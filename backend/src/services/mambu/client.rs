use std::sync::Arc;
use std::time::Duration;

use tokio::sync::Semaphore;
use tokio::task::JoinSet;

use chrono::NaiveDate;
use reqwest::{Client, RequestBuilder, StatusCode};
use serde::de::DeserializeOwned;
use serde_json::json;

use crate::config::AppConfig;
use crate::error::{AppError, AppResult};
use crate::services::mambu::models::{
    MambuBranch, MambuClient, MambuDeposit, MambuJournalEntry, MambuLoan, MambuProduct, MambuReport,
};

const ACCEPT_V2: &str = "application/vnd.mambu.v2+json";
const MAX_ATTEMPTS: u32 = 6;
const PAGE_ATTEMPTS: u32 = 3;
/// Pages of one list asked for at the same time.
const SEARCH_PARALLEL_PAGES: u64 = 4;
const REPORT_POLLS: u32 = 120;
/// Mambu builds one accounting report at a time for the whole tenant and refuses a new
/// one with ANOTHER_TASK_IN_PROGRESS. The client waits and asks again for up to 10 minutes.
const BUSY_RETRIES: u32 = 40;
const BUSY_DELAY: Duration = Duration::from_secs(15);
const REPORT_POLL_DELAY: Duration = Duration::from_secs(3);

#[derive(Clone)]
enum Credentials {
    Basic { username: String, password: String },
    ApiKey(String),
}

/// The three lists of a branch.
pub struct BranchLists {
    pub clients: Vec<MambuClient>,
    pub deposits: Vec<MambuDeposit>,
    pub loans: Vec<MambuLoan>,
}

/// How far a list has been read. Shared with the task that reports progress, so reading
/// does not wait for the database.
#[derive(Default)]
pub struct ReadProgress {
    read: std::sync::atomic::AtomicU64,
    total: std::sync::atomic::AtomicU64,
}

impl ReadProgress {
    pub fn read(&self) -> u64 {
        self.read.load(std::sync::atomic::Ordering::Relaxed)
    }
    pub fn total(&self) -> u64 {
        self.total.load(std::sync::atomic::Ordering::Relaxed)
    }
    fn add_read(&self, n: u64) {
        self.read.fetch_add(n, std::sync::atomic::Ordering::Relaxed);
    }
    fn set_total(&self, n: u64) {
        self.total.store(n, std::sync::atomic::Ordering::Relaxed);
    }
}

fn from_values<T: DeserializeOwned>(values: Vec<serde_json::Value>) -> AppResult<Vec<T>> {
    values
        .into_iter()
        .map(|v| {
            serde_json::from_value(v).map_err(|e| {
                tracing::warn!(error = %e, "Unexpected Mambu record");
                AppError::InternalServerError("Unexpected response from Mambu".into())
            })
        })
        .collect()
}

/// Read-only client for the Mambu REST API v2. It never issues a write: the only
/// POST it makes starts an asynchronous accounting report.
#[derive(Clone)]
pub struct MambuApiClient {
    http: Client,
    base_url: String,
    credentials: Credentials,
    page_size: u32,
    report_poll_delay: Duration,
    busy_delay: Duration,
    /// Requests in flight at once over every sync that shares this client.
    inflight: Arc<Semaphore>,
}

impl MambuApiClient {
    /// `None` while the integration is not configured.
    pub fn from_config(config: &AppConfig) -> Option<Self> {
        let base_url = config
            .mambu_base_url
            .trim()
            .trim_end_matches('/')
            .to_string();
        if base_url.is_empty() {
            return None;
        }
        let credentials = if !config.mambu_api_key.is_empty() {
            Credentials::ApiKey(config.mambu_api_key.clone())
        } else if !config.mambu_username.is_empty() {
            Credentials::Basic {
                username: config.mambu_username.clone(),
                password: config.mambu_password.clone(),
            }
        } else {
            return None;
        };
        let http = Client::builder()
            .timeout(Duration::from_secs(config.mambu_timeout_secs.max(5)))
            .build()
            .ok()?;
        Some(Self {
            http,
            base_url,
            credentials,
            page_size: config.mambu_page_size.clamp(10, 1000),
            report_poll_delay: REPORT_POLL_DELAY,
            busy_delay: BUSY_DELAY,
            inflight: Arc::new(Semaphore::new(config.mambu_max_inflight.clamp(1, 64))),
        })
    }

