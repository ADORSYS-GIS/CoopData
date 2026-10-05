use std::sync::Arc;

use axum::extract::{Extension, Path, State};
use axum::response::IntoResponse;
use axum::Json;
use uuid::Uuid;

use crate::auth::claims::Claims;
use crate::error::{AppError, AppResult};
use crate::services::questionnaire_report::{dashboard_for_submission, is_questionnaire_method};
use crate::AppState;

/// GET /api/v1/cooperative/submissions/{id}/questionnaire-report
///
/// KPI data for the questionnaire PDF report of one submission. Same access
/// rule as the PDF export itself.
#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions/{id}/questionnaire-report",
    params(("id" = Uuid, Path, description = "Submission ID")),
    responses(
        (status = 200, description = "Report data", body = BasicDashboardResponse),
        (status = 400, description = "Submission was not filled in through the questionnaire"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Export"
)]
pub async fn get_questionnaire_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let allowed_coops =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if !allowed_coops.contains(&submission.cooperative_id) {
        return Err(AppError::Forbidden(
            "Access denied to this cooperative's submission".into(),
        ));
    }
    if !is_questionnaire_method(&submission.submission_method) {
        return Err(AppError::BadRequest(
            "This submission was not filled in through the questionnaire".into(),
        ));
    }

    let dashboard = dashboard_for_submission(&state, &submission).await?;
    Ok(Json(dashboard))
}
