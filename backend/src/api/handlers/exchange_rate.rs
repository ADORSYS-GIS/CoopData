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
}

impl From<crate::entities::exchange_rate::Model> for ExchangeRateResponse {
    fn from(m: crate::entities::exchange_rate::Model) -> Self {
        use rust_decimal::prelude::ToPrimitive;
        Self {
            currency_code: m.currency_code.as_str().to_string(),
            rate_to_usd: m.rate_to_usd.to_f64().unwrap_or(1.0),
            updated_at: m.updated_at,
            updated_by: m.updated_by,
        }
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateExchangeRateRequest {
    pub currency_code: String,
    /// Units of native currency per 1 USD (e.g. 18.5 for SZL).
    pub rate_to_usd: f64,
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

    let model = state
        .exchange_rate_repo
        .upsert(currency, rate, updated_by)
        .await?;
    Ok((StatusCode::OK, Json(ExchangeRateResponse::from(model))))
}
