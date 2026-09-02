use chrono::{NaiveDate, Utc};
use rust_decimal::Decimal;
use sea_orm::ActiveValue;
use sea_orm::DatabaseBackend;
use sea_orm::prelude::Uuid;
use sea_orm::MockDatabase;
use coop_data_backend::api::dto::UpdateUserRequest;
use coop_data_backend::entities::enums::{
    AccountCategory, AccountType, AgeGroup, CoopStatus, CooperativeSector, CooperativeType,
    DpdCategory, EswatiniRegion, Gender, LoanStatus, MemberStatus, PeriodType, ReviewTier,
    SubmissionCreatedByRole, SubmissionStatus, UrbanRural, AccountingYear, Currency,
};
use coop_data_backend::entities::{
    apex, balance_sheet_line_item, cooperative, federation, financial_statement, loan,
    member, savings_account, submission, user,
};
use coop_data_backend::repositories::{
    ApexRepository, BalanceSheetLineItemRepository, CooperativeRepository,
    FederationRepository, FinancialStatementRepository, LoanRepository, MemberRepository,
    SavingsAccountRepository, SubmissionRepository, UserRepository,
};

// =============================================================================
// SUBMISSION REPOSITORY TESTS
// =============================================================================

fn mock_submission(id: Uuid, cooperative_id: Uuid, status: SubmissionStatus) -> submission::Model {
    submission::Model {
        id,
        reference: None,
        cooperative_id,
        reporting_year: 2025,
        period_type: PeriodType::Yearly,
        period_value: "FY2025".to_string(),
        status,
        current_tier: ReviewTier::Cooperative,
        submitted_by: None,
        submitted_at: None,
        last_reviewed_by: None,
        last_reviewed_at: None,
        rejection_reason: None,
        priority: "normal".to_string(),
        metadata: serde_json::json!({}),
        submission_method: "manual".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
        created_by_role: SubmissionCreatedByRole::Cooperative,
        created_by_user_id: None,
        created_by_name: None,
        edited_by: None,
        edited_by_name: None,
    }
}

mod submission_repo {
    use super::*;

    #[tokio::test]
    async fn find_by_id_returns_some_when_found() {
        let id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let sub = mock_submission(id, coop_id, SubmissionStatus::Draft);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![sub.clone()]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.find_by_id(id).await.unwrap();

        assert!(result.is_some());
        assert_eq!(result.unwrap().id, id);
    }

    #[tokio::test]
    async fn find_by_id_returns_none_when_not_found() {
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.find_by_id(id).await.unwrap();

        assert!(result.is_none());
    }

    #[tokio::test]
    async fn find_by_cooperative_returns_submissions() {
        let coop_id = Uuid::new_v4();
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_submission(id1, coop_id, SubmissionStatus::Draft),
                mock_submission(id2, coop_id, SubmissionStatus::Submitted),
            ]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.find_by_cooperative(coop_id).await.unwrap();

        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn find_by_cooperative_returns_empty_when_no_submissions() {
        let coop_id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.find_by_cooperative(coop_id).await.unwrap();

        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn find_by_status_approved_includes_submitted() {
        let id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_submission(id, coop_id, SubmissionStatus::Approved),
            ]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.find_by_status(SubmissionStatus::Approved).await.unwrap();

        assert_eq!(result.len(), 1);
    }

    #[tokio::test]
    async fn find_by_status_draft_returns_only_draft() {
        let id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_submission(id, coop_id, SubmissionStatus::Draft),
            ]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.find_by_status(SubmissionStatus::Draft).await.unwrap();

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].status, SubmissionStatus::Draft);
    }

    #[tokio::test]
    async fn find_by_tier_returns_submissions() {
        let coop_id = Uuid::new_v4();
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_submission(id, coop_id, SubmissionStatus::InReview),
            ]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.find_by_tier(ReviewTier::Cooperative).await.unwrap();

        assert_eq!(result.len(), 1);
    }

    #[tokio::test]
    async fn find_by_cooperative_and_year_returns_some() {
        let coop_id = Uuid::new_v4();
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_submission(id, coop_id, SubmissionStatus::Draft),
            ]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.find_by_cooperative_and_year(coop_id, 2025).await.unwrap();

        assert!(result.is_some());
    }

    #[tokio::test]
    async fn find_by_cooperative_and_year_returns_none_when_not_found() {
        let coop_id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.find_by_cooperative_and_year(coop_id, 2025).await.unwrap();

        assert!(result.is_none());
    }

    #[tokio::test]
    async fn find_by_cooperative_and_period_returns_some() {
        let coop_id = Uuid::new_v4();
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_submission(id, coop_id, SubmissionStatus::Draft),
            ]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.find_by_cooperative_and_period(
            coop_id, 2025, PeriodType::Yearly, "FY2025",
        ).await.unwrap();

        assert!(result.is_some());
    }

    #[tokio::test]
    async fn count_by_reporting_year_returns_count() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![5u8]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.count_by_reporting_year(2025).await.unwrap();

        assert_eq!(result, 5);
    }

    #[tokio::test]
    async fn find_by_cooperative_ids_returns_submissions() {
        let coop_id1 = Uuid::new_v4();
        let coop_id2 = Uuid::new_v4();
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_submission(id1, coop_id1, SubmissionStatus::Draft),
                mock_submission(id2, coop_id2, SubmissionStatus::Draft),
            ]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.find_by_cooperative_ids(vec![coop_id1, coop_id2]).await.unwrap();

        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn find_by_cooperative_ids_returns_empty_for_empty_list() {
        let db = MockDatabase::new(DatabaseBackend::Postgres);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.find_by_cooperative_ids(vec![]).await.unwrap();

        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn find_all_non_draft_excludes_draft() {
        let coop_id = Uuid::new_v4();
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_submission(id, coop_id, SubmissionStatus::Submitted),
            ]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.find_all_non_draft().await.unwrap();

        assert_eq!(result.len(), 1);
        assert_ne!(result[0].status, SubmissionStatus::Draft);
    }

    #[tokio::test]
    async fn find_by_cooperative_ids_and_tier_returns_filtered() {
        let coop_id = Uuid::new_v4();
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_submission(id, coop_id, SubmissionStatus::InReview),
            ]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.find_by_cooperative_ids_and_tier(vec![coop_id], ReviewTier::Cooperative).await.unwrap();

        assert_eq!(result.len(), 1);
    }

    #[tokio::test]
    async fn find_by_cooperative_ids_and_tier_returns_empty_for_empty_list() {
        let db = MockDatabase::new(DatabaseBackend::Postgres);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.find_by_cooperative_ids_and_tier(vec![], ReviewTier::Cooperative).await.unwrap();

        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn create_inserts_submission() {
        let coop_id = Uuid::new_v4();
        let id = Uuid::new_v4();
        let sub = mock_submission(id, coop_id, SubmissionStatus::Draft);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![sub.clone()]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.create(sub.clone().into()).await.unwrap();

        assert_eq!(result.id, id);
    }

    #[tokio::test]
    async fn delete_removes_submission() {
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.delete(id).await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn update_metadata_patches_existing_metadata() {
        let id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let existing = mock_submission(id, coop_id, SubmissionStatus::Draft);

        let updated = submission::Model {
            metadata: serde_json::json!({"key": "value"}),
            ..existing.clone()
        };

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![existing], vec![updated]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.update_metadata(id, serde_json::json!({"key": "value"})).await.unwrap();

        assert_eq!(result.metadata["key"], "value");
    }

    #[tokio::test]
    async fn update_status_changes_status_and_tier() {
        let id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let existing = mock_submission(id, coop_id, SubmissionStatus::Draft);

        let updated = submission::Model {
            status: SubmissionStatus::Submitted,
            current_tier: ReviewTier::Cooperative,
            ..existing.clone()
        };

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![existing], vec![updated]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.update_status(id, SubmissionStatus::Submitted, ReviewTier::Cooperative).await.unwrap();

        assert_eq!(result.status, SubmissionStatus::Submitted);
    }

    #[tokio::test]
    async fn update_submission_method_changes_method() {
        let id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let existing = mock_submission(id, coop_id, SubmissionStatus::Draft);

        let updated = submission::Model {
            submission_method: "excel_import".to_string(),
            ..existing.clone()
        };

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![existing], vec![updated]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.update_submission_method(id, "excel_import".to_string()).await.unwrap();

        assert_eq!(result.submission_method, "excel_import");
    }

    #[tokio::test]
    async fn update_period_changes_period_info() {
        let id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let existing = mock_submission(id, coop_id, SubmissionStatus::Draft);

        let updated = submission::Model {
            period_type: PeriodType::Quarterly,
            period_value: "Q1".to_string(),
            ..existing.clone()
        };

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![existing], vec![updated]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.update_period(id, PeriodType::Quarterly, "Q1".to_string()).await.unwrap();

        assert_eq!(result.period_type, PeriodType::Quarterly);
        assert_eq!(result.period_value, "Q1");
    }

    #[tokio::test]
    async fn set_current_tier_changes_tier() {
        let id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let existing = mock_submission(id, coop_id, SubmissionStatus::InReview);

        let updated = submission::Model {
            current_tier: ReviewTier::Apex,
            ..existing.clone()
        };

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![existing], vec![updated]]);

        let repo = SubmissionRepository::new(db.into_connection());
        let result = repo.set_current_tier(id, ReviewTier::Apex).await.unwrap();

        assert_eq!(result.current_tier, ReviewTier::Apex);
    }
}

