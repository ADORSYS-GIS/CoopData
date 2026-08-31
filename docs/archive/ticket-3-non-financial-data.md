# Ticket 3 — Non-Financial Data Pipeline

> **Epic**: Sprint 2, Epic 2 — Primary Cooperative Data
> **Ticket**: 3 of 2
> **Status**: Specification (DB migrations done, implementation pending)
> {: .info }

---

## 1. Overview

### Problem

Cooperatives in Eswatini must submit **non-financial data** alongside their financial statements. This data covers four domains:

1. **Membership** — who is in the cooperative (demographics, status, participation)
2. **Savings Accounts** — member savings products and contribution behavior
3. **Loans** — member loan products, repayment status, and risk indicators
4. **Fixed Deposits** — term deposit products and rollover behavior

Unlike financial statements (Ticket 2), which are unstructured PDFs requiring LLM extraction, non-financial data arrives in **structured Excel spreadsheets** with fixed column layouts. The challenge is parsing, validating, and storing this data reliably — no AI needed.

### Solution

A deterministic pipeline that:

1. Accepts **Excel file uploads** (`.xlsx`/`.xls`) with four named sheets
2. Parses each sheet using the **calamine** crate (pure Rust Excel reader)
3. Maps columns to database fields with **enum validation** and **type coercion**
4. Runs **consistency checks** across tables (e.g., loans reference valid members)
5. Stores records via **bulk upsert** (insert-or-update on composite unique keys)
6. Links all records to a **submission** for the review workflow
7. Exposes **CRUD + list** endpoints for manual entry and correction
8. Feeds data into **KPI computation** for dashboards and regulatory reports

### Scope

**In scope:**
- Backend: 4 SeaORM entities, 4 repositories, 1 DTO module, 1 Excel parser service, 1 handler module, route wiring, OpenAPI registration
- Frontend: 4 custom hooks, refactor of existing `NonFinancialDataPage.tsx` to use real API + Excel upload
- Validation: 5 consistency rules (cross-table integrity, date logic, enum matching)
- KPI computation hooks (KPI storage table already exists from Ticket 2)

