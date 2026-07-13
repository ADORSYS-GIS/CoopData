use serde::{Deserialize, Serialize};

use crate::entities::account_alias::Model as AliasEntry;
use crate::entities::chart_of_account::Model as CoaEntry;
use crate::error::{AppError, AppResult};

// ── Domain types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionOutput {
    pub line_items: Vec<ExtractedLineItem>,
    pub totals_reconciliation: TotalsReconciliation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractedLineItem {
    pub account_code: Option<i32>,
    pub account_name: Option<String>,
    pub month: i16,
    #[serde(default)]
    pub value: Option<f64>,
    pub confidence: f64,
    pub raw_label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TotalsReconciliation {
    pub assets_total: Option<f64>,
    pub liabilities_total: Option<f64>,
    pub equity_total: Option<f64>,
    pub net_surplus: Option<f64>,
}

// ── Trait ─────────────────────────────────────────────────────────────────────

#[async_trait::async_trait]
pub trait FinancialStatementExtractor: Send + Sync {
    /// Parse file bytes → raw text (stage 1 preprocessing)
    async fn capture(&self, file_bytes: &[u8], mime_type: &str) -> AppResult<String>;
    /// Map raw text → canonical CoA line items (stage 2 LLM mapping)
    async fn map_to_coa(
        &self,
        raw_text: &str,
        chart_of_accounts: &[CoaEntry],
        account_aliases: &[AliasEntry],
        cooperative_type: &str,
    ) -> AppResult<ExtractionOutput>;
}

// ── File parsing helpers ──────────────────────────────────────────────────────

/// Extract text from a PDF using pdf_oxide.
pub fn extract_pdf_text(bytes: &[u8]) -> AppResult<String> {
    use pdf_oxide::api::Pdf;
    let mut doc = Pdf::from_bytes(bytes.to_vec())
        .map_err(|e| AppError::BadRequest(format!("Failed to parse PDF: {e}")))?;

    let page_count = doc
        .page_count()
        .map_err(|e| AppError::BadRequest(format!("Cannot read page count: {e}")))?;

    let mut text = String::new();
    for i in 0..page_count {
        if let Ok(page_text) = doc.to_text(i) {
            text.push_str(&page_text);
            text.push('\n');
        }
    }

    if text.trim().is_empty() {
        return Err(AppError::BadRequest(
            "PDF appears to be scanned or image-only — no extractable text found. \
             Upload as PNG/JPEG for vision-based extraction."
                .into(),
        ));
    }
    Ok(text)
}

/// Extract text from an Excel file using calamine.
pub fn extract_excel_text(bytes: &[u8]) -> AppResult<String> {
    use calamine::{open_workbook_from_rs, Data, Reader, Xlsx};
    use std::io::Cursor;

    let cursor = Cursor::new(bytes);
    let mut workbook: Xlsx<_> = open_workbook_from_rs(cursor)
        .map_err(|e| AppError::BadRequest(format!("Failed to parse Excel: {e}")))?;

    let mut output = String::new();
    for sheet_name in workbook.sheet_names().to_vec() {
        if let Ok(range) = workbook.worksheet_range(&sheet_name) {
            output.push_str(&format!("=== Sheet: {sheet_name} ===\n"));
            for row in range.rows() {
                let cells: Vec<String> = row
                    .iter()
                    .map(|cell| match cell {
                        Data::Empty => String::new(),
                        Data::String(s) => s.clone(),
                        Data::Float(f) => format!("{f}"),
                        Data::Int(i) => format!("{i}"),
                        Data::Bool(b) => format!("{b}"),
                        Data::DateTime(dt) => format!("{dt}"),
                        Data::Error(e) => format!("ERR:{e:?}"),
                        Data::DateTimeIso(s) => s.clone(),
                        Data::DurationIso(s) => s.clone(),
                    })
                    .collect();
                let line = cells.join("\t");
                if !line.trim().is_empty() {
                    output.push_str(&line);
                    output.push('\n');
                }
            }
        }
    }
    Ok(output)
}

/// Encode image bytes as base64 for vision API.
fn image_to_base64(bytes: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(bytes)
}

// ── LLM prompt builder ────────────────────────────────────────────────────────

fn build_mapping_prompt(
    raw_text: &str,
    coa: &[CoaEntry],
    aliases: &[AliasEntry],
    cooperative_type: &str,
) -> String {
    let coa_table: String = coa
        .iter()
        .map(|c| {
            format!(
                "| {} | {} | {} | {} |",
                c.account_code,
                c.account_name,
                c.account_category.as_str(),
                c.formula.as_deref().unwrap_or("")
            )
        })
        .collect::<Vec<_>>()
        .join("\n");

    let alias_table: String = if aliases.is_empty() {
        "(no aliases defined)".to_string()
    } else {
        aliases
            .iter()
            .map(|a| {
                format!(
                    "| {} | {} | {} |",
                    a.account_code, a.alias_label, a.language
                )
            })
            .collect::<Vec<_>>()
            .join("\n")
    };

    format!(
        r#"You are a financial statement extraction assistant for Swazi cooperatives.
Your job is to extract EVERY line item from the raw text and map each one to the canonical Chart of Accounts.

CHART OF ACCOUNTS (target schema):
| Code | Name | Category | Formula |
|------|------|----------|---------|
{coa_table}

Only use account codes from this list. If a label doesn't match any code, set account_code to null.

ACCOUNT ALIASES (synonyms in Swazi/English/French/Spanish):
| Code | Alias Label | Language |
|------|-------------|----------|
{alias_table}

RAW TEXT FROM UPLOADED FILE:
---
{raw_text}
---

This is a balance sheet for a {cooperative_type} cooperative.

CRITICAL INSTRUCTIONS:
1. Extract EVERY single numeric value from the raw text as a separate line item.
2. Do NOT skip any row — include individual items, subtotals, AND totals.
3. For each value, create a line item with:
   - account_code: the best matching CoA code (integer), or null if no match
   - account_name: the canonical CoA name if mapped, or the raw label if unmapped
   - raw_label: the EXACT label as it appears in the raw text
   - value: the numeric value (negative if in parentheses)
   - confidence: how confident you are in the mapping (not in the value)
4. Map aggressively — "Cash and cash equivalents" should map to cash codes, "Trade and other receivables" to receivables codes, etc.
5. Subtotal rows (e.g. "Total current assets") and total rows (e.g. "Total assets") should also be mapped to their corresponding total codes if they exist in the CoA (e.g. 1999 for Total Assets, 2999 for Total Liabilities, 3999 for Total Equity).
6. Prefer mapping to leaf/child codes (e.g. 1101, 1303, 3301) over parent/roll-up codes (e.g. 1100, 1300, 3300). Parent codes have formulas and are computed automatically — do NOT map to a parent code if a child code exists for that item.
7. "Retained earnings" → 3301 (Accumulated Surplus), NOT 3300 (which is a parent code).
8. "Cash and cash equivalents" → 1101 (Cash on Hand) if no separate bank accounts are listed.
9. "Share capital" or "Permanent share capital" → 3101, NOT 3100 (parent).

Return ONLY a JSON object with this exact structure (no markdown, no explanation):
{{
  "line_items": [
    {{
      "account_code": 1101,
      "account_name": "Cash on Hand",
      "month": 0,
      "value": 50000.00,
      "confidence": 0.95,
      "raw_label": "Cash on Hand"
    }}
  ],
  "totals_reconciliation": {{
    "assets_total": null,
    "liabilities_total": null,
    "equity_total": null,
    "net_surplus": null
  }}
}}

Rules:
- account_code must be an integer from the chart above, or null if unmapped
- month=0 means annual total; month=1-12 means that specific month
- confidence: 1.0=exact match, 0.8=alias match, 0.5=fuzzy, 0.3=guessed
- Parentheses like (8,000) mean negative values: -8000.0
- Do NOT invent values. Only extract values that appear in the raw text.
- Output ALL line items — a typical balance sheet has 25-40 line items."#
    )
}

// ── JSON repair helper ───────────────────────────────────────────────────────

/// Best-effort repair of truncated JSON from LLM responses.
/// Attempts to close incomplete arrays and objects so serde can parse partial output.
fn repair_truncated_json(raw: &str) -> Option<String> {
    let trimmed = raw.trim();

    // Count unmatched braces/brackets
    let mut open_braces = 0i32;
    let mut open_brackets = 0i32;
    let mut in_string = false;
    let mut escape = false;

    for ch in trimmed.chars() {
        if escape {
            escape = false;
            continue;
        }
        if ch == '\\' {
            escape = true;
            continue;
        }
        if ch == '"' {
            in_string = !in_string;
            continue;
        }
        if in_string {
            continue;
        }
        match ch {
            '{' => open_braces += 1,
            '}' => open_braces -= 1,
            '[' => open_brackets += 1,
            ']' => open_brackets -= 1,
            _ => {}
        }
    }

    if open_braces <= 0 && open_brackets <= 0 {
        return None; // Not a truncation issue
    }

    tracing::warn!(
        open_braces,
        open_brackets,
        "Attempting JSON repair for truncated response"
    );

    // Find the last complete line_item object in the array
    // Strategy: find "line_items": [ ... and look for the last } that closes a line item
    // Then close the array, add a minimal totals_reconciliation, and close the outer object
    let li_start = trimmed.find("\"line_items\"")?;
    let bracket_after = trimmed[li_start..].find('[')?;
    let array_start = li_start + bracket_after + 1;

    // Find the last complete object in the line_items array
    let array_content = &trimmed[array_start..];
    let mut last_complete_obj_end = None;
    let mut depth = 0i32;
    let mut in_str = false;
    let mut esc = false;

    for (i, ch) in array_content.char_indices() {
        if esc {
            esc = false;
            continue;
        }
        if ch == '\\' {
            esc = true;
            continue;
        }
        if ch == '"' {
            in_str = !in_str;
            continue;
        }
        if in_str {
            continue;
        }
        match ch {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    last_complete_obj_end = Some(i + 1);
                }
            }
            _ => {}
        }
    }

    let end = last_complete_obj_end?;

    // Reconstruct: everything up to the last complete line item, close array,
    // add empty totals_reconciliation, close outer object
    let prefix = &trimmed[..array_start + end];
    let repaired = format!(
        "{prefix}],\"totals_reconciliation\":{{\"assets_total\":null,\"liabilities_total\":null,\"equity_total\":null,\"net_surplus\":null}}}}",
    );

    Some(repaired)
}