// =============================================================================
// COOPERATIVE REPOSITORY TESTS
// =============================================================================

fn mock_cooperative(id: Uuid, name: &str) -> cooperative::Model {
    cooperative::Model {
        id,
        keycloak_id: "kc-123".to_string(),
        apex_id: Uuid::new_v4(),
        display_name: name.to_string(),
        keycloak_group_id: None,
        apex_group_id: None,
        federation_org_id: None,
        name: name.to_string(),
        institution_type: Some(CooperativeType::Sacco),
        reg_no: Some("REG123".to_string()),
        tin: Some("TIN123".to_string()),
        address: None,
        georeference: None,
        region: Some(EswatiniRegion::Manzini),
        geographic_classif: Some(UrbanRural::Urban),
        phone: None,
        sector: Some(CooperativeSector::Finance),
        responsible_financial: None,
        responsible_non_financial: None,
        status: CoopStatus::Active,
        registered_on: Some(NaiveDate::from_ymd_opt(2020, 1, 15).unwrap()),
        accounting_year: AccountingYear::Calendar,
        tier: "tier1".to_string(),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

mod cooperative_repo {
    use super::*;

    #[tokio::test]
    async fn find_by_keycloak_id_returns_some_when_found() {
        let id = Uuid::new_v4();
        let coop = mock_cooperative(id, "Test Coop");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![coop.clone()]]);

        let repo = CooperativeRepository::new(db.into_connection());
        let result = repo.find_by_keycloak_id("kc-123").await.unwrap();

        assert!(result.is_some());
        assert_eq!(result.unwrap().id, id);
    }

    #[tokio::test]
    async fn find_by_keycloak_id_returns_none_when_not_found() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = CooperativeRepository::new(db.into_connection());
        let result = repo.find_by_keycloak_id("nonexistent").await.unwrap();

        assert!(result.is_none());
    }

    #[tokio::test]
    async fn find_by_id_returns_some_when_found() {
        let id = Uuid::new_v4();
        let coop = mock_cooperative(id, "Test Coop");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![coop.clone()]]);

        let repo = CooperativeRepository::new(db.into_connection());
        let result = repo.find_by_id(id).await.unwrap();

        assert!(result.is_some());
    }

    #[tokio::test]
    async fn find_by_id_returns_none_when_not_found() {
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = CooperativeRepository::new(db.into_connection());
        let result = repo.find_by_id(id).await.unwrap();

        assert!(result.is_none());
    }

    #[tokio::test]
    async fn find_by_keycloak_group_id_returns_some() {
        let id = Uuid::new_v4();
        let group_id = Uuid::new_v4();
        let coop = cooperative::Model {
            keycloak_group_id: Some(group_id),
            ..mock_cooperative(id, "Test Coop")
        };

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![coop.clone()]]);

        let repo = CooperativeRepository::new(db.into_connection());
        let result = repo.find_by_keycloak_group_id(group_id).await.unwrap();

        assert!(result.is_some());
    }

    #[tokio::test]
    async fn find_by_name_returns_some() {
        let id = Uuid::new_v4();
        let coop = mock_cooperative(id, "Eswatini Sacco");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![coop.clone()]]);

        let repo = CooperativeRepository::new(db.into_connection());
        let result = repo.find_by_name("Eswatini Sacco").await.unwrap();

        assert!(result.is_some());
        assert_eq!(result.unwrap().name, "Eswatini Sacco");
    }

    #[tokio::test]
    async fn find_by_reg_no_returns_some() {
        let id = Uuid::new_v4();
        let coop = mock_cooperative(id, "Test Coop");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![coop.clone()]]);

        let repo = CooperativeRepository::new(db.into_connection());
        let result = repo.find_by_reg_no("REG123").await.unwrap();

        assert!(result.is_some());
    }

    #[tokio::test]
    async fn find_by_apex_id_returns_cooperatives() {
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_cooperative(id1, "Coop A"),
                mock_cooperative(id2, "Coop B"),
            ]]);

        let repo = CooperativeRepository::new(db.into_connection());
        let result = repo.find_by_apex_id(Uuid::new_v4()).await.unwrap();

        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn find_by_ids_returns_cooperatives() {
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_cooperative(id1, "Coop A"),
                mock_cooperative(id2, "Coop B"),
            ]]);

        let repo = CooperativeRepository::new(db.into_connection());
        let result = repo.find_by_ids(vec![id1, id2]).await.unwrap();

        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn find_by_ids_returns_empty_for_empty_list() {
        let db = MockDatabase::new(DatabaseBackend::Postgres);

        let repo = CooperativeRepository::new(db.into_connection());
        let result = repo.find_by_ids(vec![]).await.unwrap();

        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn list_all_returns_all_cooperatives() {
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();
        let id3 = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_cooperative(id1, "Coop A"),
                mock_cooperative(id2, "Coop B"),
                mock_cooperative(id3, "Coop C"),
            ]]);

        let repo = CooperativeRepository::new(db.into_connection());
        let result = repo.list_all().await.unwrap();

        assert_eq!(result.len(), 3);
    }

    #[tokio::test]
    async fn create_inserts_cooperative() {
        let id = Uuid::new_v4();
        let coop = mock_cooperative(id, "New Coop");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![coop.clone()]]);

        let repo = CooperativeRepository::new(db.into_connection());
        let result = repo.create(coop.clone().into()).await.unwrap();

        assert_eq!(result.id, id);
    }

    #[tokio::test]
    async fn update_updates_cooperative() {
        let id = Uuid::new_v4();
        let coop = mock_cooperative(id, "Updated Coop");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![coop.clone()]]);

        let repo = CooperativeRepository::new(db.into_connection());
        let result = repo.update(coop.clone().into()).await.unwrap();

        assert_eq!(result.id, id);
    }

    #[tokio::test]
    async fn delete_removes_cooperative() {
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = CooperativeRepository::new(db.into_connection());
        let result = repo.delete(id).await;

        assert!(result.is_ok());
    }
}

