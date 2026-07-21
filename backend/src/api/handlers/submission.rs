use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::Datelike;
use sea_orm::Set;
use std::sync::Arc;
use uuid::Uuid;

use crate::api::dto::apex::ApexStatsResponse;
use crate::api::dto::submission::{
    CooperativeStatsResponse, CreateSubmissionRequest, SubmissionResponse,
    SubmissionReviewResponse, SubmissionSectionResponse, UpdateSectionStatusRequest,
};
use crate::auth::claims::Claims;

use crate::entities::enums::SubmissionStatus;
use crate::entities::submission::ActiveModel;
use crate::error::{AppError, AppResult};
use crate::repositories::submission_section::VALID_STATUSES;
use crate::AppState;

#[utoipa::path(
    post,
    path = "/api/v1/cooperative/submissions",
    request_body = CreateSubmissionRequest,
    responses(
        (status = 201, description = "Submission created", body = SubmissionResponse),
        (status = 400, description = "Invalid input"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Cooperative profile not found"),
        (status = 409, description = "Submission already exists for this year")
    ),
    tag = "Cooperative"
)]
pub async fn create_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(body): Json<CreateSubmissionRequest>,
) -> AppResult<impl IntoResponse> {
    let current_year = chrono::Utc::now().year();
    if body.reporting_year < current_year - 5 || body.reporting_year > current_year {
        return Err(AppError::BadRequest(format!(
            "reporting_year must be between {} and {}",
            current_year - 5,
            current_year
        )));
    }

    let coop =
        crate::api::handlers::cooperative::resolve_caller_cooperative(&state, &claims).await?;

    if let Some(existing) = state
        .submission_repo
        .find_by_cooperative_and_year(coop.id, body.reporting_year)
        .await?
    {
        if existing.status == crate::entities::enums::SubmissionStatus::Draft {
            tracing::info!(
                submission_id = %existing.id,
                "Deleting existing draft submission to allow re-creation"
            );
            state.submission_repo.delete(existing.id).await?;
        } else {
            return Err(AppError::Conflict(format!(
                "A submission already exists for reporting year {} (status: {})",
                body.reporting_year,
                existing.status.as_str()
            )));
        }
    }

    let seq = state
        .submission_repo
        .count_by_reporting_year(body.reporting_year)
        .await? as u32
        + 1;
    let reference = format!("SUB-{}-{:05}", body.reporting_year, seq);

    let submitted_by = Uuid::parse_str(&claims.sub).ok();

    let model = ActiveModel {
        id: Set(Uuid::new_v4()),
        reference: Set(Some(reference)),
        cooperative_id: Set(coop.id),
        reporting_year: Set(body.reporting_year),
        status: Set(crate::entities::enums::SubmissionStatus::Draft),
        current_tier: Set(crate::entities::enums::ReviewTier::Cooperative),
        submitted_by: Set(submitted_by),
        submitted_at: Set(None),
        last_reviewed_by: Set(None),
        last_reviewed_at: Set(None),
        rejection_reason: Set(None),
        priority: Set(body.priority),
        metadata: Set(serde_json::json!({})),
        created_at: Set(chrono::Utc::now()),
        updated_at: Set(chrono::Utc::now()),
    };

    let submission = state.submission_repo.create(model).await?;

    let section_models =
        crate::repositories::submission_section::SubmissionSectionRepository::new_section_models(
            submission.id,
        );
    let sections = state
        .section_repo
        .create_many(section_models)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "Failed to create submission sections");
            e
        })?;

    tracing::info!(
        submission_id = %submission.id,
        cooperative_id = %coop.id,
        reporting_year = %body.reporting_year,
        "Submission created with {} sections",
        sections.len()
    );

    let mut resp = SubmissionResponse::from(submission);
    resp.sections = sections
        .into_iter()
        .map(SubmissionSectionResponse::from)
        .collect();
    Ok((StatusCode::CREATED, Json(resp)))
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions",
    responses(
        (status = 200, description = "List of submissions for the cooperative", body = Vec<SubmissionResponse>),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Cooperative profile not found")
    ),
    tag = "Cooperative"
)]
pub async fn list_cooperative_submissions(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    let coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let subs = state
        .submission_repo
        .find_by_cooperative_ids(coop_ids)
        .await?;
    let sub_ids: Vec<Uuid> = subs.iter().map(|s| s.id).collect();

    // Batch-fetch all enrichment data in 3 queries instead of 3N
    let fs_list = state
        .financial_statement_repo
        .find_by_submission_ids(sub_ids.clone())
        .await
        .unwrap_or_default();
    let fs_map: std::collections::HashMap<Uuid, Uuid> =
        fs_list.iter().map(|fs| (fs.submission_id, fs.id)).collect();

    let job_list = state
        .extraction_job_repo
        .find_by_submission_ids(sub_ids.clone())
        .await
        .unwrap_or_default();
    let job_map: std::collections::HashMap<Uuid, Uuid> =
        job_list.iter().map(|j| (j.submission_id, j.id)).collect();
    let file_map: std::collections::HashMap<Uuid, Uuid> = job_list
        .iter()
        .map(|j| (j.submission_id, j.source_file_id))
        .collect();

    let section_list = state
        .section_repo
        .find_by_submission_ids(sub_ids)
        .await
        .unwrap_or_default();
    let mut sections_by_sub: std::collections::HashMap<Uuid, Vec<SubmissionSectionResponse>> =
        std::collections::HashMap::new();
    for sec in section_list {
        sections_by_sub
            .entry(sec.submission_id)
            .or_default()
            .push(SubmissionSectionResponse::from(sec));
    }

    let responses = subs
        .into_iter()
        .map(|sub| {
            let sub_id = sub.id;
            let fs_id = fs_map.get(&sub_id).copied();
            let job_id = job_map.get(&sub_id).copied();
            let file_id = file_map.get(&sub_id).copied();
            let sections = sections_by_sub.remove(&sub_id).unwrap_or_default();
            SubmissionResponse::from(sub)
                .with_fs(fs_id, job_id, file_id)
                .with_sections(sections)
        })
        .collect::<Vec<_>>();

    Ok((StatusCode::OK, Json(responses)))
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions/{id}",
    params(("id" = Uuid, Path, description = "Submission ID")),
    responses(
        (status = 200, description = "Submission found", body = SubmissionResponse),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Cooperative"
)]
pub async fn get_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if !coop_ids.contains(&submission.cooperative_id) {
        return Err(AppError::Forbidden(
            "Access denied: this submission does not belong to your cooperative".into(),
        ));
    }

    let mut resp = SubmissionResponse::from(submission);
    if let Ok(Some(fs)) = state.financial_statement_repo.find_by_submission(id).await {
        let job = state
            .extraction_job_repo
            .find_by_submission(id)
            .await
            .ok()
            .flatten();
        let job_id = job.as_ref().map(|j| j.id);
        let file_id = job.as_ref().map(|j| j.source_file_id);
        resp = resp.with_fs(Some(fs.id), job_id, file_id);
    }
    if let Ok(sections) = state.section_repo.find_by_submission(id).await {
        let section_resps: Vec<SubmissionSectionResponse> = sections
            .into_iter()
            .map(SubmissionSectionResponse::from)
            .collect();
        resp = resp.with_sections(section_resps);
    }

    Ok((StatusCode::OK, Json(resp)))
}

