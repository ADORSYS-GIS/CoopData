use axum::body::Body;
use axum::http::StatusCode;
use axum::response::Response;
use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Extension, Json,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::api::dto::report_export::ReportStatusResponse;
use crate::auth::claims::Claims;
use crate::error::{AppError, AppResult};
use crate::services::export_generator::QUESTIONNAIRE_LOCALE;
use crate::services::narrative_translation;
use crate::services::report_jobs::{self, ReportTarget};
use crate::AppState;

#[derive(Debug, serde::Deserialize)]
pub struct ExportQuery {
    pub federation_id: Option<Uuid>,
    pub apex_id: Option<Uuid>,
    #[serde(alias = "year")]
    pub reporting_year: Option<i32>,
    /// `questionnaire` exports the report built from questionnaire answers;
    /// anything else (or nothing) exports the statement-based report.
    pub method: Option<String>,
    /// Report locale (`en`, `fr`, `pt`, `ss`). Accepts `lng` as an alias. Defaults to `en`.
    #[serde(alias = "lng")]
    pub lang: Option<String>,
    /// Prepare: regenerate the English report from the current data.
    #[serde(default)]
    pub regenerate: bool,
}

#[derive(Debug, serde::Deserialize, Default)]
pub struct SingleExportQuery {
    /// Report locale (`en`, `fr`, `pt`, `ss`). Accepts `lng` as an alias. Defaults to `en`.
    #[serde(alias = "lng")]
    pub lang: Option<String>,
    /// Prepare: regenerate the English report from the current data.
    #[serde(default)]
    pub regenerate: bool,
}

/// Normalises a requested report locale, defaulting to English.
fn requested_locale(lang: Option<&str>) -> String {
    crate::services::localization::normalize_lang(lang)
        .unwrap_or_else(|| crate::services::localization::FALLBACK_LOCALE.to_string())
}

/// The requested locale, or English for English-only (questionnaire) reports.
fn report_locale(target: ReportTarget, lang: Option<&str>) -> String {
    if target.languages().len() == 1 {
        QUESTIONNAIRE_LOCALE.to_string()
    } else {
        requested_locale(lang)
    }
}

/// The report of a submission the caller may access.
async fn submission_target(state: &AppState, claims: &Claims, id: Uuid) -> AppResult<ReportTarget> {
    let allowed_coops =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(state, claims).await?;

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

    Ok(ReportTarget::Submission {
        id,
        questionnaire: crate::services::questionnaire_report::is_questionnaire_method(
            &submission.submission_method,
        ),
    })
}

/// The consolidated report (apex, federation or national) the caller asked for,
/// restricted to the caller's scope.
async fn consolidated_target(
    state: &AppState,
    claims: &Claims,
    query: &ExportQuery,
) -> AppResult<ReportTarget> {
    let mut apex_id = query.apex_id;
    let mut federation_id = query.federation_id;
    if apex_id.is_none() && claims.is_apex() {
        if let Ok(id) =
            crate::api::handlers::cooperative::resolve_caller_apex_db_id_pub(state, claims).await
        {
            apex_id = Some(id);
        }
    }
    if federation_id.is_none() && claims.is_federation() {
        if let Some(org_id) = claims.get_organization_id() {
            if let Ok(Some(fed)) = state.federation_repo.find_by_keycloak_id(&org_id).await {
                federation_id = Some(fed.id);
            }
        }
    }

    let mut allowed_coops =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(state, claims).await?;

    if allowed_coops.is_empty() {
        return Err(AppError::Forbidden(
            "No cooperatives in your scope to export".into(),
        ));
    }

    if let Some(apex_id) = apex_id {
        let coops = state.cooperative_repo.find_by_apex_id(apex_id).await?;
        let coop_ids: Vec<Uuid> = coops.into_iter().map(|c| c.id).collect();
        allowed_coops.retain(|id| coop_ids.contains(id));
    } else if let Some(fed_id) = federation_id {
        let apexes = state.apex_repo.find_by_federation_id(fed_id).await?;
        let mut coop_ids = vec![];
        for apex in apexes {
            let coops = state.cooperative_repo.find_by_apex_id(apex.id).await?;
            coop_ids.extend(coops.into_iter().map(|c| c.id));
        }
        allowed_coops.retain(|id| coop_ids.contains(id));
    }

    if allowed_coops.is_empty() {
        return Err(AppError::Forbidden(
            "No cooperatives matching the selected hierarchical filter".into(),
        ));
    }

    let questionnaire = query
        .method
        .as_deref()
        .is_some_and(|m| m.eq_ignore_ascii_case("questionnaire"));
    let year = query
        .reporting_year
        .ok_or_else(|| {
            AppError::BadRequest("reporting_year is required for consolidated exports".into())
        })?
        .clamp(1900, 2100);

    Ok(match (apex_id, federation_id) {
        (Some(id), _) => ReportTarget::Apex {
            id,
            year,
            questionnaire,
        },
        (None, Some(id)) => ReportTarget::Federation {
            id,
            year,
            questionnaire,
        },
        (None, None) => ReportTarget::Ministry {
            year,
            questionnaire,
        },
    })
}

