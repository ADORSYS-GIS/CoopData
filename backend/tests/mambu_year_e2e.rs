//! End-to-end test of the whole-year Mambu sync against a real Postgres database and a
//! stand-in Mambu server. Ignored by default.
//!
//! Run: TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/coopdata_test3 \
//!      cargo test --test mambu_year_e2e -- --ignored --nocapture

mod common;

use std::sync::Arc;

use chrono::Datelike;
use common::mambu::{fake_mambu, scalar, serve, text, wait_for_run};
use coop_data_backend::auth::claims::Claims;
use coop_data_backend::services::mambu::client::MambuApiClient;
use coop_data_backend::services::mambu::sync::{start_run, SyncScope};
use sea_orm::ConnectionTrait;
use serde_json::json;
use uuid::Uuid;

const COOP: &str = "00000000-0000-0000-0000-0000000000d1";

#[tokio::test]
#[ignore]
async fn a_whole_year_sync_makes_one_full_year_return_with_a_column_per_month() {
    let Ok(url) = std::env::var("TEST_DATABASE_URL") else {
        eprintln!("TEST_DATABASE_URL not set, skipping");
        return;
    };
    let conn = sea_orm::Database::connect(&url).await.unwrap();
    for sql in [
        "INSERT INTO federations (id, keycloak_id, display_name) VALUES ('00000000-0000-0000-0000-0000000000f2', 'kc-fed-y', 'Fed')",
        "INSERT INTO apexes (id, keycloak_id, federation_id, organization_keycloak_id, display_name) VALUES ('00000000-0000-0000-0000-0000000000a2', 'kc-apex-y', '00000000-0000-0000-0000-0000000000f2', 'kc-org', 'Apex')",
        "INSERT INTO cooperatives (id, keycloak_id, apex_id, display_name, name, institution_type) VALUES ('00000000-0000-0000-0000-0000000000d1', 'kc-coop-y', '00000000-0000-0000-0000-0000000000a2', 'Asikhutulisane SACCO', 'asikhutulisane-y', 'sacco')",
    ] {
        conn.execute_unprepared(sql).await.unwrap();
    }

    let base = serve(fake_mambu()).await;
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
            "sub": "00000000-0000-0000-0000-0000000000b2", "exp": 4102444800u64, "iat": 0,
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

    // The surplus is split in every month: 80 of the year, 200 before it.
    assert_eq!(
        scalar(
            &conn,
            &format!("SELECT count(*) FROM balance_sheet_line_items i JOIN financial_statements f ON f.id=i.financial_statement_id WHERE f.submission_id='{sid}' AND i.account_code=3302 AND i.value=80")
        )
        .await,
        expected_months
    );

    // A year that already has a submission is never imported again, whole or by month.
    conn.execute_unprepared("UPDATE mambu_sync_items SET created_at = now() - interval '1 hour'")
        .await
        .unwrap();
    for month in [0, 1] {
        let again = start_run(&state, 2026, month, claims.clone(), SyncScope::All).await;
        let message = again
            .err()
            .expect("a second sync must be refused")
            .to_string();
        assert!(message.contains("already exists"), "{message}");
    }
    assert_eq!(
        scalar(
            &conn,
            "SELECT count(*) FROM submissions WHERE submission_method='mambu'"
        )
        .await,
        1
    );

    // The link is fixed once the cooperative has been synced.
    assert!(state
        .mambu_repo
        .has_synced(COOP.parse().unwrap())
        .await
        .unwrap());
}
