//! Mock-database test infrastructure.
//!
//! Provides a SeaORM `MockDatabase`-backed `AppState` plus a tiny in-process
//! mock Keycloak server so that tenant-isolation and workflow logic can be
//! tested without Postgres or a real Keycloak.
//!
//! # Mock queue mechanics (sea-orm 1.1, Postgres backend)
//! - SELECTs **and** `INSERT/UPDATE ... RETURNING` pop from `query_results`
//!   in order (RETURNING is executed as a raw SELECT over the mock connection).
//! - Plain `execute` statements (no RETURNING) pop from `exec_results`.
//! - Repos like `update_status` issue a SELECT (find) **plus** an
//!   UPDATE…RETURNING, i.e. **two** query pops per call.
//! - Expectations must be appended in the exact order the code under test
//!   issues its statements; an empty queue yields `DbErr`.

use sea_orm::{DatabaseBackend, DatabaseConnection, MockDatabase};

use coop_data_backend::auth::claims::{Claims, Cooperation, RealmAccess};
use coop_data_backend::entities::enums::{
    AccountingYear, CoopStatus, PeriodType, ReviewTier, SubmissionCreatedByRole, SubmissionStatus,
};
use coop_data_backend::entities::{apex, cooperative, federation, submission};
use coop_data_backend::AppState;

use super::mock::TestApp;

// ============================================================================
// Mock Keycloak server
// ============================================================================

/// A minimal in-process Keycloak stand-in.
///
/// `resolve_group` walks: token endpoint → top-level group search (matched by
/// name) → children walk (matched by child name) → group by id. This server
/// answers exactly those routes for one apex group with one cooperative
/// subgroup. The search endpoint matches both the apex group's name and its id
/// (claims may carry either form), and the cooperative subgroup is exposed with
/// `name == coop_group_id` so the path-walk can find it.
pub struct MockKeycloak {
    pub addr: std::net::SocketAddr,
    shutdown: Option<tokio::sync::oneshot::Sender<()>>,
}

impl MockKeycloak {
    pub async fn start(apex_name: &str, apex_group_id: &str, coop_group_id: &str) -> Self {
        let apex_name = apex_name.to_string();
        let apex_group_id = apex_group_id.to_string();
        let coop_group_id = coop_group_id.to_string();

        let app = axum::Router::new()
            .route(
                "/realms/test-realm/protocol/openid-connect/token",
                axum::routing::post(|| async {
                    axum::Json(serde_json::json!({
                        "access_token": "mock-admin-token",
                        "expires_in": 3600,
                        "token_type": "Bearer",
                    }))
                }),
            )
            .route(
                "/admin/realms/test-realm/groups",
                axum::routing::get({
                    let apex_name = apex_name.clone();
                    let apex_group_id = apex_group_id.clone();
                    move |axum::extract::Query(q): axum::extract::Query<
                        std::collections::HashMap<String, String>,
                    >| {
                        // Echo the searched term as the group name so the
                        // name filter in resolve_group always matches.
                        let search = q.get("search").cloned().unwrap_or_default();
                        let apex_name = apex_name.clone();
                        let apex_group_id = apex_group_id.clone();
                        async move {
                            if search == apex_name || search == apex_group_id {
                                axum::Json(serde_json::json!([{
                                    "id": apex_group_id,
                                    "name": search,
                                    "path": format!("/{}", apex_name),
                                    "subGroups": [],
                                }]))
                            } else {
                                axum::Json(serde_json::json!([]))
                            }
                        }
                    }
                }),
            )
            .route(
                "/admin/realms/test-realm/groups/{id}",
                axum::routing::get({
                    let apex_name = apex_name.clone();
                    let apex_group_id = apex_group_id.clone();
                    let coop_group_id = coop_group_id.clone();
                    move |axum::extract::Path(id): axum::extract::Path<String>| {
                        let apex_name = apex_name.clone();
                        let apex_group_id = apex_group_id.clone();
                        let coop_group_id = coop_group_id.clone();
                        async move {
                            let (status, body) = if id == apex_group_id {
                                (
                                    axum::http::StatusCode::OK,
                                    serde_json::json!({
                                        "id": apex_group_id,
                                        "name": apex_name,
                                        "path": format!("/{}", apex_name),
                                    }),
                                )
                            } else if id == coop_group_id {
                                (
                                    axum::http::StatusCode::OK,
                                    serde_json::json!({
                                        "id": coop_group_id,
                                        "name": coop_group_id,
                                        "path": format!("/{}/{}", apex_name, coop_group_id),
                                    }),
                                )
                            } else {
                                (
                                    axum::http::StatusCode::NOT_FOUND,
                                    serde_json::json!({ "error": "Group not found" }),
                                )
                            };
                            (status, axum::Json(body))
                        }
                    }
                }),
            )
            .route(
                "/admin/realms/test-realm/groups/{id}/children",
                axum::routing::get({
                    let apex_name = apex_name.clone();
                    let coop_group_id = coop_group_id.clone();
                    move |axum::extract::Path(id): axum::extract::Path<String>| {
                        let apex_name = apex_name.clone();
                        let coop_group_id = coop_group_id.clone();
                        async move {
                            if id == coop_group_id {
                                axum::Json(serde_json::json!([]))
                            } else {
                                // The apex's only child is the cooperative; its
                                // name equals the group id used in JWT claims.
                                axum::Json(serde_json::json!([{
                                    "id": coop_group_id,
                                    "name": coop_group_id,
                                    "path": format!("/{}/{}", apex_name, coop_group_id),
                                }]))
                            }
                        }
                    }
                }),
            );

        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind mock keycloak");
        let addr = listener.local_addr().expect("mock keycloak addr");

        let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();
        tokio::spawn(async move {
            axum::serve(listener, app)
                .with_graceful_shutdown(async {
                    let _ = shutdown_rx.await;
                })
                .await
                .ok();
        });

        Self {
            addr,
            shutdown: Some(shutdown_tx),
        }
    }

