use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Extension, Json,
};
use sea_orm::{Set, TransactionTrait};
use std::sync::Arc;
use uuid::Uuid;

use crate::api::dto::apex::ApexStatsResponse;
#[allow(unused_imports)]
use crate::api::dto::submission::{
    CooperativeStatsResponse, CreateApexSubmissionRequest, CreateSubmissionRequest,
    DelegateSubmissionRequest, MembershipStatsResponse, PortfolioBreakdownResponse,
    ReclaimSubmissionRequest, SubmissionResponse, SubmissionReviewResponse,
    SubmissionSectionResponse, UpdateSectionStatusRequest, UpdateSubmissionMethodRequest,
};
use crate::auth::claims::Claims;

use crate::entities::enums::SubmissionStatus;
use crate::entities::submission::ActiveModel;
use crate::error::{AppError, AppResult};
use crate::repositories::submission_section::VALID_STATUSES;
use crate::services::verification_token::VerificationTokenService;
use crate::AppState;

/// Resolve a federation's PostgreSQL tracking record by its Keycloak org ID,
/// auto-backfilling a row if one is missing so Keycloak and PG never diverge.
async fn resolve_federation_record(
    state: &AppState,
    org_id: &str,
) -> AppResult<crate::entities::federation::Model> {
    if let Some(f) = state.federation_repo.find_by_keycloak_id(org_id).await? {
        return Ok(f);
    }
    tracing::warn!(org_id = %org_id, "Federation PG record not found, auto-backfilling");
    let backfill_model = crate::entities::federation::ActiveModel {
        id: sea_orm::Set(Uuid::new_v4()),
        keycloak_id: sea_orm::Set(org_id.to_string()),
        display_name: sea_orm::Set("Federation".to_string()),
        is_active: sea_orm::Set(true),
        metadata: sea_orm::Set(Some(serde_json::json!({}))),
        created_at: sea_orm::Set(chrono::Utc::now()),
        updated_at: sea_orm::Set(chrono::Utc::now()),
    };
    state.federation_repo.create(backfill_model).await
}

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
    if body.reporting_year < 1900 || body.reporting_year > 2100 {
        return Err(AppError::BadRequest(
            "reporting_year must be between 1900 and 2100".to_string(),
        ));
    }

    body.validate_period().map_err(AppError::BadRequest)?;
    let (period_type, period_value) = body.resolved_period();

    let coop =
        crate::api::handlers::cooperative::resolve_caller_cooperative(&state, &claims).await?;

    if let Some(existing) = state
        .submission_repo
        .find_by_cooperative_and_period(coop.id, body.reporting_year, period_type, &period_value)
        .await?
    {
        tracing::info!(
            submission_id = %existing.id,
            cooperative_id = %coop.id,
            reporting_year = body.reporting_year,
            period_type = period_type.as_str(),
            period_value = %period_value,
            status = %existing.status.as_str(),
            "Submission draft already exists for this cooperative and period"
        );
        return Err(AppError::ConflictWithSubmission {
            message: format!(
                "A submission already exists for this cooperative for {} {} {} (Status: {}). You will be redirected to the existing submission.",
                period_type.as_str(),
                period_value,
                body.reporting_year,
                existing.status.as_str()
            ),
            submission_id: existing.id,
        });
    }

    let seq = state
        .submission_repo
        .count_by_reporting_year(body.reporting_year)
        .await? as u32
        + 1;
    let reference = format!("SUB-{}-{:05}", body.reporting_year, seq);

    let submitted_by = Uuid::parse_str(&claims.sub).ok();

    let submission_method_val = if coop.tier == "basic" {
        "questionnaire".to_string()
    } else {
        body.submission_method.clone()
    };

    let creator_name = claims
        .name
        .clone()
        .or_else(|| claims.preferred_username.clone());

    let model = ActiveModel {
        id: Set(body.id.unwrap_or_else(Uuid::new_v4)),
        reference: Set(Some(reference)),
        cooperative_id: Set(coop.id),
        reporting_year: Set(body.reporting_year),
        period_type: Set(period_type),
        period_value: Set(period_value),
        status: Set(crate::entities::enums::SubmissionStatus::Draft),
        current_tier: Set(crate::entities::enums::ReviewTier::Cooperative),
        submitted_by: Set(submitted_by),
        submitted_at: Set(None),
        last_reviewed_by: Set(None),
        last_reviewed_at: Set(None),
        rejection_reason: Set(None),
        priority: Set(body.priority),
        metadata: Set(serde_json::json!({})),
        submission_method: Set(submission_method_val.clone()),
        created_at: Set(chrono::Utc::now()),
        updated_at: Set(chrono::Utc::now()),
        created_by_role: Set(crate::entities::enums::SubmissionCreatedByRole::Cooperative),
        created_by_user_id: Set(submitted_by),
        created_by_name: Set(creator_name.clone()),
        edited_by: Set(submitted_by),
        edited_by_name: Set(creator_name),
    };

    let submission = state.submission_repo.create(model).await?;

    let section_models =
        crate::repositories::submission_section::SubmissionSectionRepository::new_section_models(
            submission.id,
            &submission_method_val,
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

    // Populate cooperative name from DB so frontend doesn't need a separate Keycloak-based call
    if let Ok(Some(coop)) = state.cooperative_repo.find_by_id(resp.cooperative_id).await {
        resp.cooperative_name = Some(coop.name);
    }

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

    let files = state.uploaded_file_repo.find_by_submission(id).await?;
    let file = files
        .first()
        .ok_or_else(|| AppError::NotFound("No uploaded file found for this submission".into()))?;

    // Download the original file from S3/MinIO
    let file_bytes = state.storage.get_object(&file.storage_key).await?;

    // Create a new extraction job record to track this re-validation run
    let job_id = Uuid::new_v4();
    let job_model = crate::entities::extraction_job::ActiveModel {
        id: Set(job_id),
        submission_id: Set(id),
        source_file_id: Set(file.id),
        status: Set("queued".to_string()),
        engine: Set(None),
        raw_text: Set(None),
        extracted_json: Set(None),
        confidence: Set(None),
        error_message: Set(None),
        started_at: Set(None),
        completed_at: Set(None),
        created_at: Set(chrono::Utc::now()),
    };
    state.extraction_job_repo.create(job_model).await?;

    let coop_type = coop
        .institution_type
        .as_ref()
        .map(|t| t.as_str().to_string())
        .unwrap_or_else(|| "sacco".to_string());

    let extractor = Arc::clone(&state.extractor);

    // Call the extraction pipeline synchronously to completely rebuild the line items
    if let Err(e) = crate::services::extraction_pipeline::run_pipeline_inner(
        job_id,
        id,
        coop.id,
        submission.reporting_year,
        file_bytes,
        file.mime_type.clone().unwrap_or_default(),
        coop_type,
        extractor,
        &state.extraction_job_repo,
        &state.submission_repo,
        &state.financial_statement_repo,
        &state.line_item_repo,
        &state.coa_repo,
        &state.account_alias_repo,
        &state.flag_repo,
        &state.section_repo,
    )
    .await
    {
        tracing::error!(
            submission_id = %id,
            job_id = %job_id,
            error = %e,
            "Re-extraction pipeline failed during validate-extraction call"
        );
        let _ = state
            .extraction_job_repo
            .update_status(
                job_id,
                "failed",
                None,
                Some(chrono::Utc::now()),
                Some(e.to_string()),
            )
            .await;
        return Err(e);
    }

    // Recompute and save KPIs to database so analytics and benchmarking are in sync
    let workflow = SubmissionWorkflow::new(
        state.submission_repo.clone(),
        state.review_repo.clone(),
        state.flag_repo.clone(),
        state.section_repo.clone(),
        state.financial_statement_repo.clone(),
        state.line_item_repo.clone(),
        state.kpi_record_repo.clone(),
        state.db.clone(),
    );
    if let Err(e) = workflow
        .compute_and_save_kpis(id, coop.id, submission.reporting_year)
        .await
    {
        tracing::error!(
            submission_id = %id,
            error = %e,
            "Failed to compute and save KPIs during validation"
        );
    }

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
        state.line_item_repo.clone(),
        state.kpi_record_repo.clone(),
        state.db.clone(),
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

// ── Submit (apex-created → federation) ───────────────────────────────────────

#[utoipa::path(
    post,
    path = "/api/v1/apex/submissions/{id}/submit",
    params(("id" = Uuid, Path, description = "Submission ID")),
    responses(
        (status = 200, description = "Submission submitted to federation", body = SubmissionResponse),
        (status = 400, description = "Error flags must be resolved first"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Apex"
)]
pub async fn apex_submit_submission(
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

    // Verify submission belongs to a cooperative under this apex
    let cooperatives = state.cooperative_repo.find_by_apex_id(apex_db_id).await?;
    let belongs = cooperatives
        .iter()
        .any(|c| c.id == submission.cooperative_id);
    if !belongs {
        return Err(AppError::Forbidden(
            "Access denied: submission does not belong to your apex".into(),
        ));
    }

    // Verify this is an apex-created submission
    if submission.created_by_role != crate::entities::enums::SubmissionCreatedByRole::Apex {
        return Err(AppError::BadRequest(
            "This submission was not created by an apex user".into(),
        ));
    }

    let workflow = SubmissionWorkflow::new(
        state.submission_repo.clone(),
        state.review_repo.clone(),
        state.flag_repo.clone(),
        state.section_repo.clone(),
        state.financial_statement_repo.clone(),
        state.line_item_repo.clone(),
        state.kpi_record_repo.clone(),
        state.db.clone(),
    );
    workflow.submit(id, &claims).await?;

    let updated = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    tracing::info!(submission_id = %id, apex_id = %apex_db_id, "Apex-initiated submission submitted to federation");
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

    let federation = resolve_federation_record(&state, &org_id).await?;

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
        state.line_item_repo.clone(),
        state.kpi_record_repo.clone(),
        state.db.clone(),
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
        state.line_item_repo.clone(),
        state.kpi_record_repo.clone(),
        state.db.clone(),
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

    let federation = resolve_federation_record(&state, &org_id).await?;

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
        state.line_item_repo.clone(),
        state.kpi_record_repo.clone(),
        state.db.clone(),
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
        state.line_item_repo.clone(),
        state.kpi_record_repo.clone(),
        state.db.clone(),
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
        state.line_item_repo.clone(),
        state.kpi_record_repo.clone(),
        state.db.clone(),
    );
    workflow.ministry_approve(id, &claims, body.comment).await?;
    let updated = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Not found".into()))?;

    // Compute and persist KPIs on approval
    if let Err(e) = workflow
        .compute_and_save_kpis(id, updated.cooperative_id, updated.reporting_year)
        .await
    {
        tracing::error!(
            submission_id = %id,
            error = %e,
            "Failed to compute and save KPIs during ministry approval"
        );
    }

    // Phase A: Trigger background export generation for the cooperative, Apex, Federation, and Ministry.
    // Stagger tier launches by 65s in the background to avoid Gemini free-tier rate limits (5 req/min)
    let state_clone = state.clone();
    let cooperative_id = updated.cooperative_id;
    let reporting_year = updated.reporting_year;
    tokio::spawn(async move {
        crate::services::export_generator::ExportGenerator::trigger_cooperative_export(
            state_clone.clone(),
            id,
        );

        // Fetch parent Coop
        let coop = match state_clone
            .cooperative_repo
            .find_by_id(cooperative_id)
            .await
        {
            Ok(Some(c)) => c,
            Ok(None) => {
                tracing::error!("Cooperative not found in background export thread");
                return;
            }
            Err(e) => {
                tracing::error!(
                    "Failed to fetch cooperative in background export thread: {:?}",
                    e
                );
                return;
            }
        };

        tokio::time::sleep(std::time::Duration::from_secs(65)).await;
        crate::services::export_generator::ExportGenerator::trigger_apex_export(
            state_clone.clone(),
            coop.apex_id,
            reporting_year,
        );

        // Fetch parent Apex
        let apex = match state_clone.apex_repo.find_by_id(coop.apex_id).await {
            Ok(Some(a)) => a,
            Ok(None) => {
                tracing::error!("Apex not found in background export thread");
                return;
            }
            Err(e) => {
                tracing::error!("Failed to fetch apex in background export thread: {:?}", e);
                return;
            }
        };

        tokio::time::sleep(std::time::Duration::from_secs(65)).await;
        crate::services::export_generator::ExportGenerator::trigger_federation_export(
            state_clone.clone(),
            apex.federation_id,
            reporting_year,
        );

        tokio::time::sleep(std::time::Duration::from_secs(65)).await;
        crate::services::export_generator::ExportGenerator::trigger_ministry_export(
            state_clone.clone(),
            reporting_year,
        );

        // Phase F: Invalidate stale exports for future-year submissions of the same cooperative.
        match state_clone
            .submission_repo
            .find_by_cooperative(cooperative_id)
            .await
        {
            Ok(subs) => {
                let future_subs: Vec<_> = subs
                    .into_iter()
                    .filter(|s| {
                        s.reporting_year > reporting_year
                            && s.id != id
                            && s.status == crate::entities::enums::SubmissionStatus::Approved
                    })
                    .collect();

                if !future_subs.is_empty() {
                    tracing::info!(
                        cooperative_id = %cooperative_id,
                        current_year = reporting_year,
                        stale_count = future_subs.len(),
                        "Invalidating stale exports for future-year submissions"
                    );

                    for sub in future_subs {
                        // Delete stale cached PDF from object storage (best-effort)
                        let pdf_key =
                            format!("exports/individual/{}/submission_{}.pdf", sub.id, sub.id);
                        let _ = state_clone.storage.delete_object(&pdf_key).await;

                        // Trigger background regeneration so the next download gets fresh data
                        crate::services::export_generator::ExportGenerator::trigger_cooperative_export(
                            state_clone.clone(),
                            sub.id,
                        );
                        tokio::time::sleep(std::time::Duration::from_secs(65)).await;
                        crate::services::export_generator::ExportGenerator::trigger_apex_export(
                            state_clone.clone(),
                            coop.apex_id,
                            sub.reporting_year,
                        );
                        tokio::time::sleep(std::time::Duration::from_secs(65)).await;
                        crate::services::export_generator::ExportGenerator::trigger_federation_export(
                            state_clone.clone(),
                            apex.federation_id,
                            sub.reporting_year,
                        );
                        tokio::time::sleep(std::time::Duration::from_secs(65)).await;
                        crate::services::export_generator::ExportGenerator::trigger_ministry_export(
                            state_clone.clone(),
                            sub.reporting_year,
                        );

                        tracing::info!(
                            stale_submission_id = %sub.id,
                            stale_year = sub.reporting_year,
                            "Queued re-generation of stale export"
                        );
                    }
                }
            }
            Err(e) => {
                tracing::error!(
                    "Failed to fetch future submissions in background export thread: {:?}",
                    e
                );
            }
        }
    });

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
        state.line_item_repo.clone(),
        state.kpi_record_repo.clone(),
        state.db.clone(),
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
    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if claims.has_role("apex") {
        let coop_ids =
            crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims)
                .await?;
        if !coop_ids.contains(&submission.cooperative_id) {
            return Err(AppError::Forbidden("Access denied".into()));
        }
    } else {
        let coop =
            crate::api::handlers::cooperative::resolve_caller_cooperative(&state, &claims).await?;
        if submission.cooperative_id != coop.id {
            return Err(AppError::Forbidden("Access denied".into()));
        }
    }

    if submission.status != SubmissionStatus::Draft {
        return Err(AppError::BadRequest(format!(
            "Cannot update sections when submission is in '{}' status",
            submission.status.as_str()
        )));
    }

    // Enforce exclusive editor: only the user who owns the draft can edit sections
    let current_user_id = Uuid::parse_str(&claims.sub).ok();
    if let Some(editor_id) = submission.edited_by {
        if current_user_id != Some(editor_id) {
            return Err(AppError::Forbidden(
                "Only the editor assigned to this submission can modify sections".into(),
            ));
        }
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
        (status = 400, description = "Cannot delete a submitted submission"),
        (status = 403, description = "Forbidden — not your cooperative"),
        (status = 404, description = "Submission not found"),
        (status = 428, description = "Identity verification required", body = ErrorResponse)
    ),
    security(("bearer" = []))
)]
pub async fn delete_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let token = headers
        .get("x-verification-token")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| {
            AppError::PreconditionRequired(
                "Identity verification is required for destructive actions. Please verify your identity and try again.".to_string(),
            )
        })?;

    VerificationTokenService::validate_and_consume(&state.cache, &claims.sub, token).await?;

    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    let current_user_id = Uuid::parse_str(&claims.sub).ok();

    if claims.has_role("apex") {
        let apex_db_id =
            crate::api::handlers::cooperative::resolve_caller_apex_db_id_pub(&state, &claims)
                .await?;
        let cooperatives = state.cooperative_repo.find_by_apex_id(apex_db_id).await?;
        let belongs = cooperatives
            .iter()
            .any(|c| c.id == submission.cooperative_id);
        if !belongs {
            return Err(AppError::Forbidden(
                "Access denied: submission does not belong to your apex".into(),
            ));
        }
        if submission.created_by_role != crate::entities::enums::SubmissionCreatedByRole::Apex {
            return Err(AppError::Forbidden(
                "Only the apex that created this submission can delete it".into(),
            ));
        }
        if submission.created_by_user_id != current_user_id {
            return Err(AppError::Forbidden(
                "Only the user who created this submission can delete it".into(),
            ));
        }
    } else {
        let coop =
            crate::api::handlers::cooperative::resolve_caller_cooperative(&state, &claims).await?;
        if submission.cooperative_id != coop.id {
            return Err(AppError::Forbidden(
                "This submission does not belong to your cooperative".into(),
            ));
        }
        if submission.created_by_role == crate::entities::enums::SubmissionCreatedByRole::Apex {
            return Err(AppError::Forbidden(
                "This submission was created by the apex and cannot be deleted by the cooperative"
                    .into(),
            ));
        }
    }

    match submission.status {
        crate::entities::enums::SubmissionStatus::Draft
        | crate::entities::enums::SubmissionStatus::Rejected => {}
        _ => {
            return Err(AppError::BadRequest(
                "Cannot delete a submitted submission. Only draft or rejected submissions can be deleted.".into(),
            ));
        }
    }

    state.submission_repo.delete(id).await?;

    tracing::info!(
        submission_id = %id,
        status = %submission.status.as_str(),
        "Submission deleted"
    );

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

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions/{id}/portfolio-breakdown",
    params(("id" = Uuid, Path, description = "Submission ID")),
    responses(
        (status = 200, description = "Portfolio breakdown", body = PortfolioBreakdownResponse),
        (status = 403, description = "Access denied"),
        (status = 404, description = "Submission not found")
    ),
    tag = "Cooperative"
)]
pub async fn get_portfolio_breakdown(
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

    let categories = state
        .loan_repo
        .get_portfolio_breakdown(submission.cooperative_id)
        .await?;

    Ok((
        StatusCode::OK,
        Json(crate::api::dto::submission::PortfolioBreakdownResponse {
            submission_id: id,
            categories,
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions/{id}/membership-stats",
    params(("id" = Uuid, Path, description = "Submission ID")),
    responses(
        (status = 200, description = "Membership stats", body = MembershipStatsResponse),
        (status = 403, description = "Access denied"),
        (status = 404, description = "Submission not found")
    ),
    tag = "Cooperative"
)]
pub async fn get_membership_stats(
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

    let stats = state
        .member_repo
        .get_membership_stats(submission.cooperative_id, id)
        .await?;

    Ok((StatusCode::OK, Json(stats)))
}

#[utoipa::path(
    patch,
    path = "/api/v1/cooperative/submissions/{id}/method",
    params(("id" = Uuid, Path, description = "Submission ID")),
    request_body = UpdateSubmissionMethodRequest,
    responses(
        (status = 200, description = "Submission method updated", body = SubmissionResponse),
        (status = 400, description = "Invalid method or submission not in draft"),
        (status = 403, description = "Forbidden — not your cooperative"),
        (status = 404, description = "Submission not found")
    ),
    security(("bearer" = [])),
    tag = "Cooperative"
)]
pub async fn update_submission_method(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateSubmissionMethodRequest>,
) -> AppResult<impl IntoResponse> {
    const VALID_METHODS: [&str; 3] = ["upload", "manual", "questionnaire"];

    let method = body.submission_method.trim().to_string();
    if !VALID_METHODS.contains(&method.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid submission method '{}'. Valid methods: {}",
            method,
            VALID_METHODS.join(", ")
        )));
    }

    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if claims.has_role("apex") {
        let apex_db_id =
            crate::api::handlers::cooperative::resolve_caller_apex_db_id_pub(&state, &claims)
                .await?;
        let cooperatives = state.cooperative_repo.find_by_apex_id(apex_db_id).await?;
        let belongs = cooperatives
            .iter()
            .any(|c| c.id == submission.cooperative_id);
        if !belongs {
            return Err(AppError::Forbidden(
                "Access denied: submission does not belong to your apex".into(),
            ));
        }
    } else {
        let coop =
            crate::api::handlers::cooperative::resolve_caller_cooperative(&state, &claims).await?;
        if submission.cooperative_id != coop.id {
            return Err(AppError::Forbidden("Access denied".into()));
        }
        if coop.tier == "basic" {
            return Err(AppError::BadRequest(
                "Basic cooperatives are restricted to the questionnaire method".into(),
            ));
        }
    }

    // Enforce exclusive editor
    let current_user_id = Uuid::parse_str(&claims.sub).ok();
    if let Some(editor_id) = submission.edited_by {
        if current_user_id != Some(editor_id) {
            return Err(AppError::Forbidden(
                "Only the editor assigned to this submission can modify it".into(),
            ));
        }
    }

    if submission.status != SubmissionStatus::Draft {
        return Err(AppError::BadRequest(format!(
            "Cannot change submission method when submission is in '{}' status",
            submission.status.as_str()
        )));
    }

    let updated = state
        .submission_repo
        .update_submission_method(id, method)
        .await?;

    tracing::info!(
        submission_id = %id,
        cooperative_id = %submission.cooperative_id,
        method = %body.submission_method,
        "Submission method updated"
    );

    Ok((StatusCode::OK, Json(SubmissionResponse::from(updated))))
}

