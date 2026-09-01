---
layout: default
title: "Epic 2 Tickets 3+4 — Non-Financial Data Pipeline — Complete Implementation"
nav_order: 2
---

# Epic 2, Tickets 3+4: Non-Financial Data Pipeline — Implementation Report

> **Branch:** `27-epic-2-ticket-3-membership-database-management-us22-members`
> **Base:** `develop`
> **Last Commit:** `d46755d`
> **Date:** 2026-07-10

---

## Table of Contents

1. [Overview](#1-overview)
2. [Backend Infrastructure](#2-backend-infrastructure)
3. [Backend: Entity Layer](#3-backend-entity-layer)
4. [Backend: DTO Layer](#4-backend-dto-layer)
5. [Backend: Repository Layer](#5-backend-repository-layer)
6. [Backend: Handler Layer](#6-backend-handler-layer)
7. [Backend: Routes & OpenAPI](#7-backend-routes--openapi)
8. [Backend: Parser (Excel Upload)](#8-backend-parser-excel-upload)
9. [Backend: Services](#9-backend-services)
10. [Frontend: Types & Constants](#10-frontend-types--constants)
11. [Frontend: Hooks](#11-frontend-hooks)
12. [Frontend: Components](#12-frontend-components)
13. [Frontend: Pages](#13-frontend-pages)
14. [Infrastructure & DevOps](#14-infrastructure--devops)
15. [Bugs Fixed & Root Causes](#15-bugs-fixed--root-causes)
16. [Verification Results](#16-verification-results)
17. [Remaining Work](#17-remaining-work)
18. [Diff Summary](#18-diff-summary)

---

## 1. Overview

This branch implements the **Non-Financial Data Pipeline** covering two tickets:

- **Ticket 3:** Membership/cooperative database management — upload, parse, store, and display non-financial data (membership, savings, loans, fixed deposits, farm cooperatives)
- **Ticket 4:** Data collection UI — Excel upload with validation, data grids with sorting/filtering, inline edit dialogs, and full-replace semantics for re-uploads

The pipeline allows cooperative-level users to upload an Excel workbook containing 5 sheets (NF MSHIP, NF S, NF LOANS, NF FS, NF FARM), validates the data against 5 business rules, stores validated records in the database, and displays them in sortable TanStack Table grids.

---

## 2. Backend Infrastructure

### 2.1 AppState (`backend/src/lib.rs`)

All NF repositories and services are registered in `AppState`:

```
AppState
├── member_repo: MemberRepository
├── savings_account_repo: SavingsAccountRepository
├── loan_repo: LoanRepository
├── fixed_deposit_repo: FixedDepositRepository
├── farm_coop_repo: FarmCoopRepository              ← NEW
├── uploaded_file_repo: UploadedFileRepository
├── storage: ObjectStorageService
├── nf_excel_parser: CalamineNfParser
├── audit: AuditService
├── auth: Arc<JwtValidator>
...
```

### 2.2 Config (`backend/src/config.rs`)

S3 storage is configured via environment:

| Variable | Value | Purpose |
|----------|-------|---------|
| `STORAGE_TYPE` | `s3` (default: `local`) | Storage backend selection |
| `S3_ENDPOINT` | `http://minio:9000` | MinIO API endpoint |
| `S3_BUCKET` | `coopdata` | MinIO bucket name |
| `S3_ACCESS_KEY` | `minioadmin` | MinIO access key |
| `S3_SECRET_KEY` | `minioadmin` | MinIO secret key |

### 2.3 Database Migrations

Two migration files were created:

| File | Purpose |
|------|---------|
| `backend/migrations/14_unique_nf_constraints.sql` | Adds `UNIQUE (cooperative_id, savings_account_id)` constraints to `savings_accounts`, `loans`, `fixed_deposits` tables (required for `ON CONFLICT DO UPDATE` in bulk_upsert) |
| `backend/migrations/15_farm_coop.sql` | Creates `farm_coop` table with 22 data columns + FKs to `cooperatives` and `submissions` |

---

## 3. Backend: Entity Layer

All entities are in `backend/src/entities/` with SeaORM derives (`DeriveEntityModel`, `DeriveRelation`, `ActiveModelBehavior`).

### 3.1 Member (`backend/src/entities/member.rs`)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| cooperative_id | UUID | FK → cooperatives(id) |
| submission_id | UUID? | Nullable, links to submission |
| member_id | String | Business ID (unique per cooperative) |
| join_date | NaiveDate | |
| status | MemberStatus | Enum: Active, Exited, Dormant |
| exit_date | NaiveDate? | Nullable |
| gender | Gender | Enum: Male, Female |
| age_group | AgeGroup | Enum: Under18, Between18And35, Between36And50, Over50 |
| region | EswatiniRegion | Enum: Hhohho, Manzini, Shiselweni, Lubombo |
| urban_rural | UrbanRural | Enum: Urban, Rural |
| agm_attendance | bool | |
| leadership_role | String? | Nullable |
| voting_exercised | bool | |

**Unique constraint:** `UNIQUE (cooperative_id, member_id)`

### 3.2 Savings Account (`backend/src/entities/savings_account.rs`)

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK |
| cooperative_id | UUID | FK → cooperatives(id) |
| member_id | UUID | FK → members(id) |
| submission_id | UUID? | Nullable |
| savings_account_id | String | Business ID |
| account_type | String | |
| account_opening_date | NaiveDate | |
| account_status | String | |
| contribution_frequency | String | |
| ... 8 more columns | | balance, interest_rate, etc. |

**Unique constraint:** `UNIQUE (cooperative_id, savings_account_id)`

### 3.3 Loan (`backend/src/entities/loan.rs`)

21 data columns + metadata. **Unique constraint:** `UNIQUE (cooperative_id, loan_id)`

### 3.4 Fixed Deposit (`backend/src/entities/fixed_deposit.rs`)

15 data columns + metadata. **Unique constraint:** `UNIQUE (cooperative_id, fixed_deposit_id)`

### 3.5 Farm Coop (`backend/src/entities/farm_coop.rs`) ← NEW

22 data columns spanning 6 logical groups:

| Group | Fields |
|-------|--------|
| **General** | cooperative_type, primary_activities, year_of_establishment, operational_status |
| **Producer** | active_producer_flag, production_type, participation_frequency, delivery_compliance, production_cycle_type |
| **Planning** | use_of_production_planning, use_of_shared_inputs, quality_compliance_flag |
| **Market** | market_channel_type, formal_offtake_agreement, buyer_concentration_flag, price_predictability_category |
| **Infrastructure** | access_to_storage, access_to_processing_facilities, transport_coordination |
| **Climate** | climate_exposure_type, irrigation_access, climate_mitigation_practices |

No unique constraint (no natural business key — `cooperative_id` + `submission_id` composite is sufficient).

### 3.6 Entity Module Re-exports (`backend/src/entities/mod.rs`)

All 5 NF entities re-exported with `Column`, `Entity`, and `Model` aliases.

---

## 4. Backend: DTO Layer

**File:** `backend/src/api/dto/non_financial.rs` (720+ lines)

### 4.1 Request DTOs

| DTO | Fields | Purpose |
|-----|--------|---------|
| `CreateMemberRequest` | 12 fields | POST body for manual member creation |
| `UpdateMemberRequest` | 12 Optional fields | PUT body for member update |
| `CreateSavingsAccountRequest` | 15 fields | |
| `UpdateSavingsAccountRequest` | 15 Optional fields | |
| `CreateLoanRequest` | 22 fields | |
| `UpdateLoanRequest` | 22 Optional fields | |
| `CreateFixedDepositRequest` | 16 fields | |
| `UpdateFixedDepositRequest` | 16 Optional fields | |
| `CreateFarmCoopRequest` | 23 fields (incl. submission_id) | |
| `UpdateFarmCoopRequest` | 23 Optional fields (incl. submission_id) | |

### 4.2 Response DTOs

| DTO | Source | Notes |
|-----|--------|-------|
| `MemberResponse` | `From<member::Model>` | All fields + timestamps |
| `SavingsAccountResponse` | `From<savings_account::Model>` | |
| `LoanResponse` | `From<loan::Model>` | |
| `FixedDepositResponse` | `From<fixed_deposit::Model>` | |
| `FarmCoopResponse` | `From<farm_coop::Model>` | All 26 fields (incl. id, cooperative_id, timestamps) |

### 4.3 Common DTOs

| DTO | Fields | Purpose |
|-----|--------|---------|
| `NfUploadResponse` | upload_id, submission_id, sheets_found, rows_parsed, rows_imported, errors, warnings | Upload result returned to frontend |
| `NfListQueryParams` | submission_id (optional), page, page_size | Paginated list query |
| `RowsParsed` | members, savings_accounts, loans, fixed_deposits, farm_coop | Per-entity parsed counts |
| `RowsImported` | members, savings_accounts, loans, fixed_deposits, farm_coop | Per-entity imported counts |
| `PaginatedMembersResponse` | data, page, page_size, total | |
| `PaginatedSavingsAccountsResponse` | | |
| `PaginatedLoansResponse` | | |
| `PaginatedFixedDepositsResponse` | | |
| `PaginatedFarmCoopResponse` | | |

---

## 5. Backend: Repository Layer

### 5.1 Member Repository (`backend/src/repositories/member.rs`)

| Method | Description |
|--------|-------------|
| `find_by_id` | Single record by UUID |
| `find_by_cooperative_id` | Paginated query with optional submission_id filter |
| `create` | Insert single record |
| `update` | Update single record |
| `delete` | Delete by UUID |
| `bulk_upsert` | Insert many with `ON CONFLICT (cooperative_id, member_id) DO UPDATE` |
| `count_by_cooperative` | Count records for a cooperative |
| `find_by_cooperative_and_member_id` | Business-key lookup (member_id within cooperative) |
| `delete_by_cooperative_and_submission` | Bulk delete for full-replace |

### 5.2 Savings Account / Loan / Fixed Deposit Repositories

Same pattern as MemberRepository. Each has `bulk_upsert` with entity-specific `ON CONFLICT` target:
- Savings: `(cooperative_id, savings_account_id)`
- Loan: `(cooperative_id, loan_id)`
- Fixed Deposit: `(cooperative_id, fixed_deposit_id)`

### 5.3 Farm Coop Repository (`backend/src/repositories/farm_coop.rs`) ← NEW

| Method | Description |
|--------|-------------|
| `find_by_id` | Single record by UUID |
| `find_by_cooperative_id` | Paginated with optional submission filter |
| `create` | Insert single record |
| `update` | Update single record |
| `delete` | Delete by UUID |
| `delete_by_cooperative_and_submission` | Bulk delete for full-replace |
| `bulk_insert` | Insert many (no ON CONFLICT — no natural business key) |

### 5.4 Uploaded File Repository (`backend/src/repositories/uploaded_file.rs`)

Tracks uploaded Excel files in the database: `create`, `find_by_id`, `find_by_submission_id`.

---

## 6. Backend: Handler Layer

**File:** `backend/src/api/handlers/non_financial.rs` (1759 lines)

### 6.1 Upload Handler (`upload_non_financial`)

This is the core handler, ~400 lines. Flow:

```
1. Authenticate → extract cooperative_id from JWT claims
2. Parse multipart: file + submission_id
3. Parse Excel via CalamineNfParser (5 sheets)
4. If parse errors → return 201 with errors (no DB writes)
5. Resolve canonical submission_id (ON CONFLICT DO NOTHING → re-query)
6. Check for existing uploaded_file; delete old file from MinIO if found
7. Store new file in MinIO at nf-uploads/{submission_id}/{filename}
8. Create/update uploaded_file DB record
9. CHECK MEMBER COUNT DRIFT: compare parsed vs DB member count → warning if mismatch
10. DELETE existing records for cooperative + submission (full-replace):
    - Savings → Loans → Fixed Deposits → Members → Farm Coops (FK-safe order)
11. BULK UPSERT members (with ON CONFLICT)
12. Build member_map from DB (UUID by member_id)
13. For each savings account:
    - Resolve member_id UUID from member_map
    - Check member belongs to cooperative
    - Bulk upsert
14. Same for loans and fixed deposits
15. BULK INSERT farm coop records
16. Log audit event
17. Return 201 with NfUploadResponse
```

### 6.2 CRUD Handlers

| Entity | List | Get | Create | Update | Delete |
|--------|------|-----|--------|--------|--------|
| Members | GET `/non-financial/members` | GET `/{id}` | POST | PUT `/{id}` | DELETE `/{id}` |
| Savings | GET `/non-financial/savings` | GET `/{id}` | POST | PUT `/{id}` | DELETE `/{id}` |
| Loans | GET `/non-financial/loans` | GET `/{id}` | POST | PUT `/{id}` | DELETE `/{id}` |
| FDs | GET `/non-financial/fixed-deposits` | GET `/{id}` | POST | PUT `/{id}` | DELETE `/{id}` |
| Farm Coops | GET `/non-financial/farm-coop` | GET `/{id}` | POST | PUT `/{id}` | DELETE `/{id}` |

Every CRUD handler:
- Has `#[utoipa::path]` annotation
- Validates cooperative ownership (returns 403 if mismatched)
- Returns proper HTTP status codes (201 CREATE, 204 DELETE, 200 OK, 404 NOT FOUND)
- Logs via `tracing::info!`

### 6.3 Validation Rules Implemented

| Rule | Location | Type | Description |
|------|----------|------|-------------|
| `EXIT_BEFORE_JOIN` | Parser (members sheet) | Hard error | exit_date < join_date → skip record |
| `MATURITY_BEFORE_START` | Parser (loans & FD sheets) | Hard error | maturity_date < start_date → skip record |
| `DPD_STATUS_MISMATCH` | Parser (loans sheet) | Hard error | Performing loan with non-zero DPD → skip |
| `SAVINGS_WITHOUT_MEMBER` | Parser (cross-table) | Hard error | Savings referencing non-existent member → remove |
| `LOAN_WITHOUT_MEMBER` | Parser (cross-table) | Hard error | Loan referencing non-existent member → remove |
| `FIXED_DEPOSIT_WITHOUT_MEMBER` | Parser (cross-table) | Hard error | FD referencing non-existent member → remove |
| `MISSING_HEADERS` | Parser (all sheets) | Hard error | Required header column missing → skip entire sheet |
| `MEMBER_COUNT_DRIFT` | Handler | Warning | Parsed member count ≠ DB member count |

---

## 7. Backend: Routes & OpenAPI

### 7.1 Route Wiring

**File:** `backend/src/api/routes/cooperative.rs`

All NF routes are wired under `/api/v1/cooperative/non-financial/*`:

```
/non-financial/upload             POST
/non-financial/members            GET, POST
/non-financial/members/{id}       GET, PUT, DELETE
/non-financial/savings            GET, POST
/non-financial/savings/{id}       GET, PUT, DELETE
/non-financial/loans              GET, POST
/non-financial/loans/{id}         GET, PUT, DELETE
/non-financial/fixed-deposits     GET, POST
/non-financial/fixed-deposits/{id} GET, PUT, DELETE
/non-financial/farm-coop          GET, POST      ← NEW
/non-financial/farm-coop/{id}     GET, PUT, DELETE  ← NEW
```

### 7.2 OpenAPI Registration

**File:** `backend/src/api/openapi.rs`

- **26 handler paths** registered in `paths(...)`
- **26 schemas** registered in `components(schemas(...))`:
  - 5 CreateRequest DTOs
  - 5 UpdateRequest DTOs
  - 5 Response DTOs
  - 5 PaginatedResponse DTOs
  - 1 NfUploadResponse
  - 1 NfListQueryParams
  - 1 RowsParsed
  - 1 RowsImported
  - 2 parse error/warning types

---

## 8. Backend: Parser (Excel Upload)

**File:** `backend/src/services/nf_excel_parser.rs` (1198 lines)

### 8.1 Architecture

The parser uses the `calamine` crate for Excel reading. Each sheet has an expected header array, and `build_column_map()` validates all required headers are present (case-insensitive, exact match).

### 8.2 Sheet Configuration

| Sheet Constant | Sheet Name | Headers | Parsed Into |
|----------------|-----------|---------|-------------|
| `SHEET_MEMBERS` | `NF MSHIP` | 11 headers | `MemberRecord` |
| `SHEET_SAVINGS` | `NF S` | 14 headers | `SavingsAccountRecord` |
| `SHEET_LOANS` | `NF LOANS` | 21 headers | `LoanRecord` |
| `SHEET_FIXED_DEPOSITS` | `NF FS` | 15 headers | `FixedDepositRecord` |
| `SHEET_FARM_COOP` | `NF FARM` | 22 headers | `FarmCoopRecord` |

### 8.3 Record Structs

| Struct | Fields | Notes |
|--------|--------|-------|
| `MemberRecord` | 11 fields | member_id, join_date, status, exit_date, gender, age_group, region, urban_rural, agm_attendance, leadership_role, voting_exercised |
| `SavingsAccountRecord` | 14 fields | member_id, savings_account_id, account_type, ..., balance (Decimal) |
| `LoanRecord` | 21 fields | member_id, loan_id, ..., balance, loan_amount |
| `FixedDepositRecord` | 15 fields | member_id, fixed_deposit_id, ..., balance |
| `FarmCoopRecord` | 22 fields | cooperative_type, primary_activities, year_of_establishment, ..., climate_mitigation_practices |

### 8.4 Cell Parsers

| Function | Input | Output | Sources |
|----------|-------|--------|---------|
| `get_string_cell` | `Data` | `Option<String>` | String, Int, Float, DateTime (formatted) |
| `get_optional_string_cell` | `Data` | `Option<Option<String>>` | Empty → None, else string |
| `get_date_cell` | `Data` | `Option<NaiveDate>` | DateTime, DateTimeIso, String (multiple formats) |
| `get_optional_date_cell` | `Data` | `Option<Option<NaiveDate>>` | Empty → None |
| `get_bool_cell` | `Data` | `Option<bool>` | Bool, String ("true"/"yes"/"1"), Int, Float |
| `get_int_cell` | `Data` | `Option<i32>` | Int, Float, String |
| `get_decimal_cell` | `Data` | `Option<Decimal>` | Int, Float, String (via from_str_exact) |

### 8.5 Header-Based Column Lookup

Refactored from hardcoded positional indices to header-based lookup:

```rust
fn build_column_map(
    header_row: &[Data],
    expected: &[&str],
    sheet_name: &str,
    result: &mut NfParseResult,
) -> Option<HashMap<String, usize>> {
    // 1. Build map of lowercased header → index
    // 2. Check each expected header exists
    // 3. If any missing → push MISSING_HEADERS error, return None
    // 4. Return Ok(map)
}
```

### 8.6 Cross-Table Validations (`run_cross_table_validations`)

After all 5 sheets are parsed, cross-table validation runs:
1. Build `member_map: HashMap<String, bool>` from parsed members
2. For each savings account → check `member_business_id` exists → orphan removal
3. For each loan → same
4. For each fixed deposit → same

### 8.7 Unit Tests (9 tests)

| Test | What It Validates |
|------|-------------------|
| `test_calamine_parser_creates` | Parser constructor works |
| `test_get_string_cell_string` | String cell reading |
| `test_get_string_cell_empty` | Empty cell → None |
| `test_get_bool_cell_string_true` | Parses "true" → Some(true) |
| `test_get_int_cell` | Int cell → Some(42) |
| `test_get_date_cell_iso` | Date string → NaiveDate |
| `test_build_column_map_success` | All headers present → Some(map) |
| `test_build_column_map_missing_header` | Missing header → error |
| `test_build_column_map_case_insensitive` | "Member_ID" matches "member_id" |

---

## 9. Backend: Services

### 9.1 Object Storage (`backend/src/services/object_storage.rs`)

Dual backend (S3/Local):

| Method | Description |
|--------|-------------|
| `new` | Reads config, initializes S3 client or local filesystem |
| `put_object` | Upload file to storage (path: `{prefix}/{submission_id}/{filename}`) |
| `get_object` | Download file from storage |
| `delete_object` | Remove file from storage |

Storage prefix for NF uploads: `nf-uploads/`

### 9.2 Audit Service (`backend/src/services/audit.rs`)

Logs all NF upload operations with:
- Actor UUID (from JWT `sub`)
- Cooperative ID
- Action type (`non_financial_upload`)
- Metadata (member/savings/loan/fd/farm_coop import counts)
- IP address and user agent

---

## 10. Frontend: Types & Constants

### 10.1 TypeScript Types (`frontend/src/types/non-financial.ts`)

289 lines of hand-written types (OpenAPI client not regenerated):

| Interface | Fields | Notes |
|-----------|--------|-------|
| `MemberResponse` | 15 fields | matches entity |
| `SavingsAccountResponse` | 16 fields | |
| `LoanResponse` | 23 fields | |
| `FixedDepositResponse` | 17 fields | |
| `FarmCoopResponse` | 26 fields | id, cooperative_id, submission_id, 22 data fields, created_at, updated_at |
| `NfUploadResponse` | 7 fields | upload_id, submission_id, sheets_found, rows_parsed, rows_imported, errors, warnings |
| `PaginatedResponse<T>` | data, page, page_size, total | Generic paginated wrapper |
| `NfListParams` | submission_id?, page, page_size | |

Related request interfaces: `CreateMemberRequest`, `UpdateMemberRequest`, etc.

---

## 11. Frontend: Hooks

All hooks in `frontend/src/hooks/non-financial/`. Each uses TanStack Query (`useQuery`/`useMutation`) with raw `fetch()` calling the backend.

### 11.1 Hook Inventory

| File | Exports | Operations |
|------|---------|------------|
| `useMembers.ts` | `useMembers`, `useMember`, `useCreateMember`, `useUpdateMember`, `useDeleteMember` | List, Get by ID, Create, Update, Delete |
| `useSavings.ts` | `useSavings`, `useSaving`, `useCreateSavings`, `useUpdateSavings`, `useDeleteSavings` | List, Get by ID, Create, Update, Delete |
| `useLoans.ts` | `useLoans`, `useLoan`, `useCreateLoan`, `useUpdateLoan`, `useDeleteLoan` | List, Get by ID, Create, Update, Delete |
| `useFixedDeposits.ts` | `useFixedDeposits`, `useFixedDeposit`, `useCreateFixedDeposit`, `useUpdateFixedDeposit`, `useDeleteFixedDeposit` | List, Get by ID, Create, Update, Delete |
| `useFarmCoop.ts` | `useFarmCoops`, `useFarmCoop`, `useCreateFarmCoop`, `useUpdateFarmCoop`, `useDeleteFarmCoop` | List, Get by ID, Create, Update, Delete |
| `useNfUpload.ts` | `useNfUpload` | Upload mutation (file + submission_id → NfUploadResponse) |

### 11.2 Pattern

```typescript
export const useMembers = (params?: NfListParams) =>
  useQuery({
    queryKey: [NF_MEMBERS_KEY, params],
    queryFn: () => fetchMembers(params),
  });
```

Each mutation invalidates its query key on success to trigger automatic refresh.

### 11.3 Auth Integration

All hooks use `getAccessToken()` from `@/services/shared/authService` to inject `Authorization: Bearer <token>` into requests. Token refresh is handled transparently by the Keycloak auth layer.

---

## 12. Frontend: Components

### 12.1 DataTable (`frontend/src/components/ui/data-table.tsx`)

Enhanced with `getRowClassName` prop for row-level styling:

```tsx
interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  emptyMessage?: string;
  pageSize?: number;
  getRowClassName?: (row: TData) => string | undefined;  // ← NEW
}
```

Uses `@tanstack/react-table` with built-in sorting (client-side).

### 12.2 Column Definitions (4 + 1 new files)

**Pattern:** Each entity has a `XColumns.tsx` file exporting `createXColumns(actions?)`:

| File | Columns | Key Features |
|------|---------|-------------|
| `MemberColumns.tsx` | 9 + actions | Badge for status (Active/Exited/Dormant) |
| `SavingsColumns.tsx` | 10 + actions | formatCurrency for balance (SZL) |
| `LoanColumns.tsx` | 11 + actions | Status badge: Performing(default), Arrears(destructive), Restructured(secondary) |
| `FixedDepositColumns.tsx` | 10 + actions | |
| `FarmCoopColumns.tsx` | 22 + actions ← NEW | BoolIcon (Check/X) for booleans |

**SortableHeader:** Click-to-sort column headers using TanStack's `column.getToggleSortingHandler()`.

### 12.3 Grid Components (4 + 1 new files)

| File | Props | Features |
|------|-------|----------|
| `MemberGrid.tsx` | members, isLoading, isReadOnly, errorRowIds, onEdit, onDelete | Card + DataTable + error highlighting |
| `SavingsGrid.tsx` | savings, ... | Same pattern |
| `LoanGrid.tsx` | loans, ... | Same pattern |
| `FixedDepositGrid.tsx` | fixedDeposits, ... | Same pattern |
| `FarmCoopGrid.tsx` | farmCoops, ... ← NEW | Same pattern |

All grids:
- Show loading spinner via `isLoading`
- Show empty state message
- Support `errorRowIds` for red background highlighting (`bg-destructive/5`)
- Support read-only mode (no action buttons)

### 12.4 Upload Zone (`frontend/src/components/non-financial/NfUploadZone.tsx`)

- **Drag-and-drop** support with visual feedback (scale, border color)
- Click-to-select via hidden `<input>`
- File validation: `.xlsx`/`.xls` only, max 50 MB
- Upload progress via `uploadMutation.isPending`
- Reset button after file selection
- Displays expected sheet names

### 12.5 Parse Results (`frontend/src/components/non-financial/NfParseResults.tsx`)

- Sheets found displayed as badges
- Stat boxes for each entity (imported / parsed)
- Error table (scrollable): sheet, row, column, rule, message
- Warning list (scrollable)
- Success state with green checkmark

### 12.6 Form Dialog (`frontend/src/components/non-financial/NfFormDialog.tsx`)

Generic RHF + Zod form dialog for manual record creation/editing:

```tsx
interface NfFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  fields: FieldConfig[];
  defaultValues: Record<string, any>;
  onSubmit: (values: Record<string, any>) => Promise<void>;
}
```

Supporting field types:
- `text` — standard Input
- `number` — Input with `type="number"`, step 0.01
- `date` — Input with `type="date"`
- `select` — SelectTrigger + SelectItem (with options array)

---

## 13. Frontend: Pages

### 13.1 DataCollectionPage (`frontend/src/pages/cooperative/DataCollectionPage.tsx`)

745 lines. Main cooperative view with:
- Quick stats cards (4/5 databases ready, total records, next deadline)
- Financial statement upload section
- 5 tabs for NF data: Membership, Savings, Loans, Fixed Deposits, Farm Coop
- Each tab shows the entity grid + FilingGuideline

**Data flow:**
```
Page mounts → useQuery hooks fire → 5 parallel API calls → data populates 5 grids
Upload completes → invalidates query keys → grids auto-refresh
```

### 13.2 NonFinancialDataPage (`frontend/src/pages/cooperative/NonFinancialDataPage.tsx`)

Alternate page used by ministry/apex/federation roles (read-only view). Same grid components but no upload zone.

---

## 14. Infrastructure & DevOps

### 14.1 Docker Compose

Services:
- `postgres` — PostgreSQL 15 (port 5432)
- `keycloak` — Keycloak 26 (port 8180)
- `minio` — S3-compatible object storage (port 9100 API, 9101 console)
- `backend` — Axum Rust backend (port 3000)
- `frontend` — Vite React app (port 5173)

### 14.2 MinIO Configuration

- **Bucket:** `coopdata`
- **Upload path:** `nf-uploads/{submission_id}/{filename}`
- **Credentials:** `minioadmin` / `minioadmin`

### 14.3 Keycloak Configuration

| Setting | Value |
|---------|-------|
| Realm | `coop-data` |
| Backend client | `coopdata-backend` (confidential, client_secret) |
| Frontend client | `coopdata-frontend` (public) |
| Backend URL | `http://keycloak:8180` |
| JWT Audience | `coopdata-backend` |
| Test user | `test@coop.coop` / `test1234` (cooperative role) |
| Ministry user | `admin@ministry.gov` / `admin@ministry.gov` (ministry role) |

### 14.4 Environment Files

Root `.env` (shared):
```
KEYCLOAK_CLIENT_SECRET=lJRztBhc6IQSkbF5bxmlhGwsKH12gqen
STORAGE_TYPE=s3
KEYCLOAK_URL=http://keycloak:8180
```

Backend `.env`:
```
KEYCLOAK_CLIENT_ID=coopdata-backend
KEYCLOAK_CLIENT_SECRET=lJRztBhc6IQSkbF5bxmlhGwsKH12gqen
KEYCLOAK_REALM=coop-data
KEYCLOAK_URL=http://localhost:8180
DATABASE_URL=postgres://coopdata:password@localhost:5432/coopdata
```

---

## 15. Bugs Fixed & Root Causes

### 15.1 Backend 502 on Federations Page

**Root cause:** Root `.env` had `KEYCLOAK_CLIENT_SECRET=**********` (literal asterisks) instead of the real secret. The backend used the `coopdata-backend` client's `client_credentials` grant to get an admin token — wrong secret caused 401 from Keycloak → 502 to frontend.

**Fix:** Set `KEYCLOAK_CLIENT_SECRET=lJRztBhc6IQSkbF5bxmlhGwsKH12gqen` in root `.env`.

### 15.2 MinIO Not Storing Uploads

**Root cause:** `STORAGE_TYPE` defaulted to `local`, using the container's ephemeral filesystem. Files were lost on container restart.

**Fix:** Created `coopdata` bucket in MinIO, set `STORAGE_TYPE=s3` in `.env`.

### 15.3 MinIO File Duplication on Re-Upload

**Root cause:** The frontend generates a new UUID for `submission_id` on each upload. The handler used this new UUID for the storage key, creating a new file each time. Old files were never cleaned up.

**Fix:** 
1. Resolve canonical submission_id from DB first (`ON CONFLICT DO NOTHING` → re-query)
2. Check if `uploaded_file` record exists for submission + filename
3. Delete old file from MinIO if exists
4. Upload new file with resolved submission_id
5. Update existing DB record (same `upload_id`) or create new

### 15.4 `n.toFixed is not a function` Frontend Error

**Root cause:** Backend serializes `Decimal` fields as strings (e.g., `"2500.00"`). The frontend's `reduce((sum, s) => sum + s.balance, 0)` performed string concatenation instead of numeric addition.

**Fix:** Wrapped `balance` with `Number()` in three `reduce` calls (savings, loans, fixed deposits).

### 15.5 Member ID Mapping Bug

**Root cause:** `member_map` was populated with generated UUIDs *before* `bulk_upsert`. But `ON CONFLICT DO UPDATE` preserves existing DB UUIDs, so the pre-generated UUID in the map didn't match the actual stored UUID.

**Fix:** Re-query member UUIDs from DB *after* `bulk_upsert` succeeds, then build `member_map`.

### 15.6 `uploaded_files` FK Constraint Violation

**Root cause:** When deleting existing submissions (during full-replace cleanup), the `uploaded_files` table had FK references to the submission, causing `violates foreign key constraint uploaded_files_submission_id_fkey`.

**Fix:** Reordered operations in the handler: upload the new file to MinIO first, create/update the `uploaded_file` record, THEN delete old NF data records (which still reference the submission but not via FK).

### 15.7 Template Age Group Values Wrong

**Root cause:** Template had `18-25` and `26-35` as age group values. The backend enum expects `18-35` and `36-50` (Between18And35, Between36And50).

**Fix:** Changed template age groups to `18-35` and `36-50`.

---

## 16. Verification Results

### 16.1 Upload Test (201 Created)

```
{
  "upload_id": "94dbb94c-37c1-44d3-a52b-a3d279b5d763",
  "submission_id": "a0627b47-fef7-4d9c-95b9-9e344a871e5d",
  "sheets_found": ["NF MSHIP", "NF S", "NF LOANS", "NF FS", "NF FARM"],
  "rows_parsed": { "members": 2, "savings_accounts": 2, "loans": 2, "fixed_deposits": 2, "farm_coop": 2 },
  "errors": [],
  "warnings": [],
  "rows_imported": { "members": 2, "savings_accounts": 2, "loans": 2, "fixed_deposits": 2, "farm_coop": 2 }
}
```

### 16.2 Full-Replace Verification

Second upload with same data returns same counts — no duplicate accumulation.

### 16.3 GET Endpoints

All 5 list endpoints return 2 records each with full field population:
- Members: M001 (Male/18-35/Hhohho/Urban) + M002 (Female/36-50/Manzini/Rural)
- Savings: SAV001 (Voluntary/2500) + SAV002 (Mandatory/5000)
- Loans: LN001 (Agricultural/15000) + LN002 (SME/8000)
- FDs: FD001 (Fixed Term/10000) + FD002 (Fixed Term/5000)
- Farm Coops: Farmer Cooperative (2010/Mixed Farming) + Farming Cooperative (2018/Vegetable Farming)

### 16.4 MinIO Storage

File stored at: `nf-uploads/a0627b47-fef7-4d9c-95b9-9e344a871e5d/nf_template.xlsx`

### 16.5 Backend Health

`GET /api/v1/health` → `{"status": "healthy"}`

### 16.6 Test Coverage

| Area | Test Count | Scope |
|------|-----------|-------|
| Parser | 9 unit tests | Cell helpers, build_column_map |
| Handler | 3 unit tests | empty_rows_imported, parse_uploaded_by |
| Auth | 20+ tests | Claims, roles, org resolution |
| Error handling | 12+ tests | All AppError variants |
| Config | 3 tests | Environment detection |
| RBAC | 5 tests | Role guards, constants |
| Frontend auth service | 40+ tests | Login, logout, token, roles |
| Frontend AuthContext | 15+ tests | Provider, auth state |
| Frontend roles | 20+ tests | Nav, dashboard, hierarchy |

### 16.7 Frontend Build

`npm run build` passes in ~8 seconds with 0 errors.

---

## 17. Remaining Work

### 17.1 Medium Priority

1. **Add `year_of_establishment` to `FARM_COOP_HEADERS`** — Currently `year_of_establishment` is parsed via fallback (`map.get("year_of_establishment").unwrap_or(&usize::MAX)`). Adding it to the `FARM_COOP_HEADERS` constant would validate it as a required column. Template already includes it.

2. **Hooks test `test_empty_rows_imported`** — Does not verify the `farm_coop` field. Should add `assert_eq!(r.farm_coop, 0)`.

### 17.2 Low Priority

3. **Regenerate OpenAPI client** — All frontend hooks use raw `fetch()`. Running `npm run update-client` would regenerate the OpenAPI client from the backend spec, but then all hooks need migration to use the generated client.

4. **Column visibility toggle** — Farm Coop has 22 columns. A column visibility toggle would help users focus on relevant fields.

---

## 18. Diff Summary

**36 files changed, +9684 / -2586 lines** across branches

### Backend (17 files)

| File | Change | Lines |
|------|--------|-------|
| `src/api/dto/non_financial.rs` | Added FarmCoop DTOs (+175 lines) | +175 |
| `src/api/handlers/non_financial.rs` | Added FarmCoop 5 CRUD handlers, full-replace delete | +234/-0 |
| `src/api/openapi.rs` | Registered FarmCoop paths + schemas | +9 |
| `src/api/routes/cooperative.rs` | Wired FarmCoop routes | +10 |
| `src/entities/mod.rs` | FarmCoop re-export | +4 |
| `src/entities/farm_coop.rs` | **New entity file** | +59 |
| `src/lib.rs` | Added farm_coop_repo to AppState | +7 |
| `src/main.rs` | FarmCoopRepository construction | +4 |
| `src/repositories/mod.rs` | FarmCoopRepository re-export | +2 |
| `src/repositories/farm_coop.rs` | **New repository file** | +93 |
| `src/services/nf_excel_parser.rs` | NF FARM sheet parsing, header-based lookup refactor | +162/-0 |
| `migrations/14_unique_nf_constraints.sql` | **New migration** | +8 |
| `migrations/15_farm_coop.sql` | **New migration** | +35 |

### Frontend (18 files)

| File | Change | Lines |
|------|--------|-------|
| `components/non-financial/FarmCoopColumns.tsx` | **New — 22 columns** | +163 |
| `components/non-financial/FarmCoopGrid.tsx` | **New — TanStack DataTable** | +52 |
| `hooks/non-financial/useFarmCoop.ts` | **New — CRUD + list hooks** | +129 |
| `components/non-financial/NfParseResults.tsx` | Added FarmCoop stat box | +5 |
| `components/non-financial/NfUploadZone.tsx` | Drag-and-drop support | +18/-0 |
| `components/non-financial/MemberGrid.tsx` | TanStack rewrite | +8/-4 |
| `components/non-financial/SavingsGrid.tsx` | TanStack rewrite | +8/-4 |
| `components/non-financial/LoanGrid.tsx` | TanStack rewrite | +4/-2 |
| `components/non-financial/FixedDepositGrid.tsx` | TanStack rewrite | +8/-4 |
| `components/non-financial/MemberColumns.tsx` | TanStack column defs | +8/-0 |
| `components/non-financial/SavingsColumns.tsx` | TanStack column defs | +8/-0 |
| `components/non-financial/LoanColumns.tsx` | TanStack column defs | +4/-0 |
| `components/non-financial/FixedDepositColumns.tsx` | TanStack column defs | +8/-0 |
| `components/non-financial/NfFormDialog.tsx` | RHF+Zod form dialog | +35/-15 |
| `types/non-financial.ts` | FarmCoop types | +59 |
| `pages/cooperative/DataCollectionPage.tsx` | FarmCoop tab + edit handlers | +89/-16 |
| `pages/cooperative/NonFinancialDataPage.tsx` | FarmCoop tab | +47/-0 |

### Infrastructure

| File | Change |
|------|--------|
| `nf_template.xlsx` | Regenerated with 5 sheets including NF FARM |
| `.env` | KEYCLOAK_CLIENT_SECRET + STORAGE_TYPE=s3 |

---

Generated: 2026-07-10