    pub fn url(&self) -> String {
        format!("http://{}", self.addr)
    }
}

impl Drop for MockKeycloak {
    fn drop(&mut self) {
        if let Some(tx) = self.shutdown.take() {
            let _ = tx.send(());
        }
    }
}

// ============================================================================
// Claims builders (one per tenant tier)
// ============================================================================

fn base_claims(sub: &str, roles: &[&str]) -> Claims {
    Claims {
        sub: sub.to_string(),
        exp: 9999999999,
        iat: 0,
        iss: "test-issuer".to_string(),
        aud: Some(serde_json::json!("test-audience")),
        preferred_username: Some("test-user".to_string()),
        email: Some("user@test.example".to_string()),
        email_verified: Some(true),
        realm_access: Some(RealmAccess {
            roles: roles.iter().map(|r| r.to_string()).collect(),
        }),
        resource_access: None,
        organization: None,
        cooperation: None,
        assigned_dimensions: None,
        name: Some("Test User".to_string()),
    }
}

pub fn ministry_claims() -> Claims {
    base_claims("11111111-1111-1111-1111-111111111111", &["ministry"])
}

pub fn federation_claims(org_id: &str) -> Claims {
    let mut c = base_claims("22222222-2222-2222-2222-222222222222", &["federation"]);
    c.organization = Some(serde_json::json!({ "Federation": { "id": org_id } }));
    c
}

pub fn apex_claims(apex_group_id: &str) -> Claims {
    let mut c = base_claims("33333333-3333-3333-3333-333333333333", &["apex"]);
    c.cooperation = Some(Cooperation(vec![format!("/{}", apex_group_id)]));
    c
}

pub fn cooperative_claims(coop_group_id: &str) -> Claims {
    let mut c = base_claims("44444444-4444-4444-4444-444444444444", &["cooperative"]);
    c.cooperation = Some(Cooperation(vec![format!("/apex-name/{}", coop_group_id)]));
    c
}

// ============================================================================
// Entity fixture builders
// ============================================================================

pub fn federation_row(id: uuid::Uuid, keycloak_id: &str) -> federation::Model {
    federation::Model {
        id,
        keycloak_id: keycloak_id.to_string(),
        display_name: "Test Federation".to_string(),
        is_active: true,
        metadata: Some(serde_json::json!({})),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    }
}

pub fn apex_row(id: uuid::Uuid, keycloak_id: &str, federation_id: uuid::Uuid) -> apex::Model {
    apex::Model {
        id,
        keycloak_id: keycloak_id.to_string(),
        federation_id,
        organization_keycloak_id: keycloak_id.to_string(),
        display_name: "Test Apex".to_string(),
        metadata: Some(serde_json::json!({})),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    }
}

