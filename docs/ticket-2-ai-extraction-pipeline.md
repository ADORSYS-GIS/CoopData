# Ticket 2: AI Extraction Pipeline — Full Stack Implementation

> **Epic**: Sprint 2, Epic 2 — Primary Cooperative Data  
> **Status**: Ready for Implementation  
> **Architecture Reference**: `docs/architecture.md` §4 (AI-Extraction Pipeline), §7 (State Machine), §9 (Abnormality Flags), §10 (API Surface), §15 (Roadmap Phase 8)  
> **DB Schema Reference**: `docs/database-schema.md` §6.4–6.7, §6.11  
> **Prerequisite**: Sprint 2 US2.1 (all 23 DB tables, enums, chart_of_accounts seed — COMPLETE)

---

## 1. Overview

Cooperatives upload financial statements as PDFs, scanned images, or Excel files. These files come in wildly different formats — handwritten ledgers, Excel with custom headers, scanned PDFs with merged cells, photos of monitors, partial account codes, multiple languages. A rule-based parser would need a template per format, which is unmaintainable.

**Solution**: A three-stage pipeline where a pre-trained LLM (via API) acts as the structure interpreter, mapping raw extracted text to the canonical Chart of Accounts (CoA). No model training, no model download — just an API call with the CoA + account_aliases as context.

### Why LLM API (not local model, not training)?

- **Cost**: ~$0.01–0.05 per balance sheet, ~1000 calls/year = $10–50/year
- **Quality**: GPT-4 / Claude / Gemini already understand financial statements in multiple languages
- **No training data**: We don't have enough labeled Swazi cooperative balance sheets to train a custom model
- **No infrastructure**: No GPU servers, no model hosting, no MLOps pipeline
- **Swappable**: `extraction_jobs.engine` field stores which LLM was used; swap providers by changing env vars
- **Future option**: Can swap API call for local Ollama model (download pre-trained llama3/qwen2.5) — same prompt, different endpoint. No retraining needed.

### Ticket 2 Scope

Build the **full pipeline shape** — upload → extraction_job → grid pre-fill → validation → human review. The LLM step is **mocked** (returns deterministic hardcoded JSON) to prove the data model works end-to-end. Real LLM API call is plugged in next sprint.

---