    /// Client for a given base URL and API key, with a short report poll delay.
    /// Used by tests and local runs against a stand-in server.
    pub fn with_api_key(base_url: &str, api_key: &str, page_size: u32) -> Self {
        Self {
            http: Client::new(),
            base_url: base_url.trim_end_matches('/').to_string(),
            credentials: Credentials::ApiKey(api_key.to_string()),
            page_size: page_size.max(1),
            report_poll_delay: Duration::from_millis(50),
            busy_delay: Duration::from_millis(20),
            inflight: Arc::new(Semaphore::new(8)),
        }
    }

    fn request(&self, builder: RequestBuilder) -> RequestBuilder {
        let builder = builder.header("Accept", ACCEPT_V2);
        match &self.credentials {
            Credentials::ApiKey(key) => builder.header("apikey", key),
            Credentials::Basic { username, password } => {
                builder.basic_auth(username, Some(password))
            }
        }
    }

    async fn send(
        &self,
        label: &str,
        make: impl Fn() -> RequestBuilder,
    ) -> AppResult<reqwest::Response> {
        let mut attempt = 0;
        loop {
            attempt += 1;
            let _permit = self.inflight.acquire().await.ok();
            let result = self.request(make()).send().await;
            match result {
                Ok(resp) => {
                    let status = resp.status();
                    let retryable =
                        status == StatusCode::TOO_MANY_REQUESTS || status.is_server_error();
                    if retryable && attempt < MAX_ATTEMPTS {
                        tokio::time::sleep(Duration::from_secs(u64::from(attempt) * 5)).await;
                        continue;
                    }
                    if !status.is_success() {
                        let reason = error_reason(resp).await;
                        tracing::warn!(status = %status, request = label, reason = %reason, "Mambu request failed");
                        return Err(AppError::InternalServerError(format!(
                            "Mambu request {label} failed with status {status}{reason}"
                        )));
                    }
                    return Ok(resp);
                }
                Err(e) => {
                    if attempt < MAX_ATTEMPTS {
                        tokio::time::sleep(Duration::from_secs(u64::from(attempt) * 5)).await;
                        continue;
                    }
                    tracing::warn!(error = %e, request = label, "Mambu request error");
                    return Err(AppError::InternalServerError(
                        "Could not reach Mambu".to_string(),
                    ));
                }
            }
        }
    }

    /// Sends one page request and decodes it. A body that is cut off or cannot be read is
    /// asked for again a few times, because deep pages of a big branch sometimes fail once.
    /// The log names the cause (transport or JSON position) but never the record data.
    async fn read_page<T: DeserializeOwned>(
        &self,
        path: &str,
        offset: u32,
        make: impl Fn() -> RequestBuilder,
    ) -> AppResult<Vec<T>> {
        let mut attempt = 0;
        loop {
            attempt += 1;
            let resp = self.send(path, &make).await?;
            let cause = match resp.bytes().await {
                Ok(bytes) => match serde_json::from_slice::<Vec<T>>(&bytes) {
                    Ok(page) => return Ok(page),
                    Err(e) => format!("JSON line {} column {}: {}", e.line(), e.column(), e),
                },
                Err(e) => format!("body not received: {e}"),
            };
            tracing::warn!(path, offset, attempt, cause = %cause, "Unexpected Mambu response");
            if attempt >= PAGE_ATTEMPTS {
                return Err(AppError::InternalServerError(
                    "Unexpected response from Mambu".into(),
                ));
            }
            tokio::time::sleep(Duration::from_secs(u64::from(attempt) * 5)).await;
        }
    }