// ── OpenAI-compatible LLM extractor ──────────────────────────────────────────

pub struct LlmExtractor {
    client: reqwest::Client,
    api_key: String,
    provider_url: String,
    model: String,
    vision_model: String,
    max_tokens: u32,
}

impl LlmExtractor {
    pub fn new(
        api_key: &str,
        provider_url: &str,
        model: &str,
        vision_model: &str,
        max_tokens: u32,
    ) -> Self {
        Self {
            client: reqwest::Client::new(),
            api_key: api_key.to_string(),
            provider_url: provider_url.trim_end_matches('/').to_string(),
            model: model.to_string(),
            vision_model: vision_model.to_string(),
            max_tokens,
        }
    }

    /// Call the chat completions endpoint with a text prompt.
    async fn chat(&self, model: &str, prompt: &str) -> AppResult<String> {
        let url = format!("{}/chat/completions", self.provider_url);
        let body = serde_json::json!({
            "model": model,
            "messages": [{ "role": "user", "content": prompt }],
            "temperature": 0,
            "max_tokens": self.max_tokens
        });

        tracing::info!(
            model = model,
            url = %url,
            prompt_chars = prompt.len(),
            max_tokens = self.max_tokens,
            "=== LLM CHAT REQUEST ==="
        );
        tracing::info!("=== LLM PROMPT START ===\n{prompt}\n=== LLM PROMPT END ===");

        let res = self
            .client
            .post(&url)
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(format!("LLM request failed: {e}")))?;

