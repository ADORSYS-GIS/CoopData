use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::api::dto::extraction::ExtractionJobResponse;
use crate::auth::Claims;
use crate::error::{AppError, AppResult};
use crate::AppState;

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/extraction-jobs/{id}",
    params(("id" = Uuid, Path, description = "Extraction job ID")),
    responses(
        (status = 200, description = "Extraction job status", body = ExtractionJobResponse),
        (status = 403, description = "Forbidden — job does not belong to your scope"),
        (status = 404, description = "Not found")
    ),
    tag = "Cooperative"
)]
pub async fn get_extraction_job(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let job = state
        .extraction_job_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Extraction job not found".into()))?;

    // Tenant identity is derived from JWT claims only. Resolve the submission's
    // cooperative and verify it belongs to the caller's scope before returning
    // any extraction data (raw text, extracted JSON, confidence).
    let submission = state
        .submission_repo
        .find_by_id(job.submission_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Extraction job not found".into()))?;

    let coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;
    if !coop_ids.contains(&submission.cooperative_id) {
        return Err(AppError::NotFound("Extraction job not found".into()));
    }

    Ok((StatusCode::OK, Json(ExtractionJobResponse::from(job))))
}