// ── Apex-Initiated Submissions ─────────────────────────────────────────────

#[utoipa::path(
    post,
    path = "/api/v1/apex/submissions",
    request_body = CreateApexSubmissionRequest,
    responses(
        (status = 201, description = "Submission created on behalf of cooperative", body = SubmissionResponse),
        (status = 400, description = "Invalid input"),
        (status = 403, description = "Forbidden — cooperative not under your apex"),
        (status = 404, description = "Cooperative not found"),
        (status = 409, description = "Submission already exists for this cooperative and year")
    ),
    tag = "Apex"
)]
pub async fn create_apex_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(body): Json<CreateApexSubmissionRequest>,
) -> AppResult<impl IntoResponse> {
    if body.reporting_year < 1900 || body.reporting_year > 2100 {
        return Err(AppError::BadRequest(
            "reporting_year must be between 1900 and 2100".to_string(),
        ));
    }

    let apex_db_id =
        crate::api::handlers::cooperative::resolve_caller_apex_db_id_pub(&state, &claims).await?;

    // The frontend sends the Keycloak group UUID (from list_cooperatives which returns Keycloak groups).
    // Resolve it to the database cooperative record.
    let coop_keycloak_id = body.cooperative_id.to_string();
    let coop = state
        .cooperative_repo
        .find_by_keycloak_id(&coop_keycloak_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Cooperative not found in database".into()))?;

    // Verify this cooperative belongs to the caller's apex
    if coop.apex_id != apex_db_id {
        return Err(AppError::Forbidden(
            "Access denied: cooperative does not belong to your apex".into(),
        ));
    }

    body.validate_period().map_err(AppError::BadRequest)?;
    let (period_type, period_value) = body.resolved_period();

    // Check no existing submission for this coop+period
    if let Some(existing) = state
        .submission_repo
        .find_by_cooperative_and_period(coop.id, body.reporting_year, period_type, &period_value)
        .await?
    {
        tracing::info!(
            submission_id = %existing.id,
            cooperative_id = %coop.id,
            reporting_year = body.reporting_year,
            period_type = period_type.as_str(),
            period_value = %period_value,
            status = %existing.status.as_str(),
            "Draft already exists for this cooperative and period"
        );
        return Err(AppError::ConflictWithSubmission {
            message: format!(
                "A submission already exists for {} for {} {} {} (Status: {}). You will be redirected to the existing submission.",
                coop.display_name.as_str(),
                period_type.as_str(),
                period_value,
                body.reporting_year,
                existing.status.as_str()
            ),
            submission_id: existing.id,
        });
    }

    let seq = state
        .submission_repo
        .count_by_reporting_year(body.reporting_year)
        .await? as u32
        + 1;
    let reference = format!("SUB-{}-{:05}", body.reporting_year, seq);

    let submitted_by = Uuid::parse_str(&claims.sub).ok();
    let creator_name = claims
        .name
        .clone()
        .or_else(|| claims.preferred_username.clone());

    let submission_method_val = if coop.tier == "basic" {
        "questionnaire".to_string()
    } else {
        body.submission_method.clone()
    };

    let model = ActiveModel {
        id: Set(Uuid::new_v4()),
        reference: Set(Some(reference)),
        cooperative_id: Set(coop.id),
        reporting_year: Set(body.reporting_year),
        period_type: Set(period_type),
        period_value: Set(period_value),
        status: Set(crate::entities::enums::SubmissionStatus::Draft),
        current_tier: Set(crate::entities::enums::ReviewTier::Cooperative),
        submitted_by: Set(submitted_by),
        submitted_at: Set(None),
        last_reviewed_by: Set(None),
        last_reviewed_at: Set(None),
        rejection_reason: Set(None),
        priority: Set(body.priority),
        metadata: Set(serde_json::json!({})),
        submission_method: Set(submission_method_val.clone()),
        created_at: Set(chrono::Utc::now()),
        updated_at: Set(chrono::Utc::now()),
        created_by_role: Set(crate::entities::enums::SubmissionCreatedByRole::Apex),
        created_by_user_id: Set(submitted_by),
        created_by_name: Set(creator_name.clone()),
        edited_by: Set(submitted_by),
        edited_by_name: Set(creator_name),
    };

    let submission = state.submission_repo.create(model).await?;

    let section_models =
        crate::repositories::submission_section::SubmissionSectionRepository::new_section_models(
            submission.id,
            &submission_method_val,
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
        apex_id = %apex_db_id,
        reporting_year = %body.reporting_year,
        "Apex-initiated submission created with {} sections",
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
    post,
    path = "/api/v1/apex/submissions/{id}/delegate",
    params(("id" = Uuid, Path, description = "Submission ID")),
    request_body = DelegateSubmissionRequest,
    responses(
        (status = 200, description = "Submission delegated to cooperative", body = SubmissionResponse),
        (status = 400, description = "Invalid state — submission is not returned to apex"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Apex"
)]
pub async fn delegate_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Json(body): Json<DelegateSubmissionRequest>,
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

    // Verify submission is delegatable:
    // - "returned" status at apex tier (federation returned to apex)
    // - "submitted" status at apex tier (returned by federation, set to submitted)
    // - "submitted" status at federation tier (apex-created, not yet reviewed by fed)
    // - "draft" status at apex tier (reclaimed by apex or apex returned to self)
    let delegatable = match submission.status {
        crate::entities::enums::SubmissionStatus::Returned
            if submission.current_tier == crate::entities::enums::ReviewTier::Apex =>
        {
            true
        }
        crate::entities::enums::SubmissionStatus::Draft
            if submission.current_tier == crate::entities::enums::ReviewTier::Apex =>
        {
            true
        }
        crate::entities::enums::SubmissionStatus::Submitted => {
            submission.current_tier == crate::entities::enums::ReviewTier::Apex
                || submission.current_tier == crate::entities::enums::ReviewTier::Federation
        }
        _ => false,
    };
    if !delegatable {
        return Err(AppError::BadRequest(format!(
            "Cannot delegate a submission in '{}' status at {:?} tier. Only returned or submitted submissions can be delegated.",
            submission.status.as_str(),
            submission.current_tier
        )));
    }

    // Find the cooperative's primary user to set as edited_by
    // For now, we clear edited_by and set it when cooperative user opens the submission
    let delegate_comment = body.comment.clone();

    let txn = state.db.begin().await.map_err(AppError::DatabaseError)?;

    // Transition status to draft at cooperative tier so the coop can edit
    state
        .submission_repo
        .update_status_tx(
            &txn,
            id,
            crate::entities::enums::SubmissionStatus::Draft,
            crate::entities::enums::ReviewTier::Cooperative,
        )
        .await?;

    // Record the delegation review
    let reviewer_id = Uuid::parse_str(&claims.sub).ok();
    let review_model = crate::entities::submission_review::ActiveModel {
        id: Set(Uuid::new_v4()),
        submission_id: Set(id),
        tier: Set(crate::entities::enums::ReviewTier::Apex),
        reviewer_id: Set(reviewer_id),
        action: Set(crate::entities::enums::ReviewAction::Return),
        comment: Set(delegate_comment.clone()),
        target_tier: Set(Some(crate::entities::enums::ReviewTier::Cooperative)),
        created_at: Set(chrono::Utc::now()),
    };
    state.review_repo.create_tx(&txn, review_model).await?;

    // Transfer ownership to cooperative (clear edited_by — cooperative will pick it up)
    let updated = state
        .submission_repo
        .set_edited_by_tx(&txn, id, None, None)
        .await?;

    txn.commit().await.map_err(AppError::DatabaseError)?;

    tracing::info!(
        submission_id = %id,
        apex_id = %apex_db_id,
        delegate_to = %submission.cooperative_id,
        comment = ?delegate_comment,
        "Submission delegated to cooperative"
    );

    let mut resp = SubmissionResponse::from(updated);
    resp.cooperative_name = Some(
        cooperatives
            .iter()
            .find(|c| c.id == submission.cooperative_id)
            .map(|c| {
                if c.display_name.is_empty() {
                    c.name.clone()
                } else {
                    c.display_name.clone()
                }
            })
            .unwrap_or_default(),
    );
    Ok((StatusCode::OK, Json(resp)))
}

// ── Claim edit (Cooperative) ────────────────────────────────────────────────

#[utoipa::path(
    post,
    path = "/api/v1/cooperative/submissions/{id}/claim-edit",
    params(("id" = Uuid, Path, description = "Submission ID")),
    responses(
        (status = 200, description = "Edit rights claimed", body = SubmissionResponse),
        (status = 400, description = "Cannot claim — not a draft or already has editor"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Cooperative"
)]
pub async fn claim_cooperative_edit(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop =
        crate::api::handlers::cooperative::resolve_caller_cooperative(&state, &claims).await?;
    let coop_id = coop.id;

    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if submission.cooperative_id != coop_id {
        return Err(AppError::Forbidden(
            "Access denied: submission does not belong to your cooperative".into(),
        ));
    }

    if submission.status != crate::entities::enums::SubmissionStatus::Draft {
        return Err(AppError::BadRequest(format!(
            "Cannot claim edit on a '{}' submission. Only draft submissions can be claimed.",
            submission.status.as_str()
        )));
    }

    let user_id = uuid::Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".into()))?;
    let user_name = claims
        .name
        .clone()
        .or_else(|| claims.preferred_username.clone());

    let updated = state
        .submission_repo
        .claim_edited_by(id, user_id, user_name)
        .await?
        .ok_or_else(|| {
            AppError::Conflict("Another user is currently editing this submission".into())
        })?;

    tracing::info!(
        submission_id = %id,
        coop_id = %coop_id,
        user_id = %user_id,
        "Cooperative user claimed edit rights"
    );

    Ok((StatusCode::OK, Json(SubmissionResponse::from(updated))))
}

#[utoipa::path(
    post,
    path = "/api/v1/apex/submissions/{id}/reclaim",
    params(("id" = Uuid, Path, description = "Submission ID")),
    request_body = ReclaimSubmissionRequest,
    responses(
        (status = 200, description = "Submission reclaimed by apex", body = SubmissionResponse),
        (status = 400, description = "Invalid state — submission is not delegated to cooperative"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Apex"
)]
pub async fn reclaim_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Json(body): Json<ReclaimSubmissionRequest>,
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

    // Verify submission is a draft (returned + delegated state)
    if submission.status != crate::entities::enums::SubmissionStatus::Draft {
        return Err(AppError::BadRequest(format!(
            "Cannot reclaim a submission in '{}' status. Only draft submissions can be reclaimed.",
            submission.status.as_str()
        )));
    }

    // Verify the submission was originally delegated (not an apex-created draft)
    // The submission must have been returned from federation before delegation
    let reviews = state.review_repo.find_by_submission(id).await?;
    let was_delegated = reviews.iter().any(|r| {
        r.action == crate::entities::enums::ReviewAction::Return
            && r.target_tier == Some(crate::entities::enums::ReviewTier::Cooperative)
    });
    if !was_delegated {
        return Err(AppError::BadRequest(
            "Cannot reclaim: this submission was not delegated to a cooperative".into(),
        ));
    }

    let apex_user_id = Uuid::parse_str(&claims.sub).ok();
    let apex_name = claims
        .name
        .clone()
        .or_else(|| claims.preferred_username.clone());

    // Record the reclaim review
    let reviewer_id = apex_user_id;
    let review_model = crate::entities::submission_review::ActiveModel {
        id: Set(Uuid::new_v4()),
        submission_id: Set(id),
        tier: Set(crate::entities::enums::ReviewTier::Apex),
        reviewer_id: Set(reviewer_id),
        action: Set(crate::entities::enums::ReviewAction::Comment),
        comment: Set(Some(format!(
            "Reclaimed by apex{}",
            body.comment
                .as_deref()
                .map(|c| format!(": {}", c))
                .unwrap_or_default()
        ))),
        target_tier: Set(None),
        created_at: Set(chrono::Utc::now()),
    };
    state.review_repo.create(review_model).await?;

    // Transfer ownership back to apex
    state
        .submission_repo
        .set_current_tier(id, crate::entities::enums::ReviewTier::Apex)
        .await?;
    let updated = state
        .submission_repo
        .set_edited_by(id, apex_user_id, apex_name)
        .await?;

    tracing::info!(
        submission_id = %id,
        apex_id = %apex_db_id,
        "Submission reclaimed by apex from cooperative"
    );

    let mut resp = SubmissionResponse::from(updated);
    resp.cooperative_name = Some(
        cooperatives
            .iter()
            .find(|c| c.id == submission.cooperative_id)
            .map(|c| {
                if c.display_name.is_empty() {
                    c.name.clone()
                } else {
                    c.display_name.clone()
                }
            })
            .unwrap_or_default(),
    );
    Ok((StatusCode::OK, Json(resp)))
}

// ── Claim edit (Apex) ───────────────────────────────────────────────────────

#[utoipa::path(
    post,
    path = "/api/v1/apex/submissions/{id}/claim-edit",
    params(("id" = Uuid, Path, description = "Submission ID")),
    responses(
        (status = 200, description = "Edit rights claimed", body = SubmissionResponse),
        (status = 400, description = "Cannot claim — not a draft or already has editor"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Apex"
)]
pub async fn claim_apex_edit(
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

    let cooperatives = state.cooperative_repo.find_by_apex_id(apex_db_id).await?;
    let belongs = cooperatives
        .iter()
        .any(|c| c.id == submission.cooperative_id);
    if !belongs {
        return Err(AppError::Forbidden(
            "Access denied: submission does not belong to your apex".into(),
        ));
    }

    if submission.status != crate::entities::enums::SubmissionStatus::Draft {
        return Err(AppError::BadRequest(format!(
            "Cannot claim edit on a '{}' submission. Only draft submissions can be claimed.",
            submission.status.as_str()
        )));
    }

    let user_id = uuid::Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".into()))?;
    let user_name = claims
        .name
        .clone()
        .or_else(|| claims.preferred_username.clone());

    let updated = state
        .submission_repo
        .claim_edited_by(id, user_id, user_name)
        .await?
        .ok_or_else(|| {
            AppError::Conflict("Another user is currently editing this submission".into())
        })?;

    tracing::info!(
        submission_id = %id,
        apex_id = %apex_db_id,
        user_id = %user_id,
        "Apex user claimed edit rights"
    );

    Ok((StatusCode::OK, Json(SubmissionResponse::from(updated))))
}