use crate::api::dto::upload::{AbnormalityFlagResponse, ReviewActionRequest};
use crate::services::abnormality_detector::AbnormalityDetector;
use crate::services::submission_workflow::SubmissionWorkflow;

// ── Validate extraction (re-run Stage 3) ────────────────────────────────────

#[utoipa::path(
    post,
    path = "/api/v1/cooperative/submissions/{id}/validate-extraction",
    params(("id" = Uuid, Path, description = "Submission ID")),
    responses(
        (status = 200, description = "Validation complete", body = Vec<AbnormalityFlagResponse>),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Cooperative"
)]
pub async fn validate_extraction(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop =
        crate::api::handlers::cooperative::resolve_caller_cooperative(&state, &claims).await?;

    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if submission.cooperative_id != coop.id {
        return Err(AppError::Forbidden("Access denied".into()));
    }

    let fs = state
        .financial_statement_repo
        .find_by_submission(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Financial statement not found".into()))?;

    let removed = state
        .line_item_repo
        .delete_unmapped_by_financial_statement(fs.id)
        .await?;
    if removed > 0 {
        tracing::info!(submission_id = %id, removed, "Discarded unmapped line items");
    }

    let coa = state.coa_repo.find_all().await?;
    let coop_type = coop
        .institution_type
        .as_ref()
        .map(|t| t.as_str())
        .unwrap_or("other");
    let detector = AbnormalityDetector::new(
        state.line_item_repo.clone(),
        state.flag_repo.clone(),
        state.coa_repo.clone(),
    );
    let (errors, warnings) = detector.run(id, coop.id, fs.id, &coa, coop_type).await?;

    let validation_json = serde_json::json!({"errors": errors, "warnings": warnings});
    state
        .financial_statement_repo
        .set_validation_errors(fs.id, validation_json)
        .await?;

    let flags = state
        .flag_repo
        .find_by_submission(id)
        .await?
        .into_iter()
        .map(AbnormalityFlagResponse::from)
        .collect::<Vec<_>>();

    Ok((StatusCode::OK, Json(flags)))
}

// ── Submit (cooperative → submitted) ─────────────────────────────────────────

#[utoipa::path(
    post,
    path = "/api/v1/cooperative/submissions/{id}/submit",
    params(("id" = Uuid, Path, description = "Submission ID")),
    responses(
        (status = 200, description = "Submission submitted", body = SubmissionResponse),
        (status = 400, description = "Error flags must be resolved first"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Cooperative"
)]
pub async fn submit_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop =
        crate::api::handlers::cooperative::resolve_caller_cooperative(&state, &claims).await?;

    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if submission.cooperative_id != coop.id {
        return Err(AppError::Forbidden("Access denied".into()));
    }

    let workflow = SubmissionWorkflow::new(
        state.submission_repo.clone(),
        state.review_repo.clone(),
        state.flag_repo.clone(),
        state.section_repo.clone(),
        state.financial_statement_repo.clone(),
    );
    workflow.submit(id, &claims).await?;

    let updated = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    tracing::info!(submission_id = %id, cooperative_id = %coop.id, "Submission submitted to apex");
    Ok((StatusCode::OK, Json(SubmissionResponse::from(updated))))
}