## 2. Three-Stage Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        COOPERATIVE USER                                 │
│                    uploads PDF / Image / Excel                           │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STAGE 1: UPLOAD & PREPROCESS (deterministic, no AI)                    │
│                                                                         │
│  1a. Multipart upload → uploaded_files row                             │
│  1b. MIME sniff → route to correct parser                               │
│  1c. PDF → pdfplumber/lopdf → raw_text                                  │
│      Image → Tesseract OCR → raw_text                                   │
│      Excel → calamine → raw_text (tabular)                              │
│  1d. Store blob in object storage (MinIO/S3 or local filesystem)        │
│  1e. Create extraction_job (status=queued)                               │
│  1f. Create submission (status=draft) + financial_statement (draft)      │
│  1g. Return 202 Accepted + extraction_job_id                            │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STAGE 2: EXTRACT & MAP (LLM API — mocked in Ticket 2)                  │
│                                                                         │
│  2a. extraction_job status → preprocessing → extracting → mapping       │
│  2b. raw_text + chart_of_accounts + account_aliases → LLM prompt        │
│  2c. LLM returns structured JSON:                                      │
│      {                                                                  │
│        line_items: [                                                    │
│          { account_code: 1101, month: 0, value: 50000,                  │
│            confidence: 0.95, raw_label: "Cash on Hand" },               │
│          { account_code: null, month: 0, value: 12000,                 │
│            confidence: 0.40, raw_label: "Miscellaneous Fund" },        │
│          ...                                                            │
│        ],                                                               │
│        totals_reconciliation: {                                         │
│          assets_total: 1999, liabilities_total: 2999,                   │
│          equity_total: 3999, net_surplus: 6999                         │
│        }                                                                │
│      }                                                                  │
│  2d. Write line_items to balance_sheet_line_items (draft)               │
│  2e. extraction_job status → succeeded, store extracted_json + conf    │
│  2f. submission status → awaiting_coop_validation                       │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STAGE 3: VALIDATE (deterministic, no AI)                               │
│                                                                         │
│  3a. Balance identity: 1999 == 2999 + 3999                             │
│  3b. Roll-up reconciliation: each formula field matches sum of children│
│  3c. Missing required codes per cooperative_type                        │
│  3d. Portfolio composition sanity (loans don't exceed 100% of assets)   │
│  3e. Cross-month trend (no wild swings without flag)                    │
│  3f. Failures → abnormality_flags + financial_statements.validation_err│
│  3g. Per-cell confidence < 0.6 → LOW_EXTRACTION_CONFIDENCE flag          │
│  3h. Unknown labels (account_code=null) → UNMAPPED_ACCOUNT flag          │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  STAGE 4: HUMAN-IN-THE-LOOP REVIEW (cooperative user)                    │
│                                                                         │
│  4a. Frontend shows grid editor with all line items                     │
│  4b. Low-confidence cells (< 0.6) highlighted RED                       │
│  4c. Unmapped rows (account_code=null) highlighted YELLOW               │
│  4d. Validation errors shown as banner / inline                         │
│  4e. User edits cells → manually_edited=true, ai_flagged=false          │
│  4f. User clicks "Validate" → re-run Stage 3                            │
│  4g. User clicks "Submit" → submission status → submitted               │
│  4h. Submission enters 4-tier review workflow                           │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Stage 1: Upload & Preprocessing

### 3.1 Multipart Upload Handler

**Endpoint**: `POST /api/v1/cooperative/financial-statement/upload`  
**Auth**: `cooperative` role  
**Content-Type**: `multipart/form-data`

**Request parts**:
- `file` (binary): The PDF, image, or Excel file
- `reporting_year` (text): e.g. "2024"
- `accounting_year` (text, optional): "calendar" | "fiscal" (default: cooperative's setting)
- `currency` (text, optional): "SZL" | "USD" (default: "SZL")

**Handler logic** (`handlers/upload.rs`):
1. Extract cooperative_id from JWT claims
2. Validate reporting_year (current year or previous year only)
3. Check if submission already exists for (cooperative_id, reporting_year) — return 409 Conflict if so
4. Read file bytes, sniff MIME type
5. Store blob in object storage → get `storage_key`
6. Create `uploaded_files` row (original_name, mime_type, storage_key, size_bytes, uploaded_by)
7. Create `submissions` row (reference auto-generated, cooperative_id, reporting_year, status=draft, submitted_by)
8. Create `financial_statements` row (submission_id, cooperative_id, reporting_year, accounting_year, currency, is_validated=false)
9. Create `extraction_jobs` row (submission_id, source_file_id, status=queued, engine=TBD)
10. Spawn async task to run extraction pipeline
11. Return 202 Accepted with `{ submission_id, extraction_job_id }`

### 3.2 File Parsing (deterministic)

**Service**: `services/file_parser.rs`

```rust
pub enum ParsedContent {
    Text(String),
    Tabular { headers: Vec<String>, rows: Vec<Vec<String>> },
}

pub trait FileParser: Send + Sync {
    fn parse(&self, file_bytes: &[u8], mime_type: &str) -> AppResult<ParsedContent>;
}
```

**Implementations**:
- `PdfParser` — uses `pdfplumber` equivalent (Rust: `lopdf` or `pdf-extract` crate) → `ParsedContent::Text`
- `ImageOcrParser` — uses Tesseract via `tesseract-rs` or shell out to `tesseract` CLI → `ParsedContent::Text`
- `ExcelParser` — uses `calamine` crate → `ParsedContent::Tabular`
- `MockParser` — returns hardcoded text for testing

**MIME routing**:
| MIME | Parser | Output |
|------|--------|--------|
| `application/pdf` | PdfParser | Text |
| `image/png`, `image/jpeg`, `image/tiff` | ImageOcrParser | Text |
| `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` | ExcelParser | Tabular |
| `application/vnd.ms-excel` | ExcelParser | Tabular |
| Other | Error: Unsupported file type | — |

### 3.3 Object Storage

**Service**: `services/object_storage.rs`

```rust
pub trait ObjectStorage: Send + Sync {
    async fn store(&self, key: &str, data: &[u8], content_type: &str) -> AppResult<()>;
    async fn retrieve(&self, key: &str) -> AppResult<Vec<u8>>;
    async fn delete(&self, key: &str) -> AppResult<()>;
    async fn get_presigned_url(&self, key: &str, expiry_secs: u64) -> AppResult<String>;
}
```

**Implementations**:
- `LocalFileStorage` — stores files in `./data/uploads/` (dev/default). Key format: `{cooperative_id}/{submission_id}/{filename}`
- `S3Storage` — uses `reqwest` to call MinIO/S3 API (env: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`). For production.
- `MockStorage` — no-op, returns fake keys. For testing.

**Env vars** (Twelve-Factor):
- `STORAGE_BACKEND` = "local" | "s3" (default: "local")
- `STORAGE_LOCAL_PATH` = "./data/uploads" (default)
- `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `S3_REGION`

---

## 4. Stage 2: AI Extraction & Mapping

### 4.1 Extraction Service Trait

**Service**: `services/ai_extraction.rs`

```rust
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
    pub value: f64,
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

#[async_trait::async_trait]
pub trait FinancialStatementExtractor: Send + Sync {
    async fn capture(&self, file_bytes: &[u8], mime_type: &str) -> AppResult<String>;
    async fn map_to_coa(
        &self,
        raw_text: &str,
        chart_of_accounts: &[CoaEntry],
        account_aliases: &[AliasEntry],
        cooperative_type: &str,
    ) -> AppResult<ExtractionOutput>;
}
```

### 4.2 LLM Prompt Design

The prompt sent to the LLM contains four sections:

**Section 1: Target Chart of Accounts**
```
You are a financial statement extraction assistant for Swazi cooperatives.
Map the raw text below to the canonical Chart of Accounts.

CHART OF ACCOUNTS (target schema):
| Code | Name | Category | Formula |
|------|------|----------|---------|
| 1101 | Cash on Hand | assets | |
| 1102 | Cash at Bank (Current) | assets | |
| ... | ... | ... | |
| 1999 | TOTAL ASSETS | assets | 1100+1200-1250+1300 |
| ... | ... | ... | |
| 6999 | NET SURPLUS/DEFICIT | surplus | 4999-5999 |

Only use account codes from this list. If a label doesn't match any code, set account_code to null.
```

**Section 2: Account Aliases**
```
ACCOUNT ALIASES (synonyms in Swazi/English/French/Spanish):
| Code | Alias Label | Language |
|------|-------------|----------|
| 1101 | Cash in hand | en |
| 1101 | Imali etfolweni | ss |
| 1101 | Liquid Cash | en |
| 1201 | Performing Loans | en |
| 1201 | Good Loans | en |
| ... | ... | ... |

Use these aliases to match labels that don't exactly match the account name.
```

**Section 3: Raw Extracted Content**
```
RAW TEXT FROM UPLOADED FILE:
---
{raw_text}
---

This is a balance sheet for a {cooperative_type} cooperative.
Values are in {currency}.
```

**Section 4: Output Contract**
```
Return ONLY a JSON object with this exact structure:
{
  "line_items": [
    {
      "account_code": 1101,        // null if unmapped
      "account_name": "Cash on Hand",
      "month": 0,                   // 0 = annual total, 1-12 = month
      "value": 50000.00,
      "confidence": 0.95,           // 0.0 to 1.0
      "raw_label": "Cash on Hand"   // exact text from the document
    }
  ],
  "totals_reconciliation": {
    "assets_total": 1999,
    "liabilities_total": 2999,
    "equity_total": 3999,
    "net_surplus": 6999
  }
}

Rules:
- Map every numeric value you find to an account_code (or null if unmapped)
- month=0 means annual total; month=1-12 means that specific month
- confidence: 1.0 = exact match, 0.8 = alias match, 0.5 = fuzzy, 0.3 = guessed
- If the document has subtotals (e.g. "Total Assets"), map to the total code (1999)
- Do NOT invent values. Only extract what's in the document.
```

### 4.3 Implementations

**`MockExtractor`** (for Ticket 2):
- `capture()` — returns hardcoded raw text simulating a balance sheet
- `map_to_coa()` — returns hardcoded `ExtractionOutput` with ~10 line items, some with confidence=0.95, some with confidence=0.40, one with account_code=null (unmapped)
- Deterministic — same input always produces same output
- No network calls, no API keys needed

**`OpenAiExtractor`** (for next sprint):
- `capture()` — for images, calls GPT-4 Vision API; for PDFs, uses text from Stage 1
- `map_to_coa()` — calls LLM chat completion API with the 4-section prompt
- Env vars: `AI_PROVIDER_URL`, `AI_API_KEY`, `AI_MODEL` (e.g. "gpt-4o", "claude-sonnet-4-20250514")
- Stores `engine` = "openai-gpt4o" or "claude-sonnet" in extraction_jobs

**`CalamineExcelExtractor`** (for Excel files):
- `capture()` — uses `calamine` crate to read xlsx → raw tabular text
- `map_to_coa()` — tries header matching first (deterministic), falls back to LLM for unmatched columns

### 4.4 Extraction Job Lifecycle

```
queued → preprocessing → extracting → mapping → succeeded
                    ↓           ↓          ↓
                  failed      failed    failed/partial
```

| Status | Meaning |
|--------|---------|
| `queued` | Job created, waiting for worker |
| `preprocessing` | File parsing (PDF→text, OCR, Excel) |
| `extracting` | Raw text extraction complete, preparing for LLM |
| `mapping` | LLM API call in progress |
| `succeeded` | All line items extracted and written to DB |
| `failed` | Fatal error (file corrupt, LLM API down) |
| `partial` | Some items extracted, some failed (low confidence but stored) |

**Polling**: Frontend polls `GET /api/v1/cooperative/extraction-jobs/{id}` every 2 seconds. When status=succeeded or failed, stops polling and shows results.

### 4.5 Writing Results to DB

After `map_to_coa()` returns:

1. For each `ExtractedLineItem`:
   - Look up `account_code` in `chart_of_accounts` (validate it exists)
   - If `account_code` is null → store with account_code=NULL, account_name=raw_label (unmapped row)
   - Insert into `balance_sheet_line_items` (financial_statement_id, account_code, account_name, account_category, account_subcategory, month, value, ai_confidence, ai_flagged=(confidence<0.6), manually_edited=false)
2. Store `extracted_json` (full LLM response) in `extraction_jobs.extracted_json`
3. Store overall `confidence` (average of all line item confidences) in `extraction_jobs.confidence`
4. Update `extraction_jobs.status` = succeeded, `completed_at` = now
5. Update `submissions.status` = awaiting_coop_validation
6. Update `financial_statements.is_validated` = false (pending human review)

---

## 5. Stage 3: Validation Layer

**Service**: `services/abnormality_detector.rs`

Deterministic, post-LLM. Runs after extraction completes AND when user clicks "Validate".

### 5.1 Balance Identity Check

```
Assets (1999) == Liabilities (2999) + Equity (3999)
```
- If not equal → `BALANCE_UNBALANCED` flag (error severity)
- Tolerance: ±1.00 (rounding)

### 5.2 Roll-Up Reconciliation

For every account with a `formula` field in `chart_of_accounts`:
- Compute formula from child line items
- Compare to the stored value for that account code
- If mismatch > ±1.00 → `TOTAL_MISMATCH` flag (error severity)

Formulas (from CoA seed):
```
1100 = 1101 + 1102 + 1103 + 1104
1200 = 1201 + 1202 + 1203 + 1204 + 1205
1250 = 1251 + 1252
1300 = 1301 + 1302 + 1303 - 1304 + 1305
1999 = 1100 + 1200 - 1250 + 1300
2100 = 2101 + 2102 + 2103
2200 = 2201 + 2202
2300 = 2301 + 2302 + 2303
2999 = 2100 + 2200 + 2300
3100 = 3101 + 3102
3200 = 3201 + 3202 + 3203
3300 = 3301 + 3302
3999 = 3100 + 3200 + 3300
4100 = 4101 + 4102
4200 = 4201
4999 = 4100 + 4200
5100 = 5101 + 5102
5200 = 5201 + 5202 + 5203 + 5204
5300 = 5301
5999 = 5100 + 5200 + 5300
6999 = 4999 - 5999
```

### 5.3 Missing Required Codes

For the cooperative's `institution_type`, query `chart_of_accounts_coop_types` where `is_required=true AND cooperative_type={type}`. For each required code not present in line items → `MISSING_ACCOUNT` flag (error severity).

### 5.4 Portfolio Composition Sanity

- Sum of loan line items (1201-1205) should not exceed total assets (1999)
- If loans > assets → `PORTFOLIO_OVER_100` flag (warning severity)

### 5.5 Extraction Confidence Flags

| Flag | Condition | Severity |
|------|-----------|----------|
| `LOW_EXTRACTION_CONFIDENCE` | `ai_confidence < 0.6` on any line item | warning |
| `UNMAPPED_ACCOUNT` | `account_code IS NULL` on any line item | error |
| `AI_TOTAL_DRIFT` | LLM's `totals_reconciliation.assets_total` ≠ sum of extracted asset line items | warning |

### 5.6 Flag Storage

All flags written to `abnormality_flags` table:
```sql
INSERT INTO abnormality_flags (submission_id, cooperative_id, rule_id, severity, message, field_ref)
VALUES (...);
```

Validation errors also stored in `financial_statements.validation_errors` as JSONB:
```json
{
  "errors": [
    { "rule": "BALANCE_UNBALANCED", "message": "Assets (45000) != Liabilities (30000) + Equity (14000)", "severity": "error" }
  ],
  "warnings": [
    { "rule": "LOW_EXTRACTION_CONFIDENCE", "message": "3 line items below 0.6 confidence", "severity": "warning" }
  ]
}
```

### 5.7 Submission Gate

Submission cannot transition from `awaiting_coop_validation` to `submitted` while there are unresolved **error-severity** flags. Warning-severity flags allow submission but are visible to reviewers.

---

## 6. Stage 4: Human-in-the-Loop Review

### 6.1 Grid Editor (Frontend)

**Component**: `frontend/src/pages/cooperative/FinancialStatementEditor.tsx`

A TanStack Table grid showing all `balance_sheet_line_items` for the financial statement:

| Account Code | Account Name | Category | Month | Value | AI Confidence | Source Label | Status |
|-------------|-------------|----------|-------|-------|---------------|-------------|--------|
| 1101 | Cash on Hand | assets | 0 | 50,000 | 0.95 ✅ | "Cash on Hand" | — |
| 1102 | Cash at Bank | assets | 0 | 120,000 | 0.88 ✅ | "Bank Balance" | — |
| NULL | Miscellaneous Fund | — | 0 | 12,000 | 0.40 🔴 | "Misc Fund" | Unmapped |
| 1201 | Performing Loans | assets | 0 | 200,000 | 0.92 ✅ | "Good Loans" | — |

**Cell styling**:
- `ai_confidence >= 0.8` → green badge "High"
- `0.6 <= ai_confidence < 0.8` → yellow badge "Medium"
- `ai_confidence < 0.6` → red badge "Low" + cell background highlighted
- `account_code IS NULL` → row highlighted yellow, "Unmapped" badge
- `manually_edited = true` → blue badge "Edited"

**Editing**:
- Value cells are editable (inline edit, Enter to save)
- Account code cells are editable via dropdown (select from CoA)
- On save → `PATCH /api/v1/cooperative/financial-statements/{id}/line-items` with updated values
- Backend sets `manually_edited=true, ai_flagged=false` for edited cells

### 6.2 Validation Panel

Sidebar or top banner showing:
- Error count (red) — blocks submission
- Warning count (yellow) — allows submission
- Each flag expandable to show details (rule, message, field_ref)
- "Re-validate" button → `POST /api/v1/cooperative/submissions/{id}/validate-extraction`

### 6.3 Submit Flow

1. User reviews all cells, corrects low-confidence/unmapped items
2. User clicks "Validate" → backend re-runs Stage 3 validation
3. If errors → show in panel, user fixes
4. If no errors → "Submit" button enabled
5. User clicks "Submit" → `POST /api/v1/cooperative/submissions/{id}/submit`
6. Submission status → `submitted`, enters 4-tier review workflow

---

## 7. Submission State Machine

```
                    ┌─────────┐
                    │  draft  │ ← upload creates this
                    └────┬────┘
                         │ extraction completes
                         ▼
              ┌─────────────────────────┐
              │ awaiting_coop_validation │ ← AI extraction done, human review needed
              └────────────┬────────────┘
                           │ user validates + submits
                           ▼
                    ┌──────────┐
                    │ submitted │
                    └────┬─────┘
                         │ auto-transition
                         ▼
                  ┌──────────────┐
                  │ apex_review  │
                  └────┬────┬────┘
             approve   │    │  return
                      ▼    ▼
          ┌──────────────┐  ┌──────────┐
          │federation_review│  │  draft  │ ← apex_returned
          └────┬────┬────┘  └──────────┘
          approve│   │return
                 ▼   ▼
         ┌──────────────┐ ┌──────────────┐
         │ministry_review│ │ apex_review  │ ← federation_returned
         └────┬────┬────┘ └──────────────┘
    approve   │    │  reject
             ▼    ▼
      ┌─────────┐ ┌──────────┐
      │ approved│ │ rejected │ ← terminal (ministry_rejected)
      └─────────┘ └──────────┘
```

**Transitions**:
| From | To | Trigger |
|------|-----|---------|
| draft | awaiting_coop_validation | Extraction job succeeds |
| awaiting_coop_validation | submitted | User clicks Submit (no error flags) |
| submitted | apex_review | Auto (or apex user sees it) |
| apex_review | federation_review | Apex approves |
| apex_review | draft | Apex returns (apex_returned) |
| federation_review | ministry_review | Federation approves |
| federation_review | apex_review | Federation returns (federation_returned) |
| ministry_review | approved | Ministry approves (triggers KPI computation) |
| ministry_review | rejected | Ministry rejects (terminal) |

---

## 8. API Surface

### 8.1 Cooperative Endpoints

| Endpoint | Method | Handler | Description |
|----------|--------|---------|-------------|
| `/api/v1/cooperative/financial-statement/upload` | POST | `upload_financial_statement` | Multipart upload, creates submission + file + extraction job |
| `/api/v1/cooperative/submissions` | GET | `list_cooperative_submissions` | List submissions for caller's cooperative |
| `/api/v1/cooperative/submissions/{id}` | GET | `get_cooperative_submission` | Get single submission with line items + flags |
| `/api/v1/cooperative/financial-statements/{id}` | GET | `get_financial_statement` | Get FS with all line items |
| `/api/v1/cooperative/financial-statements/{id}/line-items` | GET | `list_line_items` | Get all line items for a FS |
| `/api/v1/cooperative/financial-statements/{id}/line-items` | PATCH | `update_line_items` | Bulk update line item values (human edits) |
| `/api/v1/cooperative/submissions/{id}/validate-extraction` | POST | `validate_extraction` | Re-run validation (Stage 3) |
| `/api/v1/cooperative/submissions/{id}/submit` | POST | `submit_submission` | Transition to submitted state |
| `/api/v1/cooperative/extraction-jobs/{id}` | GET | `get_extraction_job` | Poll extraction job status |

### 8.2 Review Endpoints (Apex / Federation / Ministry)

| Endpoint | Method | Handler | Description |
|----------|--------|---------|-------------|
| `/api/v1/apex/submissions` | GET | `list_apex_submissions` | List submissions for apex's cooperatives |
| `/api/v1/apex/submissions/{id}/approve` | POST | `apex_approve_submission` | Forward to federation review |
| `/api/v1/apex/submissions/{id}/return` | POST | `apex_return_submission` | Return to cooperative (draft) |
| `/api/v1/apex/submissions/{id}/flags` | GET | `get_submission_flags` | Get abnormality flags for a submission |
| `/api/v1/federation/submissions` | GET | `list_federation_submissions` | List submissions for federation's apexes |
| `/api/v1/federation/submissions/{id}/approve` | POST | `federation_approve_submission` | Forward to ministry review |
| `/api/v1/federation/submissions/{id}/return` | POST | `federation_return_submission` | Return to apex review |
| `/api/v1/ministry/submissions` | GET | `list_ministry_submissions` | List all submissions |
| `/api/v1/ministry/submissions/{id}/approve` | POST | `ministry_approve_submission` | Finalize → approved, trigger KPI computation |
| `/api/v1/ministry/submissions/{id}/reject` | POST | `ministry_reject_submission` | Terminal rejection |

### 8.3 Shared Endpoints

| Endpoint | Method | Handler | Description |
|----------|--------|---------|-------------|
| `/api/v1/submissions/{id}` | GET | `get_submission` | Get submission (scoped by role) |
| `/api/v1/kpis/{cooperativeId}` | GET | `get_cooperative_kpis` | Get computed KPIs for a cooperative |
| `/api/v1/benchmarks` | GET | `get_benchmarks` | Get benchmark data |

---

## 9. Backend Implementation Plan

### 9.1 New Files to Create

**Entities** (`backend/src/entities/`):
- `submission.rs` — SeaORM entity for `submissions` table
- `financial_statement.rs` — entity for `financial_statements` table
- `balance_sheet_line_item.rs` — entity for `balance_sheet_line_items` table
- `uploaded_file.rs` — entity for `uploaded_files` table
- `extraction_job.rs` — entity for `extraction_jobs` table
- `submission_review.rs` — entity for `submission_reviews` table
- `chart_of_account.rs` — entity for `chart_of_accounts` table
- `chart_of_accounts_coop_type.rs` — entity for `chart_of_accounts_coop_types` table
- `account_alias.rs` — entity for `account_aliases` table
- `abnormality_flag.rs` — entity for `abnormality_flags` table

**DTOs** (`backend/src/api/dto/`):
- `submission.rs` — `CreateSubmissionRequest`, `SubmissionResponse`, `SubmissionWithDetailsResponse`, `SubmissionStatusUpdate`
- `financial.rs` — `FinancialStatementResponse`, `LineItemResponse`, `LineItemUpdateRequest`, `LineItemBulkUpdateRequest`
- `extraction.rs` — `ExtractionJobResponse`, `ExtractionJobStatusResponse`
- `upload.rs` — `UploadResponse` (submission_id + extraction_job_id)

**Repositories** (`backend/src/repositories/`):
- `submission.rs` — CRUD + `find_by_cooperative_and_year()`, `find_by_status()`, `find_by_apex()`, `find_by_federation()`
- `financial_statement.rs` — CRUD + `find_by_submission()`, `find_by_cooperative_and_year()`
- `balance_sheet_line_item.rs` — CRUD + `find_by_financial_statement()`, `bulk_update()`
- `uploaded_file.rs` — CRUD + `find_by_submission()`
- `extraction_job.rs` — CRUD + `find_by_submission()`, `update_status()`
- `submission_review.rs` — CRUD + `find_by_submission()`
- `chart_of_accounts.rs` — `find_all()`, `find_by_code()`, `find_by_coop_type()`, `find_required_by_coop_type()`
- `account_alias.rs` — `find_all()`, `find_by_account_code()`
- `abnormality_flag.rs` — CRUD + `find_by_submission()`, `find_errors_by_submission()`

**Handlers** (`backend/src/api/handlers/`):
- `upload.rs` — `upload_financial_statement` (multipart)
- `extraction.rs` — `get_extraction_job` (poll)
- `submission.rs` — list/get/submit/validate + apex/federation/ministry approve/return/reject
- `financial_statement.rs` — get FS, list line items, update line items

**Services** (`backend/src/services/`):
- `object_storage.rs` — `ObjectStorage` trait + `LocalFileStorage` + `MockStorage` impls
- `file_parser.rs` — `FileParser` trait + `MockParser` impl
- `ai_extraction.rs` — `FinancialStatementExtractor` trait + `MockExtractor` impl
- `abnormality_detector.rs` — validation rules (balance identity, roll-ups, missing codes, confidence)
- `extraction_pipeline.rs` — orchestrator: calls parser → extractor → writes results → runs validation
- `submission_workflow.rs` — state machine transitions + authority matrix

**Routes** (`backend/src/api/routes/`):
- Update `cooperative.rs` — add upload, submissions, financial-statements, extraction-jobs routes
- Update `apex.rs` — add submission review routes
- Update `federation.rs` — add submission review routes
- Update `ministry.rs` — add submission review routes
- Update `shared.rs` — add shared submission/KPI/benchmark routes

### 9.2 AppState Evolution

Add to `AppState` in `lib.rs`:
```rust
pub struct AppState {
    // ... existing fields ...
    pub storage: Arc<dyn ObjectStorage>,
    pub extractor: Arc<dyn FinancialStatementExtractor>,
    pub submission_repo: SubmissionRepository,
    pub financial_statement_repo: FinancialStatementRepository,
    pub line_item_repo: BalanceSheetLineItemRepository,
    pub uploaded_file_repo: UploadedFileRepository,
    pub extraction_job_repo: ExtractionJobRepository,
    pub submission_review_repo: SubmissionReviewRepository,
    pub chart_of_accounts_repo: ChartOfAccountsRepository,
    pub account_alias_repo: AccountAliasRepository,
    pub abnormality_flag_repo: AbnormalityFlagRepository,
}
```

### 9.3 Extraction Pipeline Orchestrator

**Service**: `services/extraction_pipeline.rs`

```rust
pub async fn run_extraction_pipeline(
    job_id: Uuid,
    file_bytes: Vec<u8>,
    mime_type: String,
    cooperative_type: String,
    extractor: Arc<dyn FinancialStatementExtractor>,
    chart_of_accounts: Vec<CoaEntry>,
    account_aliases: Vec<AliasEntry>,
    fs_repo: &FinancialStatementRepository,
    line_item_repo: &BalanceSheetLineItemRepository,
    job_repo: &ExtractionJobRepository,
    submission_repo: &SubmissionRepository,
    detector: &AbnormalityDetector,
) -> AppResult<()> {
    // 1. Update job status → preprocessing
    job_repo.update_status(job_id, "preprocessing", None, None).await?;

    // 2. Parse file → raw_text
    let raw_text = extractor.capture(&file_bytes, &mime_type).await?;
    job_repo.update_raw_text(job_id, &raw_text).await?;
    job_repo.update_status(job_id, "extracting", None, None).await?;

    // 3. Map to CoA
    job_repo.update_status(job_id, "mapping", None, None).await?;
    let output = extractor.map_to_coa(&raw_text, &chart_of_accounts, &account_aliases, &cooperative_type).await?;

    // 4. Write line items to DB
    let financial_statement = fs_repo.find_by_submission(submission_id).await?;
    for item in &output.line_items {
        line_item_repo.create(LineItemActiveModel {
            financial_statement_id: Set(financial_statement.id),
            account_code: Set(item.account_code),
            account_name: Set(item.account_name.clone()),
            month: Set(item.month),
            value: Set(Decimal::from_f64(item.value)),
            ai_confidence: Set(Decimal::from_f64(item.confidence)),
            ai_flagged: Set(item.confidence < 0.6),
            manually_edited: Set(false),
            ..Default::default()
        }).await?;
    }

    // 5. Store extraction results
    job_repo.update_extracted_json(job_id, &serde_json::to_value(&output)?).await?;
    job_repo.update_confidence(job_id, avg_confidence).await?;
    job_repo.update_status(job_id, "succeeded", Some(now), None).await?;

    // 6. Update submission status
    submission_repo.update_status(submission_id, "awaiting_coop_validation").await?;

    // 7. Run validation
    detector.validate(submission_id, cooperative_id).await?;

    Ok(())
}
```

### 9.4 Mock Extractor Implementation

```rust
pub struct MockExtractor;

#[async_trait::async_trait]
impl FinancialStatementExtractor for MockExtractor {
    async fn capture(&self, _file_bytes: &[u8], _mime_type: &str) -> AppResult<String> {
        Ok(r#"
        COOPERATIVE BALANCE SHEET - ANNUAL 2024
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
        Interest Expense on Borrowings     6,000
        Personnel Costs                  12,000
        Administrative Expenses           8,000
        Governance Expenses               3,000
        Depreciation                      4,000
        Loan Loss Provision Expense       5,000

        Miscellaneous Fund               12,000
        "#.to_string())
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
                ExtractedLineItem { account_code: Some(1101), account_name: Some("Cash on Hand".into()), month: 0, value: 50000.0, confidence: 0.95, raw_label: "Cash on Hand".into() },
                ExtractedLineItem { account_code: Some(1102), account_name: Some("Cash at Bank (Current)".into()), month: 0, value: 120000.0, confidence: 0.92, raw_label: "Cash at Bank (Current)".into() },
                ExtractedLineItem { account_code: Some(1103), account_name: Some("Cash at Bank (Savings)".into()), month: 0, value: 30000.0, confidence: 0.90, raw_label: "Cash at Bank (Savings)".into() },
                ExtractedLineItem { account_code: Some(1104), account_name: Some("Short Term Investments".into()), month: 0, value: 10000.0, confidence: 0.85, raw_label: "Short Term Investments".into() },
                ExtractedLineItem { account_code: Some(1201), account_name: Some("Performing Loans".into()), month: 0, value: 200000.0, confidence: 0.93, raw_label: "Performing Loans".into() },
                ExtractedLineItem { account_code: Some(1202), account_name: Some("Loans in Arrears 1-30".into()), month: 0, value: 5000.0, confidence: 0.80, raw_label: "Loans in Arrears 1-30".into() },
                ExtractedLineItem { account_code: Some(1205), account_name: Some("Non-Performing Loans".into()), month: 0, value: 3000.0, confidence: 0.75, raw_label: "Non-Performing Loans".into() },
                ExtractedLineItem { account_code: Some(1251), account_name: Some("General Loan Loss Provision".into()), month: 0, value: -8000.0, confidence: 0.55, raw_label: "General Loan Loss Provision".into() },
                ExtractedLineItem { account_code: Some(1301), account_name: Some("Accounts Receivable".into()), month: 0, value: 15000.0, confidence: 0.88, raw_label: "Accounts Receivable".into() },
                ExtractedLineItem { account_code: Some(1303), account_name: Some("Fixed Assets (Cost)".into()), month: 0, value: 80000.0, confidence: 0.82, raw_label: "Fixed Assets (Cost)".into() },
                ExtractedLineItem { account_code: Some(1304), account_name: Some("Accumulated Depreciation".into()), month: 0, value: -20000.0, confidence: 0.78, raw_label: "Accumulated Depreciation".into() },
                ExtractedLineItem { account_code: Some(2101), account_name: Some("Voluntary Savings".into()), month: 0, value: 180000.0, confidence: 0.91, raw_label: "Voluntary Savings".into() },
                ExtractedLineItem { account_code: Some(2102), account_name: Some("Mandatory Savings".into()), month: 0, value: 90000.0, confidence: 0.89, raw_label: "Mandatory Savings".into() },
                ExtractedLineItem { account_code: Some(2103), account_name: Some("Fixed Term Deposits".into()), month: 0, value: 40000.0, confidence: 0.86, raw_label: "Fixed Term Deposits".into() },
                ExtractedLineItem { account_code: Some(2201), account_name: Some("Short Term Borrowings".into()), month: 0, value: 25000.0, confidence: 0.84, raw_label: "Short Term Borrowings".into() },
                ExtractedLineItem { account_code: Some(2301), account_name: Some("Accounts Payable".into()), month: 0, value: 8000.0, confidence: 0.82, raw_label: "Accounts Payable".into() },
                ExtractedLineItem { account_code: Some(2302), account_name: Some("Accrued Expenses".into()), month: 0, value: 2000.0, confidence: 0.79, raw_label: "Accrued Expenses".into() },
                ExtractedLineItem { account_code: Some(3101), account_name: Some("Permanent Share Capital".into()), month: 0, value: 50000.0, confidence: 0.90, raw_label: "Permanent Share Capital".into() },
                ExtractedLineItem { account_code: Some(3102), account_name: Some("Withdrawable Shares".into()), month: 0, value: 20000.0, confidence: 0.87, raw_label: "Withdrawable Shares".into() },
                ExtractedLineItem { account_code: Some(3201), account_name: Some("Statutory Reserve".into()), month: 0, value: 15000.0, confidence: 0.85, raw_label: "Statutory Reserve".into() },
                ExtractedLineItem { account_code: Some(3202), account_name: Some("General Reserve".into()), month: 0, value: 10000.0, confidence: 0.83, raw_label: "General Reserve".into() },
                ExtractedLineItem { account_code: Some(3301), account_name: Some("Accumulated Surplus".into()), month: 0, value: 5000.0, confidence: 0.80, raw_label: "Accumulated Surplus".into() },
                ExtractedLineItem { account_code: Some(3302), account_name: Some("Current Year Surplus".into()), month: 0, value: 12000.0, confidence: 0.77, raw_label: "Current Year Surplus".into() },
                ExtractedLineItem { account_code: Some(4101), account_name: Some("Interest Income from Loans".into()), month: 0, value: 45000.0, confidence: 0.91, raw_label: "Interest Income from Loans".into() },
                ExtractedLineItem { account_code: Some(4102), account_name: Some("Fees and Commissions".into()), month: 0, value: 5000.0, confidence: 0.85, raw_label: "Fees and Commissions".into() },
                ExtractedLineItem { account_code: Some(4201), account_name: Some("Other Operating Income".into()), month: 0, value: 3000.0, confidence: 0.80, raw_label: "Other Operating Income".into() },
                ExtractedLineItem { account_code: Some(5101), account_name: Some("Interest Expense on Deposits".into()), month: 0, value: 18000.0, confidence: 0.88, raw_label: "Interest Expense on Deposits".into() },
                ExtractedLineItem { account_code: Some(5102), account_name: Some("Interest Expense on Borrowings".into()), month: 0, value: 6000.0, confidence: 0.85, raw_label: "Interest Expense on Borrowings".into() },
                ExtractedLineItem { account_code: Some(5201), account_name: Some("Personnel Costs".into()), month: 0, value: 12000.0, confidence: 0.86, raw_label: "Personnel Costs".into() },
                ExtractedLineItem { account_code: Some(5202), account_name: Some("Administrative Expenses".into()), month: 0, value: 8000.0, confidence: 0.83, raw_label: "Administrative Expenses".into() },
                ExtractedLineItem { account_code: Some(5203), account_name: Some("Governance Expenses".into()), month: 0, value: 3000.0, confidence: 0.78, raw_label: "Governance Expenses".into() },
                ExtractedLineItem { account_code: Some(5204), account_name: Some("Depreciation".into()), month: 0, value: 4000.0, confidence: 0.75, raw_label: "Depreciation".into() },
                ExtractedLineItem { account_code: Some(5301), account_name: Some("Loan Loss Provision Expense".into()), month: 0, value: 5000.0, confidence: 0.72, raw_label: "Loan Loss Provision Expense".into() },
                ExtractedLineItem { account_code: None, account_name: Some("Miscellaneous Fund".into()), month: 0, value: 12000.0, confidence: 0.40, raw_label: "Miscellaneous Fund".into() },
            ],
            totals_reconciliation: TotalsReconciliation {
                assets_total: Some(435000.0),
                liabilities_total: Some(345000.0),
                equity_total: Some(112000.0),
                net_surplus: Some(0.0),
            },
        })
    }
}
```

### 9.5 OpenAPI Registration

All new handlers must have `#[utoipa::path]` annotations. Register in `openapi.rs`:
- Paths: `upload_financial_statement`, `get_extraction_job`, `list_cooperative_submissions`, `get_cooperative_submission`, `get_financial_statement`, `list_line_items`, `update_line_items`, `validate_extraction`, `submit_submission`, `list_apex_submissions`, `apex_approve_submission`, `apex_return_submission`, `get_submission_flags`, `list_federation_submissions`, `federation_approve_submission`, `federation_return_submission`, `list_ministry_submissions`, `ministry_approve_submission`, `ministry_reject_submission`, `get_cooperative_kpis`, `get_benchmarks`
- Schemas: `UploadResponse`, `ExtractionJobResponse`, `SubmissionResponse`, `SubmissionWithDetailsResponse`, `FinancialStatementResponse`, `LineItemResponse`, `LineItemUpdateRequest`, `LineItemBulkUpdateRequest`, `AbnormalityFlagResponse`

---

## 10. Frontend Implementation Plan

### 10.1 New Files to Create

**Hooks** (`frontend/src/hooks/`):
- `submissions/useSubmissions.ts` — `useCooperativeSubmissions()`, `useSubmission(id)`, `useSubmitSubmission()`, `useValidateExtraction()`
- `submissions/useApexSubmissions.ts` — `useApexSubmissions()`, `useApexApprove()`, `useApexReturn()`
- `submissions/useFederationSubmissions.ts` — `useFederationSubmissions()`, `useFederationApprove()`, `useFederationReturn()`
- `submissions/useMinistrySubmissions.ts` — `useMinistrySubmissions()`, `useMinistryApprove()`, `useMinistryReject()`
- `financial-statements/useFinancialStatement.ts` — `useFinancialStatement(id)`, `useUpdateLineItems()`
- `extraction/useExtractionJob.ts` — `useExtractionJob(id)` (polling hook)
- `upload/useUpload.ts` — `useUploadFinancialStatement()` (multipart upload mutation)

**Pages** (`frontend/src/pages/`):
- `cooperative/UploadFinancialStatement.tsx` — drag-and-drop upload zone, year selector, submit button
- `cooperative/FinancialStatementEditor.tsx` — grid editor with inline editing, confidence badges, validation panel
- `cooperative/SubmissionList.tsx` — list of cooperative's submissions with status badges
- `cooperative/SubmissionDetail.tsx` — submission detail with line items, flags, submit button
- `apex/ApexSubmissionsPage.tsx` — list of submissions for apex review, approve/return actions
- `federation/FederationSubmissionsPage.tsx` — list for federation review
- `ministry/MinistrySubmissionsPage.tsx` — list for ministry review, approve/reject actions

**Routes** (`frontend/src/routes/`):
- `app.upload.tsx` — `/app/upload` (cooperative role)
- `app.submissions.tsx` — `/app/submissions` (cooperative role) — already exists, update
- `app.submission.$id.tsx` — `/app/submissions/$id` (cooperative role)
- `app.financial-statement.$id.tsx` — `/app/financial-statement/$id` (cooperative role) — already exists, update
- `app.apex-submissions.tsx` — `/app/apex-submissions` (apex role)
- `app.federation-submissions.tsx` — `/app/federation-submissions` (federation role)
- `app.ministry-submissions.tsx` — `/app/ministry-submissions` (ministry role)

### 10.2 Upload Component

**Component**: `cooperative/UploadFinancialStatement.tsx`

- Drag-and-drop zone (react-dropzone)
- File type validation: PDF, PNG, JPEG, TIFF, XLSX, XLS
- Year selector (current year + previous year)
- Currency selector (SZL default, USD option)
- Upload button → `useUploadFinancialStatement()` mutation
- On success → navigate to `/app/financial-statement/$id` (the new financial statement)
- Show extraction job progress (poll every 2s)
- When extraction done → show grid editor

### 10.3 Grid Editor Component

**Component**: `cooperative/FinancialStatementEditor.tsx`

- TanStack Table with inline editing
- Columns: Account Code, Account Name, Category, Month, Value, AI Confidence, Source Label, Status
- Confidence badges (green/yellow/red)
- Unmapped rows highlighted yellow
- Validation panel (sidebar): errors (red, block submit), warnings (yellow)
- "Re-validate" button → `useValidateExtraction()` mutation
- "Submit" button (disabled if errors) → `useSubmitSubmission()` mutation
- On submit success → toast + navigate to submission list

### 10.4 Extraction Job Polling Hook

```typescript
export function useExtractionJob(jobId: string | null) {
  return useQuery({
    queryKey: ['extraction-job', jobId],
    queryFn: async () => {
      const token = await getAccessToken();
      const res = await fetch(`/api/v1/cooperative/extraction-jobs/${jobId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('Failed to fetch extraction job');
      return res.json();
    },
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === 'succeeded' || status === 'failed') return false;
      return 2000;
    },
  });
}
```

---

## 11. Abnormality Flags Reference

### 11.1 Balance-Sheet Integrity (§9.1)

| Rule ID | Condition | Severity |
|---------|-----------|----------|
| `BALANCE_UNBALANCED` | Assets (1999) ≠ Liabilities (2999) + Equity (3999) | error |
| `TOTAL_MISMATCH` | Formula field value ≠ sum of children (±1.00 tolerance) | error |
| `NEGATIVE_ASSET` | Any asset line item value < 0 (except accumulated depreciation) | warning |
| `MISSING_NET_SURPLUS` | Code 6999 not present in line items | error |
| `MISSING_ACCOUNT` | Required code for cooperative_type not present | error |
| `MONTH_GAP` | Monthly data has gaps (e.g. months 1-3 present, 4 missing, 5 present) | warning |
| `PORTFOLIO_OVER_100` | Sum of loans (1201-1205) > total assets (1999) | warning |

### 11.2 Extraction Confidence (§9.4)

| Rule ID | Condition | Severity |
|---------|-----------|----------|
| `LOW_EXTRACTION_CONFIDENCE` | `ai_confidence < 0.6` on any line item | warning |
| `UNMAPPED_ACCOUNT` | `account_code IS NULL` on any line item | error |
| `AI_TOTAL_DRIFT` | LLM totals_reconciliation ≠ computed sum of line items | warning |

---

## 12. Environment Variables

New env vars for Ticket 2 (add to `.env.example`):

```bash
# Object Storage
STORAGE_BACKEND=local                    # local | s3
STORAGE_LOCAL_PATH=./data/uploads        # for local backend
S3_ENDPOINT=http://localhost:9000        # for s3 backend (MinIO)
S3_BUCKET=coopdata-uploads
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_REGION=us-east-1

