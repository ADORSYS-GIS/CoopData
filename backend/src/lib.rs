use uuid::Uuid;

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
    CustomKpiRepository, ExtractionJobRepository, FarmCoopRepository, FederationRepository,
    FinancialStatementRepository, FixedDepositRepository, KpiRecordRepository, LoanRepository,
    MemberRepository, NonFinancialIndicatorCatalogRepository, NonFinancialIndicatorEntryRepository,
    OrganizationRepository, SavingsAccountRepository, SubmissionRepository,
    SubmissionReviewRepository, SubmissionSectionRepository, UploadedFileRepository,
    UserRepository, QuestionnaireRepository, QuestionnaireTemplateRepository,
};
pub use services::ai_extraction::{Extractor, FinancialStatementExtractor, NfHeaderMapper};
pub use services::keycloak::KeycloakService;
pub use services::{AuditService, CalamineNfParser, ObjectStorageService};

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
    pub questionnaire_repo: QuestionnaireRepository,
    pub questionnaire_template_repo: QuestionnaireTemplateRepository,
    // non-financial indicators
    pub non_financial_indicator_catalog_repo: NonFinancialIndicatorCatalogRepository,
    pub non_financial_indicator_entry_repo: NonFinancialIndicatorEntryRepository,
    pub custom_kpi_repo: crate::repositories::custom_kpi_repository::CustomKpiRepository,
    pub kpi_record_repo: crate::repositories::kpi_record::KpiRecordRepository,
    // services
    pub extractor: std::sync::Arc<dyn Extractor>,
    pub member_repo: MemberRepository,
    pub savings_account_repo: SavingsAccountRepository,
    pub loan_repo: LoanRepository,
    pub fixed_deposit_repo: FixedDepositRepository,
    pub farm_coop_repo: FarmCoopRepository,
    pub storage: ObjectStorageService,
    pub nf_excel_parser: CalamineNfParser,
    pub gotenberg_semaphore: std::sync::Arc<tokio::sync::Semaphore>,
}

impl AppState {
    pub async fn cooperative_id_from_claims(&self, claims: &auth::Claims) -> AppResult<Uuid> {
        let coop_id_str = auth::rbac::ScopeEnforcement::get_cooperative_id(claims)?;

        if let Ok(group_uuid) = Uuid::parse_str(&coop_id_str) {
            if let Some(coop) = self
                .cooperative_repo
                .find_by_keycloak_group_id(group_uuid)
                .await?
            {
                return Ok(coop.id);
            }
        }

        let coop = self
            .cooperative_repo
            .find_by_name(&coop_id_str)
            .await?
            .ok_or_else(|| {
                AppError::BadRequest(format!(
                    "Cooperative not found by name or keycloak_group_id: {}",
                    coop_id_str
                ))
            })?;
        Ok(coop.id)
    }
}