// ── Get submission flags ──────────────────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/v1/apex/submissions/{id}/flags",
    params(("id" = Uuid, Path, description = "Submission ID")),
    responses(
        (status = 200, description = "Abnormality flags", body = Vec<AbnormalityFlagResponse>),
        (status = 404, description = "Not found")
    ),
    tag = "Apex"
)]
pub async fn get_submission_flags(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let flags = state
        .flag_repo
        .find_by_submission(id)
        .await?
        .into_iter()
        .map(AbnormalityFlagResponse::from)
        .collect::<Vec<_>>();

    Ok((StatusCode::OK, Json(flags)))
}

// ── Review handlers (Apex) ────────────────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/v1/apex/submissions",
    responses(
        (status = 200, description = "Submissions for apex review", body = Vec<SubmissionResponse>),
        (status = 403, description = "Forbidden")
    ),
    tag = "Apex"
)]
pub async fn list_apex_submissions(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    let apex_db_id =
        crate::api::handlers::cooperative::resolve_caller_apex_db_id_pub(&state, &claims).await?;

    let cooperatives = state.cooperative_repo.find_by_apex_id(apex_db_id).await?;
    let coop_map: std::collections::HashMap<Uuid, String> = cooperatives
        .iter()
        .map(|c| {
            let name = if c.display_name.is_empty() {
                c.name.clone()
            } else {
                c.display_name.clone()
            };
            (c.id, name)
        })
        .collect();
    let coop_ids: Vec<Uuid> = cooperatives.iter().map(|c| c.id).collect();

    let subs = state
        .submission_repo
        .find_by_cooperative_ids(coop_ids)
        .await?
        .into_iter()
        .filter(|s| s.status != SubmissionStatus::Draft)
        .map(|s| {
            let name = coop_map.get(&s.cooperative_id).cloned();
            SubmissionResponse::from(s)
                .with_cooperative_name(name)
                .with_apex_id(Some(apex_db_id))
        })
        .collect::<Vec<_>>();

    Ok((StatusCode::OK, Json(subs)))
}

#[utoipa::path(
    get,
    path = "/api/v1/apex/submissions/{id}",
    params(("id" = Uuid, Path, description = "Submission ID")),
    responses(
        (status = 200, description = "Submission found", body = SubmissionResponse),
        (status = 403, description = "Forbidden — submission does not belong to your apex"),
        (status = 404, description = "Submission not found")
    ),
    tag = "Apex"
)]
pub async fn get_submission_as_apex(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let apex_db_id =
        crate::api::handlers::cooperative::resolve_caller_apex_db_id_pub(&state, &claims).await?;

    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    // Verify the submission belongs to one of this apex's cooperatives
    let cooperatives = state.cooperative_repo.find_by_apex_id(apex_db_id).await?;
    let belongs = cooperatives
        .iter()
        .any(|c| c.id == submission.cooperative_id);
    if !belongs {
        return Err(AppError::Forbidden(
            "Access denied: submission does not belong to your apex".into(),
        ));
    }

    let mut resp = SubmissionResponse::from(submission);
    if let Ok(Some(fs)) = state.financial_statement_repo.find_by_submission(id).await {
        let job = state
            .extraction_job_repo
            .find_by_submission(id)
            .await
            .ok()
            .flatten();
        let job_id = job.as_ref().map(|j| j.id);
        let file_id = job.as_ref().map(|j| j.source_file_id);
        resp = resp.with_fs(Some(fs.id), job_id, file_id);
    }
    if let Ok(sections) = state.section_repo.find_by_submission(id).await {
        resp = resp.with_sections(
            sections
                .into_iter()
                .map(SubmissionSectionResponse::from)
                .collect(),
        );
    }
    Ok((StatusCode::OK, Json(resp)))
}