// =============================================================================
// MEMBER REPOSITORY TESTS
// =============================================================================

fn mock_member(id: Uuid, cooperative_id: Uuid, member_id: &str) -> member::Model {
    member::Model {
        id,
        cooperative_id,
        submission_id: None,
        member_id: member_id.to_string(),
        join_date: NaiveDate::from_ymd_opt(2020, 1, 15).unwrap(),
        status: MemberStatus::Active,
        exit_date: None,
        gender: Gender::Male,
        age_group: AgeGroup::Between18And35,
        region: EswatiniRegion::Manzini,
        urban_rural: UrbanRural::Urban,
        agm_attendance: true,
        leadership_role: None,
        voting_exercised: true,
        share_balance: Decimal::new(1000, 2),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

mod member_repo {
    use super::*;

    #[tokio::test]
    async fn find_by_id_returns_some_when_found() {
        let id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let m = mock_member(id, coop_id, "M001");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![m.clone()]]);

        let repo = MemberRepository::new(db.into_connection());
        let result = repo.find_by_id(id).await.unwrap();

        assert!(result.is_some());
        assert_eq!(result.unwrap().id, id);
    }

    #[tokio::test]
    async fn find_by_id_returns_none_when_not_found() {
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = MemberRepository::new(db.into_connection());
        let result = repo.find_by_id(id).await.unwrap();

        assert!(result.is_none());
    }

    #[tokio::test]
    async fn find_by_cooperative_id_returns_paginated_members() {
        let coop_id = Uuid::new_v4();
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![
                vec![mock_member(id1, coop_id, "M001"), mock_member(id2, coop_id, "M002")],
                vec![2u8],
            ]);

        let repo = MemberRepository::new(db.into_connection());
        let result = repo.find_by_cooperative_id(coop_id, None, 1, 10).await.unwrap();

        assert_eq!(result.0.len(), 2);
        assert_eq!(result.1, 2);
    }

    #[tokio::test]
    async fn find_by_cooperative_id_with_submission_id_filters() {
        let coop_id = Uuid::new_v4();
        let sub_id = Uuid::new_v4();
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![
                vec![mock_member(id, coop_id, "M001")],
                vec![1u8],
            ]);

        let repo = MemberRepository::new(db.into_connection());
        let result = repo.find_by_cooperative_id(coop_id, Some(sub_id), 1, 10).await.unwrap();

        assert_eq!(result.0.len(), 1);
    }

    #[tokio::test]
    async fn create_inserts_member() {
        let id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let m = mock_member(id, coop_id, "M001");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![m.clone()]]);

        let repo = MemberRepository::new(db.into_connection());
        let result = repo.create(m.clone().into()).await.unwrap();

        assert_eq!(result.id, id);
    }

    #[tokio::test]
    async fn update_updates_member() {
        let id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let m = mock_member(id, coop_id, "M001");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![m.clone()]]);

        let repo = MemberRepository::new(db.into_connection());
        let result = repo.update(m.clone().into()).await.unwrap();

        assert_eq!(result.id, id);
    }

    #[tokio::test]
    async fn delete_removes_member() {
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = MemberRepository::new(db.into_connection());
        let result = repo.delete(id).await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn count_by_cooperative_returns_count() {
        let coop_id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![1u8]]);

        let repo = MemberRepository::new(db.into_connection());
        let result = repo.count_by_cooperative(coop_id).await.unwrap();

        assert_eq!(result, 1);
    }

    #[tokio::test]
    async fn bulk_upsert_returns_count() {
        let coop_id = Uuid::new_v4();
        let m = mock_member(Uuid::new_v4(), coop_id, "M001");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = MemberRepository::new(db.into_connection());
        let result = repo.bulk_upsert(vec![m.into()]).await.unwrap();

        assert_eq!(result, 1);
    }

    #[tokio::test]
    async fn bulk_upsert_returns_zero_for_empty_list() {
        let db = MockDatabase::new(DatabaseBackend::Postgres);

        let repo = MemberRepository::new(db.into_connection());
        let result = repo.bulk_upsert(vec![]).await.unwrap();

        assert_eq!(result, 0);
    }

    #[tokio::test]
    async fn delete_by_cooperative_and_submission_returns_rows_affected() {
        let coop_id = Uuid::new_v4();
        let sub_id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = MemberRepository::new(db.into_connection());
        let result = repo.delete_by_cooperative_and_submission(coop_id, sub_id).await.unwrap();

        assert_eq!(result, 0);
    }

    #[tokio::test]
    async fn delete_by_cooperative_returns_rows_affected() {
        let coop_id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = MemberRepository::new(db.into_connection());
        let result = repo.delete_by_cooperative(coop_id).await.unwrap();

        assert_eq!(result, 0);
    }

    #[tokio::test]
    async fn find_by_cooperative_and_member_id_returns_some() {
        let coop_id = Uuid::new_v4();
        let id = Uuid::new_v4();
        let m = mock_member(id, coop_id, "M001");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![m.clone()]]);

        let repo = MemberRepository::new(db.into_connection());
        let result = repo.find_by_cooperative_and_member_id(coop_id, "M001").await.unwrap();

        assert!(result.is_some());
    }

    #[tokio::test]
    async fn find_all_by_cooperative_and_submission_returns_members() {
        let coop_id = Uuid::new_v4();
        let sub_id = Uuid::new_v4();
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_member(id, coop_id, "M001"),
            ]]);

        let repo = MemberRepository::new(db.into_connection());
        let result = repo.find_all_by_cooperative_and_submission(coop_id, Some(sub_id)).await.unwrap();

        assert_eq!(result.len(), 1);
    }

    #[tokio::test]
    async fn get_membership_stats_returns_correct_counts() {
        let coop_id = Uuid::new_v4();
        let sub_id = Uuid::new_v4();

        let male_active = member::Model {
            gender: Gender::Male,
            age_group: AgeGroup::Between18And35,
            status: MemberStatus::Active,
            agm_attendance: true,
            ..mock_member(Uuid::new_v4(), coop_id, "M001")
        };
        let female_youth = member::Model {
            gender: Gender::Female,
            age_group: AgeGroup::Under18,
            status: MemberStatus::Dormant,
            agm_attendance: false,
            ..mock_member(Uuid::new_v4(), coop_id, "M002")
        };

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![male_active, female_youth]]);

        let repo = MemberRepository::new(db.into_connection());
        let result = repo.get_membership_stats(coop_id, sub_id).await.unwrap();

        assert_eq!(result.male_members, 1);
        assert_eq!(result.female_members, 1);
        assert_eq!(result.youth_members, 2);
        assert_eq!(result.active_members, 1);
        assert_eq!(result.inactive_members, 1);
        assert_eq!(result.agm_attendance, 1);
    }
}

// =============================================================================
// FINANCIAL STATEMENT REPOSITORY TESTS
// =============================================================================

