use axum::{
    body::Body,
    extract::{Multipart, Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Extension, Json,
};
use sea_orm::Set;
use std::sync::Arc;
use uuid::Uuid;

const MAX_UPLOAD_BYTES: usize = 20 * 1024 * 1024; // 20 MB

use crate::api::dto::upload::UploadResponse;
use crate::auth::claims::Claims;

use crate::entities::enums::{AccountingYear, Currency, SubmissionStatus};
use crate::entities::extraction_job::ActiveModel as ExtractionJobModel;
use crate::entities::financial_statement::ActiveModel as FsModel;
use crate::entities::uploaded_file::ActiveModel as UploadedFileModel;
use crate::error::{AppError, AppResult};
use crate::services::extraction_pipeline::run_extraction_pipeline;
use crate::AppState;

#[utoipa::path(
    post,
    path = "/api/v1/cooperative/financial-statement/upload",
    responses(
        (status = 202, description = "Upload accepted, extraction queued", body = UploadResponse),
        (status = 400, description = "Invalid input or unsupported file type"),
        (status = 403, description = "Forbidden or submission not owned by cooperative"),
        (status = 404, description = "Cooperative profile or submission not found"),
        (status = 409, description = "Submission already exists for this year or not in draft")
    ),
    tag = "Cooperative"
)]
pub async fn upload_financial_statement(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    mut multipart: Multipart,
) -> AppResult<impl IntoResponse> {
    let coop =
        crate::api::handlers::cooperative::resolve_caller_cooperative(&state, &claims).await?;

    let mut file_bytes: Option<Vec<u8>> = None;
    let mut original_name = String::from("upload");
    let mut mime_type = String::from("application/octet-stream");
    let mut accounting_year_str = String::from("calendar");
    let mut currency_str = String::from("SZL");
    let mut submission_id_opt: Option<String> = None;

    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::BadRequest(format!("Multipart error: {e}")))?
    {
        let name = field.name().unwrap_or("").to_string();
        match name.as_str() {
            "file" => {
                original_name = field.file_name().unwrap_or("upload").to_string();
                mime_type = field
                    .content_type()
                    .unwrap_or("application/octet-stream")
                    .to_string();
                let bytes = field
                    .bytes()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("Failed to read file: {e}")))?;
                if bytes.len() > MAX_UPLOAD_BYTES {
                    return Err(AppError::BadRequest(format!(
                        "File exceeds maximum allowed size of {} MB",
                        MAX_UPLOAD_BYTES / (1024 * 1024)
                    )));
                }
                file_bytes = Some(bytes.to_vec());
            }
            "accounting_year" => {
                accounting_year_str = field
                    .text()
                    .await
                    .unwrap_or_else(|_| "calendar".to_string());
            }
            "currency" => {
                currency_str = field.text().await.unwrap_or_else(|_| "SZL".to_string());
            }
            "submission_id" => {
                submission_id_opt = Some(field.text().await.unwrap_or_default().trim().to_string());
            }
            _ => {}
        }
    }

    let file_bytes = file_bytes
        .ok_or_else(|| AppError::BadRequest("No file provided in multipart request".into()))?;

    if file_bytes.is_empty() {
        return Err(AppError::BadRequest("Uploaded file is empty".into()));
    }

    // Validate MIME type — PDF and image only
    let supported_mimes = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/tiff",
    ];
    if !supported_mimes.iter().any(|m| mime_type.starts_with(m)) {
        return Err(AppError::BadRequest(format!(
            "Unsupported file type: {mime_type}. Accepted: PDF, PNG, JPEG, TIFF"
        )));
    }

    let accounting_year =
        AccountingYear::parse(&accounting_year_str).unwrap_or(AccountingYear::Calendar);
    let currency = if currency_str == "USD" {
        Currency::Usd
    } else {
        Currency::Szl
    };
    let submitted_by = Uuid::parse_str(&claims.sub).ok();
    let fs_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();
    let job_id = Uuid::new_v4();

    // submission_id is now required — uploads must target an existing draft submission
    let sub_id_str = submission_id_opt
        .ok_or_else(|| AppError::BadRequest("submission_id is required".into()))?;
    let submission_id = Uuid::parse_str(&sub_id_str)
        .map_err(|_| AppError::BadRequest("Invalid submission_id format".into()))?;

    let existing = state
        .submission_repo
        .find_by_id(submission_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if existing.cooperative_id != coop.id {
        return Err(AppError::Forbidden(
            "Submission does not belong to your cooperative".into(),
        ));
    }
    if existing.status != crate::entities::enums::SubmissionStatus::Draft {
        return Err(AppError::Conflict(
            "Can only upload to a draft submission".into(),
        ));
    }

    tracing::info!(submission_id = %submission_id, "Attaching financial statement to submission");

    let reporting_year = existing.reporting_year;

    // Check for existing financial statement — replace if found
    if let Some(existing_fs) = state
        .financial_statement_repo
        .find_by_submission(submission_id)
        .await?
    {
        tracing::info!(
            fs_id = %existing_fs.id,
            "Replacing existing financial statement"
        );
        // Delete old file from storage
        if let Some(existing_job) = state
            .extraction_job_repo
            .find_by_submission(submission_id)
            .await?
        {
            if let Ok(Some(old_file)) = state
                .uploaded_file_repo
                .find_by_id(existing_job.source_file_id)
                .await
            {
                let _ = state.storage.delete(&old_file.storage_key).await;
                state.uploaded_file_repo.delete(old_file.id).await?;
            }
            state.extraction_job_repo.delete(existing_job.id).await?;
        }
        // Delete existing line items (cascade from financial_statement delete)
        state
            .financial_statement_repo
            .delete(existing_fs.id)
            .await?;
    }

    // Storage key
    let storage_key = format!("{}/{}/{}.bin", coop.id, submission_id, file_id);

    // 1. Store file
    state
        .storage
        .store(&storage_key, &file_bytes, &mime_type)
        .await?;

    // 3. Create uploaded_file
    let file_model = UploadedFileModel {
        id: Set(file_id),
        submission_id: Set(submission_id),
        original_name: Set(original_name),
        mime_type: Set(Some(mime_type.clone())),
        storage_key: Set(storage_key),
        size_bytes: Set(Some(file_bytes.len() as i64)),
        uploaded_by: Set(submitted_by),
        created_at: Set(chrono::Utc::now()),
    };
    state.uploaded_file_repo.create(file_model).await?;

    // 4. Create financial_statement
    let fs_model = FsModel {
        id: Set(fs_id),
        submission_id: Set(submission_id),
        cooperative_id: Set(coop.id),
        reporting_year: Set(reporting_year),
        accounting_year: Set(accounting_year),
        currency: Set(currency),
        is_validated: Set(false),
        validation_errors: Set(None),
        created_at: Set(chrono::Utc::now()),
        updated_at: Set(chrono::Utc::now()),
    };
    state.financial_statement_repo.create(fs_model).await?;

    // 5. Create extraction_job
    let job_model = ExtractionJobModel {
        id: Set(job_id),
        submission_id: Set(submission_id),
        source_file_id: Set(file_id),
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

    // 6. Spawn async extraction pipeline
    let coop_type = coop
        .institution_type
        .as_ref()
        .map(|t| t.as_str().to_string())
        .unwrap_or_else(|| "sacco".to_string());

    let extractor = Arc::clone(&state.extractor);
    let job_repo = state.extraction_job_repo.clone();
    let sub_repo = state.submission_repo.clone();
    let fs_repo_clone = state.financial_statement_repo.clone();
    let line_item_repo = state.line_item_repo.clone();
    let coa_repo = state.coa_repo.clone();
    let alias_repo = state.account_alias_repo.clone();
    let flag_repo = state.flag_repo.clone();
    let section_repo = state.section_repo.clone();

    tokio::spawn(async move {
        run_extraction_pipeline(
            job_id,
            submission_id,
            coop.id,
            file_bytes,
            mime_type,
            coop_type,
            extractor,
            job_repo,
            sub_repo,
            fs_repo_clone,
            line_item_repo,
            coa_repo,
            alias_repo,
            flag_repo,
            section_repo,
        )
        .await;
    });

    tracing::info!(
        submission_id = %submission_id,
        job_id = %job_id,
        cooperative_id = %coop.id,
        reporting_year = %reporting_year,
        "Financial statement upload accepted, extraction queued"
    );

    Ok((
        StatusCode::ACCEPTED,
        Json(UploadResponse {
            submission_id,
            financial_statement_id: fs_id,
            extraction_job_id: job_id,
        }),
    ))
}

pub async fn serve_uploaded_file(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path((submission_id, file_id)): Path<(Uuid, Uuid)>,
) -> AppResult<impl IntoResponse> {
    let coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;
    let submission = state
        .submission_repo
        .find_by_id(submission_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;
    if !coop_ids.contains(&submission.cooperative_id) {
        return Err(AppError::Forbidden(
            "Submission does not belong to your cooperatives".into(),
        ));
    }
    let file = state
        .uploaded_file_repo
        .find_by_id(file_id)
        .await?
        .ok_or_else(|| AppError::NotFound("File not found".into()))?;
    if file.submission_id != submission_id {
        return Err(AppError::Forbidden(
            "File does not belong to this submission".into(),
        ));
    }
    let bytes = state.storage.retrieve(&file.storage_key).await?;
    let mime = file
        .mime_type
        .unwrap_or_else(|| "application/octet-stream".to_string());
    let filename = file.original_name;

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime)
        .header(
            header::CONTENT_DISPOSITION,
            format!("inline; filename=\"{}\"", filename),
        )
        .body(Body::from(bytes))
        .unwrap())
}

