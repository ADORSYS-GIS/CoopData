mod common;

use sea_orm::IntoActiveModel as _;

use common::mock_db::{member_row, user_row, AgeGroup, Gender, MemberStatus, RecordingMock};
use coop_data_backend::error::AppError;
use uuid::Uuid;

#[tokio::test]
async fn membership_stats_buckets_are_computed_from_rows() {
    let coop = Uuid::new_v4();
    let rows = vec![
        member_row(
            Uuid::new_v4(),
            coop,
            "M-1",
            Gender::Male,
            AgeGroup::Under18,
            MemberStatus::Active,
            true,
        ),
        member_row(
            Uuid::new_v4(),
            coop,
            "M-2",
            Gender::Male,
            AgeGroup::Between18And35,
            MemberStatus::Active,
            false,
        ),
        member_row(
            Uuid::new_v4(),
            coop,
            "M-3",
            Gender::Female,
            AgeGroup::Between36And50,
            MemberStatus::Dormant,
            true,
        ),
        member_row(
            Uuid::new_v4(),
            coop,
            "M-4",
            Gender::Other,
            AgeGroup::Under18,
            MemberStatus::Active,
            true,
        ),
    ];

    let rm = RecordingMock::postgres().query_rows(rows).build();
    let app = rm.app().await;

    let stats = app
        .state
        .member_repo
        .get_membership_stats(coop, Uuid::new_v4())
        .await
        .expect("stats ok");

    assert_eq!(stats.male_members, 2);
    assert_eq!(stats.female_members, 1);
    assert_eq!(stats.youth_members, 3, "under-36 counts as youth");
    assert_eq!(stats.active_members, 3);
    assert_eq!(stats.inactive_members, 1);
    assert_eq!(stats.agm_attendance, 3);
}

#[tokio::test]
async fn member_find_by_coop_and_member_id_uses_both_filters() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let coop = Uuid::new_v4();
    app.state
        .member_repo
        .find_by_cooperative_and_member_id(coop, "M-77")
        .await
        .expect("query ok");

    let sql = &rm.sql()[0];
    assert!(
        sql.contains("cooperative_id"),
        "tenant filter missing: {}",
        sql
    );
    assert!(sql.contains("member_id"), "member filter missing: {}", sql);
    assert!(
        rm.binds(0).contains(&"M-77".to_string()),
        "member id bound: {:?}",
        rm.binds(0)
    );
}

#[tokio::test]
async fn member_bulk_upsert_empty_vec_never_queries() {
    let rm = RecordingMock::postgres().build();
    let app = rm.app().await;

    let n = app
        .state
        .member_repo
        .bulk_upsert(vec![])
        .await
        .expect("empty input short-circuits");

    assert_eq!(n, 0);
    assert!(rm.sql().is_empty());
}

#[tokio::test]
async fn member_bulk_upsert_dedups_by_coop_and_member_id() {
    let coop = Uuid::new_v4();
    let a = member_row(
        Uuid::new_v4(),
        coop,
        "M-1",
        Gender::Male,
        AgeGroup::Under18,
        MemberStatus::Active,
        true,
    );
    let b = member_row(
        Uuid::new_v4(),
        coop,
        "M-2",
        Gender::Female,
        AgeGroup::Under18,
        MemberStatus::Active,
        true,
    );

    let rm = RecordingMock::postgres()
        .query_rows(vec![a.clone(), b.clone()])
        .build();
    let app = rm.app().await;

    let n = app
        .state
        .member_repo
        .bulk_upsert(vec![a.into_active_model(), b.into_active_model()])
        .await
        .expect("upsert ok");

    assert_eq!(n, 2, "two distinct member_ids");
}

