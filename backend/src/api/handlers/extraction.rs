use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use uuid::Uuid;

use crate::api::dto::extraction::ExtractionJobResponse;
use crate::error::{AppError, AppResult};
use crate::AppState;

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/extraction-jobs/{id}",
    params(("id" = Uuid, Path, description = "Extraction job ID")),
    responses(
        (status = 200, description = "Extraction job status", body = ExtractionJobResponse),
        (status = 404, description = "Not found")
    ),
    tag = "Cooperative"
)]
pub async fn get_extraction_job(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let job = state
        .extraction_job_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Extraction job not found".into()))?;

    Ok((StatusCode::OK, Json(ExtractionJobResponse::from(job))))
}