# AI Extraction (for next sprint, not needed for mock)
AI_PROVIDER_URL=https://api.openai.com/v1
AI_API_KEY=
AI_MODEL=gpt-4o

# Extraction Pipeline
EXTRACTION_MAX_FILE_SIZE_MB=20
EXTRACTION_POLL_INTERVAL_MS=2000
```

---

## 13. Acceptance Criteria

### Backend

- [ ] `POST /api/v1/cooperative/financial-statement/upload` accepts multipart file, creates submission + uploaded_file + extraction_job + financial_statement, returns 202 with IDs
- [ ] `GET /api/v1/cooperative/extraction-jobs/{id}` returns job status, raw_text, extracted_json, confidence
- [ ] Mock extractor runs async after upload, writes line items to `balance_sheet_line_items`, transitions submission to `awaiting_coop_validation`
- [ ] `GET /api/v1/cooperative/financial-statements/{id}` returns FS with all line items
- [ ] `PATCH /api/v1/cooperative/financial-statements/{id}/line-items` updates values, sets `manually_edited=true, ai_flagged=false`
- [ ] `POST /api/v1/cooperative/submissions/{id}/validate-extraction` runs validation, writes `abnormality_flags`, updates `financial_statements.validation_errors`
- [ ] `POST /api/v1/cooperative/submissions/{id}/submit` transitions to `submitted` (blocks if error-severity flags exist)
- [ ] `GET /api/v1/cooperative/submissions` lists submissions for caller's cooperative
- [ ] `GET /api/v1/apex/submissions` lists submissions for apex's cooperatives
- [ ] `POST /api/v1/apex/submissions/{id}/approve` transitions to `federation_review`
- [ ] `POST /api/v1/apex/submissions/{id}/return` transitions to `draft`
- [ ] `GET /api/v1/federation/submissions` lists submissions for federation's apexes
- [ ] `POST /api/v1/federation/submissions/{id}/approve` transitions to `ministry_review`
- [ ] `POST /api/v1/federation/submissions/{id}/return` transitions to `apex_review`
- [ ] `GET /api/v1/ministry/submissions` lists all submissions
- [ ] `POST /api/v1/ministry/submissions/{id}/approve` transitions to `approved`
- [ ] `POST /api/v1/ministry/submissions/{id}/reject` transitions to `rejected` (terminal)
- [ ] `GET /api/v1/apex/submissions/{id}/flags` returns abnormality flags
- [ ] All handlers have `#[utoipa::path]` annotations
- [ ] All new schemas registered in OpenAPI
- [ ] `cargo clippy` passes with no warnings
- [ ] `cargo test` passes