fn mock_financial_statement(id: Uuid, submission_id: Uuid, cooperative_id: Uuid) -> financial_statement::Model {
    financial_statement::Model {
        id,
        submission_id,
        cooperative_id,
        reporting_year: 2025,
        accounting_year: AccountingYear::Calendar,
        currency: Currency::Szl,
        is_validated: false,
        validation_errors: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

mod financial_statement_repo {
    use super::*;

    #[tokio::test]
    async fn find_by_id_returns_some_when_found() {
        let id = Uuid::new_v4();
        let submission_id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let fs = mock_financial_statement(id, submission_id, coop_id);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![fs.clone()]]);

        let repo = FinancialStatementRepository::new(db.into_connection());
        let result = repo.find_by_id(id).await.unwrap();

        assert!(result.is_some());
        assert_eq!(result.unwrap().id, id);
    }

    #[tokio::test]
    async fn find_by_id_returns_none_when_not_found() {
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = FinancialStatementRepository::new(db.into_connection());
        let result = repo.find_by_id(id).await.unwrap();

        assert!(result.is_none());
    }

    #[tokio::test]
    async fn find_by_submission_returns_some() {
        let id = Uuid::new_v4();
        let submission_id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let fs = mock_financial_statement(id, submission_id, coop_id);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![fs.clone()]]);

        let repo = FinancialStatementRepository::new(db.into_connection());
        let result = repo.find_by_submission(submission_id).await.unwrap();

        assert!(result.is_some());
    }

    #[tokio::test]
    async fn find_by_submission_ids_returns_statements() {
        let sub_id1 = Uuid::new_v4();
        let sub_id2 = Uuid::new_v4();
        let coop_id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_financial_statement(Uuid::new_v4(), sub_id1, coop_id),
                mock_financial_statement(Uuid::new_v4(), sub_id2, coop_id),
            ]]);

        let repo = FinancialStatementRepository::new(db.into_connection());
        let result = repo.find_by_submission_ids(vec![sub_id1, sub_id2]).await.unwrap();

        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn find_by_submission_ids_returns_empty_for_empty_list() {
        let db = MockDatabase::new(DatabaseBackend::Postgres);

        let repo = FinancialStatementRepository::new(db.into_connection());
        let result = repo.find_by_submission_ids(vec![]).await.unwrap();

        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn find_latest_by_cooperative_returns_most_recent() {
        let id = Uuid::new_v4();
        let submission_id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let fs = mock_financial_statement(id, submission_id, coop_id);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![fs.clone()]]);

        let repo = FinancialStatementRepository::new(db.into_connection());
        let result = repo.find_latest_by_cooperative(coop_id).await.unwrap();

        assert!(result.is_some());
    }

    #[tokio::test]
    async fn find_by_cooperative_ids_returns_statements() {
        let coop_id1 = Uuid::new_v4();
        let coop_id2 = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_financial_statement(Uuid::new_v4(), Uuid::new_v4(), coop_id1),
                mock_financial_statement(Uuid::new_v4(), Uuid::new_v4(), coop_id2),
            ]]);

        let repo = FinancialStatementRepository::new(db.into_connection());
        let result = repo.find_by_cooperative_ids(vec![coop_id1, coop_id2]).await.unwrap();

        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn find_by_cooperative_ids_returns_empty_for_empty_list() {
        let db = MockDatabase::new(DatabaseBackend::Postgres);

        let repo = FinancialStatementRepository::new(db.into_connection());
        let result = repo.find_by_cooperative_ids(vec![]).await.unwrap();

        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn create_inserts_financial_statement() {
        let id = Uuid::new_v4();
        let submission_id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let fs = mock_financial_statement(id, submission_id, coop_id);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![fs.clone()]]);

        let repo = FinancialStatementRepository::new(db.into_connection());
        let result = repo.create(fs.clone().into()).await.unwrap();

        assert_eq!(result.id, id);
    }

    #[tokio::test]
    async fn delete_removes_financial_statement() {
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = FinancialStatementRepository::new(db.into_connection());
        let result = repo.delete(id).await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn set_validation_errors_updates_errors() {
        let id = Uuid::new_v4();
        let submission_id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let existing = mock_financial_statement(id, submission_id, coop_id);

        let updated = financial_statement::Model {
            validation_errors: Some(serde_json::json!([{"field": "balance_sheet", "error": "missing"}])),
            ..existing.clone()
        };

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![existing], vec![updated]]);

        let repo = FinancialStatementRepository::new(db.into_connection());
        let result = repo.set_validation_errors(id, serde_json::json!([{"field": "balance_sheet", "error": "missing"}])).await.unwrap();

        assert!(result.validation_errors.is_some());
    }
}

// =============================================================================
// USER REPOSITORY TESTS
// =============================================================================

fn mock_user(id: Uuid, email: &str) -> user::Model {
    user::Model {
        id,
        keycloak_id: "kc-123".to_string(),
        email: email.to_string(),
        full_name: Some("Test User".to_string()),
        role: "cooperative_admin".to_string(),
        organization_id: None,
        region: Some("Manzini".to_string()),
        is_active: true,
        last_login_at: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
        federation_id: None,
        apex_id: None,
        cooperative_id: None,
    }
}

mod user_repo {
    use super::*;

