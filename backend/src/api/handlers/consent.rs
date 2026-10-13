use std::sync::Arc;

use axum::extract::{Extension, Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use uuid::Uuid;
use validator::Validate;

use crate::api::dto::{
    ConsentStatusResponse, PrivacyRequestInput, PrivacyRequestResponse, RecordConsentRequest,
    UserConsentResponse,
};
use crate::api::middleware::AuditContext;
use crate::auth::claims::Claims;
use crate::entities::user_consents;
use crate::error::{AppError, AppResult};
use crate::AppState;

/// Version reported before any policy has been published.
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
        "DATA_USE_CONSENT" => Some("data-use"),
        "DATA_PROCESSING_GOVERNANCE" => Some("data-processing"),
        _ => None,
    }
}

/// Whether the user's latest acceptance of a document is for its current
/// published version. An acceptance of an earlier version no longer counts, so
/// publishing a new version asks the user to accept again.
fn accepts_current(latest: Option<&user_consents::Model>, current_version: &str) -> bool {
    latest.is_some_and(|consent| consent.document_version == current_version)
}

/// Document types a consent can be recorded for.
const DOCUMENT_TYPES: [&str; 8] = [
    "TERMS_OF_SERVICE",
    "PRIVACY_POLICY",
    "COOKIE_POLICY",
    "ACCEPTABLE_USE",
    "SECURITY_PROTECTION",
    "DATA_RETENTION",
    "DATA_USE_CONSENT",
    "DATA_PROCESSING_GOVERNANCE",
];

/// How a policy version is shown and stored in consent records, e.g. `2.0`.
fn version_label(version: i32) -> String {
    format!("{version}.0")
}

/// Resolves the current published version string for a document type from the
/// legal_policies table, falling back to a default when no policy is seeded.
async fn current_policy_version(state: &AppState, document_type: &str, default: &str) -> String {
    let Some(slug) = document_type_to_slug(document_type) else {
        return default.to_string();
    };

    match state.legal_policy_repo.get_latest_by_slug(slug).await {
        Ok(Some(policy)) => version_label(policy.version),
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
    Extension(audit_ctx): Extension<AuditContext>,
    Json(payload): Json<RecordConsentRequest>,
) -> AppResult<impl IntoResponse> {
    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;
    if document_type_to_slug(&payload.document_type).is_none() {
        return Err(AppError::BadRequest(format!(
            "Unknown document type; expected one of: {}",
            DOCUMENT_TYPES.join(", ")
        )));
    }
    // The accepted version is the one published now, never what the client says.
    let document_version =
        current_policy_version(&state, &payload.document_type, DEFAULT_TERMS_VERSION).await;

    // Same client address as the audit log: the entry appended by the trusted
    // proxy, not a value the client can write into X-Forwarded-For.
    let ip_address = audit_ctx.ip_address;
    let user_agent = audit_ctx.user_agent;

    let model = state
        .consent_repo
        .record_consent(
            &claims.sub,
            &payload.document_type,
            &document_version,
            ip_address,
            user_agent,
        )
        .await?;

    Ok((StatusCode::CREATED, Json(UserConsentResponse::from(model))))
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
    let response: Vec<UserConsentResponse> = consents
        .into_iter()
        .map(UserConsentResponse::from)
        .collect();

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

    let terms_accepted = accepts_current(latest_terms.as_ref(), &current_terms_version);
    let privacy_accepted = accepts_current(latest_privacy.as_ref(), &current_privacy_version);

    let all_consents = state.consent_repo.get_user_consents(&claims.sub).await?;

    let response = ConsentStatusResponse {
        terms_accepted,
        terms_version: current_terms_version,
        privacy_accepted,
        privacy_version: current_privacy_version,
        has_accepted_all_required: terms_accepted && privacy_accepted,
        accepted_consents: all_consents
            .into_iter()
            .map(UserConsentResponse::from)
            .collect(),
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
    payload
        .validate()
        .map_err(|e| AppError::ValidationError(e.to_string()))?;

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
    let requests = state
        .consent_repo
        .get_user_privacy_requests(&claims.sub)
        .await?;
    let response: Vec<PrivacyRequestResponse> = requests
        .into_iter()
        .map(PrivacyRequestResponse::from)
        .collect();
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
    let response: Vec<PrivacyRequestResponse> = requests
        .into_iter()
        .map(PrivacyRequestResponse::from)
        .collect();
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn every_policy_document_maps_to_its_published_slug() {
        assert_eq!(document_type_to_slug("TERMS_OF_SERVICE"), Some("terms"));
        assert_eq!(document_type_to_slug("PRIVACY_POLICY"), Some("privacy"));
        assert_eq!(document_type_to_slug("COOKIE_POLICY"), Some("cookies"));
        assert_eq!(
            document_type_to_slug("ACCEPTABLE_USE"),
            Some("acceptable-use")
        );
        assert_eq!(
            document_type_to_slug("SECURITY_PROTECTION"),
            Some("security")
        );
        assert_eq!(
            document_type_to_slug("DATA_RETENTION"),
            Some("data-retention")
        );
        assert_eq!(document_type_to_slug("DATA_USE_CONSENT"), Some("data-use"));
        assert_eq!(
            document_type_to_slug("DATA_PROCESSING_GOVERNANCE"),
            Some("data-processing")
        );
    }

    #[test]
    fn every_listed_document_type_can_be_accepted() {
        for document_type in DOCUMENT_TYPES {
            assert!(
                document_type_to_slug(document_type).is_some(),
                "{document_type}"
            );
        }
    }

    fn consent_for(version: &str) -> user_consents::Model {
        let now = chrono::Utc::now();
        user_consents::Model {
            id: Uuid::nil(),
            user_id: "user-1".into(),
            document_type: "TERMS_OF_SERVICE".into(),
            document_version: version.into(),
            accepted_at: now,
            ip_address: None,
            user_agent: None,
            created_at: now,
        }
    }

    #[test]
    fn an_acceptance_of_the_current_version_counts() {
        assert!(accepts_current(
            Some(&consent_for("1.0")),
            &version_label(1)
        ));
    }

    #[test]
    fn publishing_a_new_version_asks_users_to_accept_again() {
        let accepted_v1 = consent_for("1.0");

        assert!(!accepts_current(Some(&accepted_v1), &version_label(2)));
    }

    #[test]
    fn no_acceptance_means_not_accepted() {
        assert!(!accepts_current(None, &version_label(1)));
    }

    #[test]
    fn unknown_documents_cannot_be_accepted() {
        assert_eq!(document_type_to_slug("MARKETING"), None);
        assert_eq!(document_type_to_slug(""), None);
    }

    #[test]
    fn versions_are_labelled_as_major_versions() {
        assert_eq!(version_label(1), "1.0");
        assert_eq!(version_label(12), "12.0");
    }
}