### Frontend

- [ ] Upload page with drag-and-drop, year/currency selectors, file type validation
- [ ] Upload mutation creates submission, navigates to editor
- [ ] Extraction job polling hook (2s interval, stops on succeeded/failed)
- [ ] Grid editor shows all line items with confidence badges
- [ ] Low-confidence cells (< 0.6) highlighted red
- [ ] Unmapped rows (account_code=null) highlighted yellow
- [ ] Inline editing of value cells → PATCH line items
- [ ] Account code dropdown for unmapped rows → select from CoA
- [ ] Validation panel shows errors (red, block submit) and warnings (yellow)
- [ ] "Re-validate" button re-runs validation
- [ ] "Submit" button disabled when error-severity flags exist
- [ ] Submit success → toast + redirect to submission list
- [ ] Apex submissions page with approve/return actions
- [ ] Federation submissions page with approve/return actions
- [ ] Ministry submissions page with approve/reject actions
- [ ] All pages role-protected (cooperative/apex/federation/ministry)
- [ ] `npx tsc --noEmit` passes (no new errors)
- [ ] `npm run lint` passes (no new errors)

### Integration

- [ ] Full flow: upload → mock extraction → grid pre-fill → edit → validate → submit → apex approve → federation approve → ministry approve → `approved`
- [ ] Return flow: apex return → draft → re-submit
- [ ] Validation blocks submission when balance doesn't balance
- [ ] Unmapped accounts show as errors in validation panel
- [ ] Low confidence items show as warnings in validation panel