/// Streams the PDF of a ready language; 409 while it is not ready.
async fn download(state: &AppState, target: ReportTarget, lang: &str) -> AppResult<Response> {
    match report_jobs::ready_pdf(state, target, lang).await? {
        Some(bytes) => Ok(pdf_response(bytes, &target.filename(lang))),
        None => Err(AppError::Conflict("The report is not ready yet".into())),
    }
}

async fn status_response(
    state: &AppState,
    target: ReportTarget,
) -> AppResult<Json<ReportStatusResponse>> {
    let statuses = report_jobs::statuses(state, target).await?;
    Ok(Json(ReportStatusResponse::new(target, statuses)))
}

async fn prepare_response(
    state: &AppState,
    target: ReportTarget,
    lang: Option<&str>,
    regenerate: bool,
) -> AppResult<(StatusCode, Json<ReportStatusResponse>)> {
    let lang = report_locale(target, lang);
    let statuses = report_jobs::prepare(state, target, &lang, regenerate).await?;
    Ok((
        StatusCode::ACCEPTED,
        Json(ReportStatusResponse::new(target, statuses)),
    ))
}

/// GET /api/v1/{tier}/submissions/{id}/export
/// Downloads the PDF of a submission report in one language once it is ready.
#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions/{id}/export",
    params(
        ("id" = Uuid, Path, description = "Submission ID"),
        ("lang" = Option<String>, Query, description = "Report locale: en | fr | pt | ss (default en)")
    ),
    responses(
        (status = 200, description = "PDF file stream"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found"),
        (status = 409, description = "The report is not ready in this language")
    ),
    tag = "Export"
)]
pub async fn export_single_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Query(query): Query<SingleExportQuery>,
) -> AppResult<impl IntoResponse> {
    let target = submission_target(&state, &claims, id).await?;
    let lang = report_locale(target, query.lang.as_deref());
    download(&state, target, &lang).await
}

/// GET /api/v1/{tier}/submissions/{id}/report
/// Status of every language of a submission report.
#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions/{id}/report",
    params(("id" = Uuid, Path, description = "Submission ID")),
    responses(
        (status = 200, description = "Report status per language", body = ReportStatusResponse),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Export"
)]
pub async fn get_submission_report_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let target = submission_target(&state, &claims, id).await?;
    status_response(&state, target).await
}

/// POST /api/v1/{tier}/submissions/{id}/report/prepare
/// Starts preparing one language of a submission report in the background.
#[utoipa::path(
    post,
    path = "/api/v1/cooperative/submissions/{id}/report/prepare",
    params(
        ("id" = Uuid, Path, description = "Submission ID"),
        ("lang" = Option<String>, Query, description = "Report locale: en | fr | pt | ss (default en)"),
        ("regenerate" = Option<bool>, Query, description = "Regenerate the English report from the current data")
    ),
    responses(
        (status = 202, description = "Preparation started (or already running)", body = ReportStatusResponse),
        (status = 400, description = "Language not available for this report"),
        (status = 403, description = "Forbidden"),
        (status = 409, description = "The English report must be ready first")
    ),
    tag = "Export"
)]
pub async fn prepare_submission_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Query(query): Query<SingleExportQuery>,
) -> AppResult<impl IntoResponse> {
    let target = submission_target(&state, &claims, id).await?;
    tracing::info!(report = %target.key(), lang = ?query.lang, regenerate = query.regenerate, "Report preparation requested");
    prepare_response(&state, target, query.lang.as_deref(), query.regenerate).await
}