    async fn get_pages<T: DeserializeOwned>(
        &self,
        path: &str,
        query: &[(&str, String)],
    ) -> AppResult<Vec<T>> {
        let mut all: Vec<T> = Vec::new();
        let mut offset: u32 = 0;
        loop {
            let url = format!("{}{}", self.base_url, path);
            let limit = self.page_size.to_string();
            let off = offset.to_string();
            let page: Vec<T> = self
                .read_page(path, offset, || {
                    self.http
                        .get(&url)
                        .query(query)
                        .query(&[("limit", limit.as_str()), ("offset", off.as_str())])
                })
                .await?;
            let count = page.len() as u32;
            tracing::info!(path, offset, count, "Mambu page read");
            all.extend(page);
            if count < self.page_size {
                break;
            }
            offset += count;
        }
        Ok(all)
    }

    pub async fn branches(&self) -> AppResult<Vec<MambuBranch>> {
        self.get_pages("/branches", &[("detailsLevel", "FULL".to_string())])
            .await
    }

    /// Reads the records of one branch with the server-side search. The plain list
    /// ignores its branch filter for deposits and loans and would read the whole tenant.
    async fn search_pages<T: DeserializeOwned + Send + 'static>(
        &self,
        path: &str,
        branch_field: &str,
        branch_id: &str,
    ) -> AppResult<Vec<T>> {
        let Ok(branch_key) = self.branch_key(branch_id).await else {
            tracing::warn!(
                path,
                "Branch key not readable, falling back to the plain list"
            );
            return self
                .get_pages(
                    path,
                    &[
                        ("branchId", branch_id.to_string()),
                        ("detailsLevel", "FULL".to_string()),
                    ],
                )
                .await;
        };
        self.search_pages_by_key(path, branch_field, &branch_key)
            .await
    }

    /// The records of one branch, all in memory. Use `search_pages_each` for a list that
    /// can be large.
    async fn search_pages_by_key<T: DeserializeOwned + Send + 'static>(
        &self,
        path: &str,
        branch_field: &str,
        branch_key: &str,
    ) -> AppResult<Vec<T>> {
        let mut done: Vec<(u64, Vec<T>)> = Vec::new();
        self.search_pages_each(path, branch_field, branch_key, None, |page, rows| {
            done.push((page, rows));
            Ok(())
        })
        .await?;
        done.sort_by_key(|(page, _)| *page);
        Ok(done.into_iter().flat_map(|(_, rows)| rows).collect())
    }

    /// The records of one branch, handed over a page at a time so a large list is never
    /// held as a whole. The first request gives the total, then the pages are read a few
    /// at a time and passed to `each` as they arrive, in no fixed order, with their page
    /// number. When Mambu gives no total the pages are read one by one. Returns the
    /// number of records.
    pub async fn search_pages_each<T, F>(
        &self,
        path: &str,
        branch_field: &str,
        branch_key: &str,
        progress: Option<&ReadProgress>,
        mut each: F,
    ) -> AppResult<u64>
    where
        T: DeserializeOwned + Send + 'static,
        F: FnMut(u64, Vec<T>) -> AppResult<()>,
    {
        let body = serde_json::json!({
            "filterCriteria": [{"field": branch_field, "operator": "EQUALS", "value": branch_key}],
            "sortingCriteria": {"field": "encodedKey", "order": "ASC"},
        });
        let page_size = u64::from(self.page_size);
        let total = self.search_total(path, &body).await;
        if let (Some(progress), Some(total)) = (progress, total) {
            progress.set_total(total);
        }
        let mut count: u64 = 0;
        match total {
            Some(0) => {}
            Some(total) if total > page_size => {
                let pages = total.div_ceil(page_size);
                let mut tasks: JoinSet<AppResult<(u64, Vec<T>)>> = JoinSet::new();
                let mut next = 0u64;
                let start = |tasks: &mut JoinSet<AppResult<(u64, Vec<T>)>>, page: u64| {
                    let client = self.clone();
                    let body = body.clone();
                    let path = path.to_string();
                    tasks.spawn(async move {
                        let offset = (page * page_size) as u32;
                        let rows = client.search_page::<T>(&path, &body, offset).await?;
                        Ok((page, rows))
                    });
                };
                while next < pages.min(SEARCH_PARALLEL_PAGES) {
                    start(&mut tasks, next);
                    next += 1;
                }
                while let Some(finished) = tasks.join_next().await {
                    let (page, rows) = finished.map_err(|e| {
                        tracing::warn!(error = %e, path, "Mambu page task failed");
                        AppError::InternalServerError("Could not read the Mambu data".into())
                    })??;
                    if next < pages {
                        start(&mut tasks, next);
                        next += 1;
                    }
                    count += rows.len() as u64;
                    if let Some(progress) = progress {
                        progress.add_read(rows.len() as u64);
                    }
                    each(page, rows)?;
                }
            }
            _ => {
                let mut offset: u32 = 0;
                let mut page = 0u64;
                loop {
                    let rows = self.search_page::<T>(path, &body, offset).await?;
                    let read = rows.len() as u32;
                    count += u64::from(read);
                    if let Some(progress) = progress {
                        progress.add_read(u64::from(read));
                    }
                    each(page, rows)?;
                    page += 1;
                    if read < self.page_size {
                        break;
                    }
                    offset += read;
                }
            }
        }
        tracing::info!(path, records = count, "Mambu list read");
        Ok(count)
    }

    async fn search_page<T: DeserializeOwned>(
        &self,
        path: &str,
        body: &serde_json::Value,
        offset: u32,
    ) -> AppResult<Vec<T>> {
        let url = format!("{}{}:search", self.base_url, path);
        let limit = self.page_size.to_string();
        let off = offset.to_string();
        let page: Vec<T> = self
            .read_page(path, offset, || {
                self.http
                    .post(&url)
                    .query(&[
                        ("detailsLevel", "FULL"),
                        ("limit", limit.as_str()),
                        ("offset", off.as_str()),
                    ])
                    .json(body)
            })
            .await?;
        tracing::debug!(path, offset, count = page.len(), "Mambu page read");
        Ok(page)
    }

    async fn search_total(&self, path: &str, body: &serde_json::Value) -> Option<u64> {
        let url = format!("{}{}:search", self.base_url, path);
        let resp = self
            .send(path, || {
                self.http
                    .post(&url)
                    .query(&[("limit", "1"), ("paginationDetails", "ON")])
                    .json(body)
            })
            .await
            .ok()?;
        resp.headers()
            .get("items-total")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse().ok())
    }

    /// Clients, deposits and loans of a branch, read at the same time. The branch key is
    /// asked once. When it cannot be read the plain lists are used.
    pub async fn branch_lists(&self, branch_id: &str) -> AppResult<BranchLists> {
        let Ok(key) = self.branch_key(branch_id).await else {
            tracing::warn!("Branch key not readable, falling back to the plain lists");
            let plain = |path: &'static str| {
                let query = [
                    ("branchId", branch_id.to_string()),
                    ("detailsLevel", "FULL".to_string()),
                ];
                async move { self.get_pages::<serde_json::Value>(path, &query).await }
            };
            let (clients, deposits, loans) =
                tokio::try_join!(plain("/clients"), plain("/deposits"), plain("/loans"))?;
            return Ok(BranchLists {
                clients: from_values(clients)?,
                deposits: from_values(deposits)?,
                loans: from_values(loans)?,
            });
        };
        let (clients, deposits, loans) = tokio::try_join!(
            self.search_pages_by_key::<MambuClient>("/clients", "branchKey", &key),
            self.search_pages_by_key::<MambuDeposit>("/deposits", "assignedBranchKey", &key),
            self.search_pages_by_key::<MambuLoan>("/loans", "assignedBranchKey", &key),
        )?;
        Ok(BranchLists {
            clients,
            deposits,
            loans,
        })
    }

    /// Clients and loans of a branch, read at the same time. Deposits are read with
    /// `deposits_each`, because a large branch has far more of them.
    pub async fn clients_and_loans(
        &self,
        branch_id: &str,
    ) -> AppResult<(Vec<MambuClient>, Vec<MambuLoan>)> {
        let Ok(key) = self.branch_key(branch_id).await else {
            tracing::warn!("Branch key not readable, falling back to the plain lists");
            let plain = |path: &'static str| {
                let query = [
                    ("branchId", branch_id.to_string()),
                    ("detailsLevel", "FULL".to_string()),
                ];
                async move { self.get_pages::<serde_json::Value>(path, &query).await }
            };
            let (clients, loans) = tokio::try_join!(plain("/clients"), plain("/loans"))?;
            return Ok((from_values(clients)?, from_values(loans)?));
        };
        tokio::try_join!(
            self.search_pages_by_key::<MambuClient>("/clients", "branchKey", &key),
            self.search_pages_by_key::<MambuLoan>("/loans", "assignedBranchKey", &key),
        )
    }

    /// The deposit accounts of a branch, a page at a time. When the branch key cannot be
    /// read the plain list is read in full and handed over as one page.
    pub async fn deposits_each<F>(
        &self,
        branch_id: &str,
        progress: Option<&ReadProgress>,
        mut each: F,
    ) -> AppResult<u64>
    where
        F: FnMut(Vec<MambuDeposit>) -> AppResult<()>,
    {
        let Ok(key) = self.branch_key(branch_id).await else {
            tracing::warn!("Branch key not readable, falling back to the plain deposit list");
            let all: Vec<serde_json::Value> = self
                .get_pages(
                    "/deposits",
                    &[
                        ("branchId", branch_id.to_string()),
                        ("detailsLevel", "FULL".to_string()),
                    ],
                )
                .await?;
            let all: Vec<MambuDeposit> = from_values(all)?;
            let count = all.len() as u64;
            if let Some(progress) = progress {
                progress.set_total(count);
                progress.add_read(count);
            }
            each(all)?;
            return Ok(count);
        };
        self.search_pages_each::<MambuDeposit, _>(
            "/deposits",
            "assignedBranchKey",
            &key,
            progress,
            |_, rows| each(rows),
        )
        .await
    }

    /// How many deposit accounts a branch has, from one cheap request. Used to tell a
    /// large branch from a small one before its data is read.
    pub async fn deposit_count(&self, branch_id: &str) -> Option<u64> {
        let key = self.branch_key(branch_id).await.ok()?;
        let body = serde_json::json!({
            "filterCriteria": [{"field": "assignedBranchKey", "operator": "EQUALS", "value": key}],
        });
        self.search_total("/deposits", &body).await
    }

    pub async fn branch_key(&self, branch_id: &str) -> AppResult<String> {
        #[derive(serde::Deserialize)]
        #[serde(rename_all = "camelCase")]
        struct Key {
            encoded_key: String,
        }
        let url = format!("{}/branches/{}", self.base_url, branch_id);
        let resp = self
            .send("/branches/{id}", || {
                self.http.get(&url).query(&[("detailsLevel", "BASIC")])
            })
            .await?;
        let key: Key = resp.json().await.map_err(|e| {
            tracing::warn!(error = %e, "Unexpected Mambu branch response");
            AppError::InternalServerError("Unexpected response from Mambu".into())
        })?;
        Ok(key.encoded_key)
    }

    fn journal_filter(branch_key: &str, from: NaiveDate, to: NaiveDate) -> serde_json::Value {
        json!({"filterCriteria": [
            {"field": "assignedBranchKey", "operator": "EQUALS", "value": branch_key},
            {"field": "bookingDate", "operator": "BETWEEN",
             "value": from.format("%Y-%m-%d").to_string(),
             "secondValue": to.format("%Y-%m-%d").to_string()},
        ]})
    }

    /// Number of general ledger lines booked by a branch between two dates (inclusive).
    pub async fn journal_count(
        &self,
        branch_key: &str,
        from: NaiveDate,
        to: NaiveDate,
    ) -> AppResult<u64> {
        let url = format!("{}/gljournalentries:search", self.base_url);
        let body = Self::journal_filter(branch_key, from, to);
        let resp = self
            .send("/gljournalentries:search", || {
                self.http
                    .post(&url)
                    .query(&[("limit", "1"), ("paginationDetails", "ON")])
                    .json(&body)
            })
            .await?;
        Ok(resp
            .headers()
            .get("items-total")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse().ok())
            .unwrap_or(0))
    }

    /// One page of general ledger lines booked by a branch between two dates.
    pub async fn journal_page(
        &self,
        branch_key: &str,
        from: NaiveDate,
        to: NaiveDate,
        offset: u32,
        limit: u32,
    ) -> AppResult<Vec<MambuJournalEntry>> {
        let url = format!("{}/gljournalentries:search", self.base_url);
        let body = Self::journal_filter(branch_key, from, to);
        let off = offset.to_string();
        let lim = limit.to_string();
        self.read_page("/gljournalentries", offset, || {
            self.http
                .post(&url)
                .query(&[("limit", lim.as_str()), ("offset", off.as_str())])
                .json(&body)
        })
        .await
    }

    pub async fn clients(&self, branch_id: &str) -> AppResult<Vec<MambuClient>> {
        self.search_pages("/clients", "branchKey", branch_id).await
    }

    pub async fn deposits(&self, branch_id: &str) -> AppResult<Vec<MambuDeposit>> {
        self.search_pages("/deposits", "assignedBranchKey", branch_id)
            .await
    }

    pub async fn loans(&self, branch_id: &str) -> AppResult<Vec<MambuLoan>> {
        self.search_pages("/loans", "assignedBranchKey", branch_id)
            .await
    }

    pub async fn deposit_products(&self) -> AppResult<Vec<MambuProduct>> {
        self.get_pages("/depositproducts", &[("detailsLevel", "FULL".to_string())])
            .await
    }

    pub async fn loan_products(&self) -> AppResult<Vec<MambuProduct>> {
        self.get_pages("/loanproducts", &[("detailsLevel", "FULL".to_string())])
            .await
    }

    pub async fn gl_accounts(
        &self,
    ) -> AppResult<Vec<crate::services::mambu::models::ReportGlAccount>> {
        let mut all = Vec::new();
        for kind in ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"] {
            let mut part: Vec<crate::services::mambu::models::ReportGlAccount> = self
                .get_pages("/glaccounts", &[("type", kind.to_string())])
                .await?;
            all.append(&mut part);
        }
        Ok(all)
    }

    /// Starts an accounting report for one branch and polls until it completes.
    pub async fn accounting_report(
        &self,
        branch_id: &str,
        start: NaiveDate,
        end: NaiveDate,
    ) -> AppResult<MambuReport> {
        let url = format!("{}/accounting/reports", self.base_url);
        let body = json!({
            "startDate": start.format("%Y-%m-%d").to_string(),
            "endDate": end.format("%Y-%m-%d").to_string(),
            "branchId": branch_id,
            "currencyCode": "SZL",
            "balanceTypes": ["OPENING_BALANCE", "NET_CHANGE", "CLOSING_BALANCE"],
        });
        let mut waited = 0;
        let resp = loop {
            match self
                .send("POST /accounting/reports", || {
                    self.http.post(&url).json(&body)
                })
                .await
            {
                Ok(resp) => break resp,
                Err(AppError::InternalServerError(message))
                    if message.contains("ANOTHER_TASK_IN_PROGRESS") && waited < BUSY_RETRIES =>
                {
                    waited += 1;
                    tracing::info!(waited, "Mambu is building another report, waiting");
                    tokio::time::sleep(self.busy_delay).await;
                }
                Err(e) => return Err(e),
            }
        };
        let started: MambuReport = resp
            .json()
            .await
            .map_err(|_| AppError::InternalServerError("Unexpected response from Mambu".into()))?;
        let key = started.report_key.clone().ok_or_else(|| {
            AppError::InternalServerError("Mambu did not return a report key".into())
        })?;
        let poll_url = format!("{}/accounting/reports/{}", self.base_url, key);
        for _ in 0..REPORT_POLLS {
            tokio::time::sleep(self.report_poll_delay).await;
            let resp = self
                .send("GET /accounting/reports/{key}", || self.http.get(&poll_url))
                .await?;
            let report: MambuReport = resp.json().await.map_err(|_| {
                AppError::InternalServerError("Unexpected response from Mambu".into())
            })?;
            match report.status.as_deref() {
                Some("COMPLETE") => return Ok(report),
                Some("ERROR") => {
                    return Err(AppError::InternalServerError(
                        "Mambu could not generate the accounting report".into(),
                    ))
                }
                _ => {}
            }
        }
        Err(AppError::InternalServerError(
            "Mambu accounting report timed out".into(),
        ))
    }
}

