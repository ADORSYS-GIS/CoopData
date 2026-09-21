mod common;

use common::mock_db::{
    apex_claims, apex_row, cooperative_claims, cooperative_row, federation_claims, federation_row,
    ministry_claims, mock_postgres, submission_row, MockDbApp, MockKeycloak,
};
use coop_data_backend::auth::TenantIsolation;
use coop_data_backend::entities::enums::{ReviewTier, SubmissionStatus};

use uuid::Uuid;

// ─── World state shared by most tests ──────────────────────────────────────

struct World {
    apex_id: Uuid,
    fed_id: Uuid,
    coop_a_id: Uuid,
    coop_b_id: Uuid,
    sub_a: Uuid,
    sub_b: Uuid,
}

impl World {
    fn new() -> Self {
        World {
            apex_id: Uuid::new_v4(),
            fed_id: Uuid::new_v4(),
            coop_a_id: Uuid::new_v4(),
            coop_b_id: Uuid::new_v4(),
            sub_a: Uuid::new_v4(),
            sub_b: Uuid::new_v4(),
        }
    }
}

const APEX_NAME: &str = "apex-name";
const APEX_GROUP_ID: &str = "apex-group-uuid";
const COOP_A_GROUP: &str = "coop-a-group-uuid";
const COOP_B_GROUP: &str = "coop-b-group-uuid";

// ─── 1. Ministry sees everything ────────────────────────────────────────────

#[tokio::test]
async fn ministry_can_access_any_submission() {
    let world = World::new();
    let sub_a = submission_row(
        world.sub_a,
        world.coop_a_id,
        SubmissionStatus::Submitted,
        ReviewTier::Apex,
    );
    let sub_b = submission_row(
        world.sub_b,
        world.coop_b_id,
        SubmissionStatus::Draft,
        ReviewTier::Cooperative,
    );
    let coop_a = cooperative_row(world.coop_a_id, COOP_A_GROUP, world.apex_id);
    let coop_b = cooperative_row(world.coop_b_id, COOP_B_GROUP, world.apex_id);

    // Ministry sequence per access: list_all → find_by_id_for_cooperatives.
    // Two accesses → 4 pops: [coops], [sub_a], [coops], [sub_b].
    let db = mock_postgres()
        .append_query_results(vec![vec![coop_a.clone(), coop_b.clone()]])
        .append_query_results(vec![vec![sub_a]])
        .append_query_results(vec![vec![coop_a, coop_b]])
        .append_query_results(vec![vec![sub_b]]);

    let app = MockDbApp::new(db).await;
    let claims = ministry_claims();

    let got = TenantIsolation::verify_submission_access(&app.state, &claims, world.sub_a)
        .await
        .expect("ministry must access coop A submission");
    assert_eq!(got.id, world.sub_a);

    let got = TenantIsolation::verify_submission_access(&app.state, &claims, world.sub_b)
        .await
        .expect("ministry must access coop B submission");
    assert_eq!(got.id, world.sub_b);
}

// ─── 2. Cooperative tier ────────────────────────────────────────────────────

#[tokio::test]
async fn cooperative_can_access_own_submission() {
    let world = World::new();
    let sub_a = submission_row(
        world.sub_a,
        world.coop_a_id,
        SubmissionStatus::Draft,
        ReviewTier::Cooperative,
    );

    // Sequence for cooperative tier:
    // 1. keycloak: token POST + group resolve (HTTP, not DB)
    // 2. cooperative_repo.find_by_keycloak_id → [coop_a]
    // 3. submission_repo.find_by_id_for_cooperatives → [sub_a]
    let db = mock_postgres().append_query_results(vec![vec![cooperative_row(
        world.coop_a_id,
        COOP_A_GROUP,
        world.apex_id,
    )]]);
    let db = db.append_query_results(vec![vec![sub_a]]);

    let kc = MockKeycloak::start(APEX_NAME, APEX_GROUP_ID, COOP_A_GROUP).await;
    let app = MockDbApp::with_mock_keycloak(db, kc.url()).await;

    let claims = cooperative_claims(COOP_A_GROUP);
    let (sub, coop) =
        TenantIsolation::verify_cooperative_owns_submission(&app.state, &claims, world.sub_a)
            .await
            .expect("coop must access own submission");
    assert_eq!(sub.id, world.sub_a);
    assert_eq!(coop.id, world.coop_a_id);
}

