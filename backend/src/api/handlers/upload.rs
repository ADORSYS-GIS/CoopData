use axum::{
    extract::{Multipart, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use sea_orm::Set;
use std::sync::{
    atomic::{AtomicU32, Ordering},
    Arc,
};
use uuid::Uuid;

const MAX_UPLOAD_BYTES: usize = 20 * 1024 * 1024; // 20 MB

static SEQ_COUNTER: AtomicU32 = AtomicU32::new(0);

use crate::api::dto::upload::UploadResponse;
use crate::auth::claims::Claims;

use crate::entities::enums::{AccountingYear, Currency};
use crate::entities::extraction_job::ActiveModel as ExtractionJobModel;
use crate::entities::financial_statement::ActiveModel as FsModel;
use crate::entities::submission::ActiveModel as SubmissionModel;
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
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Cooperative profile not found"),
        (status = 409, description = "Submission already exists for this year")
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
    let mut reporting_year: i32 = chrono::Utc::now().year();
    let mut accounting_year_str = String::from("calendar");
    let mut currency_str = String::from("SZL");

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
            "reporting_year" => {
                let text = field
                    .text()
                    .await
                    .map_err(|e| AppError::BadRequest(format!("Bad reporting_year: {e}")))?;
                reporting_year = text.trim().parse::<i32>().map_err(|_| {
                    AppError::BadRequest("reporting_year must be an integer".into())
                })?;
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
            _ => {}
        }
    }

    let file_bytes = file_bytes
        .ok_or_else(|| AppError::BadRequest("No file provided in multipart request".into()))?;

    if file_bytes.is_empty() {
        return Err(AppError::BadRequest("Uploaded file is empty".into()));
    }

    // Validate year
    let current_year = chrono::Utc::now().year();
    if reporting_year < current_year - 5 || reporting_year > current_year {
        return Err(AppError::BadRequest(format!(
            "reporting_year must be between {} and {current_year}",
            current_year - 5
        )));
    }

    // Validate MIME type
    let supported_mimes = [
        "application/pdf",
        "image/png",
        "image/jpeg",
        "image/jpg",
        "image/tiff",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "application/octet-stream", // allow unknown for dev
    ];
    if !supported_mimes.iter().any(|m| mime_type.starts_with(m)) {
        return Err(AppError::BadRequest(format!(
            "Unsupported file type: {mime_type}. Accepted: PDF, PNG, JPEG, TIFF, XLSX, XLS"
        )));
    }

    // Check duplicate submission — allow re-upload if existing is still in draft
    if let Some(existing) = state
        .submission_repo
        .find_by_cooperative_and_year(coop.id, reporting_year)
        .await?
    {
        if existing.status == crate::entities::enums::SubmissionStatus::Draft {
            tracing::info!(
                submission_id = %existing.id,
                "Deleting existing draft submission to allow re-upload"
            );
            state.submission_repo.delete(existing.id).await?;
        } else {
            return Err(AppError::Conflict(format!(
                "A submission already exists for {reporting_year} (status: {}). Delete it first or use a different year.",
                existing.status.as_str()
            )));
        }
    }

    let accounting_year =
        AccountingYear::parse(&accounting_year_str).unwrap_or(AccountingYear::Calendar);
    let currency = if currency_str == "USD" {
        Currency::Usd
    } else {
        Currency::Szl
    };
    let submitted_by = Uuid::parse_str(&claims.sub).ok();
    let submission_id = Uuid::new_v4();
    let fs_id = Uuid::new_v4();
    let file_id = Uuid::new_v4();
    let job_id = Uuid::new_v4();

    // Generate reference
    let reference = format!("SUB-{}-{:05}", current_year, rand_seq());

    // Storage key
    let storage_key = format!("{}/{}/{}.bin", coop.id, submission_id, file_id);

    // 1. Store file
    state
        .storage
        .store(&storage_key, &file_bytes, &mime_type)
        .await?;

    // 2. Create submission
    let submission_model = SubmissionModel {
        id: Set(submission_id),
        reference: Set(Some(reference)),
        cooperative_id: Set(coop.id),
        reporting_year: Set(reporting_year),
        status: Set(crate::entities::enums::SubmissionStatus::Draft),
        current_tier: Set(crate::entities::enums::ReviewTier::Cooperative),
        submitted_by: Set(submitted_by),
        submitted_at: Set(None),
        last_reviewed_by: Set(None),
        last_reviewed_at: Set(None),
        rejection_reason: Set(None),
        priority: Set("Routine".to_string()),
        metadata: Set(serde_json::json!({})),
        created_at: Set(chrono::Utc::now()),
        updated_at: Set(chrono::Utc::now()),
    };
    state.submission_repo.create(submission_model).await?;

    // Create submission sections (5 sections: financial, members, savings, loans, fixed_deposits)
    let section_models =
        crate::repositories::SubmissionSectionRepository::new_section_models(submission_id);
    state.section_repo.create_many(section_models).await?;

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
    let flag_repo = state.flag_repo.clone();

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
            flag_repo,
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

fn rand_seq() -> u32 {
    SEQ_COUNTER.fetch_add(1, Ordering::Relaxed) % 100_000
}

trait YearExt {
    fn year(&self) -> i32;
}
impl YearExt for chrono::DateTime<chrono::Utc> {
    fn year(&self) -> i32 {
        chrono::Datelike::year(self)
    }
}
