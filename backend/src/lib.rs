pub mod api;
pub mod auth;
pub mod config;
pub mod database;
pub mod entities;
pub mod error;
pub mod models;
pub mod repositories;
pub mod services;
pub mod utils;

pub use config::AppConfig;
pub use database::Database;
pub use error::{forbidden_with_roles, AppError, AppResult};
pub use repositories::audit_log::AuditLogRepository;
pub use repositories::{
    AbnormalityFlagRepository, AccountAliasRepository, ApexRepository,
    BalanceSheetLineItemRepository, ChartOfAccountsRepository, CooperativeRepository,
    ExtractionJobRepository, FederationRepository, FinancialStatementRepository,
    OrganizationRepository, SubmissionRepository, SubmissionReviewRepository,
    SubmissionSectionRepository, UploadedFileRepository, UserRepository,
};
pub use services::ai_extraction::FinancialStatementExtractor;
pub use services::keycloak::KeycloakService;
pub use services::AuditService;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub config: AppConfig,
    pub cache: crate::services::cache::CacheService,
    pub keycloak: KeycloakService,
    pub jwt_validator: std::sync::Arc<auth::JwtValidator>,
    // existing repos
    pub federation_repo: FederationRepository,
    pub apex_repo: ApexRepository,
    pub cooperative_repo: CooperativeRepository,
    pub organization_repo: OrganizationRepository,
    pub user_repo: UserRepository,
    pub audit: AuditService,
    // pipeline repos
    pub submission_repo: SubmissionRepository,
    pub uploaded_file_repo: UploadedFileRepository,
    pub extraction_job_repo: ExtractionJobRepository,
    pub financial_statement_repo: FinancialStatementRepository,
    pub line_item_repo: BalanceSheetLineItemRepository,
    pub coa_repo: ChartOfAccountsRepository,
    pub account_alias_repo: AccountAliasRepository,
    pub flag_repo: AbnormalityFlagRepository,
    pub review_repo: SubmissionReviewRepository,
    pub section_repo: SubmissionSectionRepository,
    // services
    pub storage: std::sync::Arc<dyn crate::services::object_storage::ObjectStorage>,
    pub extractor: std::sync::Arc<dyn FinancialStatementExtractor>,
}