---

## 14. File Checklist

### Backend — Create

```
backend/src/entities/
  ├── submission.rs
  ├── financial_statement.rs
  ├── balance_sheet_line_item.rs
  ├── uploaded_file.rs
  ├── extraction_job.rs
  ├── submission_review.rs
  ├── chart_of_account.rs
  ├── chart_of_accounts_coop_type.rs
  ├── account_alias.rs
  └── abnormality_flag.rs

backend/src/api/dto/
  ├── submission.rs
  ├── financial.rs
  ├── extraction.rs
  └── upload.rs

backend/src/repositories/
  ├── submission.rs
  ├── financial_statement.rs
  ├── balance_sheet_line_item.rs
  ├── uploaded_file.rs
  ├── extraction_job.rs
  ├── submission_review.rs
  ├── chart_of_accounts.rs
  ├── account_alias.rs
  └── abnormality_flag.rs

backend/src/api/handlers/
  ├── upload.rs
  ├── extraction.rs
  ├── submission.rs
  └── financial_statement.rs

backend/src/services/
  ├── object_storage.rs
  ├── file_parser.rs
  ├── ai_extraction.rs
  ├── abnormality_detector.rs
  ├── extraction_pipeline.rs
  └── submission_workflow.rs
```

### Backend — Modify

```
backend/src/entities/mod.rs                    — register new entities
backend/src/repositories/mod.rs                 — register new repos
backend/src/api/dto/mod.rs                     — register new DTOs
backend/src/api/handlers/mod.rs                — register new handlers
backend/src/api/routes/cooperative.rs          — add upload/submission/FS/extraction routes
backend/src/api/routes/apex.rs                 — add submission review routes
backend/src/api/routes/federation.rs           — add submission review routes
backend/src/api/routes/ministry.rs             — add submission review routes
backend/src/api/routes/shared.rs               — add shared submission/KPI routes
backend/src/api/openapi.rs                     — register new paths + schemas
backend/src/lib.rs                             — add new repos + services to AppState
backend/src/main.rs                            — initialize new repos + services
backend/Cargo.toml                             — add deps: async-trait, calamine, multipart
```