#[tokio::test]
async fn member_delete_by_coop_and_submission_scopes_both() {
    let rm = RecordingMock::postgres().exec(5).build();
    let app = rm.app().await;

    let n = app
        .state
        .member_repo
        .delete_by_cooperative_and_submission(Uuid::new_v4(), Uuid::new_v4())
        .await
        .expect("delete ok");

    assert_eq!(n, 5, "rows_affected decoded");
    let sql = &rm.sql()[0];
    assert!(
        sql.contains("cooperative_id") && sql.contains("submission_id"),
        "both filters: {}",
        sql
    );
}

#[tokio::test]
async fn user_find_by_email_binds_email() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    app.state
        .user_repo
        .find_by_email("a@b.c")
        .await
        .expect("query ok");

    assert!(
        rm.sql()[0].contains("email"),
        "filter missing: {}",
        rm.sql()[0]
    );
    assert!(
        rm.binds(0).contains(&"a@b.c".to_string()),
        "email bound: {:?}",
        rm.binds(0)
    );
}

#[tokio::test]
async fn user_update_role_sets_role() {
    let id = Uuid::new_v4();
    let mut before = user_row(id, "a@b.c", "cooperative");
    let mut after = before.clone();
    after.role = "ministry".to_string();
    before.role = "cooperative".to_string();

    let rm = RecordingMock::postgres()
        .query_rows(vec![before])
        .query_rows(vec![after])
        .build();
    let app = rm.app().await;

    let updated = app
        .state
        .user_repo
        .update_role(id, "ministry".to_string())
        .await
        .expect("update ok");

    assert_eq!(updated.role, "ministry");
    let binds = rm.binds(1);
    assert!(
        binds.contains(&"ministry".to_string()),
        "new role bound: {:?}",
        binds
    );
}

#[tokio::test]
async fn user_update_role_missing_row_not_found() {
    let rm = RecordingMock::postgres().query_empty().build();
    let app = rm.app().await;

    let err = app
        .state
        .user_repo
        .update_role(Uuid::new_v4(), "ministry".to_string())
        .await
        .expect_err("must be NotFound");

    assert!(matches!(err, AppError::NotFound(_)));
}

#[tokio::test]
async fn user_update_applies_only_present_fields() {
    let id = Uuid::new_v4();
    let before = user_row(id, "a@b.c", "cooperative");
    let mut after = before.clone();
    after.full_name = Some("New Name".to_string());
    after.is_active = false;

    let rm = RecordingMock::postgres()
        .query_rows(vec![before])
        .query_rows(vec![after])
        .build();
    let app = rm.app().await;

    let updated = app
        .state
        .user_repo
        .update(
            id,
            coop_data_backend::api::dto::UpdateUserRequest {
                full_name: Some("New Name".to_string()),
                role: None,
                organization_id: None,
                region: None,
                is_active: Some(false),
            },
        )
        .await
        .expect("update ok");

    assert_eq!(updated.full_name.as_deref(), Some("New Name"));
    assert!(!updated.is_active);
    assert_eq!(updated.role, "cooperative", "untouched field unchanged");
}

#[tokio::test]
async fn user_count_by_role_filters_and_decodes() {
    let rm = RecordingMock::postgres().count(7).build();
    let app = rm.app().await;

    let n = app
        .state
        .user_repo
        .count_by_role("cooperative")
        .await
        .expect("count ok");

    assert_eq!(n, 7);
    let binds = rm.binds(0);
    assert!(
        binds.contains(&"cooperative".to_string()),
        "role bound: {:?}",
        binds
    );
}

#[tokio::test]
async fn user_delete_by_keycloak_id_issues_scoped_delete() {
    let rm = RecordingMock::postgres().exec(1).build();
    let app = rm.app().await;

    app.state
        .user_repo
        .delete_by_keycloak_id("kc-123")
        .await
        .expect("delete ok");

    let sql = &rm.sql()[0];
    assert!(
        sql.contains("delete") && sql.contains("keycloak_id"),
        "scoped delete: {}",
        sql
    );
    assert!(
        rm.binds(0).contains(&"kc-123".to_string()),
        "kc id bound: {:?}",
        rm.binds(0)
    );
}