pub fn cooperative_row(
    id: uuid::Uuid,
    keycloak_id: &str,
    apex_id: uuid::Uuid,
) -> cooperative::Model {
    cooperative::Model {
        id,
        keycloak_id: keycloak_id.to_string(),
        apex_id,
        display_name: keycloak_id.to_string(),
        keycloak_group_id: None,
        apex_group_id: None,
        federation_org_id: None,
        name: keycloak_id.to_string(),
        institution_type: None,
        reg_no: None,
        tin: None,
        address: None,
        georeference: None,
        region: None,
        geographic_classif: None,
        phone: None,
        sector: None,
        responsible_financial: None,
        responsible_non_financial: None,
        status: CoopStatus::Active,
        registered_on: None,
        accounting_year: AccountingYear::Calendar,
        tier: "2".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    }
}

#[allow(clippy::too_many_arguments)]
pub fn submission_row(
    id: uuid::Uuid,
    cooperative_id: uuid::Uuid,
    status: SubmissionStatus,
    current_tier: ReviewTier,
) -> submission::Model {
    submission::Model {
        id,
        reference: None,
        cooperative_id,
        reporting_year: 2026,
        period_type: PeriodType::Yearly,
        period_value: "2026".to_string(),
        fiscal_start_month: 1,
        status,
        current_tier,
        submitted_by: None,
        submitted_at: None,
        last_reviewed_by: None,
        last_reviewed_at: None,
        rejection_reason: None,
        priority: "normal".to_string(),
        metadata: serde_json::json!({}),
        submission_method: "upload".to_string(),
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
        created_by_role: SubmissionCreatedByRole::Cooperative,
        created_by_user_id: None,
        created_by_name: None,
        edited_by: None,
        edited_by_name: None,
    }
}

// ============================================================================
// AppState factory
// ============================================================================

/// An `AppState` backed by a SeaORM `MockDatabase` connection.
///
/// Delegates to the shared [`TestApp`] builder so there is a single place that
/// knows how to wire `AppState` fields together.
pub struct MockDbApp {
    pub state: AppState,
}

impl MockDbApp {
    /// Build an `AppState` on top of a prepared `MockDatabase`.
    pub async fn new(database: MockDatabase) -> Self {
        Self::from_conn(database.into_connection(), None).await
    }

    /// Build an `AppState` on top of an already-built `Database` handle
    /// (e.g. a recording mock connection shared with the test).
    pub async fn from_database(database: coop_data_backend::Database) -> Self {
        let app = TestApp::build_with(database, None).await;
        Self { state: app.state }
    }

    /// Build with a mock DB **and** a Keycloak client pointed at `url`.
    pub async fn with_mock_keycloak(database: MockDatabase, keycloak_url: String) -> Self {
        Self::from_conn(database.into_connection(), Some(keycloak_url)).await
    }

    async fn from_conn(conn: DatabaseConnection, keycloak_url: Option<String>) -> Self {
        let app = match keycloak_url {
            Some(url) => TestApp::with_db_and_keycloak_url(conn, url).await,
            None => TestApp::with_db(conn).await,
        };
        Self { state: app.state }
    }
}

/// Convenience: start a `MockDatabase` on the Postgres backend (the backend the
/// production code targets, incl. RETURNING semantics).
pub fn mock_postgres() -> MockDatabase {
    MockDatabase::new(DatabaseBackend::Postgres)
}

// ============================================================================
// Recording mock: asserts on the generated SQL itself
// ============================================================================

use std::sync::{Arc, Mutex};

use sea_orm::{
    DbBackend, DbErr, ExecResult, IntoMockRow, MockDatabaseConnection, MockDatabaseTrait,
    MockExecResult, MockRow, QueryResult, Statement, Transaction,
};

/// A `MockDatabaseTrait` wrapper that records every statement the code issues.
///
/// Delegates all queue/counter behaviour to the wrapped [`MockDatabase`] and
/// additionally archives each [`Statement`]'s SQL so tests can assert on what
/// the repository actually sent (filters, guards, ordering) — not just on what
/// came back. Can also inject a [`DbErr`] for error-mapping tests.
#[derive(Debug)]
struct RecordingDb {
    inner: MockDatabase,
    stmts: Arc<Mutex<Vec<Statement>>>,
    inject_query: Option<DbErr>,
    inject_exec: Option<DbErr>,
}

impl MockDatabaseTrait for RecordingDb {
    fn execute(&mut self, counter: usize, stmt: Statement) -> Result<ExecResult, DbErr> {
        self.stmts.lock().expect("stmts lock").push(stmt.clone());
        if let Some(err) = self.inject_exec.take() {
            return Err(err);
        }
        MockDatabaseTrait::execute(&mut self.inner, counter, stmt)
    }

