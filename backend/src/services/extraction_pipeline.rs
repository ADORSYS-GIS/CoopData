use rust_decimal::prelude::*;
use rust_decimal::Decimal;
use std::sync::Arc;
use uuid::Uuid;

use crate::entities::balance_sheet_line_item::ActiveModel as LineItemModel;
use crate::entities::enums::AccountCategory;
use crate::error::AppResult;
use crate::repositories::{
    AbnormalityFlagRepository, BalanceSheetLineItemRepository, ChartOfAccountsRepository,
    ExtractionJobRepository, FinancialStatementRepository, SubmissionRepository,
};
use crate::services::abnormality_detector::AbnormalityDetector;
use crate::services::ai_extraction::FinancialStatementExtractor;
use sea_orm::Set;

#[allow(clippy::too_many_arguments)]
pub async fn run_extraction_pipeline(
    job_id: Uuid,
    submission_id: Uuid,
    cooperative_id: Uuid,
    file_bytes: Vec<u8>,
    mime_type: String,
    cooperative_type: String,
    extractor: Arc<dyn FinancialStatementExtractor>,
    job_repo: ExtractionJobRepository,
    submission_repo: SubmissionRepository,
    fs_repo: FinancialStatementRepository,
    line_item_repo: BalanceSheetLineItemRepository,
    coa_repo: ChartOfAccountsRepository,
    flag_repo: AbnormalityFlagRepository,
) {
    if let Err(e) = run_pipeline_inner(
        job_id,
        submission_id,
        cooperative_id,
        file_bytes,
        mime_type,
        cooperative_type,
        extractor,
        &job_repo,
        &submission_repo,
        &fs_repo,
        &line_item_repo,
        &coa_repo,
        &flag_repo,
    )
    .await
    {
        tracing::error!(job_id = %job_id, error = %e, "Extraction pipeline failed");
        let _ = job_repo
            .update_status(job_id, "failed", None, Some(chrono::Utc::now()), Some(e.to_string()))
            .await;
    }
}

