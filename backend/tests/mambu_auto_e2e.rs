//! End-to-end test of the automatic sync and of the checks before an apex submits an
//! import, against a real Postgres database and a stand-in Mambu server. Ignored by
//! default.
//!
//! Run: TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/coopdata_test10 \
//!      cargo test --test mambu_auto_e2e -- --ignored --nocapture

mod common;

use std::sync::Arc;

use chrono::{TimeZone, Utc};
use common::mambu::{fake_mambu, scalar, serve, wait_for_run};
use coop_data_backend::services::mambu::client::MambuApiClient;
use coop_data_backend::services::mambu::review_gate::{check_before_submit, ACK_REQUIRED};
use coop_data_backend::services::mambu::scheduler::tick;
use sea_orm::ConnectionTrait;
use uuid::Uuid;

const COOP: &str = "00000000-0000-0000-0000-0000000000a5";
const OTHER: &str = "00000000-0000-0000-0000-0000000000a6";

#[tokio::test]
#[ignore]
async fn the_automatic_sync_runs_once_a_month_for_the_linked_cooperatives_that_opt_in() {
    let Ok(url) = std::env::var("TEST_DATABASE_URL") else {
        eprintln!("TEST_DATABASE_URL not set, skipping");
        return;
    };
    let conn = sea_orm::Database::connect(&url).await.unwrap();
    for sql in [
        "INSERT INTO federations (id, keycloak_id, display_name) VALUES ('00000000-0000-0000-0000-0000000000f5', 'kc-fed-a', 'Fed')",
        "INSERT INTO apexes (id, keycloak_id, federation_id, organization_keycloak_id, display_name) VALUES ('00000000-0000-0000-0000-0000000000b5', 'kc-apex-a', '00000000-0000-0000-0000-0000000000f5', 'kc-org', 'Apex')",
        "INSERT INTO cooperatives (id, keycloak_id, apex_id, display_name, name, institution_type) VALUES ('00000000-0000-0000-0000-0000000000a5', 'kc-coop-a1', '00000000-0000-0000-0000-0000000000b5', 'Asikhutulisane SACCO', 'asikhutulisane-a', 'sacco')",
        "INSERT INTO cooperatives (id, keycloak_id, apex_id, display_name, name, institution_type) VALUES ('00000000-0000-0000-0000-0000000000a6', 'kc-coop-a2', '00000000-0000-0000-0000-0000000000b5', 'Other SACCO', 'other-a', 'sacco')",
    ] {
        conn.execute_unprepared(sql).await.unwrap();
    }

    let base = serve(fake_mambu()).await;
    let app = common::mock::TestApp::with_db(sea_orm::Database::connect(&url).await.unwrap()).await;
    let mut state = app.state;
    state.mambu_client = Some(Arc::new(MambuApiClient::with_api_key(&base, "test", 200)));
    let coop = Uuid::parse_str(COOP).unwrap();
    let other = Uuid::parse_str(OTHER).unwrap();
    state
        .mambu_repo
        .upsert_link(coop, "ES0006", None)
        .await
        .unwrap();
    state
        .mambu_repo
        .upsert_link(other, "ES0007", None)
        .await
        .unwrap();
    assert!(state.mambu_repo.set_auto_sync(other, false).await.unwrap());

    // Outside the night window or before the second day nothing starts.
    let too_early = Utc.with_ymd_and_hms(2026, 11, 1, 2, 0, 0).unwrap();
    let daytime = Utc.with_ymd_and_hms(2026, 11, 3, 14, 0, 0).unwrap();
    assert_eq!(tick(&state, too_early).await.unwrap(), 0);
    assert_eq!(tick(&state, daytime).await.unwrap(), 0);

    // At night only the cooperative that takes part is synced.
    let night = Utc.with_ymd_and_hms(2026, 11, 3, 2, 0, 0).unwrap();
    assert_eq!(tick(&state, night).await.unwrap(), 1);
    let run_id = Uuid::parse_str(
        &common::mambu::text(
            &conn,
            "SELECT id::text FROM mambu_sync_runs ORDER BY started_at DESC LIMIT 1",
        )
        .await,
    )
    .unwrap();
    assert_eq!(wait_for_run(&state, run_id).await, "completed");
    let items = state.mambu_repo.list_items(run_id).await.unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].cooperative_id, Some(coop));
    let sid = items[0].submission_id.expect("a draft was made");
    assert_eq!(
        scalar(
            &conn,
            &format!("SELECT count(*) FROM submissions WHERE id='{sid}' AND status='draft' AND current_tier='apex' AND period_value='FULL_YEAR'")
        )
        .await,
        1
    );
    assert_eq!(
        common::mambu::text(
            &conn,
            "SELECT started_by FROM mambu_sync_runs ORDER BY started_at DESC LIMIT 1"
        )
        .await,
        "00000000-0000-0000-0000-000000000000",
        "the run is marked as the scheduler's"
    );

    // The month is claimed: a second check in the same month starts nothing.
    assert_eq!(tick(&state, night).await.unwrap(), 0);
    // The next month it runs again.
    conn.execute_unprepared("UPDATE mambu_sync_items SET created_at = now() - interval '1 hour'")
        .await
        .unwrap();
    let next_month = Utc.with_ymd_and_hms(2026, 12, 3, 2, 0, 0).unwrap();
    assert_eq!(tick(&state, next_month).await.unwrap(), 1);

    // Before the apex submits, the warnings must be confirmed.
    let warning_level = items[0]
        .warnings
        .as_array()
        .map(|w| w.iter().any(|x| x["severity"].as_str() == Some("warning")))
        .unwrap_or(false);
    let unconfirmed = check_before_submit(&state, sid, false).await;
    let confirmed = check_before_submit(&state, sid, true).await;
    if items[0].unmapped_ledger_accounts > 0 {
        assert!(confirmed.is_err(), "unmapped accounts block the submit");
    } else if warning_level {
        assert!(unconfirmed.unwrap_err().to_string().contains(ACK_REQUIRED));
        assert!(confirmed.is_ok());
    } else {
        assert!(unconfirmed.is_ok());
    }
}