#[utoipa::path(
    get,
    path = "/api/v1/federation/submissions/{id}",
    params(("id" = Uuid, Path, description = "Submission ID")),
    responses(
        (status = 200, description = "Submission found", body = SubmissionResponse),
        (status = 403, description = "Forbidden — submission does not belong to your federation"),
        (status = 404, description = "Submission not found")
    ),
    tag = "Federation"
)]
pub async fn get_submission_as_federation(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let org_id = claims.get_organization_id().ok_or_else(|| {
        AppError::Forbidden("Federation user has no organization associated".into())
    })?;

    let federation = state
        .federation_repo
        .find_by_keycloak_id(&org_id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Federation not found in database".into()))?;

    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    let apexes = state.apex_repo.find_by_federation_id(federation.id).await?;
    let mut coop_ids: Vec<Uuid> = vec![];
    for apex in &apexes {
        let coops = state.cooperative_repo.find_by_apex_id(apex.id).await?;
        coop_ids.extend(coops.iter().map(|c| c.id));
    }

    if !coop_ids.contains(&submission.cooperative_id) {
        return Err(AppError::Forbidden(
            "Access denied: submission does not belong to your federation".into(),
        ));
    }

    let mut resp = SubmissionResponse::from(submission);
    if let Ok(Some(fs)) = state.financial_statement_repo.find_by_submission(id).await {
        let job = state
            .extraction_job_repo
            .find_by_submission(id)
            .await
            .ok()
            .flatten();
        let job_id = job.as_ref().map(|j| j.id);
        let file_id = job.as_ref().map(|j| j.source_file_id);
        resp = resp.with_fs(Some(fs.id), job_id, file_id);
    }
    if let Ok(sections) = state.section_repo.find_by_submission(id).await {
        resp = resp.with_sections(
            sections
                .into_iter()
                .map(SubmissionSectionResponse::from)
                .collect(),
        );
    }
    Ok((StatusCode::OK, Json(resp)))
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/submissions/{id}",
    params(("id" = Uuid, Path, description = "Submission ID")),
    responses(
        (status = 200, description = "Submission found", body = SubmissionResponse),
        (status = 404, description = "Submission not found")
    ),
    tag = "Ministry"
)]
pub async fn get_submission_as_ministry(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    let mut resp = SubmissionResponse::from(submission);
    if let Ok(Some(fs)) = state.financial_statement_repo.find_by_submission(id).await {
        let job = state
            .extraction_job_repo
            .find_by_submission(id)
            .await
            .ok()
            .flatten();
        let job_id = job.as_ref().map(|j| j.id);
        let file_id = job.as_ref().map(|j| j.source_file_id);
        resp = resp.with_fs(Some(fs.id), job_id, file_id);
    }
    if let Ok(sections) = state.section_repo.find_by_submission(id).await {
        resp = resp.with_sections(
            sections
                .into_iter()
                .map(SubmissionSectionResponse::from)
                .collect(),
        );
    }
    Ok((StatusCode::OK, Json(resp)))
}

#[utoipa::path(
    post,
    path = "/api/v1/apex/submissions/{id}/approve",
    params(("id" = Uuid, Path, description = "Submission ID")),
    request_body = ReviewActionRequest,
    responses(
        (status = 200, description = "Approved, forwarded to federation", body = SubmissionResponse),
        (status = 400, description = "Invalid state"),
        (status = 404, description = "Not found")
    ),
    tag = "Apex"
)]
pub async fn apex_approve_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewActionRequest>,
) -> AppResult<impl IntoResponse> {
    let workflow = SubmissionWorkflow::new(
        state.submission_repo.clone(),
        state.review_repo.clone(),
        state.flag_repo.clone(),
        state.section_repo.clone(),
        state.financial_statement_repo.clone(),
    );
    workflow.apex_approve(id, &claims, body.comment).await?;
    let updated = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Not found".into()))?;
    Ok((StatusCode::OK, Json(SubmissionResponse::from(updated))))
}

#[utoipa::path(
    post,
    path = "/api/v1/apex/submissions/{id}/return",
    params(("id" = Uuid, Path, description = "Submission ID")),
    request_body = ReviewActionRequest,
    responses(
        (status = 200, description = "Returned to cooperative", body = SubmissionResponse),
        (status = 400, description = "Invalid state"),
        (status = 404, description = "Not found")
    ),
    tag = "Apex"
)]
pub async fn apex_return_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewActionRequest>,
) -> AppResult<impl IntoResponse> {
    let workflow = SubmissionWorkflow::new(
        state.submission_repo.clone(),
        state.review_repo.clone(),
        state.flag_repo.clone(),
        state.section_repo.clone(),
        state.financial_statement_repo.clone(),
    );
    workflow.apex_return(id, &claims, body.comment).await?;
    let updated = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Not found".into()))?;
    Ok((StatusCode::OK, Json(SubmissionResponse::from(updated))))
}

// ── Review handlers (Federation) ─────────────────────────────────────────────

#[derive(Debug, serde::Deserialize, utoipa::IntoParams)]
pub struct SubmissionsQuery {
    pub all: Option<bool>,
}