    fn query(&mut self, counter: usize, stmt: Statement) -> Result<Vec<QueryResult>, DbErr> {
        self.stmts.lock().expect("stmts lock").push(stmt.clone());
        if let Some(err) = self.inject_query.take() {
            return Err(err);
        }
        MockDatabaseTrait::query(&mut self.inner, counter, stmt)
    }

    fn begin(&mut self) {
        MockDatabaseTrait::begin(&mut self.inner)
    }

    fn commit(&mut self) {
        MockDatabaseTrait::commit(&mut self.inner)
    }

    fn rollback(&mut self) {
        MockDatabaseTrait::rollback(&mut self.inner)
    }

    fn drain_transaction_log(&mut self) -> Vec<Transaction> {
        MockDatabaseTrait::drain_transaction_log(&mut self.inner)
    }

    fn get_database_backend(&self) -> DbBackend {
        MockDatabaseTrait::get_database_backend(&self.inner)
    }

    fn ping(&self) -> Result<(), DbErr> {
        MockDatabaseTrait::ping(&self.inner)
    }
}

/// Builder for a statement-recording mock database.
///
/// The queues must be fully populated before [`RecordingMock::build`] — the
/// builder is consumed there and the wrapped `MockDatabase` hands its state to
/// the connection, so late appends are impossible by construction. What the
/// builder *does* give you afterwards is the recording side: every statement
/// the code issued, readable via [`RecordingMock::sql`] / `statements`.
///
/// # Example
/// ```ignore
/// let rm = RecordingMock::postgres()
///     .query_rows(vec![row])          // 1st SELECT returns `row`
///     .query_rows(vec![updated_row])  // 2nd SELECT (the UPDATE…RETURNING)
///     .build();
/// let app = rm.app().await;
/// ```
pub struct RecordingMockBuilder {
    inner: MockDatabase,
    stmts: Arc<Mutex<Vec<Statement>>>,
    inject_query: Option<DbErr>,
    inject_exec: Option<DbErr>,
}

impl RecordingMockBuilder {
    fn postgres() -> Self {
        Self {
            inner: MockDatabase::new(DatabaseBackend::Postgres),
            stmts: Arc::new(Mutex::new(Vec::new())),
            inject_query: None,
            inject_exec: None,
        }
    }

    /// Queue one SELECT / INSERT…RETURNING / UPDATE…RETURNING result set.
    pub fn query_rows<T, I>(mut self, rows: I) -> Self
    where
        T: IntoMockRow,
        I: IntoIterator<Item = T>,
    {
        self.inner = self
            .inner
            .append_query_results(vec![rows.into_iter().collect::<Vec<_>>()]);
        self
    }

    /// Queue one plain-exec result (DELETE, UPDATE without RETURNING, raw
    /// claim-style UPDATE). `rows` is what `rows_affected()` reports.
    pub fn exec(mut self, rows: u64) -> Self {
        self.inner = self.inner.append_exec_results(vec![MockExecResult {
            rows_affected: rows,
            ..Default::default()
        }]);
        self
    }

    /// Queue a one-row `COUNT(*)`-style result for `Paginator::num_items`.
    pub fn count(self, n: i64) -> Self {
        self.query_rows(vec![num_items_row(n)])
    }

    /// Fail the next `query` call with `err`.
    pub fn fail_query(mut self, err: DbErr) -> Self {
        self.inject_query = Some(err);
        self
    }

    /// Fail the next `execute` call with `err`.
    pub fn fail_exec(mut self, err: DbErr) -> Self {
        self.inject_exec = Some(err);
        self
    }

    /// Queue one empty SELECT result ("no rows found" reply).
    pub fn query_empty(self) -> Self {
        self.query_rows::<MockRow, Vec<MockRow>>(Vec::new())
    }

    /// Fail the next INSERT…RETURNING with a unique-constraint violation.
    /// Repo conflict branches match `"duplicate"`/`"unique"` in the error
    /// string, so the message carries it.
    pub fn fail_insert_unique(self) -> Self {
        self.fail_query(DbErr::Exec(sea_orm::RuntimeErr::Internal(
            "ERROR: duplicate key value violates unique constraint".into(),
        )))
    }

