//! End-to-end test of the Mambu sync with the ledger rebuilt from the general ledger,
//! while the accounting reports of the stand-in Mambu do not balance. Ignored by default.
//!
//! Run: TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/coopdata_test5 \
//!      cargo test --test mambu_journal_e2e -- --ignored --nocapture

mod common;

use std::sync::Arc;

use chrono::Datelike;
use common::mambu::{fake_mambu_with_journal, scalar, serve, text, wait_for_run};
use coop_data_backend::auth::claims::Claims;
use coop_data_backend::services::mambu::client::MambuApiClient;
use coop_data_backend::services::mambu::sync::{start_run, SyncScope};
use sea_orm::ConnectionTrait;
use serde_json::json;
use uuid::Uuid;

const COOP: &str = "00000000-0000-0000-0000-0000000000c1";

#[tokio::test]
#[ignore]
async fn the_ledger_is_rebuilt_from_the_general_ledger_when_the_reports_do_not_balance() {
    let Ok(url) = std::env::var("TEST_DATABASE_URL") else {
        eprintln!("TEST_DATABASE_URL not set, skipping");
        return;
    };
    let conn = sea_orm::Database::connect(&url).await.unwrap();
    for sql in [
        "INSERT INTO federations (id, keycloak_id, display_name) VALUES ('00000000-0000-0000-0000-0000000000f4', 'kc-fed-j', 'Fed')",
        "INSERT INTO apexes (id, keycloak_id, federation_id, organization_keycloak_id, display_name) VALUES ('00000000-0000-0000-0000-0000000000a4', 'kc-apex-j', '00000000-0000-0000-0000-0000000000f4', 'kc-org', 'Apex')",
        "INSERT INTO cooperatives (id, keycloak_id, apex_id, display_name, name, institution_type) VALUES ('00000000-0000-0000-0000-0000000000c1', 'kc-coop-j', '00000000-0000-0000-0000-0000000000a4', 'Asikhutulisane SACCO', 'asikhutulisane-j', 'sacco')",
    ] {
        conn.execute_unprepared(sql).await.unwrap();
    }

    let base = serve(fake_mambu_with_journal()).await;
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
    let now = chrono::Utc::now();
    let expected_months = if now.year() > 2026 {
        12
    } else {
        now.month() as i64
    };

    let run = start_run(&state, 2026, 0, claims.clone(), SyncScope::All)
        .await
        .unwrap();
    assert_eq!(run.month, 0);
    assert_eq!(wait_for_run(&state, run.id).await, "completed");
    let items = state.mambu_repo.list_items(run.id).await.unwrap();
    assert!(items[0].error.is_none(), "{:?}", items[0].error);
    assert_ne!(items[0].status, "failed");
    let sid = items[0].submission_id.expect("submission created");

    // The lists show the ID the SACCO knows the member by, not the internal row ID.
    let member_row = text(
        &conn,
        &format!(
            "SELECT member_id::text FROM savings_accounts WHERE submission_id='{sid}' LIMIT 1"
        ),
    )
    .await;
    let ids = state
        .member_repo
        .business_ids(vec![Uuid::parse_str(&member_row).unwrap()])
        .await
        .unwrap();
    assert_eq!(ids.values().next().map(String::as_str), Some("SAP0001"));

    let row = |col: &str| format!("SELECT {col}::text FROM submissions WHERE id='{sid}'");
    assert_eq!(text(&conn, &row("period_value")).await, "FULL_YEAR");
    assert_eq!(text(&conn, &row("period_type")).await, "MONTHLY");
    assert_eq!(text(&conn, &row("status")).await, "draft");
    assert_eq!(
        scalar(
            &conn,
            "SELECT count(*) FROM submissions WHERE submission_method='mambu'"
        )
        .await,
        1,
        "one return for the whole year, not one per month"
    );
    assert_eq!(
        scalar(
            &conn,
            &format!("SELECT count(DISTINCT i.month) FROM balance_sheet_line_items i JOIN financial_statements f ON f.id=i.financial_statement_id WHERE f.submission_id='{sid}'")
        )
        .await,
        expected_months,
        "one column per month that has started"
    );
    let warnings = items[0].warnings.to_string();
    assert!(!warnings.contains("LEDGER_DOES_NOT_BALANCE"), "{warnings}");
    assert!(!warnings.contains("LEDGER_MONTHS_UNRELIABLE"), "{warnings}");
    assert!(!warnings.contains("SURPLUS_NOT_SPLIT"), "{warnings}");
    assert!(warnings.contains("LEDGER_FROM_JOURNAL"), "{warnings}");
    assert!(!warnings.contains("LEDGER_FROM_REPORTS"), "{warnings}");
    assert!(
        scalar(
            &conn,
            "SELECT count(*) FROM mambu_ledger_months WHERE mambu_branch_id='ES0006'"
        )
        .await
            > 0,
        "closed months are kept for the next sync"
    );

    // The totals the statement checks ask for are worked out from the chart formulas:
    // assets 1005 in every month, and equals liabilities plus equity.
    for (code, value) in [(1999, 1005), (2999, 400), (3999, 605)] {
        assert_eq!(
            scalar(
                &conn,
                &format!("SELECT count(*) FROM balance_sheet_line_items i JOIN financial_statements f ON f.id=i.financial_statement_id WHERE f.submission_id='{sid}' AND i.account_code={code} AND i.value={value}")
            )
            .await,
            expected_months,
            "total {code}"
        );
    }

    // The surplus is split in every month: 80 of the year, 200 before it.
    assert_eq!(
        scalar(
            &conn,
            &format!("SELECT count(*) FROM balance_sheet_line_items i JOIN financial_statements f ON f.id=i.financial_statement_id WHERE f.submission_id='{sid}' AND i.account_code=3302 AND i.value=80")
        )
        .await,
        expected_months
    );

    // Syncing the year again replaces the return, and a single month cannot sit next to it.
    conn.execute_unprepared("UPDATE mambu_sync_items SET created_at = now() - interval '1 hour'")
        .await
        .unwrap();
    let run2 = start_run(&state, 2026, 0, claims.clone(), SyncScope::All)
        .await
        .unwrap();
    assert_eq!(wait_for_run(&state, run2.id).await, "completed");
    assert_eq!(
        scalar(
            &conn,
            "SELECT count(*) FROM submissions WHERE submission_method='mambu'"
        )
        .await,
        1
    );
    conn.execute_unprepared("UPDATE mambu_sync_items SET created_at = now() - interval '1 hour'")
        .await
        .unwrap();
    let run3 = start_run(&state, 2026, 1, claims, SyncScope::All)
        .await
        .unwrap();
    assert_eq!(wait_for_run(&state, run3.id).await, "completed");
    let items3 = state.mambu_repo.list_items(run3.id).await.unwrap();
    assert_eq!(items3[0].status, "skipped");
}