        if !res.status().is_success() {
            let status = res.status();
            let text = res.text().await.unwrap_or_default();
            tracing::error!(status = %status, response = %text, "=== LLM API ERROR ===");
            return Err(AppError::ExternalServiceError(format!(
                "LLM API error {status}: {text}"
            )));
        }

        let json: serde_json::Value = res
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(format!("LLM parse error: {e}")))?;

        let finish_reason = json["choices"][0]["finish_reason"].as_str().unwrap_or("");
        tracing::info!(finish_reason, "=== LLM FINISH REASON ===");

        if finish_reason == "max_tokens" || finish_reason == "length" {
            tracing::error!(
                finish_reason,
                "LLM response truncated due to max_tokens limit"
            );
            return Err(AppError::ExternalServiceError(
                "LLM response was truncated (max_tokens reached). The financial statement has too many line items for a single call. Consider splitting the document or increasing max_tokens.".into()
            ));
        }

        let content = json["choices"][0]["message"]["content"]
            .as_str()
            .ok_or_else(|| AppError::ExternalServiceError("Empty LLM response".into()))?;

        tracing::info!(
            response_chars = content.len(),
            "=== LLM RESPONSE RECEIVED ==="
        );
        tracing::info!("=== LLM RESPONSE START ===\n{content}\n=== LLM RESPONSE END ===");

        Ok(content.to_string())
    }

    /// Call vision API for image files — sends base64 image content.
    async fn vision_capture(&self, file_bytes: &[u8], mime_type: &str) -> AppResult<String> {
        const ALLOWED_MIME_TYPES: &[&str] =
            &["image/png", "image/jpeg", "image/jpg", "image/tiff"];
        if !ALLOWED_MIME_TYPES.contains(&mime_type) {
            return Err(AppError::BadRequest(format!(
                "Unsupported image MIME type for vision extraction: '{}'. \
                 Allowed types: {}",
                mime_type,
                ALLOWED_MIME_TYPES.join(", ")
            )));
        }
        let b64 = image_to_base64(file_bytes);
        let url = format!("{}/chat/completions", self.provider_url);
        let data_url = format!("data:{mime_type};base64,{b64}");

        let vision_prompt = "You are a precise OCR system for cooperative financial statements.\n\
                 Your job is to extract EVERY single row from this financial statement image with ZERO omissions.\n\
                 \n\
                 INSTRUCTIONS:\n\
                 1. Scan the image from top to bottom, left to right.\n\
                 2. For EVERY row that has a label and a numeric value, output: LABEL: VALUE\n\
                 3. Include EVERY individual line item (Cash, Inventories, PP&E, Accounts Payable, Share Capital, etc.)\n\
                 4. Include EVERY subtotal row (Total current assets, Total noncurrent assets, Total current liabilities, etc.)\n\
                 5. Include EVERY total row (Total assets, Total liabilities, Total equity, Total liabilities and equity)\n\
                 6. Include section headers as context lines (ASSETS, Current assets, Noncurrent assets, LIABILITIES AND EQUITY, etc.)\n\
                 7. Preserve negative values in parentheses as negative numbers: (1,000) → -1000\n\
                 8. Preserve the exact numeric values including ALL digits and commas.\n\
                 9. Do NOT summarize, do NOT skip rows, do NOT combine rows, do NOT round.\n\
                 10. A typical balance sheet has 25-40 rows — make sure you output ALL of them.\n\
                 \n\
                 Output format (one row per line):\n\
                 LABEL: VALUE\n\
                 \n\
                 Example:\n\
                 Cash and cash equivalents: 500\n\
                 Short-term investments: 1,100\n\
                 Total current assets: 9,270\n\
                 Total assets: 52,484";

        let body = serde_json::json!({
            "model": self.vision_model,
            "messages": [{
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": vision_prompt
                    },
                    {
                        "type": "image_url",
                        "image_url": { "url": data_url, "detail": "high" }
                    }
                ]
            }],
            "temperature": 0,
            "max_tokens": self.max_tokens
        });

        tracing::info!(
            model = %self.vision_model,
            url = %url,
            mime_type = mime_type,
            image_bytes = file_bytes.len(),
            max_tokens = self.max_tokens,
            "=== VISION API REQUEST ==="
        );
        tracing::info!("=== VISION PROMPT START ===\n{vision_prompt}\n=== VISION PROMPT END ===");

        let res = self
            .client
            .post(&url)
            .bearer_auth(&self.api_key)
            .json(&body)
            .send()
            .await
            .map_err(|e| AppError::ExternalServiceError(format!("Vision API failed: {e}")))?;

        if !res.status().is_success() {
            let status = res.status();
            let text = res.text().await.unwrap_or_default();
            tracing::error!(status = %status, response = %text, "=== VISION API ERROR ===");
            return Err(AppError::ExternalServiceError(format!(
                "Vision API error {status}: {text}"
            )));
        }

        let json: serde_json::Value = res
            .json()
            .await
            .map_err(|e| AppError::ExternalServiceError(format!("Vision parse error: {e}")))?;

        let finish_reason = json["choices"][0]["finish_reason"].as_str().unwrap_or("");
        tracing::info!(finish_reason, "=== VISION FINISH REASON ===");

        if finish_reason == "max_tokens" || finish_reason == "length" {
            tracing::error!(
                finish_reason,
                "Vision API response truncated due to max_tokens limit"
            );
            return Err(AppError::ExternalServiceError(
                "Vision API response was truncated (max_tokens reached). The image contains too much text for a single call.".into()
            ));
        }

        let content = json["choices"][0]["message"]["content"]
            .as_str()
            .ok_or_else(|| AppError::ExternalServiceError("Empty vision response".into()))?;

        tracing::info!(
            response_chars = content.len(),
            "=== VISION RESPONSE RECEIVED ==="
        );
        tracing::info!("=== VISION RESPONSE START ===\n{content}\n=== VISION RESPONSE END ===");

        Ok(content.to_string())
    }

    /// Parse the LLM JSON response into an ExtractionOutput.
    fn parse_llm_output(raw: &str) -> AppResult<ExtractionOutput> {
        // Strip any markdown code fences the model might have added
        let cleaned = raw
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();

        match serde_json::from_str::<ExtractionOutput>(cleaned) {
            Ok(output) => {
                tracing::info!(
                    items = output.line_items.len(),
                    mapped = output
                        .line_items
                        .iter()
                        .filter(|i| i.account_code.is_some())
                        .count(),
                    unmapped = output
                        .line_items
                        .iter()
                        .filter(|i| i.account_code.is_none())
                        .count(),
                    "=== EXTRACTION PARSED SUCCESSFULLY ==="
                );
                for (i, item) in output.line_items.iter().enumerate() {
                    tracing::info!(
                        idx = i,
                        code = ?item.account_code,
                        name = ?item.account_name,
                        raw_label = %item.raw_label,
                        value = item.value,
                        confidence = item.confidence,
                        "  line_item[{i}]"
                    );
                }
                Ok(output)
            }
            Err(e) => {
                tracing::warn!(error = %e, "Initial JSON parse failed, attempting repair");

                // Best-effort JSON repair: try to close incomplete JSON
                if let Some(repaired) = repair_truncated_json(cleaned) {
                    match serde_json::from_str::<ExtractionOutput>(&repaired) {
                        Ok(output) => {
                            tracing::info!(
                                items = output.line_items.len(),
                                "JSON repair succeeded"
                            );
                            for (i, item) in output.line_items.iter().enumerate() {
                                tracing::info!(
                                    idx = i,
                                    code = ?item.account_code,
                                    name = ?item.account_name,
                                    raw_label = %item.raw_label,
                                    value = item.value,
                                    confidence = item.confidence,
                                    "  line_item[{i}] (repaired)"
                                );
                            }
                            return Ok(output);
                        }
                        Err(e2) => {
                            tracing::error!(error = %e2, "JSON repair also failed");
                        }
                    }
                }

                Err(AppError::InternalServerError(format!(
                    "Failed to parse LLM output as ExtractionOutput: {e}\nRaw: {}",
                    &cleaned[..cleaned.len().min(500)]
                )))
            }
        }
    }
}