/// GET /api/v1/apex/export
/// GET /api/v1/federation/export
/// GET /api/v1/ministry/export
/// Downloads a consolidated report PDF of the caller's scope once it is ready.
#[utoipa::path(
    get,
    path = "/api/v1/apex/export",
    params(
        ("apex_id" = Option<Uuid>, Query, description = "Apex (federation and ministry users)"),
        ("federation_id" = Option<Uuid>, Query, description = "Federation (ministry users)"),
        ("reporting_year" = i32, Query, description = "Reporting year"),
        ("method" = Option<String>, Query, description = "`questionnaire` for the questionnaire report"),
        ("lang" = Option<String>, Query, description = "Report locale: en | fr | pt | ss (default en)")
    ),
    responses(
        (status = 200, description = "Consolidated PDF file stream"),
        (status = 403, description = "Forbidden"),
        (status = 409, description = "The report is not ready in this language")
    ),
    tag = "Export"
)]
pub async fn export_bulk_consolidated(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(query): Query<ExportQuery>,
) -> AppResult<impl IntoResponse> {
    let target = consolidated_target(&state, &claims, &query).await?;
    let lang = report_locale(target, query.lang.as_deref());
    download(&state, target, &lang).await
}

/// GET /api/v1/{apex|federation|ministry}/report
/// Status of every language of a consolidated report.
#[utoipa::path(
    get,
    path = "/api/v1/apex/report",
    params(
        ("apex_id" = Option<Uuid>, Query, description = "Apex (federation and ministry users)"),
        ("federation_id" = Option<Uuid>, Query, description = "Federation (ministry users)"),
        ("reporting_year" = i32, Query, description = "Reporting year"),
        ("method" = Option<String>, Query, description = "`questionnaire` for the questionnaire report")
    ),
    responses(
        (status = 200, description = "Report status per language", body = ReportStatusResponse),
        (status = 400, description = "reporting_year missing"),
        (status = 403, description = "Forbidden")
    ),
    tag = "Export"
)]
pub async fn get_consolidated_report_status(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(query): Query<ExportQuery>,
) -> AppResult<impl IntoResponse> {
    let target = consolidated_target(&state, &claims, &query).await?;
    status_response(&state, target).await
}

/// POST /api/v1/{apex|federation|ministry}/report/prepare
/// Starts preparing one language of a consolidated report in the background.
#[utoipa::path(
    post,
    path = "/api/v1/apex/report/prepare",
    params(
        ("apex_id" = Option<Uuid>, Query, description = "Apex (federation and ministry users)"),
        ("federation_id" = Option<Uuid>, Query, description = "Federation (ministry users)"),
        ("reporting_year" = i32, Query, description = "Reporting year"),
        ("method" = Option<String>, Query, description = "`questionnaire` for the questionnaire report"),
        ("lang" = Option<String>, Query, description = "Report locale: en | fr | pt | ss (default en)"),
        ("regenerate" = Option<bool>, Query, description = "Regenerate the English report from the current data")
    ),
    responses(
        (status = 202, description = "Preparation started (or already running)", body = ReportStatusResponse),
        (status = 400, description = "Language not available for this report"),
        (status = 403, description = "Forbidden"),
        (status = 409, description = "The English report must be ready first")
    ),
    tag = "Export"
)]
pub async fn prepare_consolidated_report(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(query): Query<ExportQuery>,
) -> AppResult<impl IntoResponse> {
    let target = consolidated_target(&state, &claims, &query).await?;
    tracing::info!(report = %target.key(), lang = ?query.lang, regenerate = query.regenerate, "Report preparation requested");
    prepare_response(&state, target, query.lang.as_deref(), query.regenerate).await
}

fn pdf_response(bytes: Vec<u8>, filename: &str) -> Response {
    let mut res = Response::new(Body::from(bytes));
    let headers = res.headers_mut();
    headers.insert(
        axum::http::header::CONTENT_TYPE,
        axum::http::HeaderValue::from_static("application/pdf"),
    );
    if let Ok(value) =
        axum::http::HeaderValue::from_str(&format!("attachment; filename=\"{filename}\""))
    {
        headers.insert(axum::http::header::CONTENT_DISPOSITION, value);
    }
    res
}

/// GET /api/v1/{tier}/submissions/{id}/narratives
/// Returns AI-generated narratives for a submission from metadata cache.
/// Accepts an optional `?lng=` query param (en | fr | pt | ss). Defaults to "en".
#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions/{id}/narratives",
    params(
        ("id" = Uuid, Path, description = "Submission ID"),
        ("lng" = Option<String>, Query, description = "Locale code (en|fr|pt|ss)")
    ),
    responses(
        (status = 200, description = "AI narratives or null"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Export"
)]
pub async fn get_submission_narratives(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Query(params): Query<SingleExportQuery>,
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

    let lang = requested_locale(params.lang.as_deref());
    let narratives = submission
        .metadata
        .get("ai_narratives")
        .cloned()
        .map(|v| narrative_translation::select_locale(v, &lang));

    Ok(axum::Json(narratives))
}