#[utoipa::path(
    get,
    path = "/api/v1/federation/submissions",
    params(SubmissionsQuery),
    responses(
        (status = 200, description = "Submissions for federation review", body = Vec<SubmissionResponse>),
        (status = 403, description = "Forbidden")
    ),
    tag = "Federation"
)]
pub async fn list_federation_submissions(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(query): Query<SubmissionsQuery>,
) -> AppResult<impl IntoResponse> {
    let org_id = claims.get_organization_id().ok_or_else(|| {
        AppError::Forbidden("Federation user has no organization associated".into())
    })?;

    let federation = state
        .federation_repo
        .find_by_keycloak_id(&org_id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Federation not found in database".into()))?;

    let apexes = state.apex_repo.find_by_federation_id(federation.id).await?;

    let mut coop_ids: Vec<Uuid> = vec![];
    let mut coop_map: std::collections::HashMap<Uuid, String> = std::collections::HashMap::new();
    let mut apex_map: std::collections::HashMap<Uuid, (Uuid, String)> =
        std::collections::HashMap::new();
    for apex in &apexes {
        let apex_name = if apex.display_name.is_empty() {
            apex.organization_keycloak_id.clone()
        } else {
            apex.display_name.clone()
        };
        let coops = state.cooperative_repo.find_by_apex_id(apex.id).await?;
        for c in coops {
            let coop_name = if c.display_name.is_empty() {
                c.name.clone()
            } else {
                c.display_name.clone()
            };
            coop_map.insert(c.id, coop_name);
            apex_map.insert(c.id, (apex.id, apex_name.clone()));
            coop_ids.push(c.id);
        }
    }

    let subs = if query.all.unwrap_or(false) {
        state
            .submission_repo
            .find_by_cooperative_ids(coop_ids)
            .await?
            .into_iter()
            .filter(|s| s.status != crate::entities::enums::SubmissionStatus::Draft)
            .collect::<Vec<_>>()
    } else {
        state
            .submission_repo
            .find_by_cooperative_ids_and_tier(
                coop_ids,
                crate::entities::enums::ReviewTier::Federation,
            )
            .await?
    };

    let subs_mapped = subs
        .into_iter()
        .map(|s| {
            let name = coop_map.get(&s.cooperative_id).cloned();
            let apex_info = apex_map.get(&s.cooperative_id);
            let apex_name = apex_info.map(|x| x.1.clone());
            let apex_id = apex_info.map(|x| x.0);
            SubmissionResponse::from(s)
                .with_cooperative_name(name)
                .with_apex_name(apex_name)
                .with_apex_id(apex_id)
                .with_federation_id(Some(federation.id))
        })
        .collect::<Vec<_>>();

    Ok((StatusCode::OK, Json(subs_mapped)))
}

#[utoipa::path(
    post,
    path = "/api/v1/federation/submissions/{id}/approve",
    params(("id" = Uuid, Path, description = "Submission ID")),
    request_body = ReviewActionRequest,
    responses(
        (status = 200, description = "Approved, forwarded to ministry", body = SubmissionResponse),
        (status = 400, description = "Invalid state"),
        (status = 404, description = "Not found")
    ),
    tag = "Federation"
)]
pub async fn federation_approve_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewActionRequest>,
) -> AppResult<impl IntoResponse> {
    let workflow = SubmissionWorkflow::new(
        state.submission_repo.clone(),
        state.review_repo.clone(),
        state.flag_repo.clone(),
        state.section_repo.clone(),
        state.financial_statement_repo.clone(),
    );
    workflow
        .federation_approve(id, &claims, body.comment)
        .await?;
    let updated = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Not found".into()))?;
    Ok((StatusCode::OK, Json(SubmissionResponse::from(updated))))
}

#[utoipa::path(
    post,
    path = "/api/v1/federation/submissions/{id}/return",
    params(("id" = Uuid, Path, description = "Submission ID")),
    request_body = ReviewActionRequest,
    responses(
        (status = 200, description = "Returned to apex", body = SubmissionResponse),
        (status = 400, description = "Invalid state"),
        (status = 404, description = "Not found")
    ),
    tag = "Federation"
)]
pub async fn federation_return_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewActionRequest>,
) -> AppResult<impl IntoResponse> {
    let workflow = SubmissionWorkflow::new(
        state.submission_repo.clone(),
        state.review_repo.clone(),
        state.flag_repo.clone(),
        state.section_repo.clone(),
        state.financial_statement_repo.clone(),
    );
    workflow
        .federation_return(id, &claims, body.comment)
        .await?;
    let updated = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Not found".into()))?;
    Ok((StatusCode::OK, Json(SubmissionResponse::from(updated))))
}

