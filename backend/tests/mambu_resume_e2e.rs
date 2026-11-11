//! A sync run that keeps being interrupted is not started again for ever. Ignored by default.
//!
//! Run: TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/coopdata_test22 \
//!      cargo test --test mambu_resume_e2e -- --ignored --nocapture

mod common;

use std::sync::Arc;

use common::mambu::{fake_mambu, serve};
use coop_data_backend::services::mambu::client::MambuApiClient;
use coop_data_backend::services::mambu::sync::resume_interrupted_runs;
use sea_orm::ConnectionTrait;

#[tokio::test]
#[ignore]
async fn a_run_interrupted_three_times_is_failed_not_resumed() {
    let Ok(url) = std::env::var("TEST_DATABASE_URL") else {
        eprintln!("TEST_DATABASE_URL not set, skipping");
        return;
    };
    let conn = sea_orm::Database::connect(&url).await.unwrap();
    for sql in [
        "INSERT INTO federations (id, keycloak_id, display_name) VALUES ('00000000-0000-0000-0000-0000000000f7', 'kc-fed-r', 'Fed')",
        "INSERT INTO apexes (id, keycloak_id, federation_id, organization_keycloak_id, display_name) VALUES ('00000000-0000-0000-0000-0000000000a7', 'kc-apex-r', '00000000-0000-0000-0000-0000000000f7', 'kc-org', 'Apex')",
        "INSERT INTO cooperatives (id, keycloak_id, apex_id, display_name, name, institution_type) VALUES ('00000000-0000-0000-0000-0000000000c7', 'kc-coop-r', '00000000-0000-0000-0000-0000000000a7', 'Resume SACCO', 'resume-sacco-r', 'sacco')",
    ] {
        conn.execute_unprepared(sql).await.unwrap();
    }
    let base = serve(fake_mambu()).await;
    let app = common::mock::TestApp::with_db(sea_orm::Database::connect(&url).await.unwrap()).await;
    let mut state = app.state;
    state.mambu_client = Some(Arc::new(MambuApiClient::with_api_key(&base, "test", 200)));

    let coop = uuid::Uuid::parse_str("00000000-0000-0000-0000-0000000000c7").unwrap();
    let run = state.mambu_repo.create_run(2025, 0, None, 1).await.unwrap();
    state
        .mambu_repo
        .create_item(run.id, Some(coop), "ES0006", "pending")
        .await
        .unwrap();
    for _ in 0..3 {
        state.mambu_repo.bump_resume_count(run.id).await.unwrap();
    }

    resume_interrupted_runs(&state).await;

    let run = state.mambu_repo.find_run(run.id).await.unwrap().unwrap();
    assert_eq!(run.status, "failed");
    assert!(run
        .error
        .as_deref()
        .unwrap_or_default()
        .contains("interrupted 3 times"));
    let items = state.mambu_repo.list_items(run.id).await.unwrap();
    assert_eq!(items.len(), 1);
    assert_eq!(items[0].status, "failed");
    assert_eq!(run.resume_count, 3, "a failed run is not counted again");
}

#[tokio::test]
#[ignore]
async fn the_progress_of_an_item_is_stored_and_cleared_by_its_result() {
    let Ok(url) = std::env::var("TEST_DATABASE_URL") else {
        eprintln!("TEST_DATABASE_URL not set, skipping");
        return;
    };
    let conn = sea_orm::Database::connect(&url).await.unwrap();
    let app = common::mock::TestApp::with_db(sea_orm::Database::connect(&url).await.unwrap()).await;
    let state = app.state;
    conn.execute_unprepared("SELECT 1").await.unwrap();

    let run = state.mambu_repo.create_run(2025, 0, None, 1).await.unwrap();
    let item = state
        .mambu_repo
        .create_item(run.id, None, "ES0005", "pending")
        .await
        .unwrap();
    state
        .mambu_repo
        .set_item_progress(item.id, "reading_deposits", 83_770, 126_350)
        .await
        .unwrap();

    let stored = &state.mambu_repo.list_items(run.id).await.unwrap()[0];
    assert_eq!(stored.phase.as_deref(), Some("reading_deposits"));
    assert_eq!(
        (stored.records_read, stored.records_total),
        (83_770, 126_350)
    );

    let mut done = item.clone();
    done.status = "synced".into();
    state.mambu_repo.save_item(done).await.unwrap();
    let stored = &state.mambu_repo.list_items(run.id).await.unwrap()[0];
    assert_eq!(stored.phase, None, "the result clears the phase");
}