    /// Freeze the queues and hand back the recording handle.
    pub fn build(self) -> RecordingMock {
        let recorder = RecordingDb {
            inner: self.inner,
            stmts: self.stmts.clone(),
            inject_query: self.inject_query,
            inject_exec: self.inject_exec,
        };
        let conn = sea_orm::DatabaseConnection::MockDatabaseConnection(Arc::new(
            MockDatabaseConnection::new(recorder),
        ));
        RecordingMock {
            db: coop_data_backend::Database::new(conn),
            stmts: self.stmts,
        }
    }
}

/// A recording mock database handle: share `db` with the code under test, then
/// assert on [`RecordingMock::sql`].
pub struct RecordingMock {
    /// Shared handle — wrap in repositories / `AppState` freely (`Database` is
    /// an `Arc` wrapper, so clones share the same recorder and queues).
    pub db: coop_data_backend::Database,
    stmts: Arc<Mutex<Vec<Statement>>>,
}

/// A recording mock on the Postgres backend (matches production SQL dialect).
pub fn mock_recording_postgres() -> RecordingMock {
    RecordingMock::postgres().build()
}

/// A recording mock that fails the next query (or exec if no query happens)
/// with a generic connection failure — the "database unreachable" stand-in
/// for error-mapping tests.
pub fn mock_recording_postgres_failing() -> RecordingMock {
    RecordingMock::postgres()
        .fail_query(DbErr::Conn(sea_orm::RuntimeErr::Internal(
            "connection refused".into(),
        )))
        .fail_exec(DbErr::Conn(sea_orm::RuntimeErr::Internal(
            "connection refused".into(),
        )))
        .build()
}

impl RecordingMock {
    /// Start a builder on the Postgres backend.
    pub fn postgres() -> RecordingMockBuilder {
        RecordingMockBuilder::postgres()
    }

    /// Build an `AppState` on top of this recording mock.
    pub async fn app(&self) -> MockDbApp {
        MockDbApp::from_database(self.db.clone()).await
    }

    /// All statements issued so far, in order.
    pub fn statements(&self) -> Vec<Statement> {
        self.stmts.lock().expect("stmts lock").clone()
    }

    /// Lowercased SQL text of every issued statement, in order.
    pub fn sql(&self) -> Vec<String> {
        self.statements()
            .into_iter()
            .map(|s| s.sql.to_lowercase())
            .collect()
    }

    /// Lowercased bind values of statement `idx` (strings, JSON, decimals,
    /// UUIDs, bools).
    pub fn binds(&self, idx: usize) -> Vec<String> {
        bind_value_strings(&self.statements()[idx])
    }
}

/// The WHERE clause of a lowercased SQL string (`""` if absent).
pub fn where_clause(sql: &str) -> String {
    sql.to_lowercase()
        .split(" where ")
        .nth(1)
        .unwrap_or_default()
        .to_string()
}

/// Human-readable bind values of a statement (strings, JSON, decimals, UUIDs,
/// bools). Binds for other types (numbers, dates) are skipped.
pub fn bind_value_strings(stmt: &Statement) -> Vec<String> {
    use sea_orm::sea_query::Value;
    let Some(values) = &stmt.values else {
        return Vec::new();
    };
    values
        .0
        .iter()
        .filter_map(|v| match v {
            Value::String(Some(s)) => Some(s.to_string()),
            Value::Json(Some(j)) => Some(j.to_string()),
            Value::Decimal(Some(d)) => Some(d.to_string()),
            Value::Uuid(Some(u)) => Some(u.to_string()),
            Value::Bool(Some(b)) => Some(b.to_string()),
            _ => None,
        })
        .collect()
}

/// A one-row result for `COUNT(*)`-style queries (`Paginator::num_items`).
pub fn num_items_row(n: i64) -> MockRow {
    use sea_orm::{sea_query::Value, IntoMockRow};
    BTreeMap::from([("num_items".to_string(), Value::BigInt(Some(n)))]).into_mock_row()
}

use std::collections::BTreeMap;

// ============================================================================
// Entity fixtures (financial + people rows)
// ============================================================================

use chrono::Utc;
use rust_decimal::Decimal;
use rust_decimal_macros::dec;
use uuid::Uuid;

pub use coop_data_backend::entities::enums::{
    AccountCategory, AccountType, AgeGroup, Currency, DpdCategory, EswatiniRegion, Gender,
    LoanStatus, MemberStatus, UrbanRural,
};
use coop_data_backend::entities::{
    balance_sheet_line_item, financial_statement, loan, member, savings_account, user,
};

fn now() -> chrono::DateTime<Utc> {
    Utc::now()
}