#[async_trait::async_trait]
impl FinancialStatementExtractor for LlmExtractor {
    async fn capture(&self, file_bytes: &[u8], mime_type: &str) -> AppResult<String> {
        tracing::info!(
            mime_type,
            file_bytes = file_bytes.len(),
            "=== CAPTURE START ==="
        );
        match mime_type {
            "application/pdf" => {
                // Offload synchronous PDF parsing to a blocking thread
                let bytes = file_bytes.to_vec();
                let text_result = tokio::task::spawn_blocking(move || extract_pdf_text(&bytes))
                    .await
                    .map_err(|e| {
                        AppError::InternalServerError(format!("PDF thread join error: {e}"))
                    })?;
                match text_result {
                    Ok(text) => {
                        tracing::info!(chars = text.len(), "=== PDF TEXT EXTRACTED NATIVELY ===");
                        tracing::info!("=== PDF TEXT START ===\n{text}\n=== PDF TEXT END ===");
                        Ok(text)
                    }
                    Err(e) => {
                        tracing::warn!(error = %e, "=== NATIVE PDF EXTRACTION FAILED, ROUTING TO VISION API ===");
                        self.vision_capture(file_bytes, "image/png").await
                    }
                }
            }
            "image/png" | "image/jpeg" | "image/jpg" | "image/tiff" => {
                tracing::info!(mime_type, "=== IMAGE FILE — SENDING TO VISION API ===");
                self.vision_capture(file_bytes, mime_type).await
            }
            m if m.contains("spreadsheet") || m.contains("excel") || m.ends_with(".xls") => {
                tracing::info!("=== EXCEL FILE — EXTRACTING WITH CALAMINE ===");
                // Offload synchronous Excel parsing to a blocking thread
                let bytes = file_bytes.to_vec();
                let text = tokio::task::spawn_blocking(move || extract_excel_text(&bytes))
                    .await
                    .map_err(|e| {
                        AppError::InternalServerError(format!("Excel thread join error: {e}"))
                    })?
                    ?;
                tracing::info!(chars = text.len(), "=== EXCEL TEXT EXTRACTED ===");
                tracing::info!("=== EXCEL TEXT START ===\n{text}\n=== EXCEL TEXT END ===");
                Ok(text)
            }
            other => {
                tracing::warn!(
                    mime = other,
                    "=== UNKNOWN MIME, ATTEMPTING PDF EXTRACTION ==="
                );
                // Offload synchronous PDF parsing to a blocking thread
                let bytes = file_bytes.to_vec();
                tokio::task::spawn_blocking(move || extract_pdf_text(&bytes))
                    .await
                    .map_err(|e| {
                        AppError::InternalServerError(format!("PDF thread join error: {e}"))
                    })?
            }
        }
    }

