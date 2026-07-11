use std::net::SocketAddr;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use coop_data_backend::{
    api::routes::create_app,
    auth::JwtValidator,
    config::AppConfig,
    database,
    services::{
        ai_extraction::create_extractor, cache::CacheService, keycloak::KeycloakService,
    },
    AbnormalityFlagRepository, AccountAliasRepository, ApexRepository, AppState,
    AuditLogRepository, AuditService, CalamineNfParser, BalanceSheetLineItemRepository, ChartOfAccountsRepository,
    CooperativeRepository, ExtractionJobRepository, FarmCoopRepository,
    FederationRepository, FixedDepositRepository, LoanRepository, MemberRepository,
    FinancialStatementRepository, NonFinancialIndicatorCatalogRepository,
    NonFinancialIndicatorEntryRepository, ObjectStorageService, OrganizationRepository, SubmissionRepository,
    SubmissionReviewRepository, SubmissionSectionRepository, UploadedFileRepository,
    SavingsAccountRepository, UserRepository,
};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load .env file if present (dev convenience — production uses real env vars)
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG").unwrap_or_else(|_| "info,tower_http=debug".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let config = AppConfig::from_env()?;
    tracing::info!("Configuration loaded");

    let db = connect_db_with_retry(&config.database_url).await?;
    tracing::info!("Database connected");

    let cache = CacheService::new(&config.redis_url).await?;
    tracing::info!("Redis cache connected");

    let keycloak = KeycloakService::new(&config);

    tracing::info!("Initializing JWT validator from Keycloak JWKS...");
    let jwt_validator = init_jwt_validator_with_retry(&config).await?;
    tracing::info!("JWT validator initialized (issuer: {})", config.jwt_issuer);

    let federation_repo = FederationRepository::new(db.clone());
    let apex_repo = ApexRepository::new(db.clone());
    let cooperative_repo = CooperativeRepository::new(db.clone());
    let organization_repo = OrganizationRepository::new(db.clone());
    let user_repo = UserRepository::new(db.clone());
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
    let non_financial_indicator_catalog_repo = NonFinancialIndicatorCatalogRepository::new(db.clone());
    let non_financial_indicator_entry_repo = NonFinancialIndicatorEntryRepository::new(db.clone());
    let member_repo = MemberRepository::new(db.clone());
    let savings_account_repo = SavingsAccountRepository::new(db.clone());
    let loan_repo = LoanRepository::new(db.clone());
    let fixed_deposit_repo = FixedDepositRepository::new(db.clone());
    let farm_coop_repo = FarmCoopRepository::new(db.clone());
    let audit = AuditService::new(AuditLogRepository::new(db.clone()), user_repo.clone());

    let extractor = create_extractor(&config);
    let storage = ObjectStorageService::new(&config)?;
    let nf_excel_parser = CalamineNfParser::new();

    tracing::info!("Repositories and services initialized");

    // Seed the non-financial indicator catalog with standard indicators if empty
    seed_indicator_catalog(&non_financial_indicator_catalog_repo).await;

    let addr: SocketAddr = format!("{}:{}", config.host, config.port).parse()?;
    tracing::info!("Server listening on {}", addr);
    tracing::info!("Swagger UI available at http://{}/swagger-ui/", addr);

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
        storage,
        nf_excel_parser,
    };

    let app = create_app(state);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}

async fn init_jwt_validator_with_retry(
    config: &AppConfig,
) -> anyhow::Result<std::sync::Arc<JwtValidator>> {
    let max_retries = 30u32;
    let mut attempt = 0;

    loop {
        attempt += 1;
        match JwtValidator::from_keycloak(
            &config.keycloak_url,
            &config.keycloak_realm,
            &config.jwt_audiences(),
            &config.jwt_issuer_aliases,
        )
        .await
        {
            Ok(validator) => return Ok(std::sync::Arc::new(validator)),
            Err(e) => {
                if attempt >= max_retries {
                    tracing::error!(
                        "Failed to initialize JWT validator after {} attempts: {}",
                        attempt,
                        e
                    );
                    return Err(anyhow::anyhow!("Failed to initialize JWT validator: {}", e));
                }
                tracing::warn!(
                    attempt,
                    max_retries,
                    error = %e,
                    "Waiting for Keycloak JWKS endpoint... retrying in 2s",
                );
                tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
            }
        }
    }
}

async fn connect_db_with_retry(database_url: &str) -> anyhow::Result<coop_data_backend::Database> {
    let max_retries = 20u32;
    let mut attempt = 0;

    loop {
        attempt += 1;
        match database::connect(database_url).await {
            Ok(db) => return Ok(db),
            Err(e) => {
                if attempt >= max_retries {
                    tracing::error!(
                        "Failed to connect to database after {} attempts: {}",
                        attempt,
                        e
                    );
                    return Err(anyhow::anyhow!("Database connection failed: {}", e));
                }
                tracing::warn!(
                    attempt,
                    max_retries,
                    error = %e,
                    "Waiting for database... retrying in 3s",
                );
                tokio::time::sleep(tokio::time::Duration::from_secs(3)).await;
            }
        }
    }
}

