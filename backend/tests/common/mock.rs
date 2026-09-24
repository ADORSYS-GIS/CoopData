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
    NonFinancialIndicatorEntryRepository, OrganizationLabelRepository, OrganizationRepository,
    QuestionnaireRepository, QuestionnaireTemplateRepository, SavingsAccountRepository,
    SubmissionRepository, SubmissionReviewRepository, SubmissionSectionRepository,
    UploadedFileRepository, UserRepository,
};
use sea_orm::DatabaseConnection as SeaConnection;

/// A test application with a disconnected database, an offline Redis client
/// (never contacted in DB-free tests), a no-op Keycloak client, and a permissive
/// JWT validator. Only suitable for tests that do not require a live backend.
pub struct TestApp {
    pub state: AppState,
}

impl TestApp {
    pub async fn new() -> Self {
        Self::with_db(SeaConnection::default()).await
    }

    /// Build a TestApp around a caller-supplied database connection (e.g. a
    /// SeaORM `MockDatabase` connection) without touching real infrastructure.
    pub async fn with_db(db: SeaConnection) -> Self {
        Self::build_with(coop_data_backend::Database::new(db), None).await
    }

    /// Like [`TestApp::with_db`] but points the Keycloak client at a test server.
    pub async fn with_db_and_keycloak_url(db: SeaConnection, keycloak_url: String) -> Self {
        Self::build_with(coop_data_backend::Database::new(db), Some(keycloak_url)).await
    }

    pub(crate) async fn build_with(
        db: coop_data_backend::Database,
        keycloak_url: Option<String>,
    ) -> Self {
        let mut config = test_config();
        if let Some(keycloak_url) = keycloak_url {
            config.keycloak_url = keycloak_url;
        }
        let cache = CacheService::new("memory://")
            .await
            .expect("Failed to create cache service");
        let keycloak = KeycloakService::new(&config);
        let jwt_validator = Arc::new(JwtValidator::new_for_testing());

        let federation_repo = FederationRepository::new(db.clone());
        let apex_repo = ApexRepository::new(db.clone());
        let cooperative_repo = CooperativeRepository::new(db.clone());
        let organization_repo = OrganizationRepository::new(db.clone());
        let organization_label_repo = OrganizationLabelRepository::new(db.clone());
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
        let narrative_generator =
            coop_data_backend::services::report_narrative::create_narrative_generator(&config);
        let ministry_narratives_repo =
            coop_data_backend::repositories::MinistryReportNarrativesRepository::new(db.clone());
        let questionnaire_repo = QuestionnaireRepository::new(db.clone());
        let questionnaire_template_repo = QuestionnaireTemplateRepository::new(db.clone());
        let exchange_rate_repo =
            coop_data_backend::repositories::ExchangeRateRepository::new(db.clone());
        let currency_service =
            coop_data_backend::services::currency::CurrencyService::new(exchange_rate_repo.clone());

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
            organization_label_repo,
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
            questionnaire_repo,
            questionnaire_template_repo,
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
            ministry_narratives_repo,
            export_queue: coop_data_backend::services::export_generator::ExportQueue::new(),
            exchange_rate_repo,
            currency_service,
        };

        TestApp { state }
    }
}

/// Build an `AppConfig` populated with dummy-but-valid values for tests.
/// No environment variables are required.
/// Build an `AppConfig` with an overridden Keycloak URL (for the in-process
/// mock Keycloak server used by scope tests).
pub fn test_config_with_keycloak(keycloak_url: String) -> AppConfig {
    let mut config = test_config();
    config.keycloak_url = keycloak_url;
    config
}

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
        ai_api_keys: Vec::new(),
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
        rate_limit_auth_max: 5,
        rate_limit_auth_window_secs: 60,
    }
}

use axum::{
    body::Body,
    http::{Method, Request},
};
use tower::util::ServiceExt;