    async fn map_to_coa(
        &self,
        raw_text: &str,
        chart_of_accounts: &[CoaEntry],
        account_aliases: &[AliasEntry],
        cooperative_type: &str,
    ) -> AppResult<ExtractionOutput> {
        tracing::info!(
            raw_text_chars = raw_text.len(),
            coa_count = chart_of_accounts.len(),
            alias_count = account_aliases.len(),
            cooperative_type = cooperative_type,
            "=== MAP_TO_COA START ==="
        );
        tracing::info!(
            "=== RAW TEXT FROM VISION/EXTRACTION START ===\n{raw_text}\n=== RAW TEXT END ==="
        );

        let prompt = build_mapping_prompt(
            raw_text,
            chart_of_accounts,
            account_aliases,
            cooperative_type,
        );

        let raw_output = self.chat(&self.model, &prompt).await?;

        tracing::info!(
            output_chars = raw_output.len(),
            "=== MAP_TO_COA RESPONSE ==="
        );

        Self::parse_llm_output(&raw_output)
    }
}

// ── Mock implementation (deterministic, no network) ───────────────────────────

pub struct MockExtractor;

#[async_trait::async_trait]
impl FinancialStatementExtractor for MockExtractor {
    async fn capture(&self, _file_bytes: &[u8], _mime_type: &str) -> AppResult<String> {
        Ok(r#"COOPERATIVE BALANCE SHEET - ANNUAL 2024
========================================
ASSETS
Cash on Hand                    50,000
Cash at Bank (Current)         120,000
Cash at Bank (Savings)          30,000
Short Term Investments          10,000
Performing Loans               200,000
Loans in Arrears 1-30            5,000
Non-Performing Loans             3,000
General Loan Loss Provision     (8,000)
Accounts Receivable             15,000
Fixed Assets (Cost)             80,000
Accumulated Depreciation        (20,000)

LIABILITIES
Voluntary Savings               180,000
Mandatory Savings                90,000
Fixed Term Deposits              40,000
Short Term Borrowings            25,000
Accounts Payable                 8,000
Accrued Expenses                 2,000

EQUITY
Permanent Share Capital          50,000
Withdrawable Shares              20,000
Statutory Reserve                15,000
General Reserve                  10,000
Accumulated Surplus               5,000
Current Year Surplus             12,000

INCOME
Interest Income from Loans       45,000
Fees and Commissions              5,000
Other Operating Income            3,000

EXPENSES
Interest Expense on Deposits     18,000
Interest Expense on Borrowings    6,000
Personnel Costs                  12,000
Administrative Expenses           8,000
Governance Expenses               3,000
Depreciation                      4,000
Loan Loss Provision Expense       5,000

Miscellaneous Fund               12,000
"#
        .to_string())
    }

