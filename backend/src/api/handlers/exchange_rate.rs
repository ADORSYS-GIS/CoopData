//! Admin-configurable USD exchange rates used to standardize analytics
//! dashboards on a single currency. Ministry-only — see services::currency
//! for why this is a fixed rate rather than a live FX feed.

use axum::extract::{Extension, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use utoipa::ToSchema;

use crate::auth::claims::Claims;
use crate::entities::enums::Currency;
use crate::error::{AppError, AppResult};
use crate::AppState;

#[derive(Debug, Serialize, ToSchema)]
pub struct ExchangeRateResponse {
    pub currency_code: String,
    pub rate_to_usd: f64,
    pub updated_at: chrono::DateTime<chrono::Utc>,
    pub updated_by: Option<uuid::Uuid>,
    pub effective_date: chrono::NaiveDate,
    pub source_note: Option<String>,
}

impl From<crate::entities::exchange_rate::Model> for ExchangeRateResponse {
    fn from(m: crate::entities::exchange_rate::Model) -> Self {
        use rust_decimal::prelude::ToPrimitive;
        Self {
            currency_code: m.currency_code.as_str().to_string(),
            rate_to_usd: m.rate_to_usd.to_f64().unwrap_or(1.0),
            updated_at: m.updated_at,
            updated_by: m.updated_by,
            effective_date: m.effective_date,
            source_note: m.source_note,
        }
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateExchangeRateRequest {
    pub currency_code: String,
    /// Units of native currency per 1 USD (e.g. 18.5 for SZL).
    pub rate_to_usd: f64,
    /// Date the rate takes effect (defaults to today).
    pub effective_date: Option<chrono::NaiveDate>,
    /// Where the rate comes from, e.g. "Central Bank of Eswatini, 24 Sep 2026".
    pub source_note: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct ExchangeRateHistoryResponse {
    pub id: uuid::Uuid,
    pub currency_code: String,
    pub rate_to_usd: f64,
    pub effective_date: chrono::NaiveDate,
    pub source_note: Option<String>,
    pub changed_by: Option<uuid::Uuid>,
    pub changed_at: chrono::DateTime<chrono::Utc>,
}

/// Rate that applies to a submission's statement currency: the frozen rate
/// when the submission has one, otherwise the currently configured rate.
/// USD needs no conversion and yields None.
pub fn rate_used_for(
    currency: &Currency,
    submission: Option<&crate::entities::submission::Model>,
    current: &[crate::entities::exchange_rate::Model],
) -> Option<crate::api::dto::common::RateUsed> {
    use crate::api::dto::common::RateUsed;
    use rust_decimal::prelude::ToPrimitive;

    if *currency == Currency::Usd {
        return None;
    }
    if let Some(sub) = submission {
        if let Some(rate) = sub.rate_to_usd.and_then(|d| d.to_f64()) {
            return Some(RateUsed {
                currency_code: currency.as_str().to_string(),
                rate_to_usd: rate,
                effective_date: sub.rate_effective_date,
                source: sub.rate_source.clone(),
                frozen: true,
            });
        }
    }
    current
        .iter()
        .find(|r| r.currency_code == *currency)
        .map(|r| RateUsed {
            currency_code: currency.as_str().to_string(),
            rate_to_usd: r.rate_to_usd.to_f64().unwrap_or(1.0),
            effective_date: Some(r.effective_date),
            source: r.source_note.clone(),
            frozen: false,
        })
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/exchange-rates",
    responses((status = 200, description = "All configured exchange rates", body = [ExchangeRateResponse])),
    tag = "Ministry"
)]
pub async fn list_exchange_rates(State(state): State<AppState>) -> AppResult<impl IntoResponse> {
    let rows = state.exchange_rate_repo.find_all().await?;
    let resp: Vec<ExchangeRateResponse> = rows.into_iter().map(Into::into).collect();
    Ok((StatusCode::OK, Json(resp)))
}

#[utoipa::path(
    put,
    path = "/api/v1/ministry/exchange-rates",
    request_body = UpdateExchangeRateRequest,
    responses(
        (status = 200, description = "Rate updated", body = ExchangeRateResponse),
        (status = 400, description = "Invalid currency code or rate")
    ),
    tag = "Ministry"
)]
pub async fn update_exchange_rate(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(body): Json<UpdateExchangeRateRequest>,
) -> AppResult<impl IntoResponse> {
    if body.rate_to_usd <= 0.0 {
        return Err(AppError::BadRequest(
            "rate_to_usd must be a positive number".into(),
        ));
    }
    let currency = match body.currency_code.to_uppercase().as_str() {
        "SZL" => Currency::Szl,
        "USD" => Currency::Usd,
        other => {
            return Err(AppError::BadRequest(format!(
                "Unknown currency code '{other}'"
            )))
        }
    };
    let updated_by = uuid::Uuid::parse_str(&claims.sub).ok();
    let rate = rust_decimal::Decimal::try_from(body.rate_to_usd)
        .map_err(|_| AppError::BadRequest("Invalid rate_to_usd".into()))?;

    let effective_date = body
        .effective_date
        .unwrap_or_else(|| chrono::Utc::now().date_naive());
    let source_note = body
        .source_note
        .map(|n| n.trim().to_string())
        .filter(|n| !n.is_empty());

    let model = state
        .exchange_rate_repo
        .upsert(currency, rate, effective_date, source_note, updated_by)
        .await?;
    tracing::info!(
        currency = %model.currency_code.as_str(),
        rate = body.rate_to_usd,
        "Exchange rate updated"
    );
    Ok((StatusCode::OK, Json(ExchangeRateResponse::from(model))))
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/exchange-rates/history",
    responses((status = 200, description = "Exchange rate change history, newest first", body = [ExchangeRateHistoryResponse])),
    tag = "Ministry"
)]
pub async fn list_exchange_rate_history(
    State(state): State<AppState>,
) -> AppResult<impl IntoResponse> {
    use rust_decimal::prelude::ToPrimitive;

    let rows = state.exchange_rate_repo.find_history(None, 100).await?;
    let resp: Vec<ExchangeRateHistoryResponse> = rows
        .into_iter()
        .map(|h| ExchangeRateHistoryResponse {
            id: h.id,
            currency_code: h.currency_code.as_str().to_string(),
            rate_to_usd: h.rate_to_usd.to_f64().unwrap_or(1.0),
            effective_date: h.effective_date,
            source_note: h.source_note,
            changed_by: h.changed_by,
            changed_at: h.changed_at,
        })
        .collect();
    Ok((StatusCode::OK, Json(resp)))
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal::Decimal;

    fn current_rate() -> crate::entities::exchange_rate::Model {
        crate::entities::exchange_rate::Model {
            currency_code: Currency::Szl,
            rate_to_usd: Decimal::new(200, 1),
            updated_at: chrono::Utc::now(),
            updated_by: None,
            effective_date: chrono::NaiveDate::from_ymd_opt(2026, 9, 24).unwrap(),
            source_note: Some("current".into()),
        }
    }

    #[test]
    fn usd_needs_no_rate() {
        assert!(rate_used_for(&Currency::Usd, None, &[current_rate()]).is_none());
    }

    #[test]
    fn draft_uses_current_rate_unfrozen() {
        let used = rate_used_for(&Currency::Szl, None, &[current_rate()]).unwrap();
        assert_eq!(used.rate_to_usd, 20.0);
        assert!(!used.frozen);
    }
}