### Frontend — Create

```
frontend/src/hooks/
  ├── submissions/useSubmissions.ts
  ├── submissions/useApexSubmissions.ts
  ├── submissions/useFederationSubmissions.ts
  ├── submissions/useMinistrySubmissions.ts
  ├── financial-statements/useFinancialStatement.ts
  ├── extraction/useExtractionJob.ts
  └── upload/useUpload.ts

frontend/src/pages/
  ├── cooperative/UploadFinancialStatement.tsx
  ├── cooperative/FinancialStatementEditor.tsx
  ├── cooperative/SubmissionList.tsx
  ├── cooperative/SubmissionDetail.tsx
  ├── apex/ApexSubmissionsPage.tsx
  ├── federation/FederationSubmissionsPage.tsx
  └── ministry/MinistrySubmissionsPage.tsx

frontend/src/routes/
  ├── app.upload.tsx
  ├── app.submission.$id.tsx
  ├── app.apex-submissions.tsx
  ├── app.federation-submissions.tsx
  └── app.ministry-submissions.tsx
```

### Frontend — Modify

```
frontend/src/routes/app.submissions.tsx        — update to use real data
frontend/src/routes/app.financial-statement.$id.tsx — update to use grid editor
frontend/src/routeTree.gen.ts                  — auto-regenerated by TanStack Router plugin
```

---

## 15. Implementation Order

Follow the AGENTS.md bottom-up hierarchy:

1. **Entities** (10 new) — SeaORM entities matching DB schema
2. **Repositories** (9 new) — CRUD + custom queries
3. **DTOs** (4 new files) — request/response types with validation
4. **Services** (6 new) — object storage, file parser, AI extraction, abnormality detector, pipeline orchestrator, submission workflow
5. **Handlers** (4 new files) — upload, extraction, submission, financial statement
6. **Routes** — wire handlers to URLs, register in api.rs
7. **OpenAPI** — register all paths + schemas
8. **AppState** — add new repos + services
9. **Frontend hooks** (7 new) — TanStack Query hooks
10. **Frontend pages** (7 new) — upload, editor, lists, review pages
11. **Frontend routes** (5 new) — wire pages into router
12. **Verify** — cargo clippy, cargo test, tsc --noEmit, npm run lint