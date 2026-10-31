use std::time::Duration;

use chrono::NaiveDate;
use reqwest::{Client, RequestBuilder, StatusCode};
use serde::de::DeserializeOwned;
use serde_json::json;

use crate::config::AppConfig;
use crate::error::{AppError, AppResult};
use crate::services::mambu::models::{
    MambuBranch, MambuClient, MambuDeposit, MambuLoan, MambuProduct, MambuReport,
};

const ACCEPT_V2: &str = "application/vnd.mambu.v2+json";
const MAX_ATTEMPTS: u32 = 3;
const REPORT_POLLS: u32 = 40;
const REPORT_POLL_DELAY: Duration = Duration::from_secs(3);

#[derive(Clone)]
enum Credentials {
    Basic { username: String, password: String },
    ApiKey(String),
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
            let result = self.request(make()).send().await;
            match result {
                Ok(resp) => {
                    let status = resp.status();
                    let retryable =
                        status == StatusCode::TOO_MANY_REQUESTS || status.is_server_error();
                    if retryable && attempt < MAX_ATTEMPTS {
                        tokio::time::sleep(Duration::from_secs(u64::from(attempt) * 2)).await;
                        continue;
                    }
                    if !status.is_success() {
                        tracing::warn!(status = %status, request = label, "Mambu request failed");
                        return Err(AppError::InternalServerError(format!(
                            "Mambu request {label} failed with status {status}"
                        )));
                    }
                    return Ok(resp);
                }
                Err(e) => {
                    if attempt < MAX_ATTEMPTS {
                        tokio::time::sleep(Duration::from_secs(u64::from(attempt) * 2)).await;
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
            let resp = self
                .send(path, || {
                    self.http
                        .get(&url)
                        .query(query)
                        .query(&[("limit", limit.as_str()), ("offset", off.as_str())])
                })
                .await?;
            let page: Vec<T> = resp.json().await.map_err(|e| {
                tracing::warn!(error = %e, path, "Unexpected Mambu response");
                AppError::InternalServerError("Unexpected response from Mambu".into())
            })?;
            let count = page.len() as u32;
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

    pub async fn clients(&self, branch_id: &str) -> AppResult<Vec<MambuClient>> {
        self.get_pages(
            "/clients",
            &[
                ("branchId", branch_id.to_string()),
                ("detailsLevel", "FULL".to_string()),
            ],
        )
        .await
    }

    pub async fn deposits(&self, branch_id: &str) -> AppResult<Vec<MambuDeposit>> {
        self.get_pages(
            "/deposits",
            &[
                ("branchId", branch_id.to_string()),
                ("detailsLevel", "FULL".to_string()),
            ],
        )
        .await
    }

    pub async fn loans(&self, branch_id: &str) -> AppResult<Vec<MambuLoan>> {
        self.get_pages(
            "/loans",
            &[
                ("branchId", branch_id.to_string()),
                ("detailsLevel", "FULL".to_string()),
            ],
        )
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
        let resp = self
            .send("POST /accounting/reports", || {
                self.http.post(&url).json(&body)
            })
            .await?;
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
        let app = Router::new().route(
            "/clients",
            get(|Query(q): Query<HashMap<String, String>>| async move {
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
}
