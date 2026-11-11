//! Scale test of the Mambu sync with a branch as large as the biggest real SACCO: about
//! 10,000 clients and 126,000 deposit accounts. Measures how long the sync takes and how
//! much memory the process uses at its peak. Ignored by default.
//!
//! Run: TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/coopdata_test20 \
//!      cargo test --release --test mambu_scale_e2e -- --ignored --nocapture
//! Size: SCALE_CLIENTS (default 10000), SCALE_DEPOSITS_PER_CLIENT (default 13).

mod common;

use std::collections::HashMap;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use axum::extract::Query;
use axum::routing::{get, post};
use axum::{Json, Router};
use common::mambu::{scalar, serve, wait_for_run};
use coop_data_backend::auth::claims::Claims;
use coop_data_backend::services::mambu::client::MambuApiClient;
use coop_data_backend::services::mambu::sync::{start_run, SyncScope};
use sea_orm::ConnectionTrait;
use serde_json::{json, Value};
use uuid::Uuid;

const COOP: &str = "00000000-0000-0000-0000-0000000000c1";

fn env_usize(name: &str, default: usize) -> usize {
    std::env::var(name)
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(default)
}

/// Resident memory of this process in MiB.
fn rss_mib() -> u64 {
    std::fs::read_to_string("/proc/self/status")
        .ok()
        .and_then(|s| {
            s.lines()
                .find(|l| l.starts_with("VmRSS:"))
                .and_then(|l| l.split_whitespace().nth(1)?.parse::<u64>().ok())
        })
        .map(|kib| kib / 1024)
        .unwrap_or(0)
}

fn client(i: usize) -> Value {
    json!({
        "encodedKey": format!("c{i}"), "id": format!("SAP{i:06}"), "state": "ACTIVE",
        "activationDate": "2022-09-18T07:00:29+02:00", "birthDate": "1985-05-01",
        "gender": if i % 2 == 0 { "FEMALE" } else { "MALE" },
        "assignedBranchKey": "bk-es0006", "branchKey": "bk-es0006",
        "_ADL": {"RG": "MANZINI", "mcat": "Member"},
        // Real FULL responses carry much more than the sync reads.
        "extra": "x".repeat(1200)
    })
}

fn deposit(i: usize, clients: usize) -> Value {
    let kind = match i % 13 {
        0 => ("Mandatory Shares", "CURRENT_ACCOUNT"),
        1 => ("Fixed Deposit", "SAVINGS_PLAN"),
        _ => ("School Savings", "REGULAR_SAVINGS"),
    };
    json!({
        "encodedKey": format!("d{i}"), "name": kind.0, "accountType": kind.1,
        "accountState": "ACTIVE", "accountHolderKey": format!("c{}", i % clients),
        "activationDate": "2024-01-01T00:00:00+02:00",
        "maturityDate": "2027-02-06T00:00:00+02:00",
        "balances": {"totalBalance": 100 + (i % 500)},
        "extra": "x".repeat(2500)
    })
}

fn loan(i: usize, clients: usize) -> Value {
    json!({
        "encodedKey": format!("l{i}"), "loanName": "Quick Loan", "accountState": "ACTIVE",
        "accountHolderKey": format!("c{}", i % clients), "accountHolderType": "CLIENT",
        "loanAmount": 5000, "balances": {"principalBalance": 1200},
        "interestSettings": {"interestRate": 2.5, "interestChargeFrequency": "EVERY_MONTH"},
        "disbursementDetails": {"disbursementDate": "2025-01-01T00:00:00+02:00",
                                "firstRepaymentDate": "2025-02-01T00:00:00+02:00"},
        "scheduleSettings": {"repaymentInstallments": 12, "repaymentPeriodCount": 1,
                             "repaymentPeriodUnit": "MONTHS"},
        "extra": "x".repeat(2000)
    })
}

type Params = Query<HashMap<String, String>>;