#[tokio::test]
async fn cooperative_cannot_access_foreign_submission() {
    let world = World::new();
    // The submission belongs to coop B, caller resolves to coop A.
    // After resolving coop A, the scoped lookup returns None → NotFound.
    let db = mock_postgres().append_query_results(vec![vec![cooperative_row(
        world.coop_a_id,
        COOP_A_GROUP,
        world.apex_id,
    )]]);
    let db = db.append_query_results(vec![
        Vec::<coop_data_backend::entities::submission::Model>::new(),
    ]);

    let kc = MockKeycloak::start(APEX_NAME, APEX_GROUP_ID, COOP_A_GROUP).await;
    let app = MockDbApp::with_mock_keycloak(db, kc.url()).await;

    let claims = cooperative_claims(COOP_A_GROUP);
    let err = TenantIsolation::verify_submission_access(&app.state, &claims, world.sub_b)
        .await
        .expect_err("foreign submission must be NotFound");
    assert!(
        matches!(err, coop_data_backend::error::AppError::NotFound(_)),
        "expected NotFound, got {err:?}"
    );
}

#[tokio::test]
async fn cooperative_cannot_enumerate_nonexistent_submission() {
    let world = World::new();
    // Same response shape as the foreign-submission case: NotFound either way.
    let db = mock_postgres().append_query_results(vec![vec![cooperative_row(
        world.coop_a_id,
        COOP_A_GROUP,
        world.apex_id,
    )]]);
    let db = db.append_query_results(vec![
        Vec::<coop_data_backend::entities::submission::Model>::new(),
    ]);

    let kc = MockKeycloak::start(APEX_NAME, APEX_GROUP_ID, COOP_A_GROUP).await;
    let app = MockDbApp::with_mock_keycloak(db, kc.url()).await;

    let claims = cooperative_claims(COOP_A_GROUP);
    let err = TenantIsolation::verify_submission_access(&app.state, &claims, Uuid::new_v4())
        .await
        .expect_err("nonexistent submission must be NotFound");
    assert!(matches!(
        err,
        coop_data_backend::error::AppError::NotFound(_)
    ));
}

// ─── 3. Apex tier ───────────────────────────────────────────────────────────

#[tokio::test]
async fn apex_can_access_submission_of_coop_in_own_group() {
    let world = World::new();
    let sub_a = submission_row(
        world.sub_a,
        world.coop_a_id,
        SubmissionStatus::Submitted,
        ReviewTier::Apex,
    );

    // Sequence for apex tier:
    // 1. keycloak: resolve_group (HTTP)
    // 2. apex_repo.find_by_keycloak_id → [apex_row]  (mock may return empty → backfill path, we return the row)
    // 3. cooperative_repo.find_by_apex_id → [coop_a]
    // 4. submission_repo.find_by_id_for_cooperatives → [sub_a]
    let db = mock_postgres()
        .append_query_results(vec![vec![apex_row(
            world.apex_id,
            APEX_GROUP_ID,
            world.fed_id,
        )]])
        .append_query_results(vec![vec![cooperative_row(
            world.coop_a_id,
            COOP_A_GROUP,
            world.apex_id,
        )]])
        .append_query_results(vec![vec![sub_a]]);

    let kc = MockKeycloak::start(APEX_NAME, APEX_GROUP_ID, COOP_A_GROUP).await;
    let app = MockDbApp::with_mock_keycloak(db, kc.url()).await;

    let claims = apex_claims(APEX_GROUP_ID);
    let (sub, apex_db_id) =
        TenantIsolation::verify_apex_owns_submission(&app.state, &claims, world.sub_a)
            .await
            .expect("apex must access submission of own cooperative");
    assert_eq!(sub.id, world.sub_a);
    assert_eq!(apex_db_id, world.apex_id);
}

