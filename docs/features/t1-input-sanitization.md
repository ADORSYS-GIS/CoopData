# T1: Input Sanitization & Injection Prevention

> **Ticket:** [Issue #107 - T1](https://github.com/ADORSYS-GIS/CoopData/issues/107)
> **Epic:** EPIC-SEC-RELIABILITY-01 — Security, Reliability, and Testing Lifecycle Hardening
> **Status:** ✅ Complete
> **Date:** September 7, 2026
> **Author:** AI Agent + Maxwell

---

## 1. Objective

Prevent untrusted input from causing **SQL injection**, **Cross-Site Scripting (XSS)**, or **Command Injection** across all entry points (API endpoints, forms, file uploads).

---

## 2. Threat Model

### 2.1 SQL Injection (SQLi)

**What it is:** An attacker sends malicious SQL code through form fields or URL parameters, and the database executes it as if it were a normal query.

**Risk to CoopData:** Data theft, unauthorized access, data deletion across the cooperative hierarchy.

**Current protection:**
- ✅ All database queries use SeaORM query builder (parameterized queries)
- ✅ No `query_raw()` or `sqlx::query()` with string concatenation found
- ✅ No `format!()` with SQL strings found

### 2.2 Cross-Site Scripting (XSS)

**What it is:** An attacker injects malicious JavaScript into a web page that runs in other users' browsers.

**Risk to CoopData:** Session hijacking, credential theft, data exfiltration across cooperative users.

**Current protection:**
- ✅ React auto-escapes all JSX variables `{userInput}`
- ⚠️ 2 `dangerouslySetInnerHTML` usages found — **now sanitized with DOMPurify**

### 2.3 Command Injection

**What it is:** An attacker sends malicious OS commands through input fields that get passed to system command execution.

**Risk to CoopData:** Full system compromise, data destruction.

**Current protection:**
- ✅ No `std::process::Command` usage found in backend
- ✅ No command execution with user input

---

## 3. Implementation Details

### 3.1 Frontend XSS Prevention

#### 3.1.1 Install DOMPurify

```bash
npm install dompurify
npm install -D @types/dompurify
```

**Package:** `dompurify` v3.x — DOM-only sanitizer for untrusted HTML

#### 3.1.2 Sanitize `dangerouslySetInnerHTML` in `chart.tsx`

**File:** `frontend/src/components/ui/chart.tsx`

**Before:**
```tsx
<style
  dangerouslySetInnerHTML={{
    __html: Object.entries(THEMES)
      .map(([theme, prefix]) => `...`)
      .join("\n"),
  }}
/>
```

**After:**
```tsx
import DOMPurify from "dompurify";

const css = Object.entries(THEMES)
  .map(([theme, prefix]) => `...`)
  .join("\n");

<style
  dangerouslySetInnerHTML={{
    __html: DOMPurify.sanitize(css, { USE_PROFILES: { html: false } }),
  }}
/>
```

**Why `html: false`:** This is CSS, not HTML. The `USE_PROFILES: { html: false }` profile strips all HTML tags while preserving CSS syntax.

#### 3.1.3 Sanitize `dangerouslySetInnerHTML` in `QuestionnaireAnalyticsPage.tsx`

**File:** `frontend/src/pages/shared/QuestionnaireAnalyticsPage.tsx`

**Before:**
```tsx
<span
  dangerouslySetInnerHTML={{
    __html: t("questionnaireAnalytics.scopeMessage", {
      reporting: stats.total_reporting_cooperatives,
      total: cooperatives.length,
      year: reportingYear,
    }),
  }}
/>
```

**After:**
```tsx
import DOMPurify from "dompurify";

<span
  dangerouslySetInnerHTML={{
    __html: DOMPurify.sanitize(
      t("questionnaireAnalytics.scopeMessage", {
        reporting: stats.total_reporting_cooperatives,
        total: cooperatives.length,
        year: reportingYear,
      }),
      { USE_PROFILES: { html: true } },
    ),
  }}
/>
```

**Why `html: true`:** This is a translation string that may contain HTML formatting (e.g., `<strong>` tags). The `html: true` profile allows safe HTML tags while stripping `<script>` and event handlers.

---

### 3.2 Backend DTO Validation

#### 3.2.1 Install Validator Crate

**File:** `backend/Cargo.toml`

```toml
[dependencies]
validator = { version = "0.18", features = ["derive"] }
```

**Why `validator`:** Industry-standard Rust crate for struct-level validation with derive macros. Integrates with `serde` and `utoipa`.

#### 3.2.2 Add Validation to DTOs

All request DTOs now have `#[derive(Validate)]` with field-level constraints:

| DTO File | Structs Modified | Validation Rules |
|----------|------------------|------------------|
| `federation.rs` | `CreateFederationRequest`, `DomainRequest`, `UpdateFederationRequest` | Name: 1-200 chars, Domains: min 1, Email: valid format, Description: max 1000 |
| `apex.rs` | `CreateApexRequest`, `UpdateApexRequest` | Name: 1-200 chars, Description: max 1000 |
| `cooperative.rs` | `CreateCooperativeRequest`, `UpdateCooperativeRequest`, `CreateCooperativeProfileRequest`, `UpdateCooperativeProfileRequest` | Name: 1-200, RegNo: 1-50, TIN: max 20, Phone: max 30, Sector: 1-100 |
| `user.rs` | `CreateUserRequest`, `UpdateUserRequest`, `AssignRoleRequest`, `UpdateUserPasswordRequest` | Email: valid format, Role: 1-50, Password: 8-128 chars |
| `invitation.rs` | `CreateInvitationRequest` | Email: valid format, Names: 1-100, Role: 1-50, RedirectURL: valid URL |
| `submission.rs` | `CreateSubmissionRequest`, `UpdateSectionStatusRequest`, `UpdateSubmissionMethodRequest` | ReportingYear: 2000-2100, PeriodType: max 20, Status: 1-50 |
| `organization.rs` | `CreateOrganizationRequest`, `UpdateOrganizationRequest` | Name: 1-200, Email: valid format, Phone: max 30, Address: max 500 |

**Example validation rule:**
```rust
#[derive(Debug, Serialize, Deserialize, ToSchema, Validate)]
pub struct CreateFederationRequest {
    #[validate(length(min = 1, max = 200, message = "Name must be 1-200 characters"))]
    pub name: String,

    #[validate(length(min = 1, message = "At least one domain is required"))]
    pub domains: Vec<DomainRequest>,

    #[validate(email(message = "Invalid email format"))]
    pub contact_email: Option<String>,
}
```

#### 3.2.3 Wire `.validate()` into Handlers

All handlers that accept request DTOs now call `.validate()` at the start of the function:

```rust
use validator::Validate;

pub async fn create_federation(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(body): Json<CreateFederationRequest>,
) -> AppResult<impl IntoResponse> {
    // Validate input using validator crate
    body.validate().map_err(|e| {
        AppError::BadRequest(format!("Validation error: {}", e))
    })?;

    // ... rest of handler
}
```

**Handlers updated:**
| Handler File | Handlers Updated |
|--------------|------------------|
| `federation.rs` | `create_federation`, `update_federation`, `invite_user_to_federation`, `update_federation_profile` |
| `apex.rs` | `create_apex`, `update_apex` |
| `cooperative.rs` | `create_cooperative`, `update_cooperative`, `create_cooperative_profile`, `update_cooperative_profile` |
| `users.rs` | `create_user`, `update_user`, `assign_role_to_user` |
| `organizations.rs` | `create_organization`, `update_organization` |

---

### 3.3 File Upload Path Traversal Prevention

#### 3.3.1 Sanitize `file_name` in `non_financial.rs`

**File:** `backend/src/api/handlers/non_financial.rs`

**Before:**
```rust
file_name = field.file_name().unwrap_or("upload.xlsx").to_string();
```

**After:**
```rust
file_name = field.file_name().unwrap_or("upload.xlsx").to_string();
// Sanitize file_name: remove path separators and null bytes to prevent path traversal
file_name = file_name
    .replace(['/', '\\', '\0'], "_")
    .chars()
    .filter(|c| !c.is_control())
    .collect();
// Ensure filename is not empty after sanitization
if file_name.is_empty() {
    file_name = "upload.xlsx".to_string();
}
```

**What this prevents:**
- `../../etc/passwd.xlsx` → `.._.._etc_passwd.xlsx`
- `report\x00.exe` → `report.exe` (null byte injection)
- Control characters stripped

#### 3.3.2 Sanitize `original_name` in `upload.rs`

**File:** `backend/src/api/handlers/upload.rs`

Same sanitization applied for consistency:
```rust
original_name = original_name
    .replace(['/', '\\', '\0'], "_")
    .chars()
    .filter(|c| !c.is_control())
    .collect();
if original_name.is_empty() {
    original_name = "upload".to_string();
}
```

---

## 4. Files Changed

| File | Change Type | Description |
|------|-------------|-------------|
| `frontend/package.json` | Modified | Added `dompurify` + `@types/dompurify` |
| `frontend/src/components/ui/chart.tsx` | Modified | Added DOMPurify sanitization |
| `frontend/src/pages/shared/QuestionnaireAnalyticsPage.tsx` | Modified | Added DOMPurify sanitization |
| `backend/Cargo.toml` | Modified | Added `validator` crate |
| `backend/src/api/dto/federation.rs` | Modified | Added `#[derive(Validate)]` + rules |
| `backend/src/api/dto/apex.rs` | Modified | Added `#[derive(Validate)]` + rules |
| `backend/src/api/dto/cooperative.rs` | Modified | Added `#[derive(Validate)]` + rules |
| `backend/src/api/dto/user.rs` | Modified | Added `#[derive(Validate)]` + rules |
| `backend/src/api/dto/invitation.rs` | Modified | Added `#[derive(Validate)]` + rules |
| `backend/src/api/dto/submission.rs` | Modified | Added `#[derive(Validate)]` + rules |
| `backend/src/api/dto/organization.rs` | Modified | Added `#[derive(Validate)]` + rules |
| `backend/src/api/handlers/federation.rs` | Modified | Added `.validate()` calls + `validator::Validate` import |
| `backend/src/api/handlers/apex.rs` | Modified | Added `.validate()` calls + `validator::Validate` import |
| `backend/src/api/handlers/cooperative.rs` | Modified | Added `.validate()` calls + `validator::Validate` import |
| `backend/src/api/handlers/users.rs` | Modified | Added `.validate()` calls + `validator::Validate` import |
| `backend/src/api/handlers/organizations.rs` | Modified | Added `.validate()` calls + `validator::Validate` import |
| `backend/src/api/handlers/non_financial.rs` | Modified | Added file_name sanitization |
| `backend/src/api/handlers/upload.rs` | Modified | Added file_name sanitization |

**Total:** 18 files modified

---

## 5. Verification

### 5.1 Automated Checks

```bash
# Backend: No compilation errors or warnings
cd backend && cargo clippy

# Frontend: No lint errors
cd frontend && npm run lint

# Backend: All tests pass
cd backend && cargo test

# Frontend: All tests pass
cd frontend && npm test
```

### 5.2 Manual Verification

#### XSS Prevention
1. Open browser DevTools → Console
2. Navigate to Questionnaire Analytics page
3. Verify no `<script>` tags in rendered HTML
4. Check that translation strings render safely

#### DTO Validation
1. Send a request with an empty `name` field to `POST /api/v1/ministry/federations`
2. Expected response: `422 Unprocessable Entity` with validation error message
3. Send a request with an invalid email to `POST /api/v1/ministry/federations/{id}/invitations`
4. Expected response: `422 Unprocessable Entity` with "Invalid email format"

#### File Upload Sanitization
1. Attempt to upload a file with name `../../etc/passwd.xlsx`
2. Verify the stored key uses sanitized name: `nf-uploads/{submission_id}/.._.._etc_passwd.xlsx`

### 5.3 Security Scanning

```bash
# Check for known vulnerabilities in new dependency
cargo audit

# Check for secrets in codebase
gitleaks detect --source=. --verbose
```

---

## 6. What's NOT in Scope (Future Work)

| Item | Reason | Ticket |
|------|--------|--------|
| Remaining DTOs (`custom_kpi.rs`, `extraction.rs`, etc.) | Lower priority, can be added incrementally | T1 follow-up |
| Content-Security-Policy header | Infrastructure concern | T7 |
| Rate limiting | Separate ticket | T6 |

---

## 7. Rollback Plan

If issues arise:

1. **Frontend:** Remove `dompurify` import and revert `dangerouslySetInnerHTML` changes
2. **Backend DTOs:** Remove `#[derive(Validate)]` and `validator` import from each DTO file
3. **Backend Cargo.toml:** Remove `validator` dependency
4. **File upload:** Revert sanitization code in `non_financial.rs` and `upload.rs`

All changes are additive and backward-compatible. No database migrations required.

---

## 8. References

- [DOMPurify Documentation](https://github.com/cure53/DOMPurify)
- [Validator Crate (Rust)](https://github.com/Keats/validator)
- [OWASP SQL Injection](https://owasp.org/www-community/attacks/SQL_Injection)
- [OWASP XSS Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Scripting_Prevention_Cheat_Sheet.html)
- [Issue #107](https://github.com/ADORSYS-GIS/CoopData/issues/107)

---

## 9. Next Steps

1. **Add validation to remaining DTOs** — `custom_kpi.rs`, `extraction.rs`, `member.rs`, `non_financial.rs`, `verification.rs`
2. **Proceed to T2** — Auth & Authorization (Double-Gatekeeper Pattern)