    #[tokio::test]
    async fn find_by_id_returns_some_when_found() {
        let id = Uuid::new_v4();
        let u = mock_user(id, "test@example.com");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![u.clone()]]);

        let repo = UserRepository::new(db.into_connection());
        let result = repo.find_by_id(id).await.unwrap();

        assert!(result.is_some());
        assert_eq!(result.unwrap().id, id);
    }

    #[tokio::test]
    async fn find_by_id_returns_none_when_not_found() {
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = UserRepository::new(db.into_connection());
        let result = repo.find_by_id(id).await.unwrap();

        assert!(result.is_none());
    }

    #[tokio::test]
    async fn find_by_keycloak_id_returns_some() {
        let id = Uuid::new_v4();
        let u = mock_user(id, "test@example.com");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![u.clone()]]);

        let repo = UserRepository::new(db.into_connection());
        let result = repo.find_by_keycloak_id("kc-123").await.unwrap();

        assert!(result.is_some());
    }

    #[tokio::test]
    async fn find_by_email_returns_some() {
        let id = Uuid::new_v4();
        let u = mock_user(id, "test@example.com");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![u.clone()]]);

        let repo = UserRepository::new(db.into_connection());
        let result = repo.find_by_email("test@example.com").await.unwrap();

        assert!(result.is_some());
        assert_eq!(result.unwrap().email, "test@example.com");
    }

    #[tokio::test]
    async fn find_all_returns_all_users() {
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_user(id1, "user1@example.com"),
                mock_user(id2, "user2@example.com"),
            ]]);

        let repo = UserRepository::new(db.into_connection());
        let result = repo.find_all().await.unwrap();

        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn find_by_organization_returns_filtered_users() {
        let org_id = Uuid::new_v4();
        let id = Uuid::new_v4();
        let u = user::Model {
            organization_id: Some(org_id),
            ..mock_user(id, "user@example.com")
        };

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![u.clone()]]);

        let repo = UserRepository::new(db.into_connection());
        let result = repo.find_by_organization(org_id).await.unwrap();

        assert_eq!(result.len(), 1);
    }

    #[tokio::test]
    async fn find_by_role_returns_filtered_users() {
        let id = Uuid::new_v4();
        let u = mock_user(id, "admin@example.com");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![u.clone()]]);

        let repo = UserRepository::new(db.into_connection());
        let result = repo.find_by_role("cooperative_admin").await.unwrap();

        assert_eq!(result.len(), 1);
    }

    #[tokio::test]
    async fn find_active_returns_only_active_users() {
        let id = Uuid::new_v4();
        let u = mock_user(id, "active@example.com");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![u.clone()]]);

        let repo = UserRepository::new(db.into_connection());
        let result = repo.find_active().await.unwrap();

        assert_eq!(result.len(), 1);
        assert!(result[0].is_active);
    }

    #[tokio::test]
    async fn create_inserts_user() {
        let id = Uuid::new_v4();
        let u = mock_user(id, "new@example.com");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![u.clone()]]);

        let repo = UserRepository::new(db.into_connection());
        let result = repo.create(u.clone().into()).await.unwrap();

        assert_eq!(result.id, id);
    }

    #[tokio::test]
    async fn update_updates_user_fields() {
        let id = Uuid::new_v4();
        let existing = mock_user(id, "test@example.com");

        let updated = user::Model {
            full_name: Some("Updated Name".to_string()),
            role: "federation_admin".to_string(),
            ..existing.clone()
        };

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![existing], vec![updated]]);

        let repo = UserRepository::new(db.into_connection());
        let update_req = UpdateUserRequest {
            full_name: Some("Updated Name".to_string()),
            role: Some("federation_admin".to_string()),
            organization_id: None,
            region: None,
            is_active: None,
        };
        let result = repo.update(id, update_req).await.unwrap();

        assert_eq!(result.full_name, Some("Updated Name".to_string()));
    }

    #[tokio::test]
    async fn update_role_changes_role() {
        let id = Uuid::new_v4();
        let existing = mock_user(id, "test@example.com");

        let updated = user::Model {
            role: "ministry_viewer".to_string(),
            ..existing.clone()
        };

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![existing], vec![updated]]);

        let repo = UserRepository::new(db.into_connection());
        let result = repo.update_role(id, "ministry_viewer".to_string()).await.unwrap();

        assert_eq!(result.role, "ministry_viewer");
    }

    #[tokio::test]
    async fn update_last_login_sets_timestamp() {
        let id = Uuid::new_v4();
        let existing = mock_user(id, "test@example.com");

        let updated = user::Model {
            last_login_at: Some(Utc::now()),
            ..existing.clone()
        };

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![existing], vec![updated]]);

        let repo = UserRepository::new(db.into_connection());
        let result = repo.update_last_login(id).await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn delete_by_keycloak_id_removes_user() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = UserRepository::new(db.into_connection());
        let result = repo.delete_by_keycloak_id("kc-123").await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn delete_removes_user() {
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = UserRepository::new(db.into_connection());
        let result = repo.delete(id).await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn count_returns_total() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![5u8]]);

        let repo = UserRepository::new(db.into_connection());
        let result = repo.count().await.unwrap();

        assert_eq!(result, 5);
    }

    #[tokio::test]
    async fn count_by_role_returns_filtered_count() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![3u8]]);

        let repo = UserRepository::new(db.into_connection());
        let result = repo.count_by_role("cooperative_admin").await.unwrap();

        assert_eq!(result, 3);
    }
}

// =============================================================================
// FEDERATION REPOSITORY TESTS
// =============================================================================

fn mock_federation(id: Uuid, name: &str) -> federation::Model {
    federation::Model {
        id,
        keycloak_id: "kc-fed-123".to_string(),
        display_name: name.to_string(),
        is_active: true,
        metadata: Some(serde_json::json!({})),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

mod federation_repo {
    use super::*;

    #[tokio::test]
    async fn find_by_keycloak_id_returns_some_when_found() {
        let id = Uuid::new_v4();
        let fed = mock_federation(id, "Eswatini Federation");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![fed.clone()]]);

        let repo = FederationRepository::new(db.into_connection());
        let result = repo.find_by_keycloak_id("kc-fed-123").await.unwrap();

        assert!(result.is_some());
        assert_eq!(result.unwrap().id, id);
    }

    #[tokio::test]
    async fn find_by_keycloak_id_returns_none_when_not_found() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = FederationRepository::new(db.into_connection());
        let result = repo.find_by_keycloak_id("nonexistent").await.unwrap();

        assert!(result.is_none());
    }

    #[tokio::test]
    async fn find_by_id_returns_some_when_found() {
        let id = Uuid::new_v4();
        let fed = mock_federation(id, "Eswatini Federation");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![fed.clone()]]);

        let repo = FederationRepository::new(db.into_connection());
        let result = repo.find_by_id(id).await.unwrap();

        assert!(result.is_some());
    }

    #[tokio::test]
    async fn find_by_id_returns_none_when_not_found() {
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = FederationRepository::new(db.into_connection());
        let result = repo.find_by_id(id).await.unwrap();

        assert!(result.is_none());
    }

    #[tokio::test]
    async fn find_by_ids_returns_federations() {
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_federation(id1, "Fed A"),
                mock_federation(id2, "Fed B"),
            ]]);

        let repo = FederationRepository::new(db.into_connection());
        let result = repo.find_by_ids(vec![id1, id2]).await.unwrap();

        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn find_by_ids_returns_empty_for_empty_list() {
        let db = MockDatabase::new(DatabaseBackend::Postgres);

        let repo = FederationRepository::new(db.into_connection());
        let result = repo.find_by_ids(vec![]).await.unwrap();

        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn create_inserts_federation() {
        let id = Uuid::new_v4();
        let fed = mock_federation(id, "New Federation");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![fed.clone()]]);

        let repo = FederationRepository::new(db.into_connection());
        let result = repo.create(fed.clone().into()).await.unwrap();

        assert_eq!(result.id, id);
    }

    #[tokio::test]
    async fn delete_removes_federation() {
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = FederationRepository::new(db.into_connection());
        let result = repo.delete(id).await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn update_metadata_merges_patch_into_existing() {
        let id = Uuid::new_v4();
        let existing = federation::Model {
            metadata: Some(serde_json::json!({"region": "Manzini", "established": 2020})),
            ..mock_federation(id, "Test Fed")
        };

        let updated = federation::Model {
            metadata: Some(serde_json::json!({"region": "Manzini", "established": 2020, "contact": "email@example.com"})),
            ..existing.clone()
        };

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![existing], vec![updated]]);

        let repo = FederationRepository::new(db.into_connection());
        let result = repo.update_metadata(id, serde_json::json!({"contact": "email@example.com"})).await.unwrap();

        assert_eq!(result.metadata["contact"], "email@example.com");
        assert_eq!(result.metadata["region"], "Manzini");
    }

    #[tokio::test]
    async fn update_metadata_handles_null_metadata() {
        let id = Uuid::new_v4();
        let existing = federation::Model {
            metadata: None,
            ..mock_federation(id, "Test Fed")
        };

        let updated = federation::Model {
            metadata: Some(serde_json::json!({"new_key": "new_value"})),
            ..existing.clone()
        };

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![existing], vec![updated]]);

        let repo = FederationRepository::new(db.into_connection());
        let result = repo.update_metadata(id, serde_json::json!({"new_key": "new_value"})).await.unwrap();

        assert_eq!(result.metadata["new_key"], "new_value");
    }
}

// =============================================================================
// APEX REPOSITORY TESTS
// =============================================================================

