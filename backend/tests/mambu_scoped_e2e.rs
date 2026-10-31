//! End-to-end test of the cooperative and apex Mambu sync rules against a real
//! Postgres database and a stand-in Mambu server. Ignored by default.
//!
//! Run: TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/coopdata_test2 \
//!      cargo test --test mambu_scoped_e2e -- --ignored --nocapture

mod common;

use std::sync::Arc;

use common::mambu::{fake_mambu, scalar, serve, text, wait_for_run};
use coop_data_backend::auth::claims::Claims;
use coop_data_backend::services::mambu::client::MambuApiClient;
use coop_data_backend::services::mambu::linking::{
    ensure_branch_available, link_cooperative, search_branches,
};
use coop_data_backend::services::mambu::sync::{start_run, SyncLevel, SyncScope};
use sea_orm::ConnectionTrait;
use serde_json::json;
use uuid::Uuid;

const COOP: &str = "00000000-0000-0000-0000-0000000000c1";
const OTHER_COOP: &str = "00000000-0000-0000-0000-0000000000c2";

#[tokio::test]
#[ignore]
async fn cooperative_sync_makes_a_draft_and_the_guards_hold() {
    let Ok(url) = std::env::var("TEST_DATABASE_URL") else {
        eprintln!("TEST_DATABASE_URL not set, skipping");
        return;
    };
    let conn = sea_orm::Database::connect(&url).await.unwrap();
    for sql in [
        "INSERT INTO federations (id, keycloak_id, display_name) VALUES ('00000000-0000-0000-0000-0000000000f1', 'kc-fed-s', 'Fed')",
        "INSERT INTO apexes (id, keycloak_id, federation_id, organization_keycloak_id, display_name) VALUES ('00000000-0000-0000-0000-0000000000a1', 'kc-apex-s', '00000000-0000-0000-0000-0000000000f1', 'kc-org', 'Apex')",
        "INSERT INTO cooperatives (id, keycloak_id, apex_id, display_name, name, institution_type) VALUES ('00000000-0000-0000-0000-0000000000c1', 'kc-coop-s1', '00000000-0000-0000-0000-0000000000a1', 'Asikhutulisane SACCO', 'asikhutulisane', 'sacco')",
        "INSERT INTO cooperatives (id, keycloak_id, apex_id, display_name, name, institution_type) VALUES ('00000000-0000-0000-0000-0000000000c2', 'kc-coop-s2', '00000000-0000-0000-0000-0000000000a1', 'Other SACCO', 'other', 'sacco')",
    ] {
        conn.execute_unprepared(sql).await.unwrap();
    }

    let base = serve(fake_mambu()).await;
    let app = common::mock::TestApp::with_db(sea_orm::Database::connect(&url).await.unwrap()).await;
    let mut state = app.state;
    state.mambu_client = Some(Arc::new(MambuApiClient::with_api_key(&base, "test", 200)));
    let coop = Uuid::parse_str(COOP).unwrap();
    let other = Uuid::parse_str(OTHER_COOP).unwrap();

    // Search: by part of the name or by ID, short text refused, and a branch linked to
    // another cooperative is never listed.
    let hits = search_branches(&state, "khutuli", Some(coop))
        .await
        .unwrap();
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].id, "ES0006");
    assert_eq!(
        search_branches(&state, "es0006", None).await.unwrap().len(),
        1
    );
    assert!(search_branches(&state, "a!", None).await.is_err());
    assert!(
        search_branches(&state, "ab", None)
            .await
            .unwrap()
            .is_empty(),
        "short text matches an exact ID only"
    );
    assert!(search_branches(&state, "nothing like it", None)
        .await
        .unwrap()
        .is_empty());

    // Linking: a real branch can be linked once, an unknown one is refused, and a
    // second cooperative cannot take the same branch.
    assert!(link_cooperative(&state, coop, "NOPE", "tester")
        .await
        .is_err());
    assert_eq!(
        link_cooperative(&state, coop, "es0006", "tester")
            .await
            .unwrap(),
        "ES0006"
    );
    assert!(ensure_branch_available(&state, "ES0006", Some(other))
        .await
        .is_err());
    assert!(ensure_branch_available(&state, "ES0006", Some(coop))
        .await
        .is_ok());

    let claims = Arc::new(
        serde_json::from_value::<Claims>(json!({
            "sub": "00000000-0000-0000-0000-0000000000b1", "exp": 4102444800u64, "iat": 0,
            "iss": "test", "name": "Test Coop User"
        }))
        .unwrap(),
    );

    // A cooperative that is not linked cannot sync.
    let err = start_run(
        &state,
        2026,
        9,
        claims.clone(),
        SyncLevel::Cooperative,
        SyncScope::Cooperatives(vec![other]),
    )
    .await
    .unwrap_err();
    assert!(
        err.to_string().to_lowercase().contains("not linked"),
        "{err}"
    );

    // The cooperative sync makes a draft owned by the cooperative.
    let run = start_run(
        &state,
        2026,
        9,
        claims.clone(),
        SyncLevel::Cooperative,
        SyncScope::Cooperatives(vec![coop]),
    )
    .await
    .unwrap();
    assert_eq!(wait_for_run(&state, run.id).await, "completed");
    let items = state.mambu_repo.list_items(run.id).await.unwrap();
    assert!(items[0].error.is_none(), "{:?}", items[0].error);
    let sid = items[0].submission_id.expect("submission created");
    let row = |col: &str| format!("SELECT {col}::text FROM submissions WHERE id='{sid}'");
    assert_eq!(text(&conn, &row("status")).await, "draft");
    assert_eq!(text(&conn, &row("current_tier")).await, "cooperative");
    assert_eq!(text(&conn, &row("created_by_role")).await, "cooperative");
    assert_eq!(text(&conn, &row("submission_method")).await, "mambu");
    assert!(
        scalar(
            &conn,
            &format!("SELECT count(*) FROM members WHERE submission_id='{sid}'")
        )
        .await
            > 0
    );

    // The cooldown stops an immediate second sync of the same SACCO.
    let err = start_run(
        &state,
        2026,
        9,
        claims.clone(),
        SyncLevel::Cooperative,
        SyncScope::Cooperatives(vec![coop]),
    )
    .await
    .unwrap_err();
    assert!(err.to_string().contains("minutes ago"), "{err}");

    // The Ministry is not held back by the cooldown and replaces the draft.
    let run2 = start_run(
        &state,
        2026,
        9,
        claims.clone(),
        SyncLevel::Ministry,
        SyncScope::All,
    )
    .await
    .unwrap();
    assert_eq!(wait_for_run(&state, run2.id).await, "completed");
    assert_eq!(text(&conn, &row("status")).await, "in_review");
    assert_eq!(text(&conn, &row("current_tier")).await, "ministry");

    // A submission already in review is not overwritten by a cooperative sync.
    conn.execute_unprepared("UPDATE mambu_sync_items SET created_at = now() - interval '1 hour'")
        .await
        .unwrap();
    let claims_again = claims.clone();
    let run3 = start_run(
        &state,
        2026,
        9,
        claims,
        SyncLevel::Cooperative,
        SyncScope::Cooperatives(vec![coop]),
    )
    .await
    .unwrap();
    assert_eq!(wait_for_run(&state, run3.id).await, "completed");
    let items3 = state.mambu_repo.list_items(run3.id).await.unwrap();
    assert_eq!(items3[0].status, "skipped");
    assert!(
        items3[0]
            .error
            .as_deref()
            .unwrap_or("")
            .contains("in review"),
        "{:?}",
        items3[0].error
    );

    // Two requests for the same SACCO at the same moment: exactly one starts, and
    // the loser leaves no running run and no pending item behind.
    let starts = |level| {
        let state = state.clone();
        let claims = claims_again.clone();
        async move {
            start_run(
                &state,
                2026,
                9,
                claims,
                level,
                SyncScope::Cooperatives(vec![coop]),
            )
            .await
        }
    };
    let (a, b) = tokio::join!(starts(SyncLevel::Ministry), starts(SyncLevel::Ministry));
    let (winner, loser) = match (a, b) {
        (Ok(w), Err(l)) | (Err(l), Ok(w)) => (w, l),
        other => panic!("expected one start and one refusal, got {other:?}"),
    };
    assert!(loser.to_string().contains("already running"), "{loser}");
    assert_eq!(wait_for_run(&state, winner.id).await, "completed");
    assert_eq!(
        scalar(
            &conn,
            "SELECT count(*) FROM mambu_sync_runs WHERE status='running'"
        )
        .await,
        0
    );
    assert_eq!(
        scalar(
            &conn,
            "SELECT count(*) FROM mambu_sync_items WHERE status='pending'"
        )
        .await,
        0
    );
}
