use std::sync::Arc;

use coop_data_backend::auth::JwtValidator;
use coop_data_backend::config::Environment;
use coop_data_backend::services::{cache::CacheService, CalamineNfParser, ObjectStorageService};
use coop_data_backend::{
    AbnormalityFlagRepository, AccountAliasRepository, ApexRepository, AppConfig, AppState,
    AuditLogRepository, AuditService, BalanceSheetLineItemRepository, ChartOfAccountsRepository,
    CooperativeRepository, CustomKpiRepository, ExtractionJobRepository, FarmCoopRepository,
    FederationRepository, FinancialStatementRepository, FixedDepositRepository, KeycloakService,
    KpiRecordRepository, LoanRepository, MemberRepository, NonFinancialIndicatorCatalogRepository,
    NonFinancialIndicatorEntryRepository, OrganizationRepository, SavingsAccountRepository,
    SubmissionRepository, SubmissionReviewRepository, SubmissionSectionRepository,
    UploadedFileRepository, UserRepository,
};
use sea_orm::DatabaseConnection;

/// A test application with a disconnected database, an offline Redis client
/// (never contacted in DB-free tests), a no-op Keycloak client, and a permissive
/// JWT validator. Only suitable for tests that do not require a live backend.
pub struct TestApp {
    pub state: AppState,
}

impl TestApp {
    pub async fn new() -> Self {
        let config = test_config();
        let db = DatabaseConnection::default();
        let cache = CacheService::new("memory://")
            .await
            .expect("Failed to create cache service");
        let keycloak = KeycloakService::new(&config);
        let jwt_validator = Arc::new(JwtValidator::new_for_testing());

        let federation_repo = FederationRepository::new(db.clone());
        let apex_repo = ApexRepository::new(db.clone());
        let cooperative_repo = CooperativeRepository::new(db.clone());
        let organization_repo = OrganizationRepository::new(db.clone());
        let user_repo = UserRepository::new(db.clone());
        let audit = AuditService::new(AuditLogRepository::new(db.clone()), user_repo.clone());

        let submission_repo = SubmissionRepository::new(db.clone());
        let uploaded_file_repo = UploadedFileRepository::new(db.clone());
        let extraction_job_repo = ExtractionJobRepository::new(db.clone());
        let financial_statement_repo = FinancialStatementRepository::new(db.clone());
        let line_item_repo = BalanceSheetLineItemRepository::new(db.clone());
        let coa_repo = ChartOfAccountsRepository::new(db.clone());
        let account_alias_repo = AccountAliasRepository::new(db.clone());
        let flag_repo = AbnormalityFlagRepository::new(db.clone());
        let review_repo = SubmissionReviewRepository::new(db.clone());
        let section_repo = SubmissionSectionRepository::new(db.clone());

        let extractor = coop_data_backend::services::ai_extraction::create_extractor(&config);

        let member_repo = MemberRepository::new(db.clone());
        let savings_account_repo = SavingsAccountRepository::new(db.clone());
        let loan_repo = LoanRepository::new(db.clone());
        let fixed_deposit_repo = FixedDepositRepository::new(db.clone());
        let farm_coop_repo = FarmCoopRepository::new(db.clone());
        let storage = ObjectStorageService::new(&config)
            .await
            .expect("Failed to create object storage service");
        let nf_excel_parser = CalamineNfParser::new();

        let non_financial_indicator_catalog_repo =
            NonFinancialIndicatorCatalogRepository::new(db.clone());
        let non_financial_indicator_entry_repo =
            NonFinancialIndicatorEntryRepository::new(db.clone());
        let custom_kpi_repo = CustomKpiRepository::new(db.clone());
        let kpi_record_repo = KpiRecordRepository::new(db.clone());
        let narrative_generator = coop_data_backend::services::report_narrative::create_narrative_generator(&config);

        let state = AppState {
            db,
            config,
            cache,
            keycloak,
            jwt_validator,
            federation_repo,
            apex_repo,
            cooperative_repo,
            organization_repo,
            user_repo,
            audit,
            submission_repo,
            uploaded_file_repo,
            extraction_job_repo,
            financial_statement_repo,
            line_item_repo,
            coa_repo,
            account_alias_repo,
            flag_repo,
            review_repo,
            section_repo,
            non_financial_indicator_catalog_repo,
            non_financial_indicator_entry_repo,
            extractor,
            member_repo,
            savings_account_repo,
            loan_repo,
            fixed_deposit_repo,
            farm_coop_repo,
            custom_kpi_repo,
            kpi_record_repo,
            storage,
            gotenberg_semaphore: std::sync::Arc::new(tokio::sync::Semaphore::new(2)),
            ai_semaphore: std::sync::Arc::new(tokio::sync::Semaphore::new(2)),
            narrative_generator,
            nf_excel_parser,
        };

        TestApp { state }
    }
}

/// Build an `AppConfig` populated with dummy-but-valid values for tests.
/// No environment variables are required.
pub fn test_config() -> AppConfig {
    AppConfig {
        host: "0.0.0.0".to_string(),
        port: 3000,
        database_url: "postgres://test:test@localhost:5432/test_db".to_string(),
        redis_url: "redis://localhost:6379".to_string(),
        keycloak_url: "http://localhost:8080".to_string(),
        keycloak_realm: "test-realm".to_string(),
        keycloak_client_id: "test-client".to_string(),
        keycloak_client_secret: "test-secret".to_string(),
        jwt_issuer: "test-issuer".to_string(),
        jwt_audience: "test-audience".to_string(),
        jwt_issuer_aliases: vec![],
        frontend_url: "http://localhost:5173".to_string(),
        gotenberg_url: "http://localhost:8081".to_string(),
        gotenberg_frontend_url: "http://localhost:5173".to_string(),
        environment: Environment::Development,
        extraction_backend: "mock".to_string(),
        ai_provider_url: "https://api.openai.com/v1".to_string(),
        ai_api_key: String::new(),
        ai_model: "gpt-4o".to_string(),
        ai_vision_model: "gpt-4o".to_string(),
        ai_max_tokens: 65536,
        storage_type: "local".to_string(),
        storage_path: "/tmp/coopdata-test-uploads".to_string(),
        s3_endpoint: "http://localhost:9000".to_string(),
        s3_bucket: "test-bucket".to_string(),
        s3_access_key: "minioadmin".to_string(),
        s3_secret_key: "minioadmin".to_string(),
        s3_region: "us-east-1".to_string(),
    }
}
