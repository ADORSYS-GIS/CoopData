use std::sync::Arc;

use axum::extract::{Extension, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use validator::Validate;

use crate::api::dto::{
    ConsentStatusResponse, PrivacyRequestInput, PrivacyRequestResponse, RecordConsentRequest,
    UserConsentResponse,
};
use crate::auth::claims::Claims;
use crate::error::{AppError, AppResult};
use crate::AppState;

const CURRENT_TERMS_VERSION: &str = "1.0";
const CURRENT_PRIVACY_VERSION: &str = "1.0";

#[utoipa::path(
    post,
    path = "/api/v1/consents",
    request_body = RecordConsentRequest,
    responses(
        (status = 201, description = "Consent recorded successfully", body = UserConsentResponse),
        (status = 400, description = "Invalid payload", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
    ),
    tag = "Legal & Consent"
)]
pub async fn record_consent(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    headers: HeaderMap,
    Json(payload): Json<RecordConsentRequest>,
) -> AppResult<impl IntoResponse> {
    payload.validate().map_err(|e| AppError::ValidationError(e.to_string()))?;

    let ip_address = headers
        .get("x-forwarded-for")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.split(',').next().unwrap_or(s).trim().to_string());

    let user_agent = headers
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string());

    let model = state
        .consent_repo
        .record_consent(
            &claims.sub,
            &payload.document_type,
            &payload.document_version,
            ip_address,
            user_agent,
        )
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(UserConsentResponse::from(model)),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/consents/me",
    responses(
        (status = 200, description = "User consent history retrieved", body = Vec<UserConsentResponse>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
    ),
    tag = "Legal & Consent"
)]
pub async fn get_my_consents(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    let consents = state.consent_repo.get_user_consents(&claims.sub).await?;
    let response: Vec<UserConsentResponse> =
        consents.into_iter().map(UserConsentResponse::from).collect();

    Ok((StatusCode::OK, Json(response)))
}

#[utoipa::path(
    get,
    path = "/api/v1/consents/status",
    responses(
        (status = 200, description = "Consent status retrieved", body = ConsentStatusResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
    ),
    tag = "Legal & Consent"
)]
pub async fn get_consent_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    let latest_terms = state
        .consent_repo
        .get_latest_user_consent(&claims.sub, "TERMS_OF_SERVICE")
        .await?;

    let latest_privacy = state
        .consent_repo
        .get_latest_user_consent(&claims.sub, "PRIVACY_POLICY")
        .await?;

    let terms_accepted = latest_terms
        .as_ref()
        .map(|t| t.document_version == CURRENT_TERMS_VERSION)
        .unwrap_or(false);

    let privacy_accepted = latest_privacy
        .as_ref()
        .map(|p| p.document_version == CURRENT_PRIVACY_VERSION)
        .unwrap_or(false);

    let all_consents = state.consent_repo.get_user_consents(&claims.sub).await?;

    let response = ConsentStatusResponse {
        terms_accepted,
        terms_version: CURRENT_TERMS_VERSION.to_string(),
        privacy_accepted,
        privacy_version: CURRENT_PRIVACY_VERSION.to_string(),
        has_accepted_all_required: terms_accepted && privacy_accepted,
        accepted_consents: all_consents.into_iter().map(UserConsentResponse::from).collect(),
    };

    Ok((StatusCode::OK, Json(response)))
}

#[utoipa::path(
    post,
    path = "/api/v1/privacy/requests",
    request_body = PrivacyRequestInput,
    responses(
        (status = 201, description = "Privacy request submitted successfully", body = PrivacyRequestResponse),
        (status = 400, description = "Invalid payload", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
    ),
    tag = "Legal & Consent"
)]
pub async fn submit_privacy_request(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(payload): Json<PrivacyRequestInput>,
) -> AppResult<impl IntoResponse> {
    payload.validate().map_err(|e| AppError::ValidationError(e.to_string()))?;

    let model = state
        .consent_repo
        .create_privacy_request(&claims.sub, &payload.request_type, payload.details)
        .await?;

    Ok((
        StatusCode::CREATED,
        Json(PrivacyRequestResponse::from(model)),
    ))
}