    async fn map_to_coa(
        &self,
        _raw_text: &str,
        _chart_of_accounts: &[CoaEntry],
        _account_aliases: &[AliasEntry],
        _cooperative_type: &str,
    ) -> AppResult<ExtractionOutput> {
        Ok(ExtractionOutput {
            line_items: vec![
                item(1101, "Cash on Hand", 50000.0, 0.95, "Cash on Hand"),
                item(
                    1102,
                    "Cash at Bank (Current)",
                    120000.0,
                    0.92,
                    "Cash at Bank (Current)",
                ),
                item(
                    1103,
                    "Cash at Bank (Savings)",
                    30000.0,
                    0.90,
                    "Cash at Bank (Savings)",
                ),
                item(
                    1104,
                    "Short Term Investments",
                    10000.0,
                    0.85,
                    "Short Term Investments",
                ),
                item(1201, "Performing Loans", 200000.0, 0.93, "Performing Loans"),
                item(
                    1202,
                    "Loans in Arrears 1-30",
                    5000.0,
                    0.80,
                    "Loans in Arrears 1-30",
                ),
                item(
                    1205,
                    "Non-Performing Loans",
                    3000.0,
                    0.75,
                    "Non-Performing Loans",
                ),
                item(
                    1251,
                    "General Loan Loss Provision",
                    -8000.0,
                    0.55,
                    "General Loan Loss Provision",
                ),
                item(
                    1301,
                    "Accounts Receivable",
                    15000.0,
                    0.88,
                    "Accounts Receivable",
                ),
                item(
                    1303,
                    "Fixed Assets (Cost)",
                    80000.0,
                    0.82,
                    "Fixed Assets (Cost)",
                ),
                item(
                    1304,
                    "Accumulated Depreciation",
                    -20000.0,
                    0.78,
                    "Accumulated Depreciation",
                ),
                item(
                    2101,
                    "Voluntary Savings",
                    180000.0,
                    0.91,
                    "Voluntary Savings",
                ),
                item(
                    2102,
                    "Mandatory Savings",
                    90000.0,
                    0.89,
                    "Mandatory Savings",
                ),
                item(
                    2103,
                    "Fixed Term Deposits",
                    40000.0,
                    0.86,
                    "Fixed Term Deposits",
                ),
                item(
                    2201,
                    "Short Term Borrowings",
                    25000.0,
                    0.84,
                    "Short Term Borrowings",
                ),
                item(2301, "Accounts Payable", 8000.0, 0.82, "Accounts Payable"),
                item(2302, "Accrued Expenses", 2000.0, 0.79, "Accrued Expenses"),
                item(
                    3101,
                    "Permanent Share Capital",
                    50000.0,
                    0.90,
                    "Permanent Share Capital",
                ),
                item(
                    3102,
                    "Withdrawable Shares",
                    20000.0,
                    0.87,
                    "Withdrawable Shares",
                ),
                item(
                    3201,
                    "Statutory Reserve",
                    15000.0,
                    0.85,
                    "Statutory Reserve",
                ),
                item(3202, "General Reserve", 10000.0, 0.83, "General Reserve"),
                item(
                    3301,
                    "Accumulated Surplus",
                    5000.0,
                    0.80,
                    "Accumulated Surplus",
                ),
                item(
                    3302,
                    "Current Year Surplus",
                    12000.0,
                    0.77,
                    "Current Year Surplus",
                ),
                item(
                    4101,
                    "Interest Income from Loans",
                    45000.0,
                    0.91,
                    "Interest Income from Loans",
                ),
                item(
                    4102,
                    "Fees and Commissions",
                    5000.0,
                    0.85,
                    "Fees and Commissions",
                ),
                item(
                    4201,
                    "Other Operating Income",
                    3000.0,
                    0.80,
                    "Other Operating Income",
                ),
                item(
                    5101,
                    "Interest Expense on Deposits",
                    18000.0,
                    0.88,
                    "Interest Expense on Deposits",
                ),
                item(
                    5102,
                    "Interest Expense on Borrowings",
                    6000.0,
                    0.85,
                    "Interest Expense on Borrowings",
                ),
                item(5201, "Personnel Costs", 12000.0, 0.86, "Personnel Costs"),
                item(
                    5202,
                    "Administrative Expenses",
                    8000.0,
                    0.83,
                    "Administrative Expenses",
                ),
                item(
                    5203,
                    "Governance Expenses",
                    3000.0,
                    0.78,
                    "Governance Expenses",
                ),
                item(5204, "Depreciation", 4000.0, 0.75, "Depreciation"),
                item(
                    5301,
                    "Loan Loss Provision Expense",
                    5000.0,
                    0.72,
                    "Loan Loss Provision Expense",
                ),
                ExtractedLineItem {
                    account_code: None,
                    account_name: Some("Miscellaneous Fund".into()),
                    month: 0,
                    value: Some(12000.0),
                    confidence: 0.40,
                    raw_label: "Miscellaneous Fund".into(),
                },
            ],
            totals_reconciliation: TotalsReconciliation {
                assets_total: Some(485000.0),
                liabilities_total: Some(345000.0),
                equity_total: Some(112000.0),
                net_surplus: Some(0.0),
            },
        })
    }
}