/// Cooperative group path embedded in coop-admin test tokens. Must match the
/// path the `MockKeycloak` stub resolves (apex "test-apex", coop "test-coop").
pub const COOP_GROUP_PATH: &str = "/test-apex/test-coop";

/// Mints a structurally valid (unsigned-check) HS256 JWT carrying `roles`.
/// The permissive `JwtValidator::new_for_testing` accepts any signature but
/// still requires `iss == ""` (its test issuer) and `aud == "test-audience"`.
fn mint_test_token(roles: &[&str]) -> String {
    mint_token_with_claims(roles, None)
}

/// Same as [`mint_test_token`] but with an optional `cooperation` claim
/// (group paths), required by handlers that resolve the caller's cooperative.
fn mint_token_with_claims(roles: &[&str], cooperation: Option<Vec<String>>) -> String {
    use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};

    let claims = serde_json::json!({
        "sub": uuid::Uuid::new_v4().to_string(),
        "exp": 9999999999usize,
        "iat": 0usize,
        "iss": "",
        "aud": "test-audience",
        "preferred_username": "test-user",
        "email": "user@test.example",
        "realm_access": { "roles": roles },
        "cooperation": cooperation.unwrap_or_default(),
    });
    encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(b"test-secret"),
    )
    .expect("mint test JWT")
}

pub struct TestRequestBuilder {
    app: axum::Router,
    method: Method,
    uri: String,
    body: Body,
    headers: Vec<(String, String)>,
    auth: Option<String>,
}

pub struct TestResponse {
    status: u16,
    body: axum::body::Bytes,
}

impl TestApp {
    pub fn request(&self) -> TestRequestBuilder {
        TestRequestBuilder {
            app: coop_data_backend::api::routes::api::create_app(self.state.clone()),
            method: Method::GET,
            uri: "/".to_string(),
            body: Body::empty(),
            headers: vec![],
            auth: None,
        }
    }
}

impl TestRequestBuilder {
    pub fn method(mut self, method: Method) -> Self {
        self.method = method;
        self
    }

    pub fn uri(mut self, uri: impl Into<String>) -> Self {
        self.uri = uri.into();
        self
    }

    pub fn json<T: serde::Serialize>(mut self, payload: &T) -> Self {
        self.headers
            .push(("Content-Type".to_string(), "application/json".to_string()));
        self.body = Body::from(serde_json::to_vec(payload).unwrap());
        self
    }

    pub fn with_ministry_auth(mut self) -> Self {
        self.auth = Some(format!("Bearer {}", mint_test_token(&["ministry"])));
        self
    }

    pub fn with_coop_admin_auth(mut self) -> Self {
        self.auth = Some(format!(
            "Bearer {}",
            mint_token_with_claims(&["cooperative"], Some(vec![COOP_GROUP_PATH.into()]))
        ));
        self
    }

    pub fn with_coop_group(mut self, path: &str) -> Self {
        self.auth = Some(format!(
            "Bearer {}",
            mint_token_with_claims(&["cooperative"], Some(vec![path.into()]))
        ));
        self
    }

    pub async fn send(self) -> TestResponse {
        let mut req = Request::builder().method(self.method).uri(self.uri);

        for (k, v) in self.headers {
            req = req.header(k, v);
        }

        if let Some(auth) = self.auth {
            req = req.header("Authorization", auth);
        }

        let request = req.body(self.body).unwrap();

        let response = self.app.oneshot(request).await.unwrap();
        let status = response.status().as_u16();

        // Use axum body extraction
        let body = axum::body::to_bytes(response.into_body(), usize::MAX)
            .await
            .unwrap();

        TestResponse { status, body }
    }
}

impl TestResponse {
    pub fn assert_status(self, expected: u16) -> Self {
        assert_eq!(
            self.status, expected,
            "Status code mismatch: expected {}, got {}",
            expected, self.status
        );
        self
    }

    pub async fn json<T: serde::de::DeserializeOwned>(self) -> T {
        serde_json::from_slice(&self.body).expect("Failed to deserialize response body as JSON")
    }
}