#[utoipa::path(
    delete,
    path = "/api/v1/cooperative/submissions/{id}/financial-statement",
    params(("id" = Uuid, Path, description = "Submission ID")),
    responses(
        (status = 204, description = "Financial statement and uploaded file deleted; submission preserved"),
        (status = 400, description = "Submission is not in draft status"),
        (status = 403, description = "Access denied"),
        (status = 404, description = "Submission, financial statement, or file not found"),
    ),
    tag = "Cooperative",
    security(("bearer" = []))
)]
pub async fn delete_financial_statement(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(submission_id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;
    let submission = state
        .submission_repo
        .find_by_id(submission_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;
    if !coop_ids.contains(&submission.cooperative_id) {
        return Err(AppError::Forbidden("Access denied".into()));
    }
    if submission.status != SubmissionStatus::Draft {
        return Err(AppError::BadRequest(
            "Can only delete financial statement from draft submissions".into(),
        ));
    }

    let fs = state
        .financial_statement_repo
        .find_by_submission(submission_id)
        .await?
        .ok_or_else(|| AppError::NotFound("No financial statement for this submission".into()))?;

    let job = state
        .extraction_job_repo
        .find_by_submission(submission_id)
        .await?
        .ok_or_else(|| AppError::NotFound("No extraction job for this submission".into()))?;

    let file = state
        .uploaded_file_repo
        .find_by_id(job.source_file_id)
        .await?
        .ok_or_else(|| AppError::NotFound("No uploaded file for this submission".into()))?;

    state.storage.delete(&file.storage_key).await?;
    state.extraction_job_repo.delete(job.id).await?;
    state.uploaded_file_repo.delete(file.id).await?;
    state.financial_statement_repo.delete(fs.id).await?;

    tracing::info!(
        submission_id = %submission_id,
        "Financial statement deleted from draft"
    );

    Ok(StatusCode::NO_CONTENT)
}