fn paged(
    total: usize,
    row: impl Fn(usize) -> Value + Clone + Send + Sync + 'static,
) -> axum::routing::MethodRouter {
    post(move |Query(q): Params, _body: Json<Value>| {
        let row = row.clone();
        async move {
            let offset: usize = q.get("offset").and_then(|v| v.parse().ok()).unwrap_or(0);
            let limit: usize = q.get("limit").and_then(|v| v.parse().ok()).unwrap_or(200);
            let end = (offset + limit).min(total);
            let page: Vec<Value> = (offset.min(total)..end).map(&row).collect();
            ([("items-total", total.to_string())], Json(page))
        }
    })
}

fn fake_big_mambu(clients: usize, deposits: usize, loans: usize) -> Router {
    let gl = |code: &str, kind: &str| {
        json!({"glCode": code, "name": code, "type": kind, "usage": "DETAIL",
               "currency": {"currencyCode": "SZL"}})
    };
    let line = move |date: &str, kind: &str, amount: f64, code: &str, account: &str| {
        let mut gl_account = json!({"glCode": code, "name": code, "type": account, "usage": "DETAIL",
                                    "currency": {"currencyCode": "SZL"}});
        gl_account["usage"] = json!("DETAIL");
        json!({"encodedKey": format!("{date}-{kind}-{code}"), "type": kind, "amount": amount,
               "bookingDate": format!("{date}T10:00:00+02:00"), "glAccount": gl_account})
    };
    let journal = vec![
        line("2025-03-10", "DEBIT", 1000.0, "01101", "ASSET"),
        line("2025-03-10", "CREDIT", 600.0, "5001", "LIABILITY"),
        line("2025-03-10", "CREDIT", 300.0, "6001", "EQUITY"),
        line("2025-03-10", "CREDIT", 100.0, "4001", "INCOME"),
    ];
    let _ = gl;
    Router::new()
        .route(
            "/branches",
            get(|| async {
                Json(
                    json!([{"encodedKey": "bk-es0006", "id": "ES0006", "name": "Big SACCO",
                             "state": "ACTIVE", "addresses": [{"region": "Manzini"}]}]),
                )
            }),
        )
        .route(
            "/branches/ES0006",
            get(|| async { Json(json!({"encodedKey": "bk-es0006", "id": "ES0006"})) }),
        )
        .route("/clients:search", paged(clients, client))
        .route(
            "/deposits:search",
            paged(deposits, move |i| deposit(i, clients)),
        )
        .route("/loans:search", paged(loans, move |i| loan(i, clients)))
        .route("/glaccounts", get(|| async { Json(json!([])) }))
        .route("/depositproducts", get(|| async { Json(json!([])) }))
        .route("/loanproducts", get(|| async { Json(json!([])) }))
        .route(
            "/gljournalentries:search",
            post(move |Query(q): Params, _body: Json<Value>| {
                let journal = journal.clone();
                async move {
                    let offset: usize = q.get("offset").and_then(|v| v.parse().ok()).unwrap_or(0);
                    let limit: usize = q.get("limit").and_then(|v| v.parse().ok()).unwrap_or(1000);
                    let total = journal.len();
                    let page: Vec<Value> = journal.into_iter().skip(offset).take(limit).collect();
                    ([("items-total", total.to_string())], Json(page))
                }
            }),
        )
}