// ── Review handlers (Ministry) ────────────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/v1/ministry/submissions",
    params(SubmissionsQuery),
    responses(
        (status = 200, description = "Submissions for ministry review", body = Vec<SubmissionResponse>),
        (status = 403, description = "Forbidden")
    ),
    tag = "Ministry"
)]
pub async fn list_ministry_submissions(
    State(state): State<AppState>,
    Query(query): Query<SubmissionsQuery>,
) -> AppResult<impl IntoResponse> {
    let subs = if query.all.unwrap_or(false) {
        state.submission_repo.find_all_non_draft().await?
    } else {
        state
            .submission_repo
            .find_by_tier(crate::entities::enums::ReviewTier::Ministry)
            .await?
    };

    let coop_ids: Vec<Uuid> = subs.iter().map(|s| s.cooperative_id).collect();
    let coops = state
        .cooperative_repo
        .find_by_ids(coop_ids)
        .await
        .unwrap_or_default();
    let coop_map: std::collections::HashMap<Uuid, String> = coops
        .iter()
        .map(|c| {
            let name = if c.display_name.is_empty() {
                c.name.clone()
            } else {
                c.display_name.clone()
            };
            (c.id, name)
        })
        .collect();

    let apex_ids: Vec<Uuid> = coops.iter().map(|c| c.apex_id).collect();
    let apexes = state
        .apex_repo
        .find_by_ids(apex_ids)
        .await
        .unwrap_or_default();
    let apex_name_map: std::collections::HashMap<Uuid, String> = apexes
        .iter()
        .map(|a| {
            let name = if a.display_name.is_empty() {
                a.organization_keycloak_id.clone()
            } else {
                a.display_name.clone()
            };
            (a.id, name)
        })
        .collect();

    let federation_ids: Vec<Uuid> = apexes.iter().map(|a| a.federation_id).collect();
    let federations = state
        .federation_repo
        .find_by_ids(federation_ids)
        .await
        .unwrap_or_default();
    let fed_name_map: std::collections::HashMap<Uuid, String> = federations
        .iter()
        .map(|f| {
            let name = if f.display_name.is_empty() {
                f.keycloak_id.clone()
            } else {
                f.display_name.clone()
            };
            (f.id, name)
        })
        .collect();

    let coop_to_apex: std::collections::HashMap<Uuid, String> = coops
        .iter()
        .filter_map(|c| {
            apex_name_map
                .get(&c.apex_id)
                .map(|name| (c.id, name.clone()))
        })
        .collect();
    // Build apex_id → federation_id map for O(1) lookups (avoids inner linear scan)
    let apex_to_fed_id: std::collections::HashMap<Uuid, Uuid> =
        apexes.iter().map(|a| (a.id, a.federation_id)).collect();
    let coop_to_federation: std::collections::HashMap<Uuid, String> = coops
        .iter()
        .filter_map(|c| {
            let fed_id = apex_to_fed_id.get(&c.apex_id)?;
            fed_name_map.get(fed_id).map(|name| (c.id, name.clone()))
        })
        .collect();

    let responses = subs
        .into_iter()
        .map(|s| {
            let name = coop_map.get(&s.cooperative_id).cloned();
            let apex = coop_to_apex.get(&s.cooperative_id).cloned();
            let federation = coop_to_federation.get(&s.cooperative_id).cloned();

            let coop = coops.iter().find(|c| c.id == s.cooperative_id);
            let apex_id = coop.map(|c| c.apex_id);
            let federation_id = apex_id.and_then(|a_id| apex_to_fed_id.get(&a_id)).cloned();

            SubmissionResponse::from(s)
                .with_cooperative_name(name)
                .with_apex_name(apex)
                .with_federation_name(federation)
                .with_apex_id(apex_id)
                .with_federation_id(federation_id)
        })
        .collect::<Vec<_>>();

    Ok((StatusCode::OK, Json(responses)))
}

#[utoipa::path(
    post,
    path = "/api/v1/ministry/submissions/{id}/approve",
    params(("id" = Uuid, Path, description = "Submission ID")),
    request_body = ReviewActionRequest,
    responses(
        (status = 200, description = "Approved, submission finalized", body = SubmissionResponse),
        (status = 400, description = "Invalid state"),
        (status = 404, description = "Not found")
    ),
    tag = "Ministry"
)]
pub async fn ministry_approve_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewActionRequest>,
) -> AppResult<impl IntoResponse> {
    let workflow = SubmissionWorkflow::new(
        state.submission_repo.clone(),
        state.review_repo.clone(),
        state.flag_repo.clone(),
        state.section_repo.clone(),
        state.financial_statement_repo.clone(),
    );
    workflow.ministry_approve(id, &claims, body.comment).await?;
    let updated = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Not found".into()))?;
    Ok((StatusCode::OK, Json(SubmissionResponse::from(updated))))
}

#[utoipa::path(
    post,
    path = "/api/v1/ministry/submissions/{id}/reject",
    params(("id" = Uuid, Path, description = "Submission ID")),
    request_body = ReviewActionRequest,
    responses(
        (status = 200, description = "Submission rejected", body = SubmissionResponse),
        (status = 400, description = "Invalid state"),
        (status = 404, description = "Not found")
    ),
    tag = "Ministry"
)]
pub async fn ministry_reject_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReviewActionRequest>,
) -> AppResult<impl IntoResponse> {
    let workflow = SubmissionWorkflow::new(
        state.submission_repo.clone(),
        state.review_repo.clone(),
        state.flag_repo.clone(),
        state.section_repo.clone(),
        state.financial_statement_repo.clone(),
    );
    workflow.ministry_reject(id, &claims, body.comment).await?;
    let updated = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Not found".into()))?;
    Ok((StatusCode::OK, Json(SubmissionResponse::from(updated))))
}

