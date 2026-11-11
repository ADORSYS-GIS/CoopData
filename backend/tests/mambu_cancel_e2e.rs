//! A running Mambu sync can be cancelled and started again. Ignored by default.
//!
//! Run: TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/coopdata_test23 \
//!      cargo test --test mambu_cancel_e2e -- --ignored --nocapture

mod common;

use std::sync::Arc;
use std::time::Duration;

use axum::extract::Request;
use axum::middleware::{from_fn, Next};
use axum::response::Response;
use common::mambu::{fake_mambu, scalar, serve, wait_for_run};
use coop_data_backend::auth::claims::Claims;
use coop_data_backend::services::mambu::client::MambuApiClient;
use coop_data_backend::services::mambu::sync::{
    cancel_items, start_run, SyncScope, CANCELLED_NOTE,
};
use sea_orm::ConnectionTrait;
use serde_json::json;
use uuid::Uuid;

const COOP: &str = "00000000-0000-0000-0000-0000000000c8";

/// Reading the deposit pages takes a minute, so a sync is still reading when it is
/// cancelled. The cheap count request that comes first is not slowed.
async fn slow_deposits(request: Request, next: Next) -> Response {
    let reading_a_page = request.uri().query().is_some_and(|q| q.contains("offset="));
    if request.uri().path().contains("deposits") && reading_a_page {
        tokio::time::sleep(Duration::from_secs(60)).await;
    }
    next.run(request).await
}

#[tokio::test]
#[ignore]
async fn a_sync_can_be_cancelled_while_it_reads_and_started_again() {
    let Ok(url) = std::env::var("TEST_DATABASE_URL") else {
        eprintln!("TEST_DATABASE_URL not set, skipping");
        return;
    };
    let conn = sea_orm::Database::connect(&url).await.unwrap();
    for sql in [
        "INSERT INTO federations (id, keycloak_id, display_name) VALUES ('00000000-0000-0000-0000-0000000000f8', 'kc-fed-x', 'Fed')",
        "INSERT INTO apexes (id, keycloak_id, federation_id, organization_keycloak_id, display_name) VALUES ('00000000-0000-0000-0000-0000000000a8', 'kc-apex-x', '00000000-0000-0000-0000-0000000000f8', 'kc-org', 'Apex')",
        "INSERT INTO cooperatives (id, keycloak_id, apex_id, display_name, name, institution_type) VALUES ('00000000-0000-0000-0000-0000000000c8', 'kc-coop-x', '00000000-0000-0000-0000-0000000000a8', 'Cancel SACCO', 'cancel-sacco-x', 'sacco')",
    ] {
        conn.execute_unprepared(sql).await.unwrap();
    }
    let slow = serve(fake_mambu().layer(from_fn(slow_deposits))).await;
    let fast = serve(fake_mambu()).await;
    let app = common::mock::TestApp::with_db(sea_orm::Database::connect(&url).await.unwrap()).await;
    let mut state = app.state;
    state.mambu_client = Some(Arc::new(MambuApiClient::with_api_key(&slow, "test", 200)));
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
            "sub": "00000000-0000-0000-0000-0000000000b8", "exp": 4102444800u64, "iat": 0,
            "iss": "test", "name": "Test Ministry"
        }))
        .unwrap(),
    );

    let run = start_run(&state, 2025, 0, claims.clone(), SyncScope::All)
        .await
        .unwrap();
    // Wait until the sync is reading the deposits.
    let mut reading = false;
    for _ in 0..100 {
        let items = state.mambu_repo.list_items(run.id).await.unwrap();
        if items
            .iter()
            .any(|i| i.phase.as_deref() == Some("reading_deposits"))
        {
            reading = true;
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    assert!(reading, "the sync never reached the deposits");

    let items = state.mambu_repo.list_items(run.id).await.unwrap();
    let cancelled = cancel_items(&state, run.id, items).await.unwrap();
    assert_eq!(cancelled, 1);

    assert_eq!(wait_for_run(&state, run.id).await, "cancelled");
    let items = state.mambu_repo.list_items(run.id).await.unwrap();
    assert_eq!(items[0].status, "skipped");
    assert_eq!(items[0].error.as_deref(), Some(CANCELLED_NOTE));
    assert_eq!(items[0].phase, None);
    assert_eq!(
        scalar(&conn, "SELECT count(*) FROM submissions WHERE cooperative_id = '00000000-0000-0000-0000-0000000000c8'").await,
        0,
        "a cancelled sync leaves no submission behind"
    );

    // Started again, it is not blocked by the cancelled one and completes.
    state.mambu_client = Some(Arc::new(MambuApiClient::with_api_key(&fast, "test", 200)));
    let again = start_run(&state, 2025, 0, claims, SyncScope::All)
        .await
        .unwrap();
    assert_eq!(wait_for_run(&state, again.id).await, "completed");
    let items = state.mambu_repo.list_items(again.id).await.unwrap();
    assert!(
        matches!(items[0].status.as_str(), "synced" | "flagged"),
        "status {} error {:?}",
        items[0].status,
        items[0].error
    );
    assert_eq!(
        scalar(&conn, "SELECT count(*) FROM submissions WHERE cooperative_id = '00000000-0000-0000-0000-0000000000c8'").await,
        1
    );
}

#[tokio::test]
#[ignore]
async fn a_run_nothing_is_working_on_is_closed_by_the_cancel() {
    let Ok(url) = std::env::var("TEST_DATABASE_URL") else {
        eprintln!("TEST_DATABASE_URL not set, skipping");
        return;
    };
    let app = common::mock::TestApp::with_db(sea_orm::Database::connect(&url).await.unwrap()).await;
    let state = app.state;
    // A run left running by a server that was restarted: its SACCO is pending and no
    // task works on it.
    let run = state.mambu_repo.create_run(2025, 0, None, 1).await.unwrap();
    state
        .mambu_repo
        .create_item(run.id, None, "ES0005", "pending")
        .await
        .unwrap();

    let items = state.mambu_repo.list_items(run.id).await.unwrap();
    let cancelled = cancel_items(&state, run.id, items).await.unwrap();

    assert_eq!(cancelled, 1);
    let run = state.mambu_repo.find_run(run.id).await.unwrap().unwrap();
    assert_eq!(run.status, "cancelled");
    let items = state.mambu_repo.list_items(run.id).await.unwrap();
    assert_eq!(items[0].status, "skipped");
    assert_eq!(items[0].error.as_deref(), Some(CANCELLED_NOTE));
}
