use rust_decimal::prelude::*;
use rust_decimal::Decimal;
use std::sync::Arc;
use uuid::Uuid;

use crate::entities::balance_sheet_line_item::ActiveModel as LineItemModel;
use crate::entities::enums::AccountCategory;
use crate::error::AppResult;
use crate::repositories::{
    AbnormalityFlagRepository, AccountAliasRepository, BalanceSheetLineItemRepository,
    ChartOfAccountsRepository, ExtractionJobRepository, FinancialStatementRepository,
    SubmissionRepository, SubmissionSectionRepository,
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
    alias_repo: AccountAliasRepository,
    flag_repo: AbnormalityFlagRepository,
    section_repo: SubmissionSectionRepository,
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
        &alias_repo,
        &flag_repo,
        &section_repo,
    )
    .await
    {
        tracing::error!(job_id = %job_id, error = %e, "Extraction pipeline failed");
        let _ = job_repo
            .update_status(
                job_id,
                "failed",
                None,
                Some(chrono::Utc::now()),
                Some(e.to_string()),
            )
            .await;
    }
}

#[allow(clippy::too_many_arguments)]
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
    alias_repo: &AccountAliasRepository,
    flag_repo: &AbnormalityFlagRepository,
    section_repo: &SubmissionSectionRepository,
) -> AppResult<()> {
    let now = chrono::Utc::now();

    // Stage 1 — preprocessing: parse file bytes → raw text
    job_repo
        .update_status(job_id, "preprocessing", Some(now), None, None)
        .await?;

    let raw_text = extractor.capture(&file_bytes, &mime_type).await?;

    // Stage 2 — extracting: raw text ready, load CoA + aliases
    job_repo
        .update_status(job_id, "extracting", None, None, None)
        .await?;

    let coa = coa_repo.find_all().await?;

    // FIX 1 — Load aliases from DB (was hardcoded empty vec before)
    let aliases = alias_repo.find_all().await.unwrap_or_else(|e| {
        tracing::warn!(error = %e, "Failed to load account aliases, proceeding without them");
        vec![]
    });
    tracing::info!(
        alias_count = aliases.len(),
        "Loaded account aliases for extraction"
    );

    // Stage 3 — mapping: LLM maps text to CoA line items
    job_repo
        .update_status(job_id, "mapping", None, None, None)
        .await?;

    // FIX 6 — Retry logic: up to 3 attempts with exponential backoff on transient errors
    let output = {
        let mut last_err = None;
        let mut result = None;
        for attempt in 1u8..=3 {
            match extractor
                .map_to_coa(&raw_text, &coa, &aliases, &cooperative_type)
                .await
            {
                Ok(o) => {
                    result = Some(o);
                    break;
                }
                Err(e) => {
                    let msg = e.to_string();
                    // Don't retry on bad-input errors (4xx), only on transient failures
                    let is_transient = !msg.contains("400")
                        && !msg.contains("401")
                        && !msg.contains("403")
                        && !msg.contains("max_tokens");
                    tracing::warn!(attempt, error = %msg, is_transient, "LLM mapping attempt failed");
                    if !is_transient || attempt == 3 {
                        last_err = Some(e);
                        break;
                    }
                    // Exponential backoff: 1s, 2s
                    let delay = std::time::Duration::from_secs(u64::from(attempt));
                    tokio::time::sleep(delay).await;
                    last_err = Some(e);
                }
            }
        }
        result.ok_or_else(|| {
            last_err.unwrap_or_else(|| {
                crate::error::AppError::InternalServerError(
                    "LLM mapping failed after 3 attempts".into(),
                )
            })
        })?
    };

    // Get financial statement for this submission
    let fs = fs_repo
        .find_by_submission(submission_id)
        .await?
        .ok_or_else(|| {
            crate::error::AppError::NotFound("Financial statement not found for submission".into())
        })?;

    // Clear any existing draft line items (idempotent re-run support)
    line_item_repo.delete_by_financial_statement(fs.id).await?;

    // Group and consolidate line items by account code/label and month to aggregate sub-accounts (like multiple PP&E components)
    let mut mapped_grouped: std::collections::HashMap<(i32, i16), Vec<crate::services::ai_extraction::ExtractedLineItem>> = std::collections::HashMap::new();
    let mut unmapped_grouped: std::collections::HashMap<(String, i16), Vec<crate::services::ai_extraction::ExtractedLineItem>> = std::collections::HashMap::new();

    for item in &output.line_items {
        if item.value.is_none() {
            continue;
        }
        if let Some(code) = item.account_code {
            mapped_grouped.entry((code, item.month)).or_default().push(item.clone());
        } else {
            unmapped_grouped.entry((item.raw_label.to_lowercase(), item.month)).or_default().push(item.clone());
        }
    }

    let mut consolidated_items: Vec<crate::services::ai_extraction::ExtractedLineItem> = Vec::new();

    for ((code, month), items) in mapped_grouped {
        let total_value: f64 = items.iter().filter_map(|x| x.value).sum();
        let avg_confidence: f64 = items.iter().map(|x| x.confidence).sum::<f64>() / items.len() as f64;
        
        let mut labels: Vec<String> = items.iter().map(|x| x.raw_label.clone()).collect();
        labels.sort();
        labels.dedup();
        let raw_label = labels.join(" + ");
        
        let account_name = items.iter().find_map(|x| x.account_name.clone());

        consolidated_items.push(crate::services::ai_extraction::ExtractedLineItem {
            account_code: Some(code),
            account_name,
            month,
            value: Some(total_value),
            confidence: avg_confidence,
            raw_label,
        });
    }

    for ((_, month), items) in unmapped_grouped {
        let total_value: f64 = items.iter().filter_map(|x| x.value).sum();
        let avg_confidence: f64 = items.iter().map(|x| x.confidence).sum::<f64>() / items.len() as f64;
        
        let mut labels: Vec<String> = items.iter().map(|x| x.raw_label.clone()).collect();
        labels.sort();
        labels.dedup();
        let raw_label = labels.join(" + ");

        let account_name = items.iter().find_map(|x| x.account_name.clone());

        consolidated_items.push(crate::services::ai_extraction::ExtractedLineItem {
            account_code: None,
            account_name,
            month,
            value: Some(total_value),
            confidence: avg_confidence,
            raw_label,
        });
    }

    let mut stored_count = 0usize;
    let mut unmapped_count = 0usize;
    let mut total_confidence = 0.0f64;

    for item in &consolidated_items {
        if item.account_code.is_none() {
            unmapped_count += 1;
        }

        // Look up CoA entry for category / subcategory (only for mapped items)
        let (category, subcategory) = if let Some(code) = item.account_code {
            coa.iter()
                .find(|c| c.account_code == code)
                .map(|c| {
                    (
                        c.account_category.clone(),
                        c.account_subcategory.clone().unwrap_or_default(),
                    )
                })
                .unwrap_or((AccountCategory::Assets, String::new()))
        } else {
            // Unmapped: use a placeholder category so it still shows in the right section
            (AccountCategory::Assets, String::new())
        };

        let value = Decimal::from_f64(item.value.unwrap_or(0.0)).unwrap_or(Decimal::ZERO);
        let confidence = Decimal::from_f64(item.confidence).unwrap_or(Decimal::ZERO);

        let model = LineItemModel {
            id: Set(Uuid::new_v4()),
            financial_statement_id: Set(fs.id),
            account_code: Set(item.account_code),
            account_name: Set(item
                .account_name
                .clone()
                .unwrap_or_else(|| item.raw_label.clone())),
            account_category: Set(category),
            account_subcategory: Set(subcategory),
            month: Set(item.month),
            value: Set(Some(value)),
            ai_confidence: Set(Some(confidence)),
            ai_flagged: Set(item.confidence < 0.6 || item.account_code.is_none()),
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

    let engine_name = std::env::var("EXTRACTION_BACKEND")
        .map(|b| {
            if b == "llm" {
                std::env::var("AI_MODEL").unwrap_or_else(|_| "llm".into())
            } else {
                "mock-extractor".into()
            }
        })
        .unwrap_or_else(|_| "mock-extractor".into());

    let extracted_json = serde_json::to_value(&output).unwrap_or(serde_json::Value::Null);
    job_repo
        .update_result(
            job_id,
            &raw_text,
            extracted_json,
            avg_confidence,
            &engine_name,
        )
        .await?;

    job_repo
        .update_status(job_id, "succeeded", None, Some(chrono::Utc::now()), None)
        .await?;

    submission_repo
        .update_status(
            submission_id,
            crate::entities::enums::SubmissionStatus::Draft,
            crate::entities::enums::ReviewTier::Cooperative,
        )
        .await?;

    // Stage 4 — validation: run full abnormality detection
    let detector =
        AbnormalityDetector::new(line_item_repo.clone(), flag_repo.clone(), coa_repo.clone());
    let (errors, warnings) = detector
        .run(
            submission_id,
            cooperative_id,
            fs.id,
            &coa,
            &cooperative_type,
        )
        .await?;

    let validation_json = serde_json::json!({"errors": errors, "warnings": warnings});
    fs_repo
        .set_validation_errors(fs.id, validation_json)
        .await?;

    if let Ok(Some(sec)) = section_repo
        .find_by_submission_and_section(submission_id, "financial")
        .await
    {
        let _ = section_repo.update_status(sec.id, "in_progress").await;
    }

    tracing::info!(
        job_id = %job_id,
        submission_id = %submission_id,
        consolidated = consolidated_items.len(),
        stored = stored_count,
        unmapped = unmapped_count,
        avg_confidence = %avg_confidence,
        errors = errors.len(),
        warnings = warnings.len(),
        "Extraction pipeline completed"
    );

    Ok(())
}