// ── Submission Sections ──────────────────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions/{id}/sections",
    params(("id" = Uuid, Path, description = "Submission ID")),
    responses(
        (status = 200, description = "Section statuses", body = Vec<SubmissionSectionResponse>),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Cooperative"
)]
pub async fn list_submission_sections(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if !coop_ids.contains(&submission.cooperative_id) {
        return Err(AppError::Forbidden("Access denied".into()));
    }

    let sections = state.section_repo.find_by_submission(id).await?;
    let resps: Vec<SubmissionSectionResponse> = sections
        .into_iter()
        .map(SubmissionSectionResponse::from)
        .collect();

    Ok((StatusCode::OK, Json(resps)))
}

#[utoipa::path(
    patch,
    path = "/api/v1/cooperative/submissions/{id}/sections/{section}",
    params(
        ("id" = Uuid, Path, description = "Submission ID"),
        ("section" = String, Path, description = "Section name: financial, members, savings, loans, fixed_deposits")
    ),
    request_body = UpdateSectionStatusRequest,
    responses(
        (status = 200, description = "Section updated", body = SubmissionSectionResponse),
        (status = 400, description = "Invalid section name or status"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Cooperative"
)]
pub async fn update_submission_section(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path((id, section)): Path<(Uuid, String)>,
    Json(body): Json<UpdateSectionStatusRequest>,
) -> AppResult<impl IntoResponse> {
    let coop =
        crate::api::handlers::cooperative::resolve_caller_cooperative(&state, &claims).await?;

    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if submission.cooperative_id != coop.id {
        return Err(AppError::Forbidden("Access denied".into()));
    }

    if submission.status != SubmissionStatus::Draft {
        return Err(AppError::BadRequest(format!(
            "Cannot update sections when submission is in '{}' status",
            submission.status.as_str()
        )));
    }

    if !crate::repositories::submission_section::SECTIONS.contains(&section.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid section '{}'. Valid sections: {}",
            section,
            crate::repositories::submission_section::SECTIONS.join(", ")
        )));
    }

    if !VALID_STATUSES.contains(&body.status.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid status '{}'. Valid statuses: pending, in_progress, ready",
            body.status
        )));
    }

    let section_model = state
        .section_repo
        .find_by_submission_and_section(id, &section)
        .await?
        .ok_or_else(|| AppError::NotFound("Section not found".into()))?;

    let updated = state
        .section_repo
        .update_status(section_model.id, &body.status)
        .await?;

    tracing::info!(
        submission_id = %id,
        section = %section,
        status = %body.status,
        "Section status updated"
    );

    Ok((
        StatusCode::OK,
        Json(SubmissionSectionResponse::from(updated)),
    ))
}

#[utoipa::path(
    delete,
    path = "/api/v1/cooperative/submissions/{id}",
    params(("id" = Uuid, Path, description = "Submission ID")),
    responses(
        (status = 204, description = "Submission deleted"),
        (status = 403, description = "Forbidden — not your cooperative"),
        (status = 404, description = "Submission not found"),
    ),
    security(("bearer" = []))
)]
pub async fn delete_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop =
        crate::api::handlers::cooperative::resolve_caller_cooperative(&state, &claims).await?;

    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if submission.cooperative_id != coop.id {
        return Err(AppError::Forbidden(
            "This submission does not belong to your cooperative".into(),
        ));
    }

    if submission.status == crate::entities::enums::SubmissionStatus::Approved {
        return Err(AppError::BadRequest(
            "Cannot delete an approved submission".into(),
        ));
    }

    state.submission_repo.delete(id).await?;

    tracing::info!(submission_id = %id, status = %submission.status.as_str(), "Submission deleted");

    Ok(StatusCode::NO_CONTENT)
}

// ── Stats handlers ────────────────────────────────────────────────────────────

/// Compute average PAR30 and CAR from a list of approved submission IDs.
/// Returns (average_par30, average_car) — None if no data.
pub async fn compute_average_kpis(
    state: &AppState,
    submission_ids: Vec<Uuid>,
) -> (Option<f64>, Option<f64>) {
    if submission_ids.is_empty() {
        return (None, None);
    }

    let all_fs = match state
        .financial_statement_repo
        .find_by_submission_ids(submission_ids)
        .await
    {
        Ok(fs) => fs,
        Err(_) => return (None, None),
    };

    let mut par30_values: Vec<f64> = Vec::new();
    let mut car_values: Vec<f64> = Vec::new();

    for fs in &all_fs {
        let line_items = match state
            .line_item_repo
            .find_by_financial_statement(fs.id)
            .await
        {
            Ok(items) => items,
            Err(_) => continue,
        };
        if line_items.is_empty() {
            continue;
        }

        let kpi_set = crate::services::KpiEngine::compute(&line_items);

        if let Some(kpi) = kpi_set.get_by_name("par30") {
            par30_values.push(kpi.value);
        }
        if let Some(kpi) = kpi_set.get_by_name("capital_adequacy_ratio") {
            car_values.push(kpi.value);
        }
    }

    let avg_par30 = if par30_values.is_empty() {
        None
    } else {
        Some(par30_values.iter().sum::<f64>() / par30_values.len() as f64)
    };
    let avg_car = if car_values.is_empty() {
        None
    } else {
        Some(car_values.iter().sum::<f64>() / car_values.len() as f64)
    };

    (avg_par30, avg_car)
}