/// POST /api/v1/{tier}/submissions/{id}/narratives/generate
/// Triggers manual AI narrative regeneration. Ministry admin role protected.
#[utoipa::path(
    post,
    path = "/api/v1/cooperative/submissions/{id}/narratives/generate",
    params(
        ("id" = Uuid, Path, description = "Submission ID")
    ),
    responses(
        (status = 200, description = "Regenerated AI narratives"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Export"
)]
pub async fn generate_submission_narratives(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_ministry() {
        return Err(AppError::Forbidden(
            "Only Ministry admin users can trigger manual narrative generation".into(),
        ));
    }

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

    let questionnaire = crate::services::questionnaire_report::is_questionnaire_method(
        &submission.submission_method,
    );
    report_jobs::regenerate_submission_narratives(&state, id, questionnaire).await?;

    let stored = state
        .submission_repo
        .find_by_id(id)
        .await?
        .and_then(|s| s.metadata.get("ai_narratives").cloned())
        .map(|v| narrative_translation::select_locale(v, "en"));
    Ok(axum::Json(stored.unwrap_or(serde_json::Value::Null)))
}

/// GET /api/v1/apex/{id}/narratives?year=2025
/// Returns cached AI narratives for an apex report.
#[utoipa::path(
    get,
    path = "/api/v1/apex/{id}/narratives",
    params(
        ("id" = String, Path, description = "Apex Keycloak ID"),
        ("year" = i32, Query, description = "Reporting year"),
        ("lng" = Option<String>, Query, description = "Locale code (en|fr|pt|ss)")
    ),
    responses(
        (status = 200, description = "AI narratives or null"),
        (status = 404, description = "Not found")
    ),
    tag = "Export"
)]
pub async fn get_apex_narratives(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(params): Query<ExportQuery>,
) -> AppResult<impl IntoResponse> {
    let year = params.reporting_year.unwrap_or(2025).clamp(1900, 2100);
    let apex = state
        .apex_repo
        .find_by_keycloak_id(&id)
        .await?
        .ok_or_else(|| AppError::NotFound("Apex not found".into()))?;

    let year_key = format!("ai_narratives_{}", year);
    let raw = apex.metadata.and_then(|m| m.get(&year_key).cloned());

    let lang = requested_locale(params.lang.as_deref());
    let narratives = raw.map(|v| narrative_translation::select_locale(v, &lang));

    Ok(axum::Json(narratives))
}

/// GET /api/v1/federation/{id}/narratives?year=2025
/// Returns cached AI narratives for a federation report.
#[utoipa::path(
    get,
    path = "/api/v1/federation/{id}/narratives",
    params(
        ("id" = String, Path, description = "Federation Keycloak ID"),
        ("year" = i32, Query, description = "Reporting year"),
        ("lng" = Option<String>, Query, description = "Locale code (en|fr|pt|ss)")
    ),
    responses(
        (status = 200, description = "AI narratives or null"),
        (status = 404, description = "Not found")
    ),
    tag = "Export"
)]
pub async fn get_federation_narratives(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(params): Query<ExportQuery>,
) -> AppResult<impl IntoResponse> {
    let year = params.reporting_year.unwrap_or(2025).clamp(1900, 2100);
    let federation = state
        .federation_repo
        .find_by_keycloak_id(&id)
        .await?
        .ok_or_else(|| AppError::NotFound("Federation not found".into()))?;

    let year_key = format!("ai_narratives_{}", year);
    let raw = federation.metadata.and_then(|m| m.get(&year_key).cloned());

    let lang = requested_locale(params.lang.as_deref());
    let narratives = raw.map(|v| narrative_translation::select_locale(v, &lang));

    Ok(axum::Json(narratives))
}

/// GET /api/v1/ministry/submissions/narratives?year=2025
/// Returns cached AI narratives for the ministry national report.
#[utoipa::path(
    get,
    path = "/api/v1/ministry/submissions/narratives",
    params(
        ("year" = i32, Query, description = "Reporting year"),
        ("lng" = Option<String>, Query, description = "Locale code (en|fr|pt|ss)")
    ),
    responses(
        (status = 200, description = "AI narratives or null"),
        (status = 404, description = "Not found")
    ),
    tag = "Export"
)]
pub async fn get_ministry_narratives(
    State(state): State<AppState>,
    Query(params): Query<ExportQuery>,
) -> AppResult<impl IntoResponse> {
    let year = params.reporting_year.unwrap_or(2025).clamp(1900, 2100);
    let cached = state.ministry_narratives_repo.find_by_year(year).await?;

    let raw = cached.map(|c| c.narratives_json);
    let lang = requested_locale(params.lang.as_deref());
    let narratives = raw.map(|v| narrative_translation::select_locale(v, &lang));

    Ok(axum::Json(narratives))
}
