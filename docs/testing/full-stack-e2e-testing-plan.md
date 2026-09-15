# Full-Stack E2E Testing Plan — Submission Workflows

> **Purpose**: Document the comprehensive end-to-end testing strategy for CoopData submission workflows.
> **Scope**: Happy path testing first, then unhappy paths.
> **Approach**: Test each submission method (Upload, Manual, Questionnaire) across all Reporting Frequencies.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Test Environment Setup](#2-test-environment-setup)
3. [Test Data Requirements](#3-test-data-requirements)
4. [Happy Path Testing Matrix](#4-happy-path-testing-matrix)
5. [Route 1: Upload Method](#5-route-1-upload-method)
6. [Route 2: Manual Entry Method](#6-route-2-manual-entry-method)
7. [Route 3: Questionnaire Method](#7-route-3-questionnaire-method)
8. [Approval Workflow Tests](#8-approval-workflow-tests)
9. [Reporting Frequency Categories](#9-reporting-frequency-categories)
10. [Implementation Order](#10-implementation-order)
11. [Future: Unhappy Path Testing](#11-future-unhappy-path-testing)
12. [Test Specifications](#12-test-specifications)

---

## 1. Overview

### Testing Philosophy

We test the **real full stack**:
```
Browser (Playwright) → Real Backend (Rust API) → Real Database (PostgreSQL)
```

This ensures:
- ✅ Frontend UI works correctly
- ✅ Backend API validates properly
- ✅ Database stores data correctly
- ✅ Business logic (approval workflow) functions end-to-end

### Submission Methods

| Method | Route | Description |
|--------|-------|-------------|
| **Upload** | `/app/financial-statement/upload` | Upload PDF/Excel files, AI extracts data |
| **Manual Entry** | `/app/financial-statement/manual` | Fill form fields manually |
| **Questionnaire** | `/app/questionnaire` | Dynamic form based on template |

### Reporting Frequencies

| Frequency | Code | Description | Test Priority |
|-----------|------|-------------|---------------|
| **Yearly** | `YEARLY` | Annual reporting | 🔴 Primary (first) |
| **Quarterly** | `QUARTERLY` | Q1, Q2, Q3, Q4 | 🟡 Secondary |
| **Monthly** | `MONTHLY` | 12 months per year | 🟡 Secondary |
| **Semi-Annual** | `SEMI_ANNUAL` | H1 and H2 | 🟡 Secondary |

### Approval Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  APPROVAL CHAIN                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  COOPERATIVE                                                                 │
│  ├── Creates submission                                                      │
│  ├── Status: DRAFT → SUBMITTED                                               │
│  └── Submits for review                                                       │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  APEX (First Review)                                                          │
│  ├── Reviews submission                                                       │
│  ├── Can: Approve / Return / Reject                                          │
│  └── Status: SUBMITTED → PENDING_APEX_REVIEW → APPROVED_BY_APEX              │
│                                                                             │
│  ↓ (if approved)                                                             │
│                                                                             │
│  FEDERATION (Second Review)                                                   │
│  ├── Reviews submission                                                       │
│  ├── Can: Approve / Return / Reject                                          │
│  └── Status: APPROVED_BY_APEX → PENDING_FEDERATION_REVIEW → APPROVED_BY_FED  │
│                                                                             │
│  ↓ (if approved)                                                             │
│                                                                             │
│  MINISTRY (Final Approval)                                                    │
│  ├── Reviews submission                                                       │
│  ├── Can: Approve / Return / Reject                                          │
│  └── Status: APPROVED_BY_FED → PENDING_MINISTRY_REVIEW → APPROVED            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Test Environment Setup

### 2.1 Test Database

```bash
# Create test database
psql -c "CREATE DATABASE coopdata_test;"

# Run migrations
cd backend
sqlx migrate run
```

### 2.2 Playwright Configuration Update

```typescript
// playwright.config.ts
export default defineConfig({
  // ... existing config ...
  
  webServer: {
    // Start REAL backend with test database
    command: "DATABASE_URL=postgres://user:pass@localhost:5432/coopdata_test cargo run",
    url: "http://localhost:3000",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
  },
  
  // Increase timeout for AI extraction (upload tests)
  timeout: 120_000,
  expect: { timeout: 30_000 },
});
```

### 2.3 Test Users (Seed Data)

| Role | Email | Password | Organization |
|------|-------|----------|--------------|
| Ministry | `ministry@test.coopdata` | `Test123!` | National |
| Federation | `federation@test.coopdata` | `Test123!` | Test Federation |
| Apex | `apex@test.coopdata` | `Test123!` | Test Apex |
| Cooperative | `coop@test.coopdata` | `Test123!` | Test Cooperative |

### 2.4 Environment Variables

```bash
# .env.test
DATABASE_URL=postgres://user:pass@localhost:5432/coopdata_test
KEYCLOAK_URL=http://localhost:8180
KEYCLOAK_REALM=coop-data
VITE_KEYCLOAK_URL=http://localhost:8180
VITE_E2E_MOCK_AUTH=0  # Disable mock auth for real auth
```

---

## 3. Test Data Requirements

### 3.1 Directory Structure

```
frontend/e2e/
├── fixtures/
│   ├── auth.ts                    # Already exists
│   ├── test-data/
│   │   ├── financial/
│   │   │   ├── yearly-financial.png           # PNG image for AI extraction
│   │   │   ├── quarterly-financial.png         # Q1, Q2, Q3, Q4
│   │   │   ├── monthly-financial.png           # Samples: Jan, Jun, Dec
│   │   │   └── semi-annual-financial.png       # H1, H2
│   │   ├── non-financial/
│   │   │   ├── yearly-members.xlsx             # Members data
│   │   │   ├── yearly-savings.xlsx            # Savings data
│   │   │   ├── quarterly-members.xlsx          # Q1, Q2, Q3, Q4
│   │   │   ├── quarterly-savings.xlsx         # Q1, Q2, Q3, Q4
│   │   │   ├── monthly-members.xlsx           # Samples
│   │   │   └── monthly-savings.xlsx            # Samples
│   │   └── questionnaire/
│   │       └── (questionnaire data if needed)
│   └── helpers/
│       ├── login.ts               # Login helper functions
│       ├── navigation.ts           # Navigation helpers
│       └── submission.ts           # Submission helpers
└── specs/
    ├── submission-workflow.spec.ts
    └── approval-workflow.spec.ts
```

### 3.2 Sample Data Structure

#### Financial Statement (PNG Image)
```json
{
  "organization_name": "Test Cooperative SACCO",
  "registration_number": "COOP-2024-001",
  "reporting_period": "2024",
  "reporting_frequency": "YEARLY",
  "total_assets": 15000000,
  "total_liabilities": 8500000,
  "total_income": 3200000,
  "total_expenses": 2800000,
  "net_surplus": 400000,
  "total_members": 2500,
  "total_savings": 12000000,
  "outstanding_loans": 6500000,
  "non_performing_loans": 325000,
  "npl_ratio": 5.0
}
```

**Note:** Financial statement will be provided as a **PNG image**. The backend AI can extract data from images (not just PDFs).

#### Non-Financial Data (Excel - Separate Files per Category)

The non-financial section allows uploading separate Excel files for different categories:

| Category | File | Fields |
|----------|------|--------|
| **Members** | `yearly-members.xlsx` | Male, Female, New, Withdrawn, Total |
| **Savings** | `yearly-savings.xlsx` | Total Savings, Average Savings, etc. |
| **Loans** | `yearly-loans.xlsx` | Outstanding, NPL, Default Rate, etc. |
| **Employment** | `yearly-employment.xlsx` | Total Employees, Management, etc. |
| **Governance** | `yearly-governance.xlsx` | Board Meetings, AGM, Audit, etc. |

**For initial testing, we will use:**
- `yearly-members.xlsx` (Members data)
- `yearly-savings.xlsx` (Savings data)

```json
// yearly-members.xlsx
{
  "organization_name": "Test Cooperative SACCO",
  "reporting_period": "2024",
  "reporting_frequency": "YEARLY",
  "male_members": 1200,
  "female_members": 1300,
  "new_members_this_year": 150,
  "withdrawn_members": 50,
  "total_members": 2500
}
```

```json
// yearly-savings.xlsx
{
  "organization_name": "Test Cooperative SACCO",
  "reporting_period": "2024",
  "reporting_frequency": "YEARLY",
  "total_savings": 12000000,
  "average_savings_per_member": 4800,
  "savings_growth_rate": 8.5
}
```

### 3.3 Test Data Files Needed

| File | Format | Purpose | Status |
|------|--------|---------|--------|
| `yearly-financial.png` | PNG Image | Financial statement (AI extraction) | 📝 User to provide |
| `yearly-members.xlsx` | Excel | Members data | 📝 User to provide |
| `yearly-savings.xlsx` | Excel | Savings data | 📝 User to provide |
| `quarterly-financial.png` | PNG Image | Quarterly financial | 📝 User to provide |
| `quarterly-members.xlsx` | Excel | Quarterly members | 📝 User to provide |
| `quarterly-savings.xlsx` | Excel | Quarterly savings | 📝 User to provide |
| `monthly-financial.png` | PNG Image | Monthly financial (samples) | 📝 User to provide |
| `semi-annual-financial.png` | PNG Image | Semi-annual financial | 📝 User to provide |

**Notes:** 
- Financial statements are **PNG images** (not PDF) - backend AI can extract from images
- Non-financial data is split into separate Excel files per category (Members, Savings, Loans, etc.)
- For initial testing, we only need: `yearly-financial.png`, `yearly-members.xlsx`, `yearly-savings.xlsx`

---

## 4. Happy Path Testing Matrix

### 4.1 Route × Frequency Matrix

| Route | Method | YEARLY | QUARTERLY | MONTHLY | SEMI_ANNUAL |
|-------|--------|--------|-----------|---------|-------------|
| **Route 1** | Upload (Financial + Non-Financial) | ✅ | 🟡 | 🟡 | 🟡 |
| **Route 2** | Manual Entry | ✅ | 🟡 | 🟡 | 🟡 |
| **Route 3** | Questionnaire | ✅ | 🟡 | 🟡 | 🟡 |

**Legend:**
- 🔴 Primary test (implement first)
- 🟡 Secondary test (implement after primary)

### 4.2 Happy Path Test Count

| Phase | Tests | Description |
|-------|-------|-------------|
| **Phase 1** | 3 | Route 1, 2, 3 × YEARLY only |
| **Phase 2** | 9 | All routes × All frequencies |
| **Phase 3** | 6 | Approval workflow × All routes |
| **Total** | 18 | Happy path tests |

---

## 5. Route 1: Upload Method

### 5.1 Test Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  UPLOAD METHOD TEST FLOW                                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: Cooperative starts new submission                                  │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Login as Cooperative                                                   │
│  2. Navigate to /app/submissions                                           │
│  3. Click "Create Submission"                                               │
│  4. Verify URL: /app/submissions/new                                       │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 2: Select Reporting Frequency & Period                                │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Select Reporting Frequency: "Yearly"                                    │
│  2. Select Period: "2024"                                                   │
│  3. Click "Continue"                                                       │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 3: Select Submission Type                                              │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Select "Upload" method                                                   │
│  2. Verify URL: /app/financial-statement/upload                            │
│  3. Verify period info is displayed: "Yearly 2024"                          │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 4: Upload Financial Statement                                          │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Upload financial PDF/Excel file                                         │
│  2. Click "Upload"                                                           │
│  3. Wait for AI extraction (may take 30-60 seconds)                        │
│  4. Verify "Extraction Complete" message                                  │
│  5. Review extracted data                                                   │
│  6. Click "Confirm & Continue"                                             │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 5: Upload Non-Financial Data                                         │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Navigate to non-financial upload section                                │
│  2. Upload non-financial Excel file                                         │
│  3. Click "Upload"                                                           │
│  4. Wait for processing                                                     │
│  5. Verify "Upload Complete" message                                        │
│  6. Review extracted data                                                   │
│  7. Click "Confirm & Continue"                                              │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 6: Review & Submit                                                    │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Review all extracted data                                               │
│  2. Verify financial data is correct                                        │
│  3. Verify non-financial data is correct                                   │
│  4. Click "Submit for Review"                                                │
│  5. Verify "Submission Created Successfully"                               │
│  6. Verify status: "Pending Apex Review"                                   │
│  7. Note submission ID for next tests                                       │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 7: Apex Reviews & Approves                                            │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Logout                                                                  │
│  2. Login as Apex                                                           │
│  3. Navigate to /app/submissions                                            │
│  4. Find submission (by ID or organization name)                          │
│  5. Click to view details                                                   │
│  6. Review financial data                                                   │
│  7. Review non-financial data                                               │
│  8. Click "Approve"                                                         │
│  9. Add comment: "Data verified"                                            │
│  10. Click "Confirm Approval"                                               │
│  11. Verify status: "Pending Federation Review"                            │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 8: Federation Reviews & Approves                                       │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Logout                                                                  │
│  2. Login as Federation                                                     │
│  3. Navigate to /app/submissions                                            │
│  4. Find submission                                                         │
│  5. Review data                                                             │
│  6. Click "Approve"                                                         │
│  7. Click "Confirm Approval"                                               │
│  8. Verify status: "Pending Ministry Review"                              │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 9: Ministry Reviews & Final Approves                                  │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Logout                                                                  │
│  2. Login as Ministry                                                       │
│  3. Navigate to /app/submissions                                            │
│  4. Find submission                                                         │
│  5. Review data                                                             │
│  6. Click "Approve"                                                         │
│  7. Click "Confirm Approval"                                               │
│  8. Verify status: "APPROVED"                                              │
│  9. Verify "Final Approval Granted" message                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Test Specification

```typescript
// e2e/specs/submission-workflow.spec.ts

test.describe("Route 1: Upload Method - Happy Path", () => {
  
  test("Upload: Yearly Financial (PNG) + Non-Financial (Members + Savings) → Full Approval Chain", async ({ page }) => {
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 1: Cooperative starts new submission
    // ═══════════════════════════════════════════════════════════════
    
    await loginAs("cooperative");
    await page.goto("/app/submissions");
    await page.click('button:has-text("Create Submission")');
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 2: Select Reporting Frequency & Period FIRST
    // ═══════════════════════════════════════════════════════════════
    
    await page.selectOption('select[name="reporting-frequency"]', 'YEARLY');
    await page.selectOption('select[name="reporting-period"]', '2024');
    await page.click('button:has-text("Continue")');
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 3: Select Upload method
    // ═══════════════════════════════════════════════════════════════
    
    await page.click('button:has-text("Upload")');
    await expect(page).toHaveURL(/\/app\/financial-statement\/upload/);
    
    // Verify period info is displayed
    await expect(page.getByText("Yearly 2024")).toBeVisible();
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 4: Upload Financial Statement (PNG Image)
    // ═══════════════════════════════════════════════════════════════
    
    const financialInput = page.locator('input[name="financial-file"]');
    await financialInput.setInputFiles('./e2e/fixtures/test-data/financial/yearly-financial.png');
    
    // Wait for AI extraction (can take 4-5 minutes for image processing)
    await expect(page.getByText("Processing...")).toBeVisible({ timeout: 5000 });
    await expect(page.getByText("Extraction Complete")).toBeVisible({ timeout: 300000 }); // 5 minutes
    
    // Review extracted data
    await expect(page.getByText("Total Assets:")).toBeVisible();
    await expect(page.getByText("Total Liabilities:")).toBeVisible();
    await page.click('button:has-text("Confirm & Continue")');
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 5: Upload Non-Financial Data (Separate Files)
    // ═══════════════════════════════════════════════════════════════
    
    // Upload Members data
    const membersInput = page.locator('input[name="members-file"]');
    await membersInput.setInputFiles('./e2e/fixtures/test-data/non-financial/yearly-members.xlsx');
    await expect(page.getByText("Members data uploaded")).toBeVisible({ timeout: 30000 });
    
    // Upload Savings data
    const savingsInput = page.locator('input[name="savings-file"]');
    await savingsInput.setInputFiles('./e2e/fixtures/test-data/non-financial/yearly-savings.xlsx');
    await expect(page.getByText("Savings data uploaded")).toBeVisible({ timeout: 30000 });
    
    await page.click('button:has-text("Confirm & Continue")');
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 6: Review & Submit
    // ═══════════════════════════════════════════════════════════════
    
    await expect(page.getByText("Review Your Submission")).toBeVisible();
    await page.click('button:has-text("Submit for Review")');
    
    // Verify submission created
    await expect(page.getByText("Submission Created Successfully")).toBeVisible();
    await expect(page.getByText("Status: Pending Apex Review")).toBeVisible();
    
    // Get submission ID for next tests
    const submissionId = await page.locator('[data-testid="submission-id"]').textContent();
    console.log(`Created submission: ${submissionId}`);
    
    await page.click('button:has-text("Logout")');
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 7: Apex approves
    // ═══════════════════════════════════════════════════════════════
    
    await loginAs("apex");
    await page.goto("/app/submissions");
    
    // Find the submission
    await page.getByText(submissionId).click();
    
    // Review data
    await expect(page.getByText("Total Assets:")).toBeVisible();
    await expect(page.getByText("Total Members:")).toBeVisible();
    
    // Approve
    await page.click('button:has-text("Approve")');
    await page.fill('textarea[name="comments"]', 'Data verified and accurate');
    await page.click('button:has-text("Confirm Approval")');
    
    // Verify status
    await expect(page.getByText("Status: Pending Federation Review")).toBeVisible();
    
    await page.click('button:has-text("Logout")');
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 8: Federation approves
    // ═══════════════════════════════════════════════════════════════
    
    await loginAs("federation");
    await page.goto("/app/submissions");
    await page.getByText(submissionId).click();
    
    await page.click('button:has-text("Approve")');
    await page.click('button:has-text("Confirm Approval")');
    
    await expect(page.getByText("Status: Pending Ministry Review")).toBeVisible();
    
    await page.click('button:has-text("Logout")');
    
    // ═══════════════════════════════════════════════════════════════
    // STEP 9: Ministry final approval
    // ═══════════════════════════════════════════════════════════════
    
    await loginAs("ministry");
    await page.goto("/app/submissions");
    await page.getByText(submissionId).click();
    
    await page.click('button:has-text("Approve")');
    await page.click('button:has-text("Confirm Approval")');
    
    // Final verification
    await expect(page.getByText("Status: APPROVED")).toBeVisible();
    await expect(page.getByText("Final Approval Granted")).toBeVisible();
  });
});
```

### 5.3 AI Extraction Testing Notes

When uploading files for AI extraction, we need to verify:

1. **Upload Success**: File is received by backend
2. **Processing Started**: Backend returns "processing" status
3. **Extraction Complete**: AI extracts data within timeout (**4-5 minutes**)
4. **Data Accuracy**: Extracted values match expected values (within tolerance)
5. **Error Handling**: Invalid file format shows error message

**Important:** AI extraction can take **4-5 minutes** due to image processing. Set timeouts accordingly.

```typescript
// AI extraction verification helpers
async function waitForExtraction(page: Page, timeout = 300000) {
  // Wait for processing indicator
  await expect(page.getByText("Processing...")).toBeVisible({ timeout: 5000 });
  
  // Wait for completion (can take 4-5 minutes for image processing)
  await expect(page.getByText("Extraction Complete")).toBeVisible({ timeout });
}

async function verifyExtractedData(page: Page, expectedData: Record<string, string>) {
  for (const [field, value] of Object.entries(expectedData)) {
    await expect(page.getByText(`${field}: ${value}`)).toBeVisible();
  }
}
```

---

## 6. Route 2: Manual Entry Method

### 6.1 Test Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MANUAL ENTRY METHOD TEST FLOW                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: Cooperative starts new submission                                  │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Login as Cooperative                                                   │
│  2. Navigate to /app/submissions                                           │
│  3. Click "Create Submission"                                               │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 2: Select Reporting Frequency & Period                                │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Select Reporting Frequency: "Yearly"                                    │
│  2. Select Period: "2024"                                                    │
│  3. Click "Continue"                                                       │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 3: Select Manual Entry method                                          │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Select "Manual Entry" method                                            │
│  2. Verify URL: /app/financial-statement/manual                            │
│  3. Verify period info is displayed: "Yearly 2024"                        │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 4: Fill Financial Data                                                 │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Fill all required financial fields:                                    │
│     - Total Assets: 15,000,000                                            │
│     - Total Liabilities: 8,500,000                                         │
│     - Total Income: 3,200,000                                              │
│     - Total Expenses: 2,800,000                                             │
│     - Net Surplus: 400,000                                                 │
│     - Total Members: 2,500                                                   │
│     - Total Savings: 12,000,000                                            │
│     - Outstanding Loans: 6,500,000                                         │
│     - Non-Performing Loans: 325,000                                        │
│  2. Click "Save & Continue"                                                 │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 5: Fill Non-Financial Data                                           │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Fill all required non-financial fields:                                │
│     - Male Members: 1,200                                                  │
│     - Female Members: 1,300                                                │
│     - Total Employees: 45                                                  │
│     - Female in Management: 18                                             │
│     - Board Meetings Held: 12                                               │
│     - AGM Held: Yes                                                         │
│     - Date of Last AGM: 2024-06-15                                         │
│     - Has External Audit: Yes                                               │
│     - Audit Opinion: Unqualified                                           │
│  2. Click "Save & Continue"                                                 │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 6: Review & Submit                                                    │
│  ─────────────────────────────────────────────────────────────────────     │
│  (Same as Upload method - Steps 6-9)                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Test Specification

```typescript
test("Manual Entry: Yearly Financial + Non-Financial → Full Approval Chain", async ({ page }) => {
  
  await loginAs("cooperative");
  await page.goto("/app/submissions");
  await page.click('button:has-text("Create Submission")');
  
  // Select reporting frequency and period FIRST
  await page.selectOption('select[name="reporting-frequency"]', 'YEARLY');
  await page.selectOption('select[name="reporting-period"]', '2024');
  await page.click('button:has-text("Continue")');
  
  // Select Manual Entry method
  await page.click('button:has-text("Manual Entry")');
  await expect(page).toHaveURL(/\/app\/financial-statement\/manual/);
  await expect(page.getByText("Yearly 2024")).toBeVisible();
  
  // ═══════════════════════════════════════════════════════════════
  // Fill Financial Data
  // ═══════════════════════════════════════════════════════════════
  
  await page.fill('input[name="total-assets"]', '15000000');
  await page.fill('input[name="total-liabilities"]', '8500000');
  await page.fill('input[name="total-income"]', '3200000');
  await page.fill('input[name="total-expenses"]', '2800000');
  await page.fill('input[name="net-surplus"]', '400000');
  await page.fill('input[name="total-members"]', '2500');
  await page.fill('input[name="total-savings"]', '12000000');
  await page.fill('input[name="outstanding-loans"]', '6500000');
  await page.fill('input[name="non-performing-loans"]', '325000');
  
  await page.click('button:has-text("Save & Continue")');
  
  // ═══════════════════════════════════════════════════════════════
  // Fill Non-Financial Data
  // ═══════════════════════════════════════════════════════════════
  
  await page.fill('input[name="male-members"]', '1200');
  await page.fill('input[name="female-members"]', '1300');
  await page.fill('input[name="total-employees"]', '45');
  await page.fill('input[name="female-in-management"]', '18');
  await page.fill('input[name="board-meetings-held"]', '12');
  await page.check('input[name="agm-held"]');
  await page.fill('input[name="date-of-last-agm"]', '2024-06-15');
  await page.check('input[name="has-external-audit"]');
  await page.selectOption('select[name="audit-opinion"]', 'Unqualified');
  
  await page.click('button:has-text("Save & Continue")');
  
  // ═══════════════════════════════════════════════════════════════
  // Review & Submit
  // ═══════════════════════════════════════════════════════════════
  
  await expect(page.getByText("Review Your Submission")).toBeVisible();
  
  // Verify all values are displayed
  await expect(page.getByText("15,000,000")).toBeVisible(); // Total Assets
  await expect(page.getByText("2,500")).toBeVisible(); // Total Members
  
  await page.click('button:has-text("Submit for Review")');
  
  await expect(page.getByText("Submission Created Successfully")).toBeVisible();
  await expect(page.getByText("Status: Pending Apex Review")).toBeVisible();
  
  const submissionId = await page.locator('[data-testid="submission-id"]').textContent();
  
  // ... continue with approval chain (same as upload method) ...
});
```

---

## 7. Route 3: Questionnaire Method

### 7.1 Test Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  QUESTIONNAIRE METHOD TEST FLOW                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: Cooperative starts new submission                                  │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Login as Cooperative                                                   │
│  2. Navigate to /app/submissions                                           │
│  3. Click "Create Submission"                                               │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 2: Select Reporting Frequency & Period                                │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Select Reporting Frequency: "Yearly"                                    │
│  2. Select Period: "2024"                                                    │
│  3. Click "Continue"                                                       │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 3: Select Questionnaire method                                        │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Select "Questionnaire" method                                           │
│  2. Verify URL: /app/questionnaire                                         │
│  3. Verify period info is displayed: "Yearly 2024"                        │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 4: Select Template & Period                                           │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Select Template: "Annual Report 2024"                                   │
│  2. Click "Start Questionnaire"                                             │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 5: Fill Section 1 - Basic Information                                 │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Organization Name: "Test Cooperative SACCO"                              │
│  2. Registration Number: "COOP-2024-001"                                   │
│  3. Date of Registration: "2020-01-15"                                     │
│  4. Physical Address: "123 Test Street, Nairobi"                            │
│  5. Contact Person: "John Doe"                                              │
│  6. Email: "info@testcoop.co.ke"                                            │
│  7. Phone: "+254700000000"                                                  │
│  8. Click "Next"                                                            │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 6: Fill Section 2 - Membership                                        │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Total Male Members: 1,200                                               │
│  2. Total Female Members: 1,300                                            │
│  3. New Members This Year: 150                                              │
│  4. Withdrawn Members: 50                                                  │
│  5. Click "Next"                                                            │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 7: Fill Section 3 - Financial Performance                             │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Total Assets: 15,000,000                                               │
│  2. Total Liabilities: 8,500,000                                           │
│  3. Total Income: 3,200,000                                                │
│  4. Total Expenses: 2,800,000                                             │
│  5. Net Surplus: 400,000                                                   │
│  6. Click "Next"                                                            │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 8: Fill Section 4 - Governance                                        │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Board Meetings Held: 12                                                 │
│  2. AGM Held: Yes                                                          │
│  3. Date of Last AGM: "2024-06-15"                                         │
│  4. External Audit Done: Yes                                                │
│  5. Audit Opinion: "Unqualified"                                            │
│  6. Click "Review"                                                          │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 9: Review & Submit                                                    │
│  ─────────────────────────────────────────────────────────────────────     │
│  (Same as other methods - Steps 6-9)                                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Test Specification

```typescript
test("Questionnaire: Yearly → Full Approval Chain", async ({ page }) => {
  
  await loginAs("cooperative");
  await page.goto("/app/submissions");
  await page.click('button:has-text("Create Submission")');
  
  // Select reporting frequency and period FIRST
  await page.selectOption('select[name="reporting-frequency"]', 'YEARLY');
  await page.selectOption('select[name="reporting-period"]', '2024');
  await page.click('button:has-text("Continue")');
  
  // Select Questionnaire method
  await page.click('button:has-text("Questionnaire")');
  await expect(page).toHaveURL(/\/app\/questionnaire/);
  await expect(page.getByText("Yearly 2024")).toBeVisible();
  
  // Select template
  await page.selectOption('select[name="template"]', 'Annual Report 2024');
  await page.click('button:has-text("Start Questionnaire")');
  
  // ═══════════════════════════════════════════════════════════════
  // Section 1: Basic Information
  // ═══════════════════════════════════════════════════════════════
  
  await expect(page.getByText("Section 1: Basic Information")).toBeVisible();
  
  await page.fill('input[name="organization-name"]', 'Test Cooperative SACCO');
  await page.fill('input[name="registration-number"]', 'COOP-2024-001');
  await page.fill('input[name="date-of-registration"]', '2020-01-15');
  await page.fill('input[name="physical-address"]', '123 Test Street, Nairobi');
  await page.fill('input[name="contact-person"]', 'John Doe');
  await page.fill('input[name="email"]', 'info@testcoop.co.ke');
  await page.fill('input[name="phone"]', '+254700000000');
  
  await page.click('button:has-text("Next")');
  
  // ═══════════════════════════════════════════════════════════════
  // Section 2: Membership
  // ═══════════════════════════════════════════════════════════════
  
  await expect(page.getByText("Section 2: Membership")).toBeVisible();
  
  await page.fill('input[name="total-male-members"]', '1200');
  await page.fill('input[name="total-female-members"]', '1300');
  await page.fill('input[name="new-members"]', '150');
  await page.fill('input[name="withdrawn-members"]', '50');
  
  await page.click('button:has-text("Next")');
  
  // ═══════════════════════════════════════════════════════════════
  // Section 3: Financial Performance
  // ═══════════════════════════════════════════════════════════════
  
  await expect(page.getByText("Section 3: Financial Performance")).toBeVisible();
  
  await page.fill('input[name="total-assets"]', '15000000');
  await page.fill('input[name="total-liabilities"]', '8500000');
  await page.fill('input[name="total-income"]', '3200000');
  await page.fill('input[name="total-expenses"]', '2800000');
  await page.fill('input[name="net-surplus"]', '400000');
  
  await page.click('button:has-text("Next")');
  
  // ═══════════════════════════════════════════════════════════════
  // Section 4: Governance
  // ═══════════════════════════════════════════════════════════════
  
  await expect(page.getByText("Section 4: Governance")).toBeVisible();
  
  await page.fill('input[name="board-meetings-held"]', '12');
  await page.check('input[name="agm-held"]');
  await page.fill('input[name="date-of-last-agm"]', '2024-06-15');
  await page.check('input[name="external-audit-done"]');
  await page.selectOption('select[name="audit-opinion"]', 'Unqualified');
  
  await page.click('button:has-text("Review")');
  
  // ═══════════════════════════════════════════════════════════════
  // Review & Submit
  // ═══════════════════════════════════════════════════════════════
  
  await expect(page.getByText("Review Your Submission")).toBeVisible();
  
  // Verify all sections are complete
  await expect(page.getByText("Section 1: Complete")).toBeVisible();
  await expect(page.getByText("Section 2: Complete")).toBeVisible();
  await expect(page.getByText("Section 3: Complete")).toBeVisible();
  await expect(page.getByText("Section 4: Complete")).toBeVisible();
  
  await page.click('button:has-text("Submit")');
  
  await expect(page.getByText("Submission Created Successfully")).toBeVisible();
  await expect(page.getByText("Status: Pending Apex Review")).toBeVisible();
  
  // ... continue with approval chain ...
});
```

---

## 8. Approval Workflow Tests

### 8.1 Approval Test Flow

Each submission method (Upload, Manual, Questionnaire) follows the same approval workflow:

```
SUBMITTED → PENDING_APEX_REVIEW → APPROVED_BY_APEX → 
PENDING_FEDERATION_REVIEW → APPROVED_BY_FEDERATION → 
PENDING_MINISTRY_REVIEW → APPROVED
```

### 8.2 Test Specification (Reusable Helper)

```typescript
// e2e/fixtures/helpers/approval.ts

export async function approveAsApex(page: Page, submissionId: string, comment?: string) {
  await loginAs("apex");
  await page.goto("/app/submissions");
  await page.getByText(submissionId).click();
  await page.click('button:has-text("Approve")');
  if (comment) {
    await page.fill('textarea[name="comments"]', comment);
  }
  await page.click('button:has-text("Confirm Approval")');
  await expect(page.getByText("Status: Pending Federation Review")).toBeVisible();
  await page.click('button:has-text("Logout")');
}

export async function approveAsFederation(page: Page, submissionId: string) {
  await loginAs("federation");
  await page.goto("/app/submissions");
  await page.getByText(submissionId).click();
  await page.click('button:has-text("Approve")');
  await page.click('button:has-text("Confirm Approval")');
  await expect(page.getByText("Status: Pending Ministry Review")).toBeVisible();
  await page.click('button:has-text("Logout")');
}

export async function approveAsMinistry(page: Page, submissionId: string) {
  await loginAs("ministry");
  await page.goto("/app/submissions");
  await page.getByText(submissionId).click();
  await page.click('button:has-text("Approve")');
  await page.click('button:has-text("Confirm Approval")');
  await expect(page.getByText("Status: APPROVED")).toBeVisible();
  await expect(page.getByText("Final Approval Granted")).toBeVisible();
}

export async function fullApprovalChain(page: Page, submissionId: string) {
  await approveAsApex(page, submissionId, "Data verified");
  await approveAsFederation(page, submissionId);
  await approveAsMinistry(page, submissionId);
}
```

### 8.3 Usage Example

```typescript
test("Upload: Yearly → Full Approval Chain", async ({ page }) => {
  // ... create submission ...
  const submissionId = await page.locator('[data-testid="submission-id"]').textContent();
  
  // Use helper for approval chain
  await fullApprovalChain(page, submissionId);
  
  // Final verification
  await expect(page.getByText("Status: APPROVED")).toBeVisible();
});
```

---

## 9. Reporting Frequency Categories

### 9.1 Frequency-Specific Tests

| Frequency | Test Data | Notes |
|-----------|-----------|-------|
| **YEARLY** | Period: 2024 | Primary test - implement first |
| **QUARTERLY** | Period: 2024-Q1, 2024-Q2, 2024-Q3, 2024-Q4 | 4 separate submissions |
| **MONTHLY** | Period: 2024-01 through 2024-12 | 12 separate submissions |
| **SEMI_ANNUAL** | Period: 2024-H1, 2024-H2 | 2 separate submissions |

### 9.2 Quarterly Test Example

```typescript
test("Upload: Quarterly Q1 Financial → Full Approval", async ({ page }) => {
  await loginAs("cooperative");
  await page.goto("/app/financial-statement/upload");
  
  // Select quarterly frequency
  await page.selectOption('select[name="reporting-frequency"]', 'QUARTERLY');
  await page.selectOption('select[name="reporting-period"]', '2024-Q1');
  
  // Upload file
  const financialInput = page.locator('input[name="financial-file"]');
  await financialInput.setInputFiles('./e2e/fixtures/test-data/financial/quarterly-financial.pdf');
  
  await expect(page.getByText("Extraction Complete")).toBeVisible({ timeout: 60000 });
  
  // ... continue with submission ...
});
```

### 9.3 Test Count by Frequency

| Frequency | Submissions | Test Priority |
|-----------|-------------|---------------|
| YEARLY | 1 | 🔴 Primary |
| QUARTERLY | 4 | 🟡 Secondary |
| MONTHLY | 12 | 🟡 Secondary |
| SEMI_ANNUAL | 2 | 🟡 Secondary |

---

## 10. Implementation Order

### Phase 1: Core Infrastructure (Week 1)

| Task | Description | Status |
|------|-------------|--------|
| 1.1 | Set up test database | 📝 Pending |
| 1.2 | Update Playwright config for real backend | 📝 Pending |
| 1.3 | Create helper functions (login, navigation) | 📝 Pending |
| 1.4 | Create test data files (Yearly only) | 📝 User to provide |
| 1.5 | Seed test users in database | 📝 Pending |

### Phase 2: Route 1 - Upload Tests (Week 2)

| Test | Description | Status |
|------|-------------|--------|
| 2.1 | Upload: Yearly Financial + Non-Financial → Apex Approves | 📝 Pending |
| 2.2 | Upload: Yearly → Federation Approves | 📝 Pending |
| 2.3 | Upload: Yearly → Ministry Final Approval | 📝 Pending |
| 2.4 | Upload: Yearly → Full Happy Path | 📝 Pending |

### Phase 3: Route 2 - Manual Entry Tests (Week 3)

| Test | Description | Status |
|------|-------------|--------|
| 3.1 | Manual: Yearly Financial + Non-Financial → Full Approval | 📝 Pending |

### Phase 4: Route 3 - Questionnaire Tests (Week 4)

| Test | Description | Status |
|------|-------------|--------|
| 4.1 | Questionnaire: Yearly → Full Approval | 📝 Pending |

### Phase 5: Frequency Expansion (Week 5)

| Test | Description | Status |
|------|-------------|--------|
| 5.1 | Upload: Quarterly Q1-Q4 | 📝 Pending |
| 5.2 | Manual: Quarterly Q1-Q4 | 📝 Pending |
| 5.3 | Questionnaire: Quarterly Q1-Q4 | 📝 Pending |
| 5.4 | Upload: Monthly (Jan, Jun, Dec samples) | 📝 Pending |
| 5.5 | Manual: Semi-Annual H1, H2 | 📝 Pending |

### Phase 6: Documentation (Week 6)

| Task | Description | Status |
|------|-------------|--------|
| 6.1 | Update this document with results | 📝 Pending |
| 6.2 | Create test execution guide | 📝 Pending |
| 6.3 | Document test data requirements | 📝 Pending |

---

## 11. Future: Unhappy Path Testing

> **Note**: This section documents planned unhappy path tests. Implementation comes after happy path is complete.

### 11.1 Rejection Scenarios

| Scenario | Test Description |
|----------|------------------|
| Apex Rejects | Cooperative submits → Apex rejects → Cooperative sees rejection |
| Federation Rejects | Submit → Apex approves → Federation rejects |
| Ministry Rejects | Submit → Apex approves → Federation approves → Ministry rejects |

### 11.2 Return for Correction Scenarios

| Scenario | Test Description |
|----------|------------------|
| Apex Returns | Submit → Apex returns → Cooperative fixes → Resubmits |
| Federation Returns | Submit → Apex approves → Federation returns → Cooperative fixes → Apex re-approves |
| Ministry Returns | Submit → Apex approves → Federation approves → Ministry returns |

### 11.3 Edge Cases

| Scenario | Test Description |
|----------|------------------|
| Empty Fields | Submit with missing required fields → Validation error |
| Invalid Data | Submit with invalid values → Validation error |
| Duplicate Submission | Submit same period twice → Error message |
| Session Timeout | Long pause during form fill → Session warning |
| File Size Limit | Upload oversized file → Error message |
| Invalid File Format | Upload wrong file type → Error message |

---

## 12. Test Specifications

### 12.1 File: `e2e/specs/submission-workflow.spec.ts`

```typescript
import { test, expect } from "@playwright/test";
import { loginAs } from "../fixtures/helpers/login";
import { fullApprovalChain } from "../fixtures/helpers/approval";

test.describe("Submission Workflow - Happy Path", () => {
  
  // ═══════════════════════════════════════════════════════════════
  // ROUTE 1: UPLOAD METHOD
  // ═══════════════════════════════════════════════════════════════
  
  test.describe("Route 1: Upload Method", () => {
    
    test("Yearly: Financial + Non-Financial Upload → Full Approval", async ({ page }) => {
      // Implementation: See Section 5.2
    });
    
    test("Quarterly Q1: Upload → Full Approval", async ({ page }) => {
      // Implementation: See Section 9.2
    });
    
    // Additional quarterly tests...
    // Additional monthly tests...
    // Additional semi-annual tests...
  });
  
  // ═══════════════════════════════════════════════════════════════
  // ROUTE 2: MANUAL ENTRY METHOD
  // ═══════════════════════════════════════════════════════════════
  
  test.describe("Route 2: Manual Entry Method", () => {
    
    test("Yearly: Manual Financial + Non-Financial → Full Approval", async ({ page }) => {
      // Implementation: See Section 6.2
    });
    
    // Additional frequency tests...
  });
  
  // ═══════════════════════════════════════════════════════════════
  // ROUTE 3: QUESTIONNAIRE METHOD
  // ═══════════════════════════════════════════════════════════════
  
  test.describe("Route 3: Questionnaire Method", () => {
    
    test("Yearly: Questionnaire → Full Approval", async ({ page }) => {
      // Implementation: See Section 7.2
    });
    
    // Additional frequency tests...
  });
});
```

### 12.2 File: `e2e/fixtures/helpers/login.ts`

```typescript
import type { Page } from "@playwright/test";
import { TEST_USERS } from "../auth";

export async function loginAs(page: Page, role: "ministry" | "federation" | "apex" | "cooperative") {
  const user = TEST_USERS[role];
  
  // Navigate to login page
  await page.goto("/login");
  
  // For real auth, we would:
  // 1. Fill Keycloak login form
  // 2. Submit credentials
  // 3. Wait for redirect to dashboard
  
  // For now, we use the mock auth approach
  await page.addInitScript(
    ({ token, user }) => {
      const tokenParts = token.split(".");
      const payload = JSON.parse(atob(tokenParts[1]));
      
      (window as unknown as Record<string, unknown>).__E2E_AUTH__ = {
        token,
        tokenParsed: payload,
        user,
      };
    },
    { token: createFakeJWT(user), user },
  );
  
  // Navigate to dashboard
  await page.goto("/app/dashboard");
  await page.waitForURL(/\/app\/dashboard/, { timeout: 15000 });
}

function createFakeJWT(user: TestUser): string {
  // Implementation from auth.ts
}
```

### 12.3 File: `e2e/fixtures/helpers/approval.ts`

```typescript
import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";
import { loginAs } from "./login";

export async function approveAsApex(page: Page, submissionId: string, comment = "Approved") {
  await loginAs(page, "apex");
  await page.goto("/app/submissions");
  await page.getByText(submissionId).click();
  await page.click('button:has-text("Approve")');
  await page.fill('textarea[name="comments"]', comment);
  await page.click('button:has-text("Confirm Approval")');
  await expect(page.getByText("Status: Pending Federation Review")).toBeVisible();
  await page.click('button:has-text("Logout")');
}

export async function approveAsFederation(page: Page, submissionId: string) {
  await loginAs(page, "federation");
  await page.goto("/app/submissions");
  await page.getByText(submissionId).click();
  await page.click('button:has-text("Approve")');
  await page.click('button:has-text("Confirm Approval")');
  await expect(page.getByText("Status: Pending Ministry Review")).toBeVisible();
  await page.click('button:has-text("Logout")');
}

export async function approveAsMinistry(page: Page, submissionId: string) {
  await loginAs(page, "ministry");
  await page.goto("/app/submissions");
  await page.getByText(submissionId).click();
  await page.click('button:has-text("Approve")');
  await page.click('button:has-text("Confirm Approval")');
  await expect(page.getByText("Status: APPROVED")).toBeVisible();
  await expect(page.getByText("Final Approval Granted")).toBeVisible();
}

export async function fullApprovalChain(page: Page, submissionId: string) {
  await approveAsApex(page, submissionId, "Data verified and accurate");
  await approveAsFederation(page, submissionId);
  await approveAsMinistry(page, submissionId);
}
```

---

## Appendix A: Test Data Checklist

### Initial Testing (Yearly Only)

| File | Format | Purpose | Status |
|------|--------|---------|--------|
| `yearly-financial.png` | PNG Image | Financial statement (AI extraction) | 📝 User to provide |
| `yearly-members.xlsx` | Excel | Members data | 📝 User to provide |
| `yearly-savings.xlsx` | Excel | Savings data | 📝 User to provide |

### Quarterly Testing (Next Phase)

| File | Format | Purpose | Status |
|------|--------|---------|--------|
| `quarterly-financial.png` | PNG Image | Q1-Q4 financial | 📝 User to provide |
| `quarterly-members.xlsx` | Excel | Q1-Q4 members | 📝 User to provide |
| `quarterly-savings.xlsx` | Excel | Q1-Q4 savings | 📝 User to provide |

### Monthly Testing (Samples)

| File | Format | Purpose | Status |
|------|--------|---------|--------|
| `monthly-financial.png` | PNG Image | Jan, Jun, Dec samples | 📝 User to provide |

### Semi-Annual Testing

| File | Format | Purpose | Status |
|------|--------|---------|--------|
| `semi-annual-financial.png` | PNG Image | H1 and H2 | 📝 User to provide |

**Note:** Financial statements are PNG images (not PDF). Non-financial data is split into separate Excel files per category.

---

## Appendix B: Test Execution Commands

```bash
# Run all happy path tests
npm run test:e2e:workflow

# Run only upload tests
npm run test:e2e:workflow -- --grep "Upload"

# Run only manual entry tests
npm run test:e2e:workflow -- --grep "Manual"

# Run only questionnaire tests
npm run test:e2e:workflow -- --grep "Questionnaire"

# Run with UI (visual)
npm run test:e2e:workflow --ui

# Run headed (see browser)
npm run test:e2e:workflow --headed

# Run single test
npm run test:e2e:workflow --grep "Yearly: Financial"
```

---

## Appendix C: Troubleshooting

| Issue | Solution |
|-------|----------|
| AI extraction timeout | Increase timeout to 120 seconds |
| Login fails | Check Keycloak is running |
| Database errors | Verify test database is seeded |
| File upload fails | Check file path is correct |
| Element not found | Use `page.waitForSelector()` before interaction |

---

**Document Version**: 1.0  
**Last Updated**: 2026-09-10  
**Next Review**: After Phase 1 completion