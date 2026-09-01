use serde::{Deserialize, Serialize};

use crate::entities::account_alias::Model as AliasEntry;
use crate::entities::chart_of_account::Model as CoaEntry;
use crate::error::{AppError, AppResult};

// ── NF Header Mapping ─────────────────────────────────────────────────────────

/// Maps a sheet's actual column headers to canonical field names via LLM.
/// Returns a map of `actual_header_lowercase → canonical_field_name`.
#[async_trait::async_trait]
pub trait NfHeaderMapper: Send + Sync {
    async fn map_headers(
        &self,
        sheet_name: &str,
        actual_headers: &[String],
        canonical_fields: &[&str],
    ) -> std::collections::HashMap<String, String>;
}

// ── Domain types ──────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExtractionOutput {
    pub line_items: Vec<ExtractedLineItem>,
    pub totals_reconciliation: TotalsReconciliation,
    #[serde(default)]
    pub detected_period_type: Option<String>,
    #[serde(default)]
    pub detected_period_value: Option<String>,
    #[serde(default)]
    pub detected_reporting_year: Option<i32>,
    #[serde(default)]
    pub detected_fiscal_start_month: Option<i32>,
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
        reporting_year: i32,
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
/// Preserves column/row structure so the LLM can identify monthly columns.
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

            let rows: Vec<Vec<Data>> = range.rows().map(|r| r.to_vec()).collect();
            if rows.is_empty() {
                continue;
            }

            // Detect if any of the first 20 non-empty rows look like a month/period header
            // (contains "Jan", "Feb", month numbers, or year-like values)
            let has_column_headers = rows.iter().take(20).any(|row| {
                row.iter().skip(1).any(|cell| {
                    let s = cell_to_str(cell);
                    let lower = s.to_lowercase();
                    lower.contains("jan") || lower.contains("feb") || lower.contains("mar")
                        || lower.contains("apr") || lower.contains("may") || lower.contains("jun")
                        || lower.contains("jul") || lower.contains("aug") || lower.contains("sep")
                        || lower.contains("oct") || lower.contains("nov") || lower.contains("dec")
                        || lower.contains("month") || lower.contains("period")
                        // numeric month headers like "1", "2" ... "12"
                        || s.trim().parse::<u32>().map(|n| (1..=12).contains(&n)).unwrap_or(false)
                })
            });

            if has_column_headers {
                // Structured mode: emit as table with | separator so LLM preserves columns
                output.push_str("TABLE FORMAT (Label | Col1 | Col2 | ... | ColN):\n");
                for row in &rows {
                    if row.iter().all(|c| cell_to_str(c).trim().is_empty()) {
                        continue; // skip blank rows
                    }
                    let cells: Vec<String> = row.iter().map(cell_to_str).collect();
                    output.push_str(&format!("| {} |\n", cells.join(" | ")));
                }
            } else {
                // Simple mode: label → value pairs, one per line
                for row in &rows {
                    if row.iter().all(|c| cell_to_str(c).trim().is_empty()) {
                        continue;
                    }
                    let cells: Vec<String> = row
                        .iter()
                        .map(cell_to_str)
                        .filter(|s| !s.trim().is_empty())
                        .collect();
                    if !cells.is_empty() {
                        output.push_str(&cells.join(": "));
                        output.push('\n');
                    }
                }
            }
            output.push('\n');
        }
    }
    Ok(output)
}