fn mock_apex(id: Uuid, name: &str) -> apex::Model {
    apex::Model {
        id,
        keycloak_id: "kc-apex-123".to_string(),
        federation_id: Uuid::new_v4(),
        organization_keycloak_id: "org-kc-123".to_string(),
        display_name: name.to_string(),
        metadata: Some(serde_json::json!({})),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

mod apex_repo {
    use super::*;

    #[tokio::test]
    async fn find_by_keycloak_id_returns_some_when_found() {
        let id = Uuid::new_v4();
        let apex_entity = mock_apex(id, "Manzini Apex");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![apex_entity.clone()]]);

        let repo = ApexRepository::new(db.into_connection());
        let result = repo.find_by_keycloak_id("kc-apex-123").await.unwrap();

        assert!(result.is_some());
        assert_eq!(result.unwrap().id, id);
    }

    #[tokio::test]
    async fn find_by_keycloak_id_returns_none_when_not_found() {
        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = ApexRepository::new(db.into_connection());
        let result = repo.find_by_keycloak_id("nonexistent").await.unwrap();

        assert!(result.is_none());
    }

    #[tokio::test]
    async fn find_by_id_returns_some_when_found() {
        let id = Uuid::new_v4();
        let apex_entity = mock_apex(id, "Manzini Apex");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![apex_entity.clone()]]);

        let repo = ApexRepository::new(db.into_connection());
        let result = repo.find_by_id(id).await.unwrap();

        assert!(result.is_some());
    }

    #[tokio::test]
    async fn find_by_id_returns_none_when_not_found() {
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = ApexRepository::new(db.into_connection());
        let result = repo.find_by_id(id).await.unwrap();

        assert!(result.is_none());
    }

    #[tokio::test]
    async fn find_by_federation_id_returns_apexes() {
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_apex(id1, "Apex A"),
                mock_apex(id2, "Apex B"),
            ]]);

        let repo = ApexRepository::new(db.into_connection());
        let result = repo.find_by_federation_id(Uuid::new_v4()).await.unwrap();

        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn find_by_ids_returns_apexes() {
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_apex(id1, "Apex A"),
                mock_apex(id2, "Apex B"),
            ]]);

        let repo = ApexRepository::new(db.into_connection());
        let result = repo.find_by_ids(vec![id1, id2]).await.unwrap();

        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn find_by_ids_returns_empty_for_empty_list() {
        let db = MockDatabase::new(DatabaseBackend::Postgres);

        let repo = ApexRepository::new(db.into_connection());
        let result = repo.find_by_ids(vec![]).await.unwrap();

        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn list_all_returns_all_apexes() {
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_apex(id1, "Apex A"),
                mock_apex(id2, "Apex B"),
            ]]);

        let repo = ApexRepository::new(db.into_connection());
        let result = repo.list_all().await.unwrap();

        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn create_inserts_apex() {
        let id = Uuid::new_v4();
        let apex_entity = mock_apex(id, "New Apex");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![apex_entity.clone()]]);

        let repo = ApexRepository::new(db.into_connection());
        let result = repo.create(apex_entity.clone().into()).await.unwrap();

        assert_eq!(result.id, id);
    }

    #[tokio::test]
    async fn delete_removes_apex() {
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = ApexRepository::new(db.into_connection());
        let result = repo.delete(id).await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn update_metadata_merges_patch() {
        let id = Uuid::new_v4();
        let existing = apex::Model {
            metadata: Some(serde_json::json!({"contact": "old@example.com"})),
            ..mock_apex(id, "Test Apex")
        };

        let updated = apex::Model {
            metadata: Some(serde_json::json!({"contact": "old@example.com", "phone": "+2681234"})),
            ..existing.clone()
        };

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![existing], vec![updated]]);

        let repo = ApexRepository::new(db.into_connection());
        let result = repo.update_metadata(id, serde_json::json!({"phone": "+2681234"})).await.unwrap();

        assert_eq!(result.metadata["phone"], "+2681234");
        assert_eq!(result.metadata["contact"], "old@example.com");
    }
}

// =============================================================================
// BALANCE SHEET LINE ITEM REPOSITORY TESTS
// =============================================================================

fn mock_line_item(id: Uuid, fs_id: Uuid) -> balance_sheet_line_item::Model {
    balance_sheet_line_item::Model {
        id,
        financial_statement_id: fs_id,
        account_code: Some(1001),
        account_name: "Cash at Bank".to_string(),
        account_category: AccountCategory::Assets,
        account_subcategory: "Current Assets".to_string(),
        month: 12,
        value: Some(Decimal::new(50000, 2)),
        ai_confidence: None,
        ai_flagged: false,
        manually_edited: false,
        raw_label: None,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

mod balance_sheet_line_item_repo {
    use super::*;

    #[tokio::test]
    async fn find_by_financial_statement_returns_line_items() {
        let fs_id = Uuid::new_v4();
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_line_item(id1, fs_id),
                mock_line_item(id2, fs_id),
            ]]);

        let repo = BalanceSheetLineItemRepository::new(db.into_connection());
        let result = repo.find_by_financial_statement(fs_id).await.unwrap();

        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn find_by_id_returns_some_when_found() {
        let id = Uuid::new_v4();
        let fs_id = Uuid::new_v4();
        let item = mock_line_item(id, fs_id);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![item.clone()]]);

        let repo = BalanceSheetLineItemRepository::new(db.into_connection());
        let result = repo.find_by_id(id).await.unwrap();

        assert!(result.is_some());
        assert_eq!(result.unwrap().id, id);
    }

    #[tokio::test]
    async fn find_by_id_returns_none_when_not_found() {
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = BalanceSheetLineItemRepository::new(db.into_connection());
        let result = repo.find_by_id(id).await.unwrap();

        assert!(result.is_none());
    }

    #[tokio::test]
    async fn find_by_financial_statement_ids_returns_line_items() {
        let fs_id1 = Uuid::new_v4();
        let fs_id2 = Uuid::new_v4();
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![
                mock_line_item(id1, fs_id1),
                mock_line_item(id2, fs_id2),
            ]]);

        let repo = BalanceSheetLineItemRepository::new(db.into_connection());
        let result = repo.find_by_financial_statement_ids(vec![fs_id1, fs_id2]).await.unwrap();

        assert_eq!(result.len(), 2);
    }

    #[tokio::test]
    async fn find_by_financial_statement_ids_returns_empty_for_empty_list() {
        let db = MockDatabase::new(DatabaseBackend::Postgres);

        let repo = BalanceSheetLineItemRepository::new(db.into_connection());
        let result = repo.find_by_financial_statement_ids(vec![]).await.unwrap();

        assert!(result.is_empty());
    }

    #[tokio::test]
    async fn create_inserts_line_item() {
        let id = Uuid::new_v4();
        let fs_id = Uuid::new_v4();
        let item = mock_line_item(id, fs_id);

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![item.clone()]]);

        let repo = BalanceSheetLineItemRepository::new(db.into_connection());
        let result = repo.create(item.clone().into()).await.unwrap();

        assert_eq!(result.id, id);
    }

    #[tokio::test]
    async fn delete_by_financial_statement_removes_items() {
        let fs_id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = BalanceSheetLineItemRepository::new(db.into_connection());
        let result = repo.delete_by_financial_statement(fs_id).await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn delete_unmapped_by_financial_statement_returns_count() {
        let fs_id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = BalanceSheetLineItemRepository::new(db.into_connection());
        let result = repo.delete_unmapped_by_financial_statement(fs_id).await.unwrap();

        assert_eq!(result, 0);
    }

    #[tokio::test]
    async fn update_value_sets_value_and_flags() {
        let id = Uuid::new_v4();
        let fs_id = Uuid::new_v4();
        let existing = mock_line_item(id, fs_id);

        let updated = balance_sheet_line_item::Model {
            value: Some(Decimal::new(75000, 2)),
            manually_edited: true,
            ai_flagged: false,
            account_code: Some(1001),
            ..existing.clone()
        };

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![existing], vec![updated]]);

        let repo = BalanceSheetLineItemRepository::new(db.into_connection());
        let result = repo.update_value(id, Decimal::new(75000, 2), Some(1001)).await.unwrap();

        assert_eq!(result.value, Some(Decimal::new(75000, 2)));
        assert!(result.manually_edited);
        assert!(!result.ai_flagged);
    }
}