async fn run_pipeline_inner(
    job_id: Uuid,
    submission_id: Uuid,
    cooperative_id: Uuid,
    file_bytes: Vec<u8>,
    mime_type: String,
    cooperative_type: String,
    extractor: Arc<dyn FinancialStatementExtractor>,
    job_repo: &ExtractionJobRepository,
    submission_repo: &SubmissionRepository,
    fs_repo: &FinancialStatementRepository,
    line_item_repo: &BalanceSheetLineItemRepository,
    coa_repo: &ChartOfAccountsRepository,
    flag_repo: &AbnormalityFlagRepository,
) -> AppResult<()> {
    let now = chrono::Utc::now();

    // Stage 1 — preprocessing: parse file bytes → raw text
    job_repo
        .update_status(job_id, "preprocessing", Some(now), None, None)
        .await?;

    let raw_text = extractor.capture(&file_bytes, &mime_type).await?;

    // Stage 2 — extracting: raw text ready, load CoA
    job_repo
        .update_status(job_id, "extracting", None, None, None)
        .await?;

    let coa = coa_repo.find_all().await?;
    let aliases: Vec<crate::entities::account_alias::Model> = vec![];

    // Stage 3 — mapping: LLM maps text to CoA line items
    job_repo
        .update_status(job_id, "mapping", None, None, None)
        .await?;

    let output = extractor
        .map_to_coa(&raw_text, &coa, &aliases, &cooperative_type)
        .await?;

    // Get financial statement for this submission
    let fs = fs_repo
        .find_by_submission(submission_id)
        .await?
        .ok_or_else(|| {
            crate::error::AppError::NotFound("Financial statement not found for submission".into())
        })?;

    // Clear any existing draft line items (idempotent re-run support)
    line_item_repo.delete_by_financial_statement(fs.id).await?;

    // ── Deduplication ────────────────────────────────────────────────────────
    //
    // The DB has UNIQUE (financial_statement_id, account_code, month).
    // Problem: all unmapped items have account_code = NULL, which makes them
    // collide on (fs_id, NULL, 0) — only the first would insert.
    //
    // Solution: for mapped items, deduplicate by (code, month) keeping the
    // first (highest-confidence) occurrence. For unmapped items, keep all
    // unique raw_labels. We store account_code = NULL in the DB for all unmapped
    // items — the unique constraint uses NULLS NOT DISTINCT in Postgres 15+ but
    // for compatibility we just rely on the UUID primary key and store them all.
    // We skip the unique constraint by using INSERT ... ON CONFLICT DO NOTHING
    // via the bulk_create_ignore_conflict path, or simply accept the error and
    // continue (already done in the create call below).

    let mut seen_mapped: std::collections::HashSet<(i32, i16)> = std::collections::HashSet::new();

    // Pre-filter: skip items with no value (section headers returned by LLM)
    let candidates: Vec<&crate::services::ai_extraction::ExtractedLineItem> = output
        .line_items
        .iter()
        .filter(|item| item.value.is_some())
        .collect();

    let mut stored_count = 0usize;
    let mut total_confidence = 0.0f64;

    for item in &candidates {
        // Dedup check — skip duplicates
        let should_store = if let Some(code) = item.account_code {
            seen_mapped.insert((code, item.month))
        } else {
            // Unmapped items (account_code = null) are discarded — they cannot be mapped
            // to the cooperative Chart of Accounts and would clutter the review grid.
            tracing::debug!(raw_label = %item.raw_label, value = ?item.value, "Discarding unmapped line item");
            false
        };

        if !should_store {
            tracing::debug!(
                code = ?item.account_code,
                raw_label = %item.raw_label,
                "Skipping duplicate line item"
            );
            continue;
        }

        // Look up CoA entry for category / subcategory
        let (category, subcategory) = coa
            .iter()
            .find(|c| Some(c.account_code) == item.account_code)
            .map(|c| {
                (
                    c.account_category.clone(),
                    c.account_subcategory.clone().unwrap_or_default(),
                )
            })
            .unwrap_or((AccountCategory::Assets, String::new()));

        let value = Decimal::from_f64(item.value.unwrap_or(0.0)).unwrap_or(Decimal::ZERO);
        let confidence = Decimal::from_f64(item.confidence).unwrap_or(Decimal::ZERO);

        let model = LineItemModel {
            id: Set(Uuid::new_v4()),
            financial_statement_id: Set(fs.id),
            account_code: Set(item.account_code),
            account_name: Set(
                item.account_name
                    .clone()
                    .unwrap_or_else(|| item.raw_label.clone()),
            ),
            account_category: Set(category),
            account_subcategory: Set(subcategory),
            month: Set(item.month),
            value: Set(Some(value)),
            ai_confidence: Set(Some(confidence)),
            ai_flagged: Set(item.confidence < 0.6),
            manually_edited: Set(false),
            raw_label: Set(Some(item.raw_label.clone())),
            created_at: Set(chrono::Utc::now()),
            updated_at: Set(chrono::Utc::now()),
        };

        match line_item_repo.create(model).await {
            Ok(_) => {
                stored_count += 1;
                total_confidence += item.confidence;
            }
            Err(e) => {
                // Unique constraint violation for unmapped items — log and continue
                tracing::warn!(
                    code = ?item.account_code,
                    raw_label = %item.raw_label,
                    error = %e,
                    "Line item insert skipped (conflict)"
                );
            }
        }
    }

    let avg_confidence = if stored_count > 0 {
        Decimal::from_f64(total_confidence / stored_count as f64).unwrap_or(Decimal::ZERO)
    } else {
        Decimal::ZERO
    };

    // Determine extractor engine name from config
    let engine_name = std::env::var("EXTRACTION_BACKEND")
        .map(|b| if b == "llm" {
            std::env::var("AI_MODEL").unwrap_or_else(|_| "llm".into())
        } else {
            "mock-extractor".into()
        })
        .unwrap_or_else(|_| "mock-extractor".into());

    // Store raw extraction results in job record
    let extracted_json = serde_json::to_value(&output).unwrap_or(serde_json::Value::Null);
    job_repo
        .update_result(job_id, &raw_text, extracted_json, avg_confidence, &engine_name)
        .await?;

    job_repo
        .update_status(job_id, "succeeded", None, Some(chrono::Utc::now()), None)
        .await?;

    // Keep submission in Draft — cooperative reviews extracted data then submits
    submission_repo
        .update_status(
            submission_id,
            crate::entities::enums::SubmissionStatus::Draft,
            crate::entities::enums::ReviewTier::Cooperative,
        )
        .await?;

    // Stage 4 — validation: run abnormality detection
    let detector = AbnormalityDetector::new(line_item_repo.clone(), flag_repo.clone());
    let (errors, warnings) = detector.run(submission_id, cooperative_id, fs.id, &coa).await?;

    // Persist validation result on financial statement
    let validation_json = serde_json::json!({"errors": errors, "warnings": warnings});
    fs_repo.set_validation_errors(fs.id, validation_json).await?;

    tracing::info!(
        job_id = %job_id,
        submission_id = %submission_id,
        candidates = candidates.len(),
        stored = stored_count,
        avg_confidence = %avg_confidence,
        errors = errors.len(),
        warnings = warnings.len(),
        "Extraction pipeline completed"
    );

    Ok(())
}