#[tokio::test]
async fn apex_cannot_access_submission_of_foreign_cooperative() {
    let world = World::new();
    // Apex resolves, its coop list is [coop_a], but the submission belongs to coop B.
    let db = mock_postgres()
        .append_query_results(vec![vec![apex_row(
            world.apex_id,
            APEX_GROUP_ID,
            world.fed_id,
        )]])
        .append_query_results(vec![vec![cooperative_row(
            world.coop_a_id,
            COOP_A_GROUP,
            world.apex_id,
        )]])
        .append_query_results(vec![
            Vec::<coop_data_backend::entities::submission::Model>::new(),
        ]);

    let kc = MockKeycloak::start(APEX_NAME, APEX_GROUP_ID, COOP_A_GROUP).await;
    let app = MockDbApp::with_mock_keycloak(db, kc.url()).await;

    let claims = apex_claims(APEX_GROUP_ID);
    let err = TenantIsolation::verify_apex_owns_submission(&app.state, &claims, world.sub_b)
        .await
        .expect_err("apex must not access foreign submission");
    assert!(
        matches!(err, coop_data_backend::error::AppError::Forbidden(_)),
        "expected Forbidden, got {err:?}"
    );
}

// ─── 4. Federation tier ─────────────────────────────────────────────────────

#[tokio::test]
async fn federation_can_access_submission_under_its_apexes() {
    let world = World::new();
    let sub_a = submission_row(
        world.sub_a,
        world.coop_a_id,
        SubmissionStatus::Submitted,
        ReviewTier::Federation,
    );

    // Sequence for federation tier:
    // 1. federation_repo.find_by_keycloak_id → [federation_row]
    // 2. apex_repo.find_by_federation_id → [apex_row]
    // 3. cooperative_repo.find_by_apex_id → [coop_a]
    // 4. submission_repo.find_by_id_for_cooperatives → [sub_a]
    let db = mock_postgres()
        .append_query_results(vec![vec![federation_row(world.fed_id, "fed-kc-id")]])
        .append_query_results(vec![vec![apex_row(
            world.apex_id,
            APEX_GROUP_ID,
            world.fed_id,
        )]])
        .append_query_results(vec![vec![cooperative_row(
            world.coop_a_id,
            COOP_A_GROUP,
            world.apex_id,
        )]])
        .append_query_results(vec![vec![sub_a]]);

    let app = MockDbApp::new(db).await;

    let claims = federation_claims("fed-kc-id");
    let (sub, fed_id) =
        TenantIsolation::verify_federation_owns_submission(&app.state, &claims, world.sub_a)
            .await
            .expect("federation must access submission under its apex");
    assert_eq!(sub.id, world.sub_a);
    assert_eq!(fed_id, world.fed_id);
}

#[tokio::test]
async fn federation_cannot_access_submission_outside_its_apexes() {
    let world = World::new();
    let db = mock_postgres()
        .append_query_results(vec![vec![federation_row(world.fed_id, "fed-kc-id")]])
        .append_query_results(vec![vec![apex_row(
            world.apex_id,
            APEX_GROUP_ID,
            world.fed_id,
        )]])
        .append_query_results(vec![vec![cooperative_row(
            world.coop_a_id,
            COOP_A_GROUP,
            world.apex_id,
        )]])
        .append_query_results(vec![
            Vec::<coop_data_backend::entities::submission::Model>::new(),
        ]);

    let app = MockDbApp::new(db).await;

    let claims = federation_claims("fed-kc-id");
    let err = TenantIsolation::verify_federation_owns_submission(&app.state, &claims, world.sub_b)
        .await
        .expect_err("federation must not access foreign submission");
    assert!(matches!(
        err,
        coop_data_backend::error::AppError::Forbidden(_)
    ));
}

#[tokio::test]
async fn federation_without_organization_claim_is_forbidden() {
    let world = World::new();
    let db = mock_postgres();
    let app = MockDbApp::new(db).await;

    // Claims with federation role but no organization claim.
    let mut claims = federation_claims("ignored");
    claims.organization = None;

    let err = TenantIsolation::verify_federation_owns_submission(&app.state, &claims, world.sub_a)
        .await
        .expect_err("federation without org claim must be rejected");
    assert!(matches!(
        err,
        coop_data_backend::error::AppError::Forbidden(_)
    ));
}