fn cell_to_str(cell: &calamine::Data) -> String {
    use calamine::Data;
    match cell {
        Data::Empty => String::new(),
        Data::String(s) => s.clone(),
        Data::Float(f) => {
            // Avoid scientific notation for financial values
            if f.abs() >= 1.0 && f.fract() == 0.0 {
                format!("{}", *f as i64)
            } else {
                format!("{f:.2}")
            }
        }
        Data::Int(i) => format!("{i}"),
        Data::Bool(b) => format!("{b}"),
        Data::DateTime(dt) => format!("{dt}"),
        Data::Error(e) => format!("ERR:{e:?}"),
        Data::DateTimeIso(s) => s.clone(),
        Data::DurationIso(s) => s.clone(),
    }
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
    reporting_year: i32,
) -> String {
    let coa_table: String = coa
        .iter()
        .map(|c| {
            format!(
                "| {} | {} | {} | {} | {} |",
                c.account_code,
                c.account_name,
                c.account_category.as_str(),
                c.formula.as_deref().unwrap_or(""),
                c.description.as_deref().unwrap_or("")
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
| Code | Name | Category | Formula | Description |
|------|------|----------|---------|-------------|
{coa_table}

The Description column explains what each account code means, its sign convention, and parent/child relationships. Use it to map labels accurately.

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

═══════════════════════════════════════════════════════
TARGET YEAR — VERY IMPORTANT
═══════════════════════════════════════════════════════
This submission is for reporting year {reporting_year}.

If the document contains financial data for MULTIPLE YEARS (e.g. columns for 2024 and 2025),
extract ONLY the column for {reporting_year} or the fiscal year ending in {reporting_year}.
Ignore and discard all data columns for other years.

If the document does NOT contain data for {reporting_year} at all (e.g. it only shows 2024
and 2025 but this submission is for 2019), set detected_reporting_year to the actual year
you found in the document (e.g. 2025) so the system can detect the mismatch and alert the user.

═══════════════════════════════════════════════════════
CRITICAL MAPPING RULES — READ CAREFULLY BEFORE MAPPING
═══════════════════════════════════════════════════════

RULE 1 — PARENT vs CHILD CODES & SUBTOTALS:
- Individual line items (e.g., "Cash on hand", "Property plant and equipment", "Investment") must map to specific leaf account codes (1101, 1303, 1104, etc.).
- Subtotal and Section Summary rows MUST be mapped to their category summary codes:
  - "Total Current Assets" / "Current Assets" (subtotal) → 1100
  - "Total Non-Current Assets" / "Non-Current Assets" (subtotal) → 1300
  - "Total Assets" (grand total) → 1999
  - "Total Current Liabilities" / "Current Liabilities" (subtotal) → 2100
  - "Total Liabilities" (subtotal/total) → 2999
  - "Total Equity" / "Equity" (subtotal for equity alone, e.g. 570,976) → 3999
  - CRITICAL WARNING: "Total Equity & Liabilities" or "Total Liabilities & Equity" (grand total e.g. 2,006,383) is a grand total check row (equal to Total Assets). Do NOT output "Total Equity & Liabilities" as an entry in line_items array.
Do NOT leave standard subtotals as null account_code!

RULE 2 — NEGATIVE VALUES (critical for balance sheet accuracy):
These accounts MUST always be stored as negative numbers:
  - Accumulated depreciation / Depreciation (code 1304) → ALWAYS negative (e.g. -20000)
  - General loan loss provision (code 1251) → ALWAYS negative
  - Specific loan loss provision (code 1252) → ALWAYS negative
  - Values already in parentheses "(8,000)" → negative: -8000.0
  - Expense items ARE negative on the income side

RULE 3 — CONFIDENCE SCORING (be honest, not optimistic):
  - 1.00: Exact label match (e.g., "Cash on Hand" → 1101)
  - 0.85: Near-exact match (e.g., "Cash in hand" → 1101)
  - 0.70: Synonym/alias match (e.g., "Caja" → 1101 via alias table)
  - 0.50: Fuzzy/inferred (e.g., "Liquid assets" → probably 1100 area)
  - 0.30: Guessed (e.g., "Miscellaneous" → unclear)
  - 0.00: Cannot map → set account_code to null
  Do NOT assign 0.95 to everything. Differentiate based on certainty.

RULE 4 — MONTHLY DATA (13-COLUMN MONTHLY BALANCE SHEETS):
If the document has monthly columns (e.g., Dec 2021, Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec 2022) OR a table with month/period headers:
  - Return each row's values grouped together inside the "values" map of the row object.
  - Map month number as a string key: e.g. "0" for Dec prior year baseline, "1" for January, "2" for February, ..., "12" for December.
  - Do NOT output zero, null, or empty monthly cells. If a row has only zero or empty values across all months, you may skip the entire row from the "line_items" array.
  - Example row: "Cash & Cash Equivalents | 213,165 | 277,410 | 362,919" emits:
    {{
      "account_code": 1101,
      "account_name": "CASH ON HAND",
      "confidence": 1.0,
      "raw_label": "Cash & Cash Equivalents",
      "values": {{"0": 213165.0, "1": 277410.0, "2": 362919.0}}
    }}

RULE 5 — EXCEL TABLE STRUCTURE:
If the raw text contains table-structured data with Row/Column notation or Pipe separators (|):
  - Row headers (Column A / leftmost column) are account LABELS
  - Column headers are MONTHS or PERIODS (Dec prior year, Jan .. Dec current year)
  - Map each cell at the intersection of label-row and month-column as an entry in the "values" map of that row.
  - Do NOT discard column data — every column with a month or date header must produce an entry.

RULE 6 — EXTRACTION COMPLETENESS:
  - Extract EVERY single numeric value — do NOT skip any row
  - Include individual items, subtotals, AND grand totals
  - A typical balance sheet has 25-40 rows
  - Do NOT invent values — only extract what appears in the raw text

═══════════════════════════════════════════
SPECIFIC LABEL → CODE MAPPINGS (memorize):
═══════════════════════════════════════════
"Cash on Hand" / "Cash in hand" / "Imali" / "Cash and cash equivalent" / "Cash & cash equivalents" → 1101
"Cash at Bank (Current)" / "Bank current account" → 1102
"Cash at Bank (Savings)" / "Bank savings account" → 1103
"Short-term investments" / "Treasury bills" / "Investment" / "Investments" / "Financial Investment" → 1104
"Performing loans" / "Good loans" / "Members' long-term loans" / "Members' short-term loans" → 1201
"Loans in arrears 1-30" → 1202
"Loans in arrears 31-60" → 1203
"Loans in arrears 61-90" → 1204
"Non-performing loans" / "NPL" / "Bad loans" / "Write-offs" → 1205
"General loan loss provision" / "GLLP" → 1251 (NEGATIVE)
"Specific loan loss provision" / "SLLP" → 1252 (NEGATIVE)
"Accounts receivable" / "Receivables" / "Trade and other receivables" / "Trade & other receivables" → 1301
"Prepaid expenses" → 1302
"Fixed assets (cost)" / "Property plant equipment" / "PPE" / "Property, plant, and equipment" / "Property, plant and equipment" → 1303
"Accumulated depreciation" / "Accum. depreciation" → 1304 (NEGATIVE)
"Intangible assets" → 1305
"Total Current Assets" / "CURRENT ASSETS" (subtotal) → 1100
"Total Non-Current Assets" / "NON-CURRENT ASSETS" / "OTHER ASSETS" (subtotal) → 1300
"Total Assets" → 1999
"Voluntary savings" / "Member savings" / "Members' short-term savings" / "Short-term savings" → 2101
"Mandatory savings" / "Compulsory savings" → 2102
"Fixed term deposits" / "Fixed deposits" / "Term deposits" / "Members' long-term savings" / "Long-term savings" → 2103
"Short-term borrowings" → 2201
"Long-term borrowings" → 2202
"Accounts payable" / "Trade payables" / "Trade and other payables" / "Trade & other payables" → 2301
"Accrued expenses" / "Accruals" / "Interest provision" / "Provision for interest" → 2302
"Deferred income" → 2303
"Total Current Liabilities" / "CURRENT LIABILITIES" (subtotal) → 2100
"Total Long Term Liabilities" / "LONG TERM LIABILITIES" (subtotal) → 2200
"Total Liabilities" / "TOTAL LIABILITIES" → 2999
"Permanent share capital" / "Share capital" / "Permanent shares" / "Members shares" / "Members' shares" / "EQUITY Members shares" → 3101
"Withdrawable shares" / "Redeemable shares" → 3102
"Statutory reserve" → 3201
"General reserve" / "Reserves" / "EQUITY Reserves" → 3202
"Risk/capital adequacy reserve" → 3203
"Accumulated surplus" / "Retained earnings" / "Retained surplus" → 3301
"Current year surplus" / "Net income" / "Profit this year" → 3302
"Total Equity" / "Members equity" / "EQUITY" (subtotal for equity alone, e.g. 570,976) → 3999
"Total Equity & Liabilities" / "Total Equity and Liabilities" / "Total Liabilities & Equity" → null (Do NOT map to 3999! Code 3999 is ONLY for Equity alone)
"Interest income on loans" / "Loan interest" → 4101
"Fees and commissions" / "Service charges" → 4102
"Other operating income" → 4201
"Total Income" → 4999
"Interest expense on deposits" / "Interest paid on savings" → 5101
"Interest expense on borrowings" / "Interest on loans" → 5102
"Personnel costs" / "Staff costs" / "Salaries" → 5201
"Administrative expenses" / "Admin costs" → 5202
"Governance expenses" / "Board expenses" → 5203
"Depreciation" / "Depreciation charge" → 5204
"Loan loss provision expense" / "Provision expense" → 5301
"Total Expenses" → 5999
"Net surplus" / "Net deficit" / "Net income" / "Profit or loss" → 6999

Return ONLY a MINIFIED, SINGLE-LINE JSON object (no pretty-printing, no newlines, no indentation, no spaces in formatting, no markdown fences) with this exact structure. Minifying is absolutely critical to avoid token truncation:
{{"line_items":[{{"account_code":1101,"account_name":"CASH ON HAND","confidence":1.0,"raw_label":"Cash on Hand","values":{{"0":213165.0,"1":277410.0,"2":362919.0}}}}],"totals_reconciliation":{{"assets_total":null,"liabilities_total":null,"equity_total":null,"net_surplus":null}},"detected_period_type":"YEARLY","detected_period_value":"2026","detected_reporting_year":2026,"detected_fiscal_start_month":10}}

Fill totals_reconciliation from the grand total rows in the document:
  assets_total → the value next to "Total Assets" or equivalent
  liabilities_total → the value next to "Total Liabilities" or equivalent
  equity_total → the value next to "Total Equity" or equivalent
  net_surplus → the value next to "Net Surplus/Deficit" or equivalent

Fill auto-detected period & fiscal start month fields:
  detected_period_type → "YEARLY", "QUARTERLY", "MONTHLY", or "SEMI_ANNUAL"
  detected_period_value → e.g. "2026", "Q1".."Q4", "01".."12", "H1".."H2"
  detected_reporting_year → integer year (e.g. 2026)
  detected_fiscal_start_month → starting month integer (1 = Jan, 10 = Oct, 7 = Jul, etc.) if specified or inferred from column headers (e.g., if columns start in October, set 10).

Ensure all columns (0 to 12) for all rows are fully extracted, and ensure that all equity codes such as General Reserve (3202), Risk/Capital Adequacy Reserve (3203), Accumulated Surplus (3301), and Current Year Surplus (3302) are mapped and not omitted.

Do NOT invent values. Only extract values that appear in the raw text."#
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
    semaphore: tokio::sync::Semaphore,
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
            semaphore: tokio::sync::Semaphore::new(2),
        }
    }

    /// Call the chat completions endpoint with a text prompt.
    async fn chat(&self, model: &str, prompt: &str) -> AppResult<String> {
        let _permit =
            self.semaphore.acquire().await.map_err(|e| {
                AppError::InternalServerError(format!("Semaphore acquire error: {e}"))
            })?;
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

        let content = json["choices"][0]["message"]["content"]
            .as_str()
            .ok_or_else(|| AppError::ExternalServiceError("Empty LLM response".into()))?;

        if finish_reason == "max_tokens" || finish_reason == "length" {
            tracing::warn!(
                finish_reason,
                response_chars = content.len(),
                "LLM response truncated — returning partial content for JSON repair"
            );
            return Ok(content.to_string());
        }

        tracing::info!(
            response_chars = content.len(),
            "=== LLM RESPONSE RECEIVED ==="
        );
        tracing::info!("=== LLM RESPONSE START ===\n{content}\n=== LLM RESPONSE END ===");

        Ok(content.to_string())
    }

    /// Call vision API for image files — sends base64 image content.
    async fn vision_capture(&self, file_bytes: &[u8], mime_type: &str) -> AppResult<String> {
        const ALLOWED_MIME_TYPES: &[&str] = &["image/png", "image/jpeg", "image/jpg", "image/tiff"];
        if !ALLOWED_MIME_TYPES.contains(&mime_type) {
            return Err(AppError::BadRequest(format!(
                "Unsupported image MIME type for vision extraction: '{}'. \
                 Allowed types: {}",
                mime_type,
                ALLOWED_MIME_TYPES.join(", ")
            )));
        }
        let _permit =
            self.semaphore.acquire().await.map_err(|e| {
                AppError::InternalServerError(format!("Semaphore acquire error: {e}"))
            })?;
        let b64 = image_to_base64(file_bytes);
        let url = format!("{}/chat/completions", self.provider_url);
        let data_url = format!("data:{mime_type};base64,{b64}");

        let vision_prompt = "You are a precise OCR system for cooperative financial statements.\n\
                  Your job is to extract EVERY single row from this financial statement image with ZERO omissions.\n\
                  \n\
                  INSTRUCTIONS:\n\
                  1. Scan the image from top to bottom, left to right.\n\
                  2. Detect if the image has MULTIPLE COLUMNS of numeric data (e.g. monthly columns Jan-Dec, or quarterly columns).\n\
                  3. Output the extracted data as a raw comma-separated CSV. Do NOT format as a markdown table, do NOT pad with spaces, do NOT use pipes.\n\
                  4. The first line of the CSV must be the column headers (e.g., Code, Account Name, Jan, Feb, ..., Dec).\n\
                  5. Include EVERY individual line item (Cash, Inventories, PP&E, Accounts Payable, Share Capital, etc.)\n\
                  6. Include EVERY subtotal row (Total liquid assets, Total member shares, Total Retained Earnings, etc.)\n\
                  7. Include EVERY total row (Total assets, Total liabilities, Total equity, Total liabilities and equity)\n\
                  8. Include section headers as context lines (ASSETS, LIABILITIES, MEMBERS' EQUITY, etc.)\n\
                  9. Preserve negative values in parentheses as negative numbers: (1,000) → -1000\n\
                  10. Preserve the exact numeric values including ALL digits. Remove commas inside numbers to prevent CSV alignment issues (e.g. 52,000 → 52000).\n\
                  11. Do NOT summarize, do NOT skip rows, do NOT combine rows, do NOT round.\n\
                  12. A typical balance sheet has 25-45 rows — make sure you output ALL of them from top to bottom.\n\
                  \n\
                  CSV Format example:\n\
                  Code,Account Name,Jan,Feb,Mar,Apr,May,Jun,Jul,Aug,Sep,Oct,Nov,Dec\n\
                  1101,Cash on Hand,52000,52416,52835,53258,53684,54114,54546,54983,55423,55866,56313,56764\n\
                  1102,Cash at Bank - Current Account,145000,146740,148501,150283,152086,153911,155758,157627,159519,161433,163370,165331\n\
                  1999,TOTAL ASSETS,1827300,1852032,1877126,1902586,1928419,1954631,1981228,2008215,2035599,2063386,2091582,2120194";

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

        let content = json["choices"][0]["message"]["content"]
            .as_str()
            .ok_or_else(|| AppError::ExternalServiceError("Empty vision response".into()))?;

        if finish_reason == "max_tokens" || finish_reason == "length" {
            tracing::warn!(
                finish_reason,
                response_chars = content.len(),
                "Vision API response truncated — returning partial content"
            );
            return Ok(content.to_string());
        }

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

        // 1. Define compact format structs for parsing
        #[derive(Serialize, Deserialize)]
        struct CompactExtractionOutput {
            line_items: Vec<CompactExtractedLineItem>,
            totals_reconciliation: TotalsReconciliation,
            #[serde(default)]
            detected_period_type: Option<String>,
            #[serde(default)]
            detected_period_value: Option<String>,
            #[serde(default)]
            detected_reporting_year: Option<i32>,
            #[serde(default)]
            detected_fiscal_start_month: Option<i32>,
        }

        #[derive(Serialize, Deserialize)]
        struct CompactExtractedLineItem {
            account_code: Option<i32>,
            account_name: Option<String>,
            confidence: f64,
            raw_label: String,
            values: std::collections::HashMap<String, Option<f64>>,
        }

        let convert_compact = |compact: CompactExtractionOutput| -> ExtractionOutput {
            let mut flat_items = Vec::new();
            for item in compact.line_items {
                let lower_label = item.raw_label.to_lowercase();
                // "Total Equity & Liabilities" is a grand total check row (Total Assets = Liabilities + Equity).
                // Skip it from line_items so it doesn't appear as an unmapped NULL row.
                if lower_label.contains("equity & liabilities")
                    || lower_label.contains("liabilities & equity")
                    || lower_label.contains("liabilities and equity")
                    || lower_label.contains("equity and liabilities")
                {
                    continue;
                }

                for (month_str, val) in item.values {
                    if let Ok(month_num) = month_str.parse::<i16>() {
                        flat_items.push(ExtractedLineItem {
                            account_code: item.account_code,
                            account_name: item.account_name.clone(),
                            month: month_num,
                            value: val,
                            confidence: item.confidence,
                            raw_label: item.raw_label.clone(),
                        });
                    }
                }
            }
            ExtractionOutput {
                line_items: flat_items,
                totals_reconciliation: compact.totals_reconciliation,
                detected_period_type: compact.detected_period_type,
                detected_period_value: compact.detected_period_value,
                detected_reporting_year: compact.detected_reporting_year,
                detected_fiscal_start_month: compact.detected_fiscal_start_month,
            }
        };

        // Try parsing as the compact format first
        match serde_json::from_str::<CompactExtractionOutput>(cleaned) {
            Ok(compact) => {
                let output = convert_compact(compact);
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
                    "=== COMPACT EXTRACTION PARSED SUCCESSFULLY ==="
                );
                for (i, item) in output.line_items.iter().enumerate() {
                    tracing::info!(
                        idx = i,
                        code = ?item.account_code,
                        name = ?item.account_name,
                        raw_label = %item.raw_label,
                        month = item.month,
                        value = item.value,
                        confidence = item.confidence,
                        "  line_item[{i}]"
                    );
                }
                return Ok(output);
            }
            Err(compact_err) => {
                tracing::debug!(
                    error = %compact_err,
                    "Failed to parse as compact format, trying standard format"
                );
            }
        }

        // 2. Fallback to standard flat format
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
                    "=== FLAT EXTRACTION PARSED SUCCESSFULLY ==="
                );
                for (i, item) in output.line_items.iter().enumerate() {
                    tracing::info!(
                        idx = i,
                        code = ?item.account_code,
                        name = ?item.account_name,
                        raw_label = %item.raw_label,
                        month = item.month,
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
                    if let Ok(compact) = serde_json::from_str::<CompactExtractionOutput>(&repaired)
                    {
                        let output = convert_compact(compact);
                        tracing::info!(
                            items = output.line_items.len(),
                            "JSON repair succeeded (parsed as compact)"
                        );
                        for (i, item) in output.line_items.iter().enumerate() {
                            tracing::info!(
                                idx = i,
                                code = ?item.account_code,
                                name = ?item.account_name,
                                raw_label = %item.raw_label,
                                month = item.month,
                                value = item.value,
                                confidence = item.confidence,
                                "  line_item[{i}] (repaired compact)"
                            );
                        }
                        return Ok(output);
                    }

                    match serde_json::from_str::<ExtractionOutput>(&repaired) {
                        Ok(output) => {
                            tracing::info!(
                                items = output.line_items.len(),
                                "JSON repair succeeded (parsed as flat)"
                            );
                            for (i, item) in output.line_items.iter().enumerate() {
                                tracing::info!(
                                    idx = i,
                                    code = ?item.account_code,
                                    name = ?item.account_name,
                                    raw_label = %item.raw_label,
                                    month = item.month,
                                    value = item.value,
                                    confidence = item.confidence,
                                    "  line_item[{i}] (repaired flat)"
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

    pub async fn map_to_coa_single(
        &self,
        raw_text: &str,
        chart_of_accounts: &[CoaEntry],
        account_aliases: &[AliasEntry],
        cooperative_type: &str,
        reporting_year: i32,
    ) -> AppResult<ExtractionOutput> {
        tracing::info!("=== RAW TEXT CHUNK START ===\n{raw_text}\n=== RAW TEXT CHUNK END ===");

        let prompt = build_mapping_prompt(
            raw_text,
            chart_of_accounts,
            account_aliases,
            cooperative_type,
            reporting_year,
        );

        let raw_output = self.chat(&self.model, &prompt).await?;

        tracing::info!(
            output_chars = raw_output.len(),
            "=== MAP_TO_COA CHUNK RESPONSE ==="
        );

        Self::parse_llm_output(&raw_output)
    }
}

#[async_trait::async_trait]
impl NfHeaderMapper for LlmExtractor {
    async fn map_headers(
        &self,
        sheet_name: &str,
        actual_headers: &[String],
        canonical_fields: &[&str],
    ) -> std::collections::HashMap<String, String> {
        let actual_list = actual_headers.join(", ");
        let canonical_list = canonical_fields.join(", ");

        let prompt = format!(
            r#"You are a data-mapping assistant for cooperative financial data systems.

A user uploaded an Excel file with a sheet named "{sheet_name}".
The sheet has these column headers (as they appear in the file):
  [{actual_list}]

Map each actual header to the closest canonical field from this list:
  [{canonical_list}]

Rules:
- Only map when you are confident (typos, spaces vs underscores, capitalisation, language differences are fine to resolve).
- Do NOT invent or guess mappings for unrelated headers.
- If an actual header has no clear match, omit it from the output.
- Each canonical field should appear AT MOST ONCE in the output.

Return ONLY a JSON object like:
{{"actual_header": "canonical_field", "another_actual": "another_canonical"}}

No markdown, no explanation."#
        );

        tracing::info!(
            sheet = sheet_name,
            actual_count = actual_headers.len(),
            "Calling LLM for NF header mapping"
        );

        let raw = match self.chat(&self.model, &prompt).await {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!(error = %e, sheet = sheet_name, "LLM header mapping failed, returning empty map");
                return std::collections::HashMap::new();
            }
        };

        let cleaned = raw
            .trim()
            .trim_start_matches("```json")
            .trim_start_matches("```")
            .trim_end_matches("```")
            .trim();

        match serde_json::from_str::<std::collections::HashMap<String, String>>(cleaned) {
            Ok(map) => {
                tracing::info!(
                    sheet = sheet_name,
                    mappings = ?map,
                    "LLM header mapping succeeded"
                );
                // Normalise keys to lowercase for consistent lookup
                map.into_iter()
                    .map(|(k, v)| (k.trim().to_lowercase(), v.trim().to_lowercase()))
                    .collect()
            }
            Err(e) => {
                tracing::warn!(error = %e, raw = %cleaned, "Failed to parse LLM header mapping response");
                std::collections::HashMap::new()
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
                    })??;
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
        reporting_year: i32,
    ) -> AppResult<ExtractionOutput> {
        tracing::info!(
            raw_text_chars = raw_text.len(),
            coa_count = chart_of_accounts.len(),
            alias_count = account_aliases.len(),
            cooperative_type = cooperative_type,
            reporting_year = reporting_year,
            "=== MAP_TO_COA START ==="
        );

        let lines: Vec<&str> = raw_text.lines().collect();
        if lines.len() > 80 {
            let max_lines = 500;
            let lines_to_process = if lines.len() > max_lines {
                tracing::warn!(
                    total_lines = lines.len(),
                    max_lines = max_lines,
                    "Raw text too long, truncating to prevent runaway cost"
                );
                &lines[..max_lines]
            } else {
                &lines[..]
            };

            let chunk_size = 80;
            let mut all_line_items = Vec::new();
            let mut merged_totals = TotalsReconciliation {
                assets_total: None,
                liabilities_total: None,
                equity_total: None,
                net_surplus: None,
            };
            let mut detected_period_type = None;
            let mut detected_period_value = None;
            let mut detected_reporting_year = None;
            let mut detected_fiscal_start_month = None;

            for (idx, chunk) in lines_to_process.chunks(chunk_size).enumerate() {
                tracing::info!(
                    chunk_index = idx,
                    chunk_lines = chunk.len(),
                    "Processing raw text chunk"
                );
                let chunk_text = chunk.join("\n");
                let chunk_output = self
                    .map_to_coa_single(
                        &chunk_text,
                        chart_of_accounts,
                        account_aliases,
                        cooperative_type,
                        reporting_year,
                    )
                    .await?;

                all_line_items.extend(chunk_output.line_items);
                if merged_totals.assets_total.is_none() {
                    merged_totals.assets_total = chunk_output.totals_reconciliation.assets_total;
                }
                if merged_totals.liabilities_total.is_none() {
                    merged_totals.liabilities_total =
                        chunk_output.totals_reconciliation.liabilities_total;
                }
                if merged_totals.equity_total.is_none() {
                    merged_totals.equity_total = chunk_output.totals_reconciliation.equity_total;
                }
                if merged_totals.net_surplus.is_none() {
                    merged_totals.net_surplus = chunk_output.totals_reconciliation.net_surplus;
                }

                if detected_period_type.is_none() {
                    detected_period_type = chunk_output.detected_period_type;
                }
                if detected_period_value.is_none() {
                    detected_period_value = chunk_output.detected_period_value;
                }
                if detected_reporting_year.is_none() {
                    detected_reporting_year = chunk_output.detected_reporting_year;
                }
                if detected_fiscal_start_month.is_none() {
                    detected_fiscal_start_month = chunk_output.detected_fiscal_start_month;
                }
            }

            Ok(ExtractionOutput {
                line_items: all_line_items,
                totals_reconciliation: merged_totals,
                detected_period_type,
                detected_period_value,
                detected_reporting_year,
                detected_fiscal_start_month,
            })
        } else {
            self.map_to_coa_single(
                raw_text,
                chart_of_accounts,
                account_aliases,
                cooperative_type,
                reporting_year,
            )
            .await
        }
    }
}

// ── Mock implementation (deterministic, no network) ───────────────────────────

pub struct MockExtractor;

#[async_trait::async_trait]
impl NfHeaderMapper for MockExtractor {
    async fn map_headers(
        &self,
        _sheet_name: &str,
        _actual_headers: &[String],
        _canonical_fields: &[&str],
    ) -> std::collections::HashMap<String, String> {
        std::collections::HashMap::new()
    }
}

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
        _reporting_year: i32,
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
            detected_period_type: Some("YEARLY".to_string()),
            detected_period_value: Some("2026".to_string()),
            detected_reporting_year: Some(2026),
            detected_fiscal_start_month: Some(1),
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

// ── Combined extractor trait ──────────────────────────────────────────────────

/// Combines financial-statement extraction with NF header mapping.
/// This is what `AppState::extractor` holds.
pub trait Extractor: FinancialStatementExtractor + NfHeaderMapper {}
impl<T: FinancialStatementExtractor + NfHeaderMapper> Extractor for T {}

// ── Factory ───────────────────────────────────────────────────────────────────

pub fn create_extractor(config: &crate::config::AppConfig) -> std::sync::Arc<dyn Extractor> {
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