// =============================================================================
// LOAN REPOSITORY TESTS
// =============================================================================

fn mock_loan(id: Uuid, cooperative_id: Uuid, loan_id: &str) -> loan::Model {
    loan::Model {
        id,
        cooperative_id,
        submission_id: None,
        member_id: Uuid::new_v4(),
        loan_id: loan_id.to_string(),
        loan_product_type: "Personal".to_string(),
        loan_start_date: NaiveDate::from_ymd_opt(2023, 1, 15).unwrap(),
        loan_maturity_date: NaiveDate::from_ymd_opt(2024, 1, 15).unwrap(),
        loan_status: LoanStatus::Performing,
        borrower_type: "Individual".to_string(),
        youth_borrower_flag: false,
        women_borrower_flag: false,
        rural_borrower_flag: false,
        repayment_regularity: "Monthly".to_string(),
        days_past_due_category: DpdCategory::Zero,
        missed_installments_count: 0,
        restructured_loan_flag: false,
        number_of_restructurings: 0,
        early_settlement_flag: false,
        multiple_loans_flag: false,
        large_borrower_flag: false,
        interest_rate: Decimal::new(12, 2),
        balance: Decimal::new(5000, 2),
        loan_amount: Decimal::new(10000, 2),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

fn make_loan_active_model(id: Uuid, cooperative_id: Uuid, loan_id: &str) -> loan::ActiveModel {
    loan::ActiveModel {
        id: ActiveValue::Set(id),
        cooperative_id: ActiveValue::Set(cooperative_id),
        submission_id: ActiveValue::Set(None),
        member_id: ActiveValue::Set(Uuid::new_v4()),
        loan_id: ActiveValue::Set(loan_id.to_string()),
        loan_product_type: ActiveValue::Set("Personal".to_string()),
        loan_start_date: ActiveValue::Set(NaiveDate::from_ymd_opt(2023, 1, 15).unwrap()),
        loan_maturity_date: ActiveValue::Set(NaiveDate::from_ymd_opt(2024, 1, 15).unwrap()),
        loan_status: ActiveValue::Set(LoanStatus::Performing),
        borrower_type: ActiveValue::Set("Individual".to_string()),
        youth_borrower_flag: ActiveValue::Set(false),
        women_borrower_flag: ActiveValue::Set(false),
        rural_borrower_flag: ActiveValue::Set(false),
        repayment_regularity: ActiveValue::Set("Monthly".to_string()),
        days_past_due_category: ActiveValue::Set(DpdCategory::Zero),
        missed_installments_count: ActiveValue::Set(0),
        restructured_loan_flag: ActiveValue::Set(false),
        number_of_restructurings: ActiveValue::Set(0),
        early_settlement_flag: ActiveValue::Set(false),
        multiple_loans_flag: ActiveValue::Set(false),
        large_borrower_flag: ActiveValue::Set(false),
        interest_rate: ActiveValue::Set(Decimal::new(12, 2)),
        balance: ActiveValue::Set(Decimal::new(5000, 2)),
        loan_amount: ActiveValue::Set(Decimal::new(10000, 2)),
        created_at: ActiveValue::NotSet,
        updated_at: ActiveValue::NotSet,
    }
}

mod loan_repo {
    use super::*;

    #[tokio::test]
    async fn find_by_id_returns_some_when_found() {
        let id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let l = mock_loan(id, coop_id, "L001");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![l.clone()]]);

        let repo = LoanRepository::new(db.into_connection());
        let result = repo.find_by_id(id).await.unwrap();

        assert!(result.is_some());
        assert_eq!(result.unwrap().id, id);
    }

    #[tokio::test]
    async fn find_by_id_returns_none_when_not_found() {
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = LoanRepository::new(db.into_connection());
        let result = repo.find_by_id(id).await.unwrap();

        assert!(result.is_none());
    }

    #[tokio::test]
    async fn find_by_cooperative_id_returns_paginated_loans() {
        let coop_id = Uuid::new_v4();
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![
                vec![mock_loan(id1, coop_id, "L001"), mock_loan(id2, coop_id, "L002")],
                vec![2u8],
            ]);

        let repo = LoanRepository::new(db.into_connection());
        let result = repo.find_by_cooperative_id(coop_id, None, 1, 10).await.unwrap();

        assert_eq!(result.0.len(), 2);
        assert_eq!(result.1, 2);
    }

    #[tokio::test]
    async fn find_by_cooperative_id_with_submission_id_filters() {
        let coop_id = Uuid::new_v4();
        let sub_id = Uuid::new_v4();
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![
                vec![mock_loan(id, coop_id, "L001")],
                vec![1u8],
            ]);

        let repo = LoanRepository::new(db.into_connection());
        let result = repo.find_by_cooperative_id(coop_id, Some(sub_id), 1, 10).await.unwrap();

        assert_eq!(result.0.len(), 1);
    }

    #[tokio::test]
    async fn create_inserts_loan() {
        let id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let l = mock_loan(id, coop_id, "L001");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![l.clone()]]);

        let repo = LoanRepository::new(db.into_connection());
        let result = repo.create(l.clone().into()).await.unwrap();

        assert_eq!(result.id, id);
    }

    #[tokio::test]
    async fn update_updates_loan() {
        let id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let l = mock_loan(id, coop_id, "L001");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![l.clone()]]);

        let repo = LoanRepository::new(db.into_connection());
        let result = repo.update(l.clone().into()).await.unwrap();

        assert_eq!(result.id, id);
    }

    #[tokio::test]
    async fn delete_removes_loan() {
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = LoanRepository::new(db.into_connection());
        let result = repo.delete(id).await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn delete_by_cooperative_and_submission_returns_rows_affected() {
        let coop_id = Uuid::new_v4();
        let sub_id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = LoanRepository::new(db.into_connection());
        let result = repo.delete_by_cooperative_and_submission(coop_id, sub_id).await.unwrap();

        assert_eq!(result, 0);
    }

    #[tokio::test]
    async fn delete_by_cooperative_returns_rows_affected() {
        let coop_id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = LoanRepository::new(db.into_connection());
        let result = repo.delete_by_cooperative(coop_id).await.unwrap();

        assert_eq!(result, 0);
    }

    #[tokio::test]
    async fn bulk_upsert_inserts_and_returns_count() {
        let coop_id = Uuid::new_v4();
        let id = Uuid::new_v4();
        let model = make_loan_active_model(id, coop_id, "L001");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = LoanRepository::new(db.into_connection());
        let result = repo.bulk_upsert(vec![model]).await.unwrap();

        assert_eq!(result, 1);
    }

    #[tokio::test]
    async fn bulk_upsert_returns_zero_for_empty_list() {
        let db = MockDatabase::new(DatabaseBackend::Postgres);

        let repo = LoanRepository::new(db.into_connection());
        let result = repo.bulk_upsert(vec![]).await.unwrap();

        assert_eq!(result, 0);
    }

    #[tokio::test]
    async fn bulk_upsert_dedupes_by_cooperative_and_loan_id() {
        let coop_id = Uuid::new_v4();
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();
        let model1 = make_loan_active_model(id1, coop_id, "L001");
        let model2 = make_loan_active_model(id2, coop_id, "L001");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = LoanRepository::new(db.into_connection());
        let result = repo.bulk_upsert(vec![model1, model2]).await.unwrap();

        assert_eq!(result, 1);
    }
}