pub fn member_row(
    id: Uuid,
    cooperative_id: Uuid,
    member_no: &str,
    gender: Gender,
    age_group: AgeGroup,
    status: MemberStatus,
    agm_attendance: bool,
) -> member::Model {
    member::Model {
        id,
        cooperative_id,
        submission_id: None,
        member_id: member_no.to_string(),
        join_date: chrono::NaiveDate::from_ymd_opt(2024, 1, 1).expect("date"),
        status,
        exit_date: None,
        gender,
        age_group,
        region: EswatiniRegion::Hhohho,
        urban_rural: UrbanRural::Urban,
        agm_attendance,
        leadership_role: None,
        voting_exercised: false,
        share_balance: dec!(100),
        created_at: now(),
        updated_at: now(),
    }
}

pub fn loan_row(id: Uuid, cooperative_id: Uuid, loan_no: &str) -> loan::Model {
    loan::Model {
        id,
        cooperative_id,
        submission_id: None,
        member_id: Uuid::new_v4(),
        loan_id: loan_no.to_string(),
        loan_product_type: "personal".to_string(),
        loan_start_date: chrono::NaiveDate::from_ymd_opt(2025, 1, 1).expect("date"),
        loan_maturity_date: chrono::NaiveDate::from_ymd_opt(2026, 1, 1).expect("date"),
        loan_status: LoanStatus::Performing,
        borrower_type: "member".to_string(),
        youth_borrower_flag: false,
        women_borrower_flag: false,
        rural_borrower_flag: false,
        repayment_regularity: "regular".to_string(),
        days_past_due_category: DpdCategory::Zero,
        missed_installments_count: 0,
        restructured_loan_flag: false,
        number_of_restructurings: 0,
        early_settlement_flag: false,
        multiple_loans_flag: false,
        large_borrower_flag: false,
        interest_rate: dec!(10),
        balance: dec!(500),
        loan_amount: dec!(1000),
        created_at: now(),
        updated_at: now(),
    }
}

pub fn savings_row(id: Uuid, cooperative_id: Uuid, account_no: &str) -> savings_account::Model {
    savings_account::Model {
        id,
        cooperative_id,
        submission_id: None,
        member_id: Uuid::new_v4(),
        savings_account_id: account_no.to_string(),
        account_type: AccountType::Voluntary,
        account_opening_date: chrono::NaiveDate::from_ymd_opt(2024, 6, 1).expect("date"),
        account_status: "active".to_string(),
        contribution_frequency: "monthly".to_string(),
        last_contribution_date: chrono::NaiveDate::from_ymd_opt(2026, 1, 1).expect("date"),
        number_of_contributions: 12,
        balance_trend: "growing".to_string(),
        zero_balance_flag: false,
        withdrawal_frequency_category: "low".to_string(),
        emergency_withdrawals_flag: false,
        interest_rate: dec!(5),
        balance: dec!(750),
        created_at: now(),
        updated_at: now(),
    }
}

pub fn fs_row(id: Uuid, submission_id: Uuid, cooperative_id: Uuid) -> financial_statement::Model {
    financial_statement::Model {
        id,
        submission_id,
        cooperative_id,
        reporting_year: 2026,
        accounting_year: coop_data_backend::entities::enums::AccountingYear::Calendar,
        currency: Currency::Szl,
        is_validated: false,
        validation_errors: None,
        created_at: now(),
        updated_at: now(),
    }
}

#[allow(clippy::too_many_arguments)]
pub fn bsli_row(
    id: Uuid,
    financial_statement_id: Uuid,
    account_code: Option<i32>,
    account_name: &str,
    month: i16,
    value: Option<Decimal>,
) -> balance_sheet_line_item::Model {
    balance_sheet_line_item::Model {
        id,
        financial_statement_id,
        account_code,
        account_name: account_name.to_string(),
        account_category: AccountCategory::Assets,
        account_subcategory: "current".to_string(),
        month,
        value,
        ai_confidence: None,
        ai_flagged: false,
        manually_edited: false,
        raw_label: None,
        created_at: now(),
        updated_at: now(),
    }
}

pub fn user_row(id: Uuid, email: &str, role: &str) -> user::Model {
    user::Model {
        id,
        keycloak_id: format!("kc-{}", id.simple()),
        email: email.to_string(),
        full_name: Some("Test User".to_string()),
        role: role.to_string(),
        organization_id: None,
        region: None,
        is_active: true,
        last_login_at: None,
        created_at: now(),
        updated_at: now(),
        federation_id: None,
        apex_id: None,
        cooperative_id: None,
    }
}
