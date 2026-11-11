//! The ledger cache of a linked SACCO is brought up to date in the background. Ignored by
//! default.
//!
//! Run: TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/coopdata_test24 \
//!      cargo test --test mambu_warmup_e2e -- --ignored --nocapture

mod common;

use std::sync::Arc;

use common::mambu::{fake_mambu_with_journal, serve};
use coop_data_backend::services::mambu::client::MambuApiClient;
use coop_data_backend::services::mambu::ledger_source::cache_is_current;
use coop_data_backend::services::mambu::warmup::warm_all;
use sea_orm::ConnectionTrait;
use uuid::Uuid;

const COOP: &str = "00000000-0000-0000-0000-0000000000c9";

#[tokio::test]
#[ignore]
async fn the_history_of_a_linked_sacco_is_read_once_in_the_background() {
    let Ok(url) = std::env::var("TEST_DATABASE_URL") else {
        eprintln!("TEST_DATABASE_URL not set, skipping");
        return;
    };
    let conn = sea_orm::Database::connect(&url).await.unwrap();
    for sql in [
        "INSERT INTO federations (id, keycloak_id, display_name) VALUES ('00000000-0000-0000-0000-0000000000f9', 'kc-fed-w', 'Fed')",
        "INSERT INTO apexes (id, keycloak_id, federation_id, organization_keycloak_id, display_name) VALUES ('00000000-0000-0000-0000-0000000000a9', 'kc-apex-w', '00000000-0000-0000-0000-0000000000f9', 'kc-org', 'Apex')",
        "INSERT INTO cooperatives (id, keycloak_id, apex_id, display_name, name, institution_type) VALUES ('00000000-0000-0000-0000-0000000000c9', 'kc-coop-w', '00000000-0000-0000-0000-0000000000a9', 'Warm SACCO', 'warm-sacco-w', 'sacco')",
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
    assert!(!cache_is_current(&state.mambu_repo, "ES0006").await);

    // A SACCO that is syncing right now is left to its sync.
    let run = state.mambu_repo.create_run(2025, 0, None, 1).await.unwrap();
    state
        .mambu_repo
        .create_item(run.id, Some(coop), "ES0006", "pending")
        .await
        .unwrap();
    assert_eq!(
        warm_all(&state).await.unwrap(),
        0,
        "a syncing SACCO is skipped"
    );
    assert!(!cache_is_current(&state.mambu_repo, "ES0006").await);
    state
        .mambu_repo
        .finish_run(run.id, "completed", None)
        .await
        .unwrap();
    state
        .mambu_repo
        .fail_pending_items(run.id, "done")
        .await
        .unwrap();

    assert_eq!(warm_all(&state).await.unwrap(), 1, "the history is read");
    assert!(cache_is_current(&state.mambu_repo, "ES0006").await);

    assert_eq!(
        warm_all(&state).await.unwrap(),
        0,
        "a SACCO whose history is complete is not read again"
    );
}