#[utoipa::path(
    get,
    path = "/api/v1/apex/stats",
    responses(
        (status = 200, description = "Apex dashboard stats", body = ApexStatsResponse),
        (status = 403, description = "Forbidden")
    ),
    tag = "Apex"
)]
pub async fn get_apex_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    let apex_db_id =
        crate::api::handlers::cooperative::resolve_caller_apex_db_id_pub(&state, &claims).await?;

    let cooperatives = state.cooperative_repo.find_by_apex_id(apex_db_id).await?;
    let total_cooperatives = cooperatives.len() as u64;

    let coop_ids: Vec<Uuid> = cooperatives.iter().map(|c| c.id).collect();
    let subs = state
        .submission_repo
        .find_by_cooperative_ids(coop_ids)
        .await?;

    let pending_submissions = subs
        .iter()
        .filter(|s| {
            s.status != SubmissionStatus::Draft
                && s.status != SubmissionStatus::Approved
                && s.status != SubmissionStatus::Rejected
        })
        .count() as u64;
    let approved_submissions = subs
        .iter()
        .filter(|s| s.status == SubmissionStatus::Approved)
        .count() as u64;
    let rejected_submissions = subs
        .iter()
        .filter(|s| s.status == SubmissionStatus::Rejected)
        .count() as u64;

    // Compute average PAR30 and CAR from approved submissions
    let approved_sub_ids: Vec<Uuid> = subs
        .iter()
        .filter(|s| s.status == SubmissionStatus::Approved)
        .map(|s| s.id)
        .collect();

    let (average_par30, average_car) = compute_average_kpis(&state, approved_sub_ids).await;

    Ok((
        StatusCode::OK,
        Json(ApexStatsResponse {
            total_cooperatives,
            pending_submissions,
            approved_submissions,
            rejected_submissions,
            average_par30,
            average_car,
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/stats",
    responses(
        (status = 200, description = "Cooperative dashboard stats", body = CooperativeStatsResponse),
        (status = 403, description = "Forbidden")
    ),
    tag = "Cooperative"
)]
pub async fn get_cooperative_stats(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    let coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let subs = state
        .submission_repo
        .find_by_cooperative_ids(coop_ids)
        .await?;

    let total_submissions = subs.len() as u64;
    let draft_submissions = subs
        .iter()
        .filter(|s| s.status == SubmissionStatus::Draft)
        .count() as u64;
    let pending_submissions = subs
        .iter()
        .filter(|s| {
            s.status != SubmissionStatus::Draft
                && s.status != SubmissionStatus::Approved
                && s.status != SubmissionStatus::Rejected
        })
        .count() as u64;
    let approved_submissions = subs
        .iter()
        .filter(|s| s.status == SubmissionStatus::Approved)
        .count() as u64;
    let rejected_submissions = subs
        .iter()
        .filter(|s| s.status == SubmissionStatus::Rejected)
        .count() as u64;

    Ok((
        StatusCode::OK,
        Json(CooperativeStatsResponse {
            total_submissions,
            draft_submissions,
            pending_submissions,
            approved_submissions,
            rejected_submissions,
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions/{id}/reviews",
    params(
        ("id" = Uuid, Path, description = "Submission ID"),
    ),
    responses(
        (status = 200, description = "List of review actions for the submission", body = [SubmissionReviewResponse]),
        (status = 403, description = "Forbidden", body = ErrorResponse),
        (status = 404, description = "Submission not found", body = ErrorResponse),
    ),
    tag = "Submissions"
)]
pub async fn list_submission_reviews(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;
    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| crate::error::AppError::NotFound("Submission not found".into()))?;
    if !coop_ids.contains(&submission.cooperative_id) {
        return Err(crate::error::AppError::Forbidden(
            "Submission does not belong to your cooperatives".into(),
        ));
    }
    let caller_tier = claims
        .tier()
        .ok_or_else(|| crate::error::AppError::Forbidden("No valid tier role".into()))?;
    let reviews = state
        .review_repo
        .find_by_submission_for_tier(id, caller_tier)
        .await?;
    let responses: Vec<SubmissionReviewResponse> = reviews
        .into_iter()
        .map(SubmissionReviewResponse::from)
        .collect();
    Ok((StatusCode::OK, Json(responses)))
}
