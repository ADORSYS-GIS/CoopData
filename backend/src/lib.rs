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
    ApexRepository, CooperativeRepository, FederationRepository, FixedDepositRepository,
    LoanRepository, MemberRepository, OrganizationRepository, SavingsAccountRepository,
    UploadedFileRepository, UserRepository,
};
pub use services::keycloak::KeycloakService;
pub use services::{AuditService, CalamineNfParser, ObjectStorageService};

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub config: AppConfig,
    pub cache: crate::services::cache::CacheService,
    pub keycloak: KeycloakService,
    pub jwt_validator: std::sync::Arc<auth::JwtValidator>,
    pub federation_repo: FederationRepository,
    pub apex_repo: ApexRepository,
    pub cooperative_repo: CooperativeRepository,
    pub organization_repo: OrganizationRepository,
    pub user_repo: UserRepository,
    pub audit: AuditService,
    pub member_repo: MemberRepository,
    pub savings_account_repo: SavingsAccountRepository,
    pub loan_repo: LoanRepository,
    pub fixed_deposit_repo: FixedDepositRepository,
    pub uploaded_file_repo: UploadedFileRepository,
    pub storage: ObjectStorageService,
    pub nf_excel_parser: CalamineNfParser,
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