/// Mambu's error codes of a failed response, for example " (INVALID_PERMISSIONS)". Only
/// letters, digits and underscores are kept, so no personal data can slip in.
async fn error_reason(resp: reqwest::Response) -> String {
    let Ok(body) = resp.json::<serde_json::Value>().await else {
        return String::new();
    };
    let reasons: Vec<String> = body
        .get("errors")
        .and_then(|e| e.as_array())
        .map(|errors| {
            errors
                .iter()
                .filter_map(|e| e.get("errorReason").and_then(|r| r.as_str()))
                .map(|r| {
                    r.chars()
                        .filter(|c| c.is_ascii_alphanumeric() || *c == '_')
                        .take(60)
                        .collect::<String>()
                })
                .collect()
        })
        .unwrap_or_default();
    if reasons.is_empty() {
        String::new()
    } else {
        format!(" ({})", reasons.join(", "))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::extract::Query;
    use axum::routing::{get, post};
    use axum::{Json, Router};
    use serde_json::{json, Value};
    use std::collections::HashMap;

    async fn serve(app: Router) -> String {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            axum::serve(listener, app).await.unwrap();
        });
        format!("http://{addr}")
    }

    #[tokio::test]
    async fn clients_are_paged_until_a_short_page() {
        let app = Router::new()
            .route(
                "/branches/ES0006",
                get(|| async { Json(json!({"encodedKey": "bk", "id": "ES0006"})) }),
            )
            .route(
            "/clients:search",
            post(|Query(q): Query<HashMap<String, String>>, Json(body): Json<Value>| async move {
                assert_eq!(body["filterCriteria"][0]["value"], "bk");
                let offset: usize = q.get("offset").and_then(|o| o.parse().ok()).unwrap_or(0);
                let all = ["A", "B", "C"];
                let page: Vec<Value> = all
                    .iter()
                    .skip(offset)
                    .take(2)
                    .map(|id| json!({"encodedKey": format!("k{id}"), "id": id, "state": "ACTIVE", "firstName": "NEVER-READ"}))
                    .collect();
                Json(page)
            }),
        );
        let base = serve(app).await;
        let client = MambuApiClient::with_api_key(&base, "test", 2);
        let clients = client.clients("ES0006").await.unwrap();
        assert_eq!(clients.len(), 3);
        assert_eq!(clients[2].id, "C");
    }

    #[tokio::test]
    async fn accounting_report_is_polled_until_complete() {
        let app = Router::new()
            .route(
                "/accounting/reports",
                post(|| async { Json(json!({"reportKey": "rk1", "status": "QUEUED"})) }),
            )
            .route(
                "/accounting/reports/rk1",
                get(|| async {
                    use std::sync::atomic::{AtomicU32, Ordering};
                    static CALLS: AtomicU32 = AtomicU32::new(0);
                    let n = CALLS.fetch_add(1, Ordering::SeqCst);
                    if n == 0 {
                        Json(json!({"reportKey": "rk1", "status": "IN_PROGRESS"}))
                    } else {
                        Json(json!({"reportKey": "rk1", "status": "COMPLETE", "items": [
                            {"glAccount": {"glCode": "1101", "type": "ASSET", "usage": "DETAIL"},
                             "amounts": {"closingBalance": 12.5}}
                        ]}))
                    }
                }),
            );
        let base = serve(app).await;
        let client = MambuApiClient::with_api_key(&base, "test", 2);
        let report = client
            .accounting_report(
                "ES0006",
                NaiveDate::from_ymd_opt(2026, 9, 1).unwrap(),
                NaiveDate::from_ymd_opt(2026, 9, 30).unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(report.items.len(), 1);
        assert_eq!(report.items[0].amounts.closing_balance, 12.5);
    }

    #[tokio::test]
    async fn client_error_is_reported_without_details() {
        let app = Router::new().route(
            "/branches",
            get(|| async { (StatusCode::FORBIDDEN, "secret detail") }),
        );
        let base = serve(app).await;
        let err = MambuApiClient::with_api_key(&base, "test", 2)
            .branches()
            .await
            .unwrap_err();
        assert!(!err.to_string().contains("secret detail"));
    }

    #[tokio::test]
    async fn mambu_error_code_is_added_to_the_error_without_other_text() {
        let app = Router::new().route(
            "/branches",
            get(|| async {
                (
                    StatusCode::FORBIDDEN,
                    axum::Json(serde_json::json!({"errors": [
                        {"errorCode": 15, "errorSource": "Jane Doe 12345", "errorReason": "INVALID_PERMISSIONS"}
                    ]})),
                )
            }),
        );
        let base = serve(app).await;
        let err = MambuApiClient::with_api_key(&base, "test", 2)
            .branches()
            .await
            .unwrap_err()
            .to_string();
        assert!(err.contains("(INVALID_PERMISSIONS)"), "{err}");
        assert!(!err.contains("Jane"), "{err}");
    }

    #[tokio::test]
    async fn report_request_waits_while_mambu_is_busy_with_another_report() {
        use std::sync::atomic::{AtomicU32, Ordering};
        use std::sync::Arc;
        let calls = Arc::new(AtomicU32::new(0));
        let counter = calls.clone();
        let app = Router::new()
            .route(
                "/accounting/reports",
                post(move || {
                    let counter = counter.clone();
                    async move {
                        if counter.fetch_add(1, Ordering::SeqCst) < 2 {
                            (
                                StatusCode::BAD_REQUEST,
                                Json(json!({"errors": [{"errorCode": 1, "errorReason": "ANOTHER_TASK_IN_PROGRESS"}]})),
                            )
                        } else {
                            (
                                StatusCode::ACCEPTED,
                                Json(json!({"reportKey": "rk9", "status": "QUEUED"})),
                            )
                        }
                    }
                }),
            )
            .route(
                "/accounting/reports/rk9",
                get(|| async {
                    Json(json!({"reportKey": "rk9", "status": "COMPLETE", "items": []}))
                }),
            );
        let base = serve(app).await;
        let report = MambuApiClient::with_api_key(&base, "test", 2)
            .accounting_report(
                "ES0006",
                NaiveDate::from_ymd_opt(2026, 9, 1).unwrap(),
                NaiveDate::from_ymd_opt(2026, 9, 30).unwrap(),
            )
            .await
            .unwrap();
        assert!(report.items.is_empty());
        assert_eq!(
            calls.load(Ordering::SeqCst),
            3,
            "two refusals, then accepted"
        );
    }
}
