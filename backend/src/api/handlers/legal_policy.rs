// src/api/handlers/legal_policy.rs
use axum::extract::{Path, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;

use crate::api::dto::legal_policy::LegalPolicyResponse;
use crate::error::{AppError, AppResult};
use crate::AppState;

#[utoipa::path(
    get,
    path = "/api/v1/legal/policies",
    responses(
        (status = 200, description = "List latest legal policies", body = Vec<LegalPolicyResponse>),
    ),
    tag = "Legal & Consent"
)]
pub async fn list_policies(State(state): State<AppState>) -> AppResult<impl IntoResponse> {
    let policies = state.legal_policy_repo.list_latest().await?;
    let response: Vec<LegalPolicyResponse> = policies
        .into_iter()
        .map(LegalPolicyResponse::from)
        .collect();
    Ok((StatusCode::OK, Json(response)))
}

#[utoipa::path(
    get,
    path = "/api/v1/legal/policies/{id}",
    params(
        ("id" = String, Path, description = "Legal policy slug identifier")
    ),
    responses(
        (status = 200, description = "Get latest policy by slug", body = LegalPolicyResponse),
        (status = 404, description = "Policy not found"),
    ),
    tag = "Legal & Consent"
)]
pub async fn get_policy_by_slug(
    State(state): State<AppState>,
    Path(slug): Path<String>,
) -> AppResult<impl IntoResponse> {
    let policy = state
        .legal_policy_repo
        .get_latest_by_slug(&slug)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Policy with slug '{}' not found", slug)))?;

    Ok((StatusCode::OK, Json(LegalPolicyResponse::from(policy))))
}