async fn seed_indicator_catalog(repo: &NonFinancialIndicatorCatalogRepository) {
    use coop_data_backend::entities::enums::IndicatorDataType;
    use coop_data_backend::entities::non_financial_indicator_catalog::ActiveModel;
    use sea_orm::Set;

    let existing = match repo.find_all().await {
        Ok(v) => v,
        Err(e) => { tracing::warn!("Could not check indicator catalog: {}", e); return; }
    };
    if !existing.is_empty() {
        tracing::info!("Indicator catalog already seeded ({} items)", existing.len());
        return;
    }

    let now = chrono::Utc::now();
    let indicators = vec![
        // ── Governance ───────────────────────────────────────────────
        ("board_meetings_held",         "Board Meetings Held (Year)",           "Number of board/committee meetings held during the reporting year", IndicatorDataType::Number, true),
        ("agm_held",                    "AGM Held",                             "Was the Annual General Meeting held during the reporting year?",   IndicatorDataType::Boolean, true),
        ("female_board_members",        "Female Board Members",                 "Number of female members on the board or management committee",     IndicatorDataType::Number, true),
        ("total_board_members",         "Total Board Members",                  "Total number of board or management committee members",             IndicatorDataType::Number, true),
        // ── Membership ───────────────────────────────────────────────
        ("new_members_joined",          "New Members Joined",                   "Number of new members admitted during the reporting year",         IndicatorDataType::Number, true),
        ("members_exited",              "Members Exited",                       "Number of members who left or were expelled during the year",      IndicatorDataType::Number, true),
        ("youth_members_count",         "Youth Members (18–35)",                "Total number of youth members (aged 18–35)",                       IndicatorDataType::Number, false),
        ("women_members_count",         "Women Members",                        "Total number of female members",                                   IndicatorDataType::Number, false),
        // ── Financial Access & Products ───────────────────────────────
        ("loan_products_offered",       "Loan Products Offered",                "Number of distinct loan products currently offered to members",    IndicatorDataType::Number, false),
        ("mobile_banking_enabled",      "Mobile Banking Enabled",               "Does the cooperative offer mobile banking or USSD services?",     IndicatorDataType::Boolean, false),
        ("insurance_products_offered",  "Insurance Products Offered",           "Number of insurance products offered or bundled to members",      IndicatorDataType::Number, false),
        // ── Training & Capacity ───────────────────────────────────────
        ("trainings_conducted",         "Trainings Conducted",                  "Number of member training or financial literacy sessions held",    IndicatorDataType::Number, false),
        ("members_trained",             "Members Trained",                      "Total number of members who attended at least one training session",IndicatorDataType::Number, false),
        // ── Compliance ───────────────────────────────────────────────
        ("audited_accounts_submitted",  "Audited Accounts Submitted",           "Were audited financial accounts submitted to the regulator?",      IndicatorDataType::Boolean, true),
        ("regulatory_returns_filed",    "Regulatory Returns Filed",             "Number of regulatory returns filed on time during the year",       IndicatorDataType::Number, true),
        ("ceo_or_manager_appointed",    "CEO / Manager Appointed",              "Does the cooperative have a formally appointed CEO or manager?",   IndicatorDataType::Boolean, false),
        // ── Technology & Systems ──────────────────────────────────────
        ("core_banking_system",         "Core Banking System in Use",           "Does the cooperative use a core banking or MIS system?",          IndicatorDataType::Boolean, false),
        ("it_staff_count",              "IT Staff Count",                       "Number of full-time IT or digital-support staff",                  IndicatorDataType::Number, false),
        // ── Social Impact ─────────────────────────────────────────────
        ("community_projects_funded",   "Community Projects Funded",            "Number of community development projects financed or supported",  IndicatorDataType::Number, false),
        ("beneficiaries_of_csr",        "CSR Beneficiaries",                    "Number of individuals who benefited from CSR initiatives",        IndicatorDataType::Number, false),
    ];

    let mut seeded = 0u32;
    for (name, display, desc, dtype, required) in indicators {
        let model = ActiveModel {
            id: Set(uuid::Uuid::new_v4()),
            indicator_name: Set(name.to_string()),
            display_name: Set(display.to_string()),
            description: Set(Some(desc.to_string())),
            data_type: Set(dtype),
            coop_type: Set(None),
            is_required: Set(required),
            created_at: Set(now),
            updated_at: Set(now),
        };
        match repo.create(model).await {
            Ok(_) => seeded += 1,
            Err(e) => tracing::warn!("Skipped seeding '{}': {}", name, e),
        }
    }
    tracing::info!("Indicator catalog seeded with {} standard indicators", seeded);
}