// =============================================================================
// SAVINGS ACCOUNT REPOSITORY TESTS
// =============================================================================

fn mock_savings_account(id: Uuid, cooperative_id: Uuid, savings_account_id: &str) -> savings_account::Model {
    savings_account::Model {
        id,
        cooperative_id,
        submission_id: None,
        member_id: Uuid::new_v4(),
        savings_account_id: savings_account_id.to_string(),
        account_type: AccountType::Voluntary,
        account_opening_date: NaiveDate::from_ymd_opt(2020, 1, 15).unwrap(),
        account_status: "Active".to_string(),
        contribution_frequency: "Monthly".to_string(),
        last_contribution_date: NaiveDate::from_ymd_opt(2024, 12, 15).unwrap(),
        number_of_contributions: 12,
        balance_trend: "Increasing".to_string(),
        zero_balance_flag: false,
        withdrawal_frequency_category: "Rarely".to_string(),
        emergency_withdrawals_flag: false,
        interest_rate: Decimal::new(5, 2),
        balance: Decimal::new(5000, 2),
        created_at: Utc::now(),
        updated_at: Utc::now(),
    }
}

fn make_savings_active_model(id: Uuid, cooperative_id: Uuid, savings_account_id: &str) -> savings_account::ActiveModel {
    savings_account::ActiveModel {
        id: ActiveValue::Set(id),
        cooperative_id: ActiveValue::Set(cooperative_id),
        submission_id: ActiveValue::Set(None),
        member_id: ActiveValue::Set(Uuid::new_v4()),
        savings_account_id: ActiveValue::Set(savings_account_id.to_string()),
        account_type: ActiveValue::Set(AccountType::Voluntary),
        account_opening_date: ActiveValue::Set(NaiveDate::from_ymd_opt(2020, 1, 15).unwrap()),
        account_status: ActiveValue::Set("Active".to_string()),
        contribution_frequency: ActiveValue::Set("Monthly".to_string()),
        last_contribution_date: ActiveValue::Set(NaiveDate::from_ymd_opt(2024, 12, 15).unwrap()),
        number_of_contributions: ActiveValue::Set(12),
        balance_trend: ActiveValue::Set("Increasing".to_string()),
        zero_balance_flag: ActiveValue::Set(false),
        withdrawal_frequency_category: ActiveValue::Set("Rarely".to_string()),
        emergency_withdrawals_flag: ActiveValue::Set(false),
        interest_rate: ActiveValue::Set(Decimal::new(5, 2)),
        balance: ActiveValue::Set(Decimal::new(5000, 2)),
        created_at: ActiveValue::NotSet,
        updated_at: ActiveValue::NotSet,
    }
}

mod savings_account_repo {
    use super::*;

    #[tokio::test]
    async fn find_by_id_returns_some_when_found() {
        let id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let sa = mock_savings_account(id, coop_id, "SA001");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![sa.clone()]]);

        let repo = SavingsAccountRepository::new(db.into_connection());
        let result = repo.find_by_id(id).await.unwrap();

        assert!(result.is_some());
        assert_eq!(result.unwrap().id, id);
    }

    #[tokio::test]
    async fn find_by_id_returns_none_when_not_found() {
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = SavingsAccountRepository::new(db.into_connection());
        let result = repo.find_by_id(id).await.unwrap();

        assert!(result.is_none());
    }

    #[tokio::test]
    async fn find_by_cooperative_id_returns_paginated_accounts() {
        let coop_id = Uuid::new_v4();
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![
                vec![mock_savings_account(id1, coop_id, "SA001"), mock_savings_account(id2, coop_id, "SA002")],
                vec![2u8],
            ]);

        let repo = SavingsAccountRepository::new(db.into_connection());
        let result = repo.find_by_cooperative_id(coop_id, None, 1, 10).await.unwrap();

        assert_eq!(result.0.len(), 2);
        assert_eq!(result.1, 2);
    }

    #[tokio::test]
    async fn find_by_cooperative_id_with_submission_id_filters() {
        let coop_id = Uuid::new_v4();
        let sub_id = Uuid::new_v4();
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![
                vec![mock_savings_account(id, coop_id, "SA001")],
                vec![1u8],
            ]);

        let repo = SavingsAccountRepository::new(db.into_connection());
        let result = repo.find_by_cooperative_id(coop_id, Some(sub_id), 1, 10).await.unwrap();

        assert_eq!(result.0.len(), 1);
    }

    #[tokio::test]
    async fn create_inserts_savings_account() {
        let id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let sa = mock_savings_account(id, coop_id, "SA001");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![sa.clone()]]);

        let repo = SavingsAccountRepository::new(db.into_connection());
        let result = repo.create(sa.clone().into()).await.unwrap();

        assert_eq!(result.id, id);
    }

    #[tokio::test]
    async fn update_updates_savings_account() {
        let id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let sa = mock_savings_account(id, coop_id, "SA001");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![sa.clone()]]);

        let repo = SavingsAccountRepository::new(db.into_connection());
        let result = repo.update(sa.clone().into()).await.unwrap();

        assert_eq!(result.id, id);
    }

    #[tokio::test]
    async fn delete_removes_savings_account() {
        let id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = SavingsAccountRepository::new(db.into_connection());
        let result = repo.delete(id).await;

        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn delete_by_cooperative_and_submission_returns_rows_affected() {
        let coop_id = Uuid::new_v4();
        let sub_id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = SavingsAccountRepository::new(db.into_connection());
        let result = repo.delete_by_cooperative_and_submission(coop_id, sub_id).await.unwrap();

        assert_eq!(result, 0);
    }

    #[tokio::test]
    async fn delete_by_cooperative_returns_rows_affected() {
        let coop_id = Uuid::new_v4();

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = SavingsAccountRepository::new(db.into_connection());
        let result = repo.delete_by_cooperative(coop_id).await.unwrap();

        assert_eq!(result, 0);
    }

    #[tokio::test]
    async fn bulk_upsert_inserts_and_returns_count() {
        let coop_id = Uuid::new_v4();
        let id = Uuid::new_v4();
        let model = make_savings_active_model(id, coop_id, "SA001");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = SavingsAccountRepository::new(db.into_connection());
        let result = repo.bulk_upsert(vec![model]).await.unwrap();

        assert_eq!(result, 1);
    }

    #[tokio::test]
    async fn bulk_upsert_returns_zero_for_empty_list() {
        let db = MockDatabase::new(DatabaseBackend::Postgres);

        let repo = SavingsAccountRepository::new(db.into_connection());
        let result = repo.bulk_upsert(vec![]).await.unwrap();

        assert_eq!(result, 0);
    }

    #[tokio::test]
    async fn bulk_upsert_dedupes_by_cooperative_and_savings_account_id() {
        let coop_id = Uuid::new_v4();
        let id1 = Uuid::new_v4();
        let id2 = Uuid::new_v4();
        let model1 = make_savings_active_model(id1, coop_id, "SA001");
        let model2 = make_savings_active_model(id2, coop_id, "SA001");

        let db = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![vec![]]);

        let repo = SavingsAccountRepository::new(db.into_connection());
        let result = repo.bulk_upsert(vec![model1, model2]).await.unwrap();

        assert_eq!(result, 1);
    }
}