#[tokio::test]
#[ignore]
async fn a_very_large_branch_syncs_fast_and_within_the_memory_budget() {
    let Ok(url) = std::env::var("TEST_DATABASE_URL") else {
        eprintln!("TEST_DATABASE_URL not set, skipping");
        return;
    };
    let _ = tracing_subscriber::fmt()
        .with_env_filter("warn,coop_data_backend=warn")
        .try_init();
    let clients = env_usize("SCALE_CLIENTS", 10_000);
    let deposits = clients * env_usize("SCALE_DEPOSITS_PER_CLIENT", 13);
    let loans = clients / 3;

    let conn = sea_orm::Database::connect(&url).await.unwrap();
    for sql in [
        "INSERT INTO federations (id, keycloak_id, display_name) VALUES ('00000000-0000-0000-0000-0000000000f4', 'kc-fed-s', 'Fed')",
        "INSERT INTO apexes (id, keycloak_id, federation_id, organization_keycloak_id, display_name) VALUES ('00000000-0000-0000-0000-0000000000a4', 'kc-apex-s', '00000000-0000-0000-0000-0000000000f4', 'kc-org', 'Apex')",
        "INSERT INTO cooperatives (id, keycloak_id, apex_id, display_name, name, institution_type) VALUES ('00000000-0000-0000-0000-0000000000c1', 'kc-coop-s', '00000000-0000-0000-0000-0000000000a4', 'Big SACCO', 'big-sacco-s', 'sacco')",
    ] {
        conn.execute_unprepared(sql).await.unwrap();
    }

    let base = serve(fake_big_mambu(clients, deposits, loans)).await;
    let app = common::mock::TestApp::with_db(sea_orm::Database::connect(&url).await.unwrap()).await;
    let mut state = app.state;
    state.mambu_client = Some(Arc::new(MambuApiClient::with_api_key(&base, "test", 200)));
    let coop = Uuid::parse_str(COOP).unwrap();
    state
        .mambu_repo
        .upsert_link(coop, "ES0006", None)
        .await
        .unwrap();
    for (gl, account) in [
        ("01101", 1101),
        ("5001", 2101),
        ("6001", 3101),
        ("4001", 4101),
    ] {
        state
            .mambu_repo
            .upsert_account_mapping(gl, account, 1)
            .await
            .unwrap();
    }
    let claims = Arc::new(
        serde_json::from_value::<Claims>(json!({
            "sub": "00000000-0000-0000-0000-0000000000b4", "exp": 4102444800u64, "iat": 0,
            "iss": "test", "name": "Test Ministry"
        }))
        .unwrap(),
    );

    let baseline = rss_mib();
    let peak = Arc::new(AtomicU64::new(baseline));
    let stop = Arc::new(AtomicBool::new(false));
    let sampler = {
        let (peak, stop) = (peak.clone(), stop.clone());
        tokio::spawn(async move {
            while !stop.load(Ordering::Relaxed) {
                peak.fetch_max(rss_mib(), Ordering::Relaxed);
                tokio::time::sleep(Duration::from_millis(25)).await;
            }
        })
    };

    let started = Instant::now();
    let run = start_run(&state, 2025, 0, claims, SyncScope::All)
        .await
        .unwrap();
    let status = wait_for_run(&state, run.id).await;
    let elapsed = started.elapsed();
    stop.store(true, Ordering::Relaxed);
    let _ = sampler.await;

    let peak_mib = peak.load(Ordering::Relaxed);
    println!(
        "SCALE clients={clients} deposits={deposits} loans={loans} status={status} \
         seconds={:.1} baseline_mib={baseline} peak_mib={peak_mib} growth_mib={}",
        elapsed.as_secs_f64(),
        peak_mib.saturating_sub(baseline)
    );
    assert_eq!(status, "completed");
    let items = state.mambu_repo.list_items(run.id).await.unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(
        items[0].status, "synced",
        "item error: {:?}",
        items[0].error
    );
    assert_eq!(items[0].members as usize, clients);
    let rows = scalar(&conn, "SELECT count(*) FROM savings_accounts").await;
    assert!(rows > 0);
    let budget = env_usize("SCALE_PEAK_BUDGET_MIB", 600) as u64;
    assert!(
        peak_mib.saturating_sub(baseline) < budget,
        "memory grew by {} MiB, budget {budget} MiB",
        peak_mib.saturating_sub(baseline)
    );
}
