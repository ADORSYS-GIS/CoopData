//! A Mambu user that may read the data but not list branches or products (403) can still
//! link a SACCO by its ID and sync it. Real Postgres and a stand-in Mambu server. Ignored
//! by default.
//!
//! Run: TEST_DATABASE_URL=postgres://postgres:test@localhost:55432/coopdata_test4 \
//!      cargo test --test mambu_restricted_e2e -- --ignored --nocapture

mod common;

use std::sync::Arc;

use common::mambu::{fake_mambu_restricted, scalar, serve, wait_for_run};
use coop_data_backend::auth::claims::Claims;
use coop_data_backend::services::mambu::client::MambuApiClient;
use coop_data_backend::services::mambu::linking::{link_cooperative, search_branches};
use coop_data_backend::services::mambu::sync::{start_run, SyncScope};
use sea_orm::ConnectionTrait;
use serde_json::json;
use uuid::Uuid;

const COOP: &str = "00000000-0000-0000-0000-0000000000e1";

#[tokio::test]
#[ignore]
async fn a_user_that_cannot_list_branches_and_products_still_links_and_syncs() {
    let Ok(url) = std::env::var("TEST_DATABASE_URL") else {
        eprintln!("TEST_DATABASE_URL not set, skipping");
        return;
    };
    let conn = sea_orm::Database::connect(&url).await.unwrap();
    for sql in [
        "INSERT INTO federations (id, keycloak_id, display_name) VALUES ('00000000-0000-0000-0000-0000000000f3', 'kc-fed-r', 'Fed')",
        "INSERT INTO apexes (id, keycloak_id, federation_id, organization_keycloak_id, display_name) VALUES ('00000000-0000-0000-0000-0000000000a3', 'kc-apex-r', '00000000-0000-0000-0000-0000000000f3', 'kc-org', 'Apex')",
        "INSERT INTO cooperatives (id, keycloak_id, apex_id, display_name, name, institution_type, region) VALUES ('00000000-0000-0000-0000-0000000000e1', 'kc-coop-r', '00000000-0000-0000-0000-0000000000a3', 'Asikhutulisane SACCO', 'asikhutulisane-r', 'sacco', 'Manzini')",
    ] {
        conn.execute_unprepared(sql).await.unwrap();
    }

    let base = serve(fake_mambu_restricted()).await;
    let app = common::mock::TestApp::with_db(sea_orm::Database::connect(&url).await.unwrap()).await;
    let mut state = app.state;
    state.mambu_client = Some(Arc::new(MambuApiClient::with_api_key(&base, "test", 200)));
    let coop = Uuid::parse_str(COOP).unwrap();

    // A name cannot be searched, and a name is never saved as a link.
    let err = search_branches(&state, "khutu", Some(coop))
        .await
        .unwrap_err();
    assert!(err.to_string().contains("Type its Mambu ID"), "{err}");
    assert!(link_cooperative(&state, coop, "khutulisane", "tester")
        .await
        .is_err());

    // A typed ID is accepted without a name check.
    let hits = search_branches(&state, "ES0006", Some(coop)).await.unwrap();
    assert_eq!(hits.len(), 1);
    assert_eq!(hits[0].id, "ES0006");
    assert!(hits[0].name.is_none());
    assert_eq!(
        link_cooperative(&state, coop, "ES0006", "tester")
            .await
            .unwrap(),
        "ES0006"
    );

    let claims = Arc::new(
        serde_json::from_value::<Claims>(json!({
            "sub": "00000000-0000-0000-0000-0000000000b3", "exp": 4102444800u64, "iat": 0,
            "iss": "test", "name": "Test Ministry"
        }))
        .unwrap(),
    );
    let run = start_run(&state, 2026, 9, claims, SyncScope::All)
        .await
        .unwrap();
    assert_eq!(wait_for_run(&state, run.id).await, "completed");
    let items = state.mambu_repo.list_items(run.id).await.unwrap();
    assert!(items[0].error.is_none(), "{:?}", items[0].error);
    assert_ne!(items[0].status, "failed");
    assert!(items[0].members > 0);
    let warnings = items[0].warnings.to_string();
    assert!(
        warnings.contains("REFERENCE_DATA_UNAVAILABLE"),
        "{warnings}"
    );
    assert!(warnings.contains("branches"), "{warnings}");
    assert_eq!(
        scalar(
            &conn,
            "SELECT count(*) FROM submissions WHERE submission_method='mambu'"
        )
        .await,
        1
    );
}
