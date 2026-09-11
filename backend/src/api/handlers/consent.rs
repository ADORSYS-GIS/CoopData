use std::sync::Arc;

use axum::extract::{Extension, Path, State};
use axum::http::{HeaderMap, StatusCode};
use axum::response::IntoResponse;
use axum::Json;
use uuid::Uuid;
use validator::Validate;

use crate::api::dto::{
    ConsentStatusResponse, PrivacyRequestInput, PrivacyRequestResponse, RecordConsentRequest,
    UserConsentResponse,
};
use crate::auth::claims::Claims;
use crate::error::{AppError, AppResult};
use crate::AppState;

const DEFAULT_TERMS_VERSION: &str = "1.0";
const DEFAULT_PRIVACY_VERSION: &str = "1.0";

/// Maps a consent document_type to the legal_policies slug that holds its
/// latest published version. Returns None for document types not managed as
/// versioned policies.
fn document_type_to_slug(document_type: &str) -> Option<&'static str> {
    match document_type {
        "TERMS_OF_SERVICE" => Some("terms"),
        "PRIVACY_POLICY" => Some("privacy"),
        "COOKIE_POLICY" => Some("cookies"),
        "ACCEPTABLE_USE" => Some("acceptable-use"),
        "SECURITY_PROTECTION" => Some("security"),
        "DATA_RETENTION" => Some("data-retention"),
        _ => None,
    }
}

/// Resolves the current published version string for a document type from the
/// legal_policies table, falling back to a default when no policy is seeded.
async fn current_policy_version(
    state: &AppState,
    document_type: &str,
    default: &str,
) -> String {
    let Some(slug) = document_type_to_slug(document_type) else {
        return default.to_string();
    };

    match state.legal_policy_repo.get_latest_by_slug(slug).await {
        Ok(Some(policy)) => format!("{}.0", policy.version),
        _ => default.to_string(),
    }
}

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
    let current_terms_version =
        current_policy_version(&state, "TERMS_OF_SERVICE", DEFAULT_TERMS_VERSION).await;
    let current_privacy_version =
        current_policy_version(&state, "PRIVACY_POLICY", DEFAULT_PRIVACY_VERSION).await;

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
        .map(|t| t.document_version == current_terms_version)
        .unwrap_or(false);

    let privacy_accepted = latest_privacy
        .as_ref()
        .map(|p| p.document_version == current_privacy_version)
        .unwrap_or(false);

    let all_consents = state.consent_repo.get_user_consents(&claims.sub).await?;

    let response = ConsentStatusResponse {
        terms_accepted,
        terms_version: current_terms_version,
        privacy_accepted,
        privacy_version: current_privacy_version,
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

#[utoipa::path(
    get,
    path = "/api/v1/privacy/requests/me",
    responses(
        (status = 200, description = "Current user's privacy requests", body = Vec<PrivacyRequestResponse>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
    ),
    tag = "Legal & Consent"
)]
pub async fn get_my_privacy_requests(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    let requests = state.consent_repo.get_user_privacy_requests(&claims.sub).await?;
    let response: Vec<PrivacyRequestResponse> =
        requests.into_iter().map(PrivacyRequestResponse::from).collect();
    Ok((StatusCode::OK, Json(response)))
}

#[utoipa::path(
    get,
    path = "/api/v1/privacy/requests",
    responses(
        (status = 200, description = "All privacy requests (admin)", body = Vec<PrivacyRequestResponse>),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Forbidden", body = ErrorResponse),
    ),
    tag = "Legal & Consent"
)]
pub async fn list_all_privacy_requests(
    State(state): State<AppState>,
) -> AppResult<impl IntoResponse> {
    let requests = state.consent_repo.list_all_privacy_requests().await?;
    let response: Vec<PrivacyRequestResponse> =
        requests.into_iter().map(PrivacyRequestResponse::from).collect();
    Ok((StatusCode::OK, Json(response)))
}

#[utoipa::path(
    put,
    path = "/api/v1/privacy/requests/{request_id}",
    params(
        ("request_id" = Uuid, Path, description = "Privacy request UUID")
    ),
    request_body = PrivacyRequestStatusUpdate,
    responses(
        (status = 200, description = "Privacy request status updated", body = PrivacyRequestResponse),
        (status = 404, description = "Request not found", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse),
        (status = 403, description = "Forbidden", body = ErrorResponse),
    ),
    tag = "Legal & Consent"
)]
pub async fn update_privacy_request_status(
    State(state): State<AppState>,
    Path(request_id): Path<Uuid>,
    Json(payload): Json<crate::api::dto::consent::PrivacyRequestStatusUpdate>,
) -> AppResult<impl IntoResponse> {
    let valid = ["PENDING", "IN_PROGRESS", "COMPLETED", "REJECTED"];
    if !valid.contains(&payload.status.as_str()) {
        return Err(AppError::ValidationError(format!(
            "Invalid status '{}'. Allowed: {}",
            payload.status,
            valid.join(", ")
        )));
    }

    let model = state
        .consent_repo
        .update_privacy_request_status(request_id, &payload.status)
        .await?
        .ok_or_else(|| AppError::NotFound("Privacy request not found".into()))?;

    Ok((StatusCode::OK, Json(PrivacyRequestResponse::from(model))))
}