**Out of scope:**
- KPI dashboard rendering (separate ticket)
- Offline-first sync for non-financial data (future ticket — sync contract documented but not implemented here)
- Review workflow for non-financial submissions (reuses Ticket 2's submission state machine)
- AI/LLM extraction (not needed — data is structured)

---

## 2. Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Non-Financial Data Pipeline                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐       │
│  │  Excel   │───▶│  Parse   │───▶│ Validate │───▶│  Bulk    │       │
│  │  Upload  │    │  Sheets  │    │  Rules   │    │  Upsert  │       │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘       │
│       │              │               │               │              │
│       │              ▼               ▼               ▼              │
│       │         ┌─────────┐     ┌─────────┐    ┌──────────┐         │
│       │         │ NF MSHIP│     │ Errors  │    │ 4 tables │         │
│       │         │ NF S    │     │ + Warns │    │ members  │         │
│       │         │ NF LOANS│     └─────────┘    │ savings  │         │
│       │         │ NF FS   │                    │ loans    │         │
│       │         └─────────┘                    │ fixed_dep│         │
│       │                                        └──────────┘         │
│       ▼                                                             │
│  ┌──────────┐                                                        │
│  │ uploaded │                                                        │
│  │  files   │                                                        │
│  └──────────┘                                                        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐        │
│  │  Manual CRUD (per-record add/edit/delete via API)        │        │
│  └──────────────────────────────────────────────────────────┘        │
│                                                                      │
│  ┌──────────────────────────────────────────────────────────┐        │
│  │  KPI Computation (reads NF tables → writes kpi_flags)    │        │
│  └──────────────────────────────────────────────────────────┘        │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Key Differences from Ticket 2 (Financial Pipeline)

| Aspect              | Ticket 2 (Financial)          | Ticket 3 (Non-Financial)              |
| ------------------- | ----------------------------- | ------------------------------------- |
| Input format        | PDF / Image / Excel           | Excel only                            |
| Extraction method   | LLM API (mocked)              | Deterministic parsing (calamine)      |
| Data structure      | Unstructured → CoA mapping    | Structured columns → direct DB fields  |
| Validation          | Balance identity, roll-ups    | Cross-table FK integrity, date logic   |
| Human review        | Grid editor with confidence   | Grid editor with validation errors     |
| Records per upload  | ~34 line items                | Hundreds–thousands of member records   |
| Bulk operations     | Single FS per upload          | Bulk upsert per sheet                  |

---

## 3. Stage 1: Excel Upload & Parsing

### 3.1 Multipart Upload Handler

```
POST /api/v1/cooperative/non-financial/upload
Content-Type: multipart/form-data

Parameters:
  - file: .xlsx or .xls file (required)
  - submission_id: UUID (required — links to an existing draft submission)
  - cooperative_id: UUID (resolved from JWT claims, not user-supplied)

Response 201:
{
  "upload_id": "uuid",
  "submission_id": "uuid",
  "sheets_found": ["NF MSHIP", "NF S", "NF LOANS", "NF FS"],
  "rows_parsed": {
    "members": 245,
    "savings_accounts": 180,
    "loans": 92,
    "fixed_deposits": 34
  },
  "errors": [
    {
      "sheet": "NF LOANS",
      "row": 15,
      "column": "loan_maturity_date",
      "value": "2020-01-01",
      "rule": "MATURITY_BEFORE_START",
      "message": "Maturity date is before loan start date"
    }
  ],
  "warnings": [
    {
      "sheet": "NF MSHIP",
      "row": 0,
      "column": "member_count",
      "rule": "MEMBER_COUNT_DRIFT",
      "message": "Member count (245) differs from cached member_count (250)"
    }
  ],
  "rows_imported": {
    "members": 243,
    "savings_accounts": 178,
    "loans": 90,
    "fixed_deposits": 34
  }
}
```

### 3.2 Excel Sheet Format

The Excel file must contain four sheets with exact names:

| Sheet Name  | Maps To         | Description                        |
| ----------- | --------------- | ---------------------------------- |
| `NF MSHIP`  | `members`       | Membership roster                  |
| `NF S`      | `savings_accounts` | Savings account products        |
| `NF LOANS`  | `loans`         | Loan products                      |
| `NF FS`     | `fixed_deposits` | Fixed deposit products             |

If a sheet is missing, the parser skips it gracefully (that data type is not imported). If no recognized sheets are found, return `400 Bad Request`.

### 3.3 Column Mappings

#### NF MSHIP → members

| Excel Column            | DB Field           | Type           | Required | Validation                          |
| ----------------------- | ------------------ | -------------- | -------- | ----------------------------------- |
| Member ID               | member_id          | VARCHAR(20)    | Yes      | Unique per cooperative              |
| Join Date               | join_date          | DATE           | Yes      | Valid date, not in future           |
| Status                  | status             | member_status  | Yes      | Active / Dormant / Exited           |
| Exit Date               | exit_date          | DATE           | No       | Required if Status=Exited; ≥ join   |
| Gender                  | gender             | gender         | Yes      | Male / Female / Other               |
| Age Group               | age_group          | age_group      | Yes      | <18 / 18-35 / 36-50 / 50+           |
| Region                  | region             | eswatini_region| Yes      | Hhohho / Lubombo / Manzini / Shiselweni |
| Urban/Rural             | urban_rural        | urban_rural    | Yes      | Urban / Rural                       |
| AGM Attendance          | agm_attendance     | BOOLEAN        | No       | Default false                        |
| Leadership Role         | leadership_role    | VARCHAR(100)   | No       | Free text                           |
| Voting Exercised        | voting_exercised   | BOOLEAN        | No       | Default false                        |

#### NF S → savings_accounts

| Excel Column                | DB Field                    | Type           | Required | Validation                     |
| --------------------------- | --------------------------- | -------------- | -------- | ------------------------------ |
| Member ID                   | member_id (FK)              | UUID (lookup)  | Yes      | Must exist in members table    |
| Savings Account ID          | savings_account_id          | VARCHAR(20)    | Yes      | Unique per cooperative         |
| Account Type                | account_type                | account_type   | Yes      | Voluntary / Mandatory / Fixed  |
| Account Opening Date        | account_opening_date        | DATE           | Yes      | Valid date                     |
| Account Status              | account_status              | VARCHAR(20)    | No       | Default "Active"               |
| Contribution Frequency      | contribution_frequency      | VARCHAR(20)    | No       | Free text (e.g., Monthly)       |
| Last Contribution Date      | last_contribution_date      | DATE           | No       | ≥ account_opening_date         |
| Number of Contributions     | number_of_contributions     | INTEGER        | No       | Default 0, ≥ 0                 |
| Balance Trend                | balance_trend               | VARCHAR(20)    | No       | Free text (Increasing/Stable/Decreasing) |
| Zero Balance Flag           | zero_balance_flag           | BOOLEAN        | No       | Default false                  |
| Withdrawal Frequency        | withdrawal_frequency_category | VARCHAR(20)  | No       | Free text                      |
| Emergency Withdrawals       | emergency_withdrawals_flag  | BOOLEAN        | No       | Default false                  |
| Interest Rate               | interest_rate               | NUMERIC(5,2)   | No       | 0–100                          |
| Balance                     | balance                     | NUMERIC(15,2)  | No       | Default 0                      |

#### NF LOANS → loans

| Excel Column                | DB Field                    | Type           | Required | Validation                          |
| --------------------------- | --------------------------- | -------------- | -------- | ----------------------------------- |
| Member ID                   | member_id (FK)              | UUID (lookup)  | Yes      | Must exist in members table         |
| Loan ID                     | loan_id                     | VARCHAR(20)    | Yes      | Unique per cooperative              |
| Loan Product Type           | loan_product_type           | VARCHAR(100)   | Yes      | Free text                           |
| Loan Start Date             | loan_start_date             | DATE           | Yes      | Valid date                          |
| Loan Maturity Date          | loan_maturity_date          | DATE           | Yes      | ≥ loan_start_date                   |
| Loan Status                 | loan_status                 | loan_status    | Yes      | Performing/Arrears/Restructured/WrittenOff |
| Borrower Type               | borrower_type               | VARCHAR(50)    | No       | Free text                           |
| Youth Borrower              | youth_borrower_flag         | BOOLEAN        | No       | Default false                        |
| Women Borrower              | women_borrower_flag         | BOOLEAN        | No       | Default false                        |
| Rural Borrower              | rural_borrower_flag         | BOOLEAN        | No       | Default false                        |
| Repayment Regularity        | repayment_regularity        | VARCHAR(20)    | No       | Free text                           |
| Days Past Due Category      | days_past_due_category      | dpd_category   | No       | 0/1-30/31-60/61-90/91+              |
| Missed Installments         | missed_installments_count   | INTEGER        | No       | Default 0, ≥ 0                      |
| Restructured Loan           | restructured_loan_flag      | BOOLEAN        | No       | Default false                        |
| Number of Restructurings     | number_of_restructurings    | INTEGER        | No       | Default 0, ≥ 0                      |
| Early Settlement            | early_settlement_flag       | BOOLEAN        | No       | Default false                        |
| Multiple Loans              | multiple_loans_flag         | BOOLEAN        | No       | Default false                        |
| Large Borrower              | large_borrower_flag         | BOOLEAN        | No       | Default false                        |
| Interest Rate               | interest_rate               | NUMERIC(5,2)   | No       | 0–100                               |
| Balance                     | balance                     | NUMERIC(15,2)  | No       |                                     |
| Loan Amount                 | loan_amount                 | NUMERIC(15,2)  | No       |                                     |

#### NF FS → fixed_deposits

| Excel Column                | DB Field                    | Type           | Required | Validation                          |
| --------------------------- | --------------------------- | -------------- | -------- | ----------------------------------- |
| Member ID                   | member_id (FK)              | UUID (lookup)  | Yes      | Must exist in members table         |
| Fixed Deposit ID            | fixed_deposit_id            | VARCHAR(20)    | Yes      | Unique per cooperative              |
| Deposit Type                | deposit_type                | VARCHAR(20)    | Yes      | Short / Medium / Long-term          |
| Start Date                  | start_date                  | DATE           | Yes      | Valid date                          |
| Maturity Date               | maturity_date               | DATE           | Yes      | ≥ start_date                        |
| Status                      | status                      | fd_status      | Yes      | Active/Matured/Withdrawn/RolledOver  |
| Tenure Category             | tenure_category             | VARCHAR(10)    | No       | Free text                           |
| Original Tenure Selected    | original_tenure_selected    | VARCHAR(50)    | No       | Free text                           |
| Early Withdrawal            | early_withdrawal_flag       | BOOLEAN        | No       | Default false                        |
| Rollover at Maturity        | rollover_at_maturity_flag  | BOOLEAN        | No       | Default false                        |
| Number of Renewals          | number_of_renewals          | INTEGER        | No       | Default 0, ≥ 0                      |
| Change in Tenure at Renewal| change_in_tenure_at_renewal| BOOLEAN        | No       | Default false                        |
| Single Depositor Dependency | single_depositor_dependency_flag | BOOLEAN | No       | Default false                        |
| Interest Rate               | interest_rate               | NUMERIC(5,2)   | No       | 0–100                               |
| Balance                     | balance                     | NUMERIC(15,2)  | No       |                                     |

### 3.4 Calamine Parser Service

```rust
pub trait NfExcelParser: Send + Sync {
    fn parse(&self, file_bytes: &[u8]) -> AppResult<NfParseResult>;
}

pub struct NfParseResult {
    pub members: Vec<MemberRecord>,
    pub savings_accounts: Vec<SavingsAccountRecord>,
    pub loans: Vec<LoanRecord>,
    pub fixed_deposits: Vec<FixedDepositRecord>,
    pub errors: Vec<NfParseError>,
    pub warnings: Vec<NfParseWarning>,
    pub sheets_found: Vec<String>,
}

pub struct NfParseError {
    pub sheet: String,
    pub row: usize,        // 0-indexed
    pub column: String,
    pub value: String,
    pub rule: String,      // e.g., "MATURITY_BEFORE_START"
    pub message: String,
}

pub struct NfParseWarning {
    pub sheet: String,
    pub row: usize,
    pub column: String,
    pub rule: String,
    pub message: String,
}
```

**Implementation**: `CalamineNfParser` using `calamine::Reader<Excel<...>>` to open the workbook, iterate sheets, match by name, and map rows to record structs. Enum values are validated against const arrays (same pattern as handler validation). Dates are parsed from calamine's `DataType::DateTime` or string formats.

### 3.5 Object Storage

Uploaded Excel files are stored using the existing `ObjectStorage` trait from Ticket 2 (`LocalFileStorage` or `S3Storage`). An `uploaded_files` row is created with:

- `file_name`: original filename
- `file_path`: storage path
- `file_type`: `"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"` or `"application/vnd.ms-excel"`
- `file_size`: byte count
- `submission_id`: linked submission
- `cooperative_id`: from JWT claims

---

## 4. Stage 2: Validation Layer

### 4.1 Consistency Rules

All rules run **after parsing**, before bulk upsert. Errors prevent the record from being imported. Warnings are stored but do not block import.

| Rule                    | Table           | Condition                                         | Severity | Message                                              |
| ----------------------- | --------------- | ------------------------------------------------- | -------- | ---------------------------------------------------- |
| `LOAN_WITHOUT_MEMBER`   | loans           | `loan.member_id` not found in parsed members      | Error    | "Loan references member_id {x} not in members sheet"  |
| `MATURITY_BEFORE_START` | loans           | `loan_maturity_date < loan_start_date`            | Error    | "Maturity date is before loan start date"            |
| `DPD_STATUS_MISMATCH`   | loans           | `loan_status = Performing` AND `days_past_due != 0`| Error    | "Performing loan has non-zero days past due"          |
| `EXIT_BEFORE_JOIN`      | members         | `exit_date < join_date`                           | Error    | "Exit date is before join date"                      |
| `MEMBER_COUNT_DRIFT`    | members         | `COUNT(members) != cooperative.member_count`      | Warning  | "Member count ({x}) differs from cached ({y})"       |

### 4.2 Validation Flow

```
1. Parse all 4 sheets into in-memory record vectors
2. Build member_id → UUID lookup map from parsed members
3. For each loan: check member_id exists in map (LOAN_WITHOUT_MEMBER)
4. For each loan: check maturity ≥ start (MATURITY_BEFORE_START)
5. For each loan: check DPD/status consistency (DPD_STATUS_MISMATCH)
6. For each member with exit_date: check exit ≥ join (EXIT_BEFORE_JOIN)
7. Query cooperative.member_count from DB; compare to parsed count (MEMBER_COUNT_DRIFT)
8. Collect all errors and warnings
9. Filter out records with errors; keep records with warnings
10. Return (valid_records, errors, warnings)
```

### 4.3 Error Storage

Parse errors are returned in the upload response (not stored in DB). If the user chooses to proceed despite warnings, the warnings are stored as a JSONB array on the `submission.validation_errors` column (reusing the existing field from Ticket 2).

---

## 5. Stage 3: Bulk Upsert & Storage

### 5.1 Upsert Strategy

Each table uses a **composite unique key** for upsert (insert-or-update):

| Table            | Unique Key                              | On Conflict Action          |
| ---------------- | --------------------------------------- | ---------------------------- |
| members           | `(cooperative_id, member_id)`           | Update all non-key columns   |
| savings_accounts  | `(cooperative_id, savings_account_id)`   | Update all non-key columns   |
| loans             | `(cooperative_id, loan_id)`             | Update all non-key columns   |
| fixed_deposits    | `(cooperative_id, fixed_deposit_id)`    | Update all non-key columns   |

All records in a bulk upsert share the same `submission_id` and `cooperative_id`.

### 5.2 Member FK Resolution

Savings accounts, loans, and fixed deposits reference `member_id` (the UUID PK in the `members` table, not the VARCHAR `member_id` business key). During parsing, the Excel `Member ID` column is the business key. The parser must:

1. Parse members first
2. Build a map: `business_member_id → UUID` (from existing DB members + newly parsed members)
3. For savings/loans/fixed_deposits, resolve the FK using this map
4. If a business member_id is not found, emit `LOAN_WITHOUT_MEMBER` error

### 5.3 Transaction Boundary

The entire bulk upsert for all 4 tables runs in a **single database transaction**. If any table fails to insert, the entire upload is rolled back. Parse errors (which prevent individual records) are filtered before the transaction.

---

## 6. Stage 4: Manual CRUD & Frontend

### 6.1 Per-Record CRUD

Beyond bulk Excel upload, users can manually add, edit, and delete individual records via API endpoints. This supports corrections after upload (e.g., fixing a validation error and re-saving a single record).

### 6.2 Frontend Grid Editor

The existing `NonFinancialDataPage.tsx` (1172 lines) has a UI shell with 4 tabs (Members, Savings, Loans, Fixed Deposits). It currently uses local `useState` only. The refactor will:

1. Replace `useState` with TanStack Query hooks (`useMembers`, `useSavings`, `useLoans`, `useFixedDeposits`)
2. Add an **Excel upload** component (drag-and-drop, file validation, upload progress)
3. Display parse results (rows imported, errors, warnings) in a results panel
4. Use **TanStack Table** for each tab's data grid (inline editing, sorting, filtering)
5. Add **RHF + Zod** forms for manual record entry
6. Show validation badges (error rows highlighted red, warning rows highlighted yellow)

### 6.3 Upload Flow

```
1. User selects Excel file → drag-and-drop or file picker
2. Frontend validates file extension (.xlsx, .xls)
3. POST /api/v1/cooperative/non-financial/upload (multipart)
4. Show loading spinner during upload + parse
5. Display results: sheets found, rows parsed, rows imported, errors, warnings
6. User can click "View Errors" to see a table of all parse errors
7. User can click "Proceed" to commit the valid records (already committed server-side, but this navigates to the grid editor)
8. Grid editor loads with the newly imported data
```

---

## 7. Submission Integration

Non-financial data uploads link to the **same submission workflow** as Ticket 2. A submission can contain both financial statements and non-financial data.

### 7.1 Submission State Machine (reused from Ticket 2)

```
draft → awaiting_coop_validation → submitted → apex_review → federation_review → ministry_review → approved
                ↑                    │              │              │              │
                └────────────────────┴──────────────┴──────────────┴──────────────┘
                                     (return at any review tier)
```

### 7.2 Non-Financial Data in Submissions

- `submission_id` on each NF table is nullable (records can exist before being linked to a submission)
- When uploading via the pipeline, all records are linked to the specified `submission_id`
- Manual CRUD records are also linked to a `submission_id` (the current draft submission for the cooperative)
- When a submission transitions to `submitted`, all linked NF records are frozen (no further edits)

---

## 8. API Surface

### 8.1 Cooperative Endpoints

| Method | Path                                              | Description                          |
| ------ | ------------------------------------------------- | ------------------------------------ |
| POST   | `/api/v1/cooperative/non-financial/upload`        | Upload Excel file, parse, bulk upsert |
| GET    | `/api/v1/cooperative/non-financial/members`       | List members for cooperative         |
| GET    | `/api/v1/cooperative/non-financial/members/{id}`   | Get single member                    |
| POST   | `/api/v1/cooperative/non-financial/members`        | Create single member                 |
| PATCH  | `/api/v1/cooperative/non-financial/members/{id}`  | Update single member                 |
| DELETE | `/api/v1/cooperative/non-financial/members/{id}`   | Delete single member                 |
| GET    | `/api/v1/cooperative/non-financial/savings`        | List savings accounts                |
| GET    | `/api/v1/cooperative/non-financial/savings/{id}`  | Get single savings account           |
| POST   | `/api/v1/cooperative/non-financial/savings`        | Create single savings account        |
| PATCH  | `/api/v1/cooperative/non-financial/savings/{id}`   | Update single savings account        |
| DELETE | `/api/v1/cooperative/non-financial/savings/{id}`   | Delete single savings account        |
| GET    | `/api/v1/cooperative/non-financial/loans`          | List loans                           |
| GET    | `/api/v1/cooperative/non-financial/loans/{id}`    | Get single loan                      |
| POST   | `/api/v1/cooperative/non-financial/loans`          | Create single loan                   |
| PATCH  | `/api/v1/cooperative/non-financial/loans/{id}`     | Update single loan                   |
| DELETE | `/api/v1/cooperative/non-financial/loans/{id}`      | Delete single loan                   |
| GET    | `/api/v1/cooperative/non-financial/fixed-deposits` | List fixed deposits                  |
| GET    | `/api/v1/cooperative/non-financial/fixed-deposits/{id}` | Get single fixed deposit       |
| POST   | `/api/v1/cooperative/non-financial/fixed-deposits` | Create single fixed deposit          |
| PATCH  | `/api/v1/cooperative/non-financial/fixed-deposits/{id}` | Update single fixed deposit    |
| DELETE | `/api/v1/cooperative/non-financial/fixed-deposits/{id}` | Delete single fixed deposit    |

### 8.2 Query Parameters

All list endpoints support:

| Parameter   | Type    | Default | Description                          |
| ----------- | ------- | ------- | ------------------------------------ |
| `page`      | integer | 1       | Page number (1-indexed)              |
| `page_size` | integer | 50      | Items per page (max 200)             |
| `submission_id` | UUID | —       | Filter by submission                 |

### 8.3 Authorization

- All endpoints require `cooperative` or `apex` role
- `cooperative` users can only access their own cooperative's data (resolved from JWT claims)
- `apex` users can access any cooperative under their apex group (enforced via `assert_profile_belongs_to_apex` pattern)

---

## 9. Backend Implementation Plan

### 9.1 New Files

| File                                          | Description                              |
| --------------------------------------------- | ---------------------------------------- |
| `src/entities/member.rs`                      | SeaORM entity for members table          |
| `src/entities/savings_account.rs`             | SeaORM entity for savings_accounts table |
| `src/entities/loan.rs`                        | SeaORM entity for loans table            |
| `src/entities/fixed_deposit.rs`               | SeaORM entity for fixed_deposits table   |
| `src/repositories/member.rs`                  | CRUD + find_by_cooperative_id + bulk_upsert |
| `src/repositories/savings_account.rs`          | CRUD + find_by_cooperative_id + bulk_upsert |
| `src/repositories/loan.rs`                    | CRUD + find_by_cooperative_id + bulk_upsert |
| `src/repositories/fixed_deposit.rs`           | CRUD + find_by_cooperative_id + bulk_upsert |
| `src/api/dto/non_financial.rs`                | Request/response DTOs for all 4 types   |
| `src/api/handlers/non_financial.rs`           | Upload + CRUD handlers with utoipa      |
| `src/services/nf_excel_parser.rs`             | Calamine-based Excel parser service      |

### 9.2 Files to Modify

| File                                          | Changes                                  |
| --------------------------------------------- | ---------------------------------------- |
| `src/entities/mod.rs`                         | Add `pub mod member;` etc. + re-exports  |
| `src/repositories/mod.rs`                     | Add `pub mod member;` etc. + re-exports  |
| `src/api/dto/mod.rs`                          | Add `pub mod non_financial;`             |
| `src/api/handlers/mod.rs`                     | Add `pub mod non_financial;`             |
| `src/api/routes/cooperative.rs`               | Wire NF routes                           |
| `src/api/openapi.rs`                           | Register NF schemas + paths              |
| `src/lib.rs`                                   | Add NF repos + parser service to AppState |

### 9.3 AppState Evolution

```rust
// In AppState (src/lib.rs), add:
pub member_repo: Arc<MemberRepository>,
pub savings_account_repo: Arc<SavingsAccountRepository>,
pub loan_repo: Arc<LoanRepository>,
pub fixed_deposit_repo: Arc<FixedDepositRepository>,
pub nf_excel_parser: Arc<dyn NfExcelParser>,
```

### 9.4 Entity Pattern

Follow the existing entity pattern (see `src/entities/cooperative.rs`):

```rust
#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "members")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub cooperative_id: Uuid,
    pub submission_id: Option<Uuid>,
    pub member_id: String,
    pub join_date: Date,
    pub status: MemberStatus,
    pub exit_date: Option<Date>,
    pub gender: Gender,
    pub age_group: AgeGroup,
    pub region: EswatiniRegion,
    pub urban_rural: UrbanRural,
    pub agm_attendance: bool,
    pub leadership_role: Option<String>,
    pub voting_exercised: bool,
    pub created_at: DateTime,
    pub updated_at: DateTime,
}
```

### 9.5 Repository Pattern

Follow the existing repository pattern (see `src/repositories/cooperative.rs`):

```rust
pub struct MemberRepository {
    db: Arc<DbConn>,
}

impl MemberRepository {
    pub fn new(db: Arc<DbConn>) -> Self { ... }
    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<Model>> { ... }
    pub async fn find_by_cooperative_id(&self, coop_id: Uuid, page: u64, page_size: u64) -> AppResult<(Vec<Model>, u64)> { ... }
    pub async fn create(&self, body: CreateMemberRequest, coop_id: Uuid, submission_id: Option<Uuid>) -> AppResult<Model> { ... }
    pub async fn update(&self, id: Uuid, body: UpdateMemberRequest) -> AppResult<Option<Model>> { ... }
    pub async fn delete(&self, id: Uuid) -> AppResult<bool> { ... }
    pub async fn bulk_upsert(&self, records: Vec<MemberRecord>, coop_id: Uuid, submission_id: Option<Uuid>) -> AppResult<u64> { ... }
}
```

### 9.6 Handler Pattern

Follow the existing handler pattern (see `src/api/handlers/cooperative.rs`):

```rust
#[utoipa::path(
    post,
    path = "/api/v1/cooperative/non-financial/upload",
    tag = "non_financial",
    request_body(content_type = "multipart/form-data", content = NfUploadRequest),
    responses(
        (status = 201, description = "Upload parsed successfully", body = NfUploadResponse),
        (status = 400, description = "Invalid file or no recognized sheets", body = ErrorResponse),
        (status = 403, description = "Forbidden", body = ErrorResponse),
    )
)]
pub async fn upload_non_financial(
    State(state): State<AppState>,
    claims: Claims,
    mut multipart: Multipart,
) -> AppResult<impl IntoResponse> {
    // 1. Extract file + submission_id from multipart
    // 2. Validate file extension
    // 3. Store file via ObjectStorage
    // 4. Create uploaded_files record
    // 5. Parse Excel via nf_excel_parser
    // 6. Run validation rules
    // 7. Bulk upsert valid records (single transaction)
    // 8. Return parse results
}
```

### 9.7 OpenAPI Registration

In `src/api/openapi.rs`, add:

```rust
.components(schemas!(
    // Members
    MemberResponse, CreateMemberRequest, UpdateMemberRequest,
    // Savings
    SavingsAccountResponse, CreateSavingsAccountRequest, UpdateSavingsAccountRequest,
    // Loans
    LoanResponse, CreateLoanRequest, UpdateLoanRequest,
    // Fixed Deposits
    FixedDepositResponse, CreateFixedDepositRequest, UpdateFixedDepositRequest,
    // Upload
    NfUploadResponse, NfParseError, NfParseWarning,
))
.paths(paths!(
    upload_non_financial,
    list_members, get_member, create_member, update_member, delete_member,
    list_savings_accounts, get_savings_account, create_savings_account, update_savings_account, delete_savings_account,
    list_loans, get_loan, create_loan, update_loan, delete_loan,
    list_fixed_deposits, get_fixed_deposit, create_fixed_deposit, update_fixed_deposit, delete_fixed_deposit,
))
```

---

## 10. Frontend Implementation Plan

### 10.1 New Files

| File                                                  | Description                          |
| ----------------------------------------------------- | ------------------------------------ |
| `src/hooks/non-financial/useMembers.ts`               | TanStack Query hooks for members     |
| `src/hooks/non-financial/useSavings.ts`               | TanStack Query hooks for savings     |
| `src/hooks/non-financial/useLoans.ts`                 | TanStack Query hooks for loans       |
| `src/hooks/non-financial/useFixedDeposits.ts`         | TanStack Query hooks for fixed deps  |
| `src/hooks/non-financial/useNfUpload.ts`              | Upload mutation hook                 |
| `src/components/non-financial/NfUploadZone.tsx`       | Drag-and-drop Excel upload component |
| `src/components/non-financial/NfParseResults.tsx`     | Display parse errors/warnings       |
| `src/components/non-financial/MemberGrid.tsx`         | TanStack Table for members           |
| `src/components/non-financial/SavingsGrid.tsx`        | TanStack Table for savings           |
| `src/components/non-financial/LoanGrid.tsx`           | TanStack Table for loans             |
| `src/components/non-financial/FixedDepositGrid.tsx`   | TanStack Table for fixed deposits    |

### 10.2 Files to Modify

| File                                                  | Changes                              |
| ----------------------------------------------------- | ------------------------------------ |
| `src/pages/apex/NonFinancialDataPage.tsx`             | Replace useState with hooks, add upload, TanStack Tables |

### 10.3 Hook Pattern

Follow the existing hook pattern (see `src/hooks/cooperatives/useCooperativeProfile.ts`):

```typescript
export function useMembers(cooperativeId: string) {
  return useQuery({
    queryKey: ["non-financial", "members", cooperativeId],
    queryFn: async () => {
      const { data, error } = await apiClient.GET(
        "/api/v1/cooperative/non-financial/members",
        { params: { query: { cooperative_id: cooperativeId } } }
      );
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateMemberRequest) => {
      const { data, error } = await apiClient.POST(
        "/api/v1/cooperative/non-financial/members",
        { body }
      );
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["non-financial", "members"] });
    },
  });
}
```

### 10.4 Upload Component

```typescript
// NfUploadZone.tsx — drag-and-drop Excel upload
// - Accepts .xlsx, .xls
// - Shows upload progress
// - On success, displays NfParseResults (errors, warnings, row counts)
// - "Proceed to Grid" button navigates to data tabs
```

### 10.5 Grid Editor

Each tab (Members, Savings, Loans, Fixed Deposits) uses TanStack Table with:

- Inline editing (double-click cell to edit)
- Column sorting and filtering
- Pagination
- Error row highlighting (red background for records with errors)
- Warning row highlighting (yellow background for records with warnings)
- "Add Record" button → opens RHF + Zod form modal
- "Delete" action per row

---

## 11. KPI Computation

### 11.1 KPI Categories

Non-financial data feeds into 4 KPI categories (36 total KPIs):

#### Membership KPIs (11)

| KPI                       | Formula                              | Green Threshold |
| ------------------------- | ------------------------------------ | --------------- |
| totalMembers              | `COUNT(members)`                     | —               |
| membershipGrowthRate      | `(New - Exits) / Total`              | > 0             |
| dormancyRate              | `Dormant / Total`                    | < 20%           |
| exitRate                  | `Exited / Total`                     | < 5%            |
| activeMembersRatio        | `Active / Total`                     | ≥ 70%           |
| agmParticipationRate      | `agm_attendance=true / Total`        | ≥ 50%           |
| womenMembersPercent       | `gender=Female / Total`              | —               |
| youthMembersPercent       | `age_group=18-35 / Total`            | —               |
| ruralMembersPercent       | `urban_rural=Rural / Total`         | —               |
| womenInGovernancePercent  | `leadership_role IS NOT NULL AND gender=Female / Total` | — |
| youthInGovernancePercent  | `leadership_role IS NOT NULL AND age_group=18-35 / Total` | — |

#### Savings KPIs (10)

| KPI                              | Formula                              | Green Threshold |
| -------------------------------- | ------------------------------------ | --------------- |
| savingsPenetration               | `members w/ savings / total`         | ≥ 70%           |
| activeSaversRatio                | `active accounts / total accounts`   | —               |
| regularSaversRatio               | `regular contributors / total`       | ≥ 60%           |
| dormantSavingsAccountsPercent    | `dormant / total`                    | ≤ 20%           |
| zeroBalanceAccountsPercent       | `zero_balance_flag=true / total`      | —               |
| stableBalanceRatio               | `balance_trend=Stable / total`       | —               |
| highWithdrawalFrequencyPercent   | `high withdrawal freq / total`       | —               |
| emergencyWithdrawalIncidence     | `emergency_withdrawals_flag=true / total` | —          |
| averageInterestRate              | `AVG(interest_rate)`                  | —               |
| accountConcentration             | `top 10% balances / total balances`   | —               |

#### Loans KPIs (10)

| KPI                       | Formula                              | Green Threshold |
| ------------------------- | ------------------------------------ | --------------- |
| creditPenetration         | `members w/ loan / total`            | —               |
| onTimeRepaymentRatio      | `Performing / Total`                 | ≥ 75%           |
| loansInArrearsPercent     | `Arrears / Total`                    | ≤ 20%           |
| restructuredLoansRatio    | `Restructured / Total`               | ≤ 10%           |
| womenBorrowersPercent     | `women_borrower_flag=true / Total`   | —               |
| youthBorrowersPercent     | `youth_borrower_flag=true / Total`   | —               |
| ruralBorrowersPercent     | `rural_borrower_flag=true / Total`   | —               |
| averageLoanSize           | `AVG(loan_amount)`                    | —               |
| loansPerMember            | `COUNT(loans) / COUNT(members)`       | —               |
| averageInterestRate       | `AVG(interest_rate)`                  | —               |

#### Fixed Deposits KPIs (5)

| KPI                    | Formula                              | Green Threshold |
| ---------------------- | ------------------------------------ | --------------- |
| fdPenetration          | `members w/ FD / total`              | ≥ 20%           |
| longTermFdRatio        | `Long-term / Total`                  | —               |
| fdRolloverRate         | `RolledOver / Matured+RolledOver`    | ≥ 60%           |
| earlyWithdrawalRate    | `Withdrawn / Total`                  | ≤ 15%           |
| concentrationRisk      | `top 10% balances / total`            | —               |

### 11.2 KPI Storage

KPIs are computed and stored in the existing `kpi_flags` table (created in Ticket 2 migration `10_kpi_flags.sql`). Each KPI is a row with:

- `submission_id` — linked submission
- `kpi_code` — e.g., "totalMembers", "savingsPenetration"
- `kpi_category` — "membership", "savings", "loans", "fixed_deposits"
- `value` — numeric value
- `threshold_green` / `threshold_red` — optional thresholds
- `status` — "green" / "yellow" / "red"
- `computed_at` — timestamp

KPI computation is a **separate ticket** — this ticket only ensures the NF data is available for computation.

---

## 12. Environment Variables

No new environment variables required. The pipeline reuses:

| Variable          | Description                        | Used By          |
| ----------------- | ---------------------------------- | ---------------- |
| `STORAGE_TYPE`    | `local` or `s3`                    | ObjectStorage    |
| `STORAGE_PATH`    | Local storage directory           | LocalFileStorage |
| `S3_BUCKET`       | S3 bucket name                     | S3Storage        |
| `S3_REGION`       | S3 region                          | S3Storage        |
| `S3_ACCESS_KEY`   | S3 access key                      | S3Storage        |
| `S3_SECRET_KEY`   | S3 secret key                      | S3Storage        |

---

## 13. Acceptance Criteria

### 13.1 Backend

- [ ] `member.rs` entity created with all fields matching `09_non_financial.sql`
- [ ] `savings_account.rs` entity created with all fields
- [ ] `loan.rs` entity created with all fields
- [ ] `fixed_deposit.rs` entity created with all fields
- [ ] All 4 entities registered in `entities/mod.rs`
- [ ] `MemberRepository` with `find_by_id`, `find_by_cooperative_id`, `create`, `update`, `delete`, `bulk_upsert`
- [ ] `SavingsAccountRepository` with same methods
- [ ] `LoanRepository` with same methods
- [ ] `FixedDepositRepository` with same methods
- [ ] All 4 repos registered in `repositories/mod.rs`
- [ ] `non_financial.rs` DTO module with request/response types for all 4 entity types
- [ ] `From<Model>` impls for all 4 response types
- [ ] `NfExcelParser` trait defined in `services/nf_excel_parser.rs`
- [ ] `CalamineNfParser` implementation parses all 4 sheet types
- [ ] Parser validates enum values against const arrays
- [ ] Parser validates date ranges (maturity ≥ start, exit ≥ join)
- [ ] Parser validates member FK integrity across sheets
- [ ] `LOAN_WITHOUT_MEMBER` rule implemented
- [ ] `MATURITY_BEFORE_START` rule implemented
- [ ] `DPD_STATUS_MISMATCH` rule implemented
- [ ] `EXIT_BEFORE_JOIN` rule implemented
- [ ] `MEMBER_COUNT_DRIFT` rule implemented
- [ ] Upload handler accepts multipart, stores file, parses, validates, bulk upserts
- [ ] All 21 CRUD endpoints implemented with utoipa annotations
- [ ] All endpoints enforce cooperative scope (JWT claims)
- [ ] Apex users can access cooperatives under their apex group
- [ ] Routes wired in `routes/cooperative.rs`
- [ ] Schemas + paths registered in `openapi.rs`
- [ ] NF repos + parser service added to `AppState`
- [ ] `cargo clippy` passes with no warnings
- [ ] `cargo test` passes (unit tests for parser, validation rules, bulk upsert)

### 13.2 Frontend

- [ ] `useMembers` hook with list, get, create, update, delete mutations
- [ ] `useSavings` hook with same operations
- [ ] `useLoans` hook with same operations
- [ ] `useFixedDeposits` hook with same operations
- [ ] `useNfUpload` hook for Excel upload mutation
- [ ] `NfUploadZone` component with drag-and-drop, file validation
- [ ] `NfParseResults` component showing errors, warnings, row counts
- [ ] `MemberGrid` TanStack Table with inline editing
- [ ] `SavingsGrid` TanStack Table with inline editing
- [ ] `LoanGrid` TanStack Table with inline editing
- [ ] `FixedDepositGrid` TanStack Table with inline editing
- [ ] `NonFinancialDataPage.tsx` refactored to use hooks instead of `useState`
- [ ] Upload flow: select file → upload → show results → navigate to grid
- [ ] Error rows highlighted red, warning rows highlighted yellow
- [ ] RHF + Zod forms for manual record entry (all 4 types)
- [ ] `npm run lint` passes
- [ ] `npx tsc --noEmit` passes

### 13.3 Integration

- [ ] OpenAPI spec regenerated after backend changes
- [ ] Frontend client regenerated from new spec
- [ ] Upload endpoint accepts `.xlsx` and `.xls` files
- [ ] Upload rejects non-Excel files with 400
- [ ] Bulk upsert handles 500+ records without timeout
- [ ] Member FK resolution works across sheets (loan references member from same upload)
- [ ] Re-uploading same Excel updates existing records (upsert, not duplicate)

---

## 14. File Checklist

### 14.1 Backend — Create

| File                                          | Entity/Service/Handler          |
| --------------------------------------------- | ------------------------------- |
| `src/entities/member.rs`                      | SeaORM entity                   |
| `src/entities/savings_account.rs`             | SeaORM entity                   |
| `src/entities/loan.rs`                        | SeaORM entity                   |
| `src/entities/fixed_deposit.rs`               | SeaORM entity                   |
| `src/repositories/member.rs`                  | Repository                      |
| `src/repositories/savings_account.rs`         | Repository                      |
| `src/repositories/loan.rs`                    | Repository                      |
| `src/repositories/fixed_deposit.rs`           | Repository                      |
| `src/api/dto/non_financial.rs`                | DTOs                            |
| `src/api/handlers/non_financial.rs`           | Handlers                        |
| `src/services/nf_excel_parser.rs`             | Excel parser service            |

### 14.2 Backend — Modify

| File                                          | Changes                          |
| --------------------------------------------- | -------------------------------- |
| `src/entities/mod.rs`                         | Register 4 new entities          |
| `src/repositories/mod.rs`                     | Register 4 new repos             |
| `src/api/dto/mod.rs`                          | Register NF DTO module           |
| `src/api/handlers/mod.rs`                     | Register NF handler module       |
| `src/api/routes/cooperative.rs`               | Wire 21 NF routes                |
| `src/api/openapi.rs`                           | Register NF schemas + paths      |
| `src/lib.rs`                                   | Add NF repos + parser to AppState |

### 14.3 Frontend — Create

| File                                                  | Component/Hook                  |
| ----------------------------------------------------- | ------------------------------- |
| `src/hooks/non-financial/useMembers.ts`               | Hook                            |
| `src/hooks/non-financial/useSavings.ts`               | Hook                            |
| `src/hooks/non-financial/useLoans.ts`                 | Hook                            |
| `src/hooks/non-financial/useFixedDeposits.ts`         | Hook                            |
| `src/hooks/non-financial/useNfUpload.ts`              | Hook                            |
| `src/components/non-financial/NfUploadZone.tsx`       | Upload component                |
| `src/components/non-financial/NfParseResults.tsx`     | Results display                 |
| `src/components/non-financial/MemberGrid.tsx`         | Data grid                       |
| `src/components/non-financial/SavingsGrid.tsx`        | Data grid                       |
| `src/components/non-financial/LoanGrid.tsx`           | Data grid                       |
| `src/components/non-financial/FixedDepositGrid.tsx`   | Data grid                       |

### 14.4 Frontend — Modify

| File                                                  | Changes                          |
| ----------------------------------------------------- | -------------------------------- |
| `src/pages/apex/NonFinancialDataPage.tsx`             | Replace useState with hooks, add upload + grids |

---

## 15. Implementation Order

1. **Entities** — Create 4 SeaORM entities (`member.rs`, `savings_account.rs`, `loan.rs`, `fixed_deposit.rs`) + register in `mod.rs`
2. **Repositories** — Create 4 repositories with CRUD + `find_by_cooperative_id` + `bulk_upsert` + register in `mod.rs`
3. **DTOs** — Create `non_financial.rs` with request/response types for all 4 entity types + `From<Model>` impls + register in `mod.rs`
4. **Excel Parser Service** — Create `nf_excel_parser.rs` with `NfExcelParser` trait + `CalamineNfParser` impl + validation rules
5. **Handlers** — Create `non_financial.rs` with upload handler + 20 CRUD handlers (5 per entity type) with utoipa annotations
6. **Routes** — Wire all 21 endpoints in `routes/cooperative.rs`
7. **OpenAPI** — Register all schemas + paths in `openapi.rs`
8. **AppState** — Add NF repos + parser service to `AppState` in `lib.rs`
9. **Build & Test Backend** — `cargo clippy`, `cargo test`, fix all warnings/errors
10. **Regenerate OpenAPI Spec** — `cargo run --bin export-openapi-spec` → copy to `frontend/openapi.json` → `npm run generate-client`
11. **Frontend Hooks** — Create 5 hooks in `hooks/non-financial/`
12. **Frontend Components** — Create `NfUploadZone`, `NfParseResults`, 4 grid components
13. **Frontend Page Refactor** — Refactor `NonFinancialDataPage.tsx` to use hooks + components
14. **Build & Test Frontend** — `npm run lint`, `npx tsc --noEmit`, fix all errors
15. **Integration Test** — Upload a real Excel file, verify parse results, verify data in grid, verify CRUD operations