fn item(code: i32, name: &str, value: f64, confidence: f64, raw_label: &str) -> ExtractedLineItem {
    ExtractedLineItem {
        account_code: Some(code),
        account_name: Some(name.into()),
        month: 0,
        value: Some(value),
        confidence,
        raw_label: raw_label.into(),
    }
}

// ── Factory ───────────────────────────────────────────────────────────────────

pub fn create_extractor(
    config: &crate::config::AppConfig,
) -> std::sync::Arc<dyn FinancialStatementExtractor> {
    if config.extraction_backend == "llm" {
        if config.ai_api_key.is_empty() {
            tracing::warn!(
                "EXTRACTION_BACKEND=llm but AI_API_KEY is not set — falling back to mock extractor"
            );
            return std::sync::Arc::new(MockExtractor);
        }
        tracing::info!(
            model = config.ai_model,
            vision_model = config.ai_vision_model,
            provider = config.ai_provider_url,
            max_tokens = config.ai_max_tokens,
            "Using LLM extractor"
        );
        std::sync::Arc::new(LlmExtractor::new(
            &config.ai_api_key,
            &config.ai_provider_url,
            &config.ai_model,
            &config.ai_vision_model,
            config.ai_max_tokens,
        ))
    } else {
        tracing::info!("Using mock extractor (set EXTRACTION_BACKEND=llm to enable real AI)");
        std::sync::Arc::new(MockExtractor)
    }
}
