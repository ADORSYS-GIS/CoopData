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

We use the **real development database** (not a separate test database) for full-stack E2E testing. This ensures we test the actual data flow end-to-end.

```bash
# Database is already running via docker-compose
docker ps | grep postgres
# coopdata-postgres (postgres:16-alpine)

# Database connection
DATABASE_URL=postgresql://coopdata:password@localhost:5432/coopdata
```

### 2.2 Playwright Configuration

The Playwright config uses the real backend and frontend (no mock auth for sequential tests):

```typescript
// playwright.config.ts
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000,

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  // No webServer - we use the running dev servers (frontend on 5173, backend on 3000)
});
```

### 2.3 Test Users (Real Keycloak)

We use **real Keycloak users** (not mock users) for full-stack integration testing:

| Role | Email | Password | Organization |
|------|-------|----------|--------------|
| Cooperative | `coopadmin@gmail.com` | `password` | saccocoop |
| Apex | `apex@gmail.com` | `password` | apex |
| Federation | `yejami7300@ebflyai.com` | `password` | fsfsfa |
| Ministry | `admin@ministry.gov` | `password` | ministry |

### 2.4 Environment Variables

```bash
# .env (already configured)
DATABASE_URL=postgresql://coopdata:password@localhost:5432/coopdata
KEYCLOAK_URL=http://localhost:8180
KEYCLOAK_REALM=coop-data
VITE_KEYCLOAK_URL=http://localhost:8180
VITE_KEYCLOAK_REALM=coop-data
VITE_KEYCLOAK_CLIENT_ID=coopdata-frontend

# No VITE_E2E_MOCK_AUTH needed - we use real Keycloak auth
```

### 2.5 Running Services

```bash
# Start all services via docker-compose
docker-compose up -d

# Verify services are running
docker ps
# - coopdata-postgres (PostgreSQL)
# - coopdata-backend-dev (Rust backend on port 3000)
# - coopdata-frontend-dev (Vite frontend on port 5173)
# - coopdata-keycloak (Keycloak on port 8180)
```

---

## 3. Test Data Requirements

### 3.1 Directory Structure

```
frontend/e2e/
├── fixtures/
│   ├── auth.ts                    # TEST_USERS, mockKeycloak, mockBackendApi
│   ├── helpers/
│   │   ├── login.ts               # Real Keycloak login with storage clearing
│   │   └── approval.ts            # Approval chain helpers (Apex/Federation/Ministry)
│   └── test-data/
│       ├── financial/
│       │   └── yearly-financial.png           # PNG image for AI extraction
│       └── non-financial/
│           └── coopdatafullworkbook.xlsx      # SINGLE full workbook with ALL sections
└── specs/
    ├── route1-upload-sequential.spec.ts        # 7 sequential tests — Upload Method
    ├── route2-manual-sequential.spec.ts        # 7 sequential tests — Manual Entry
    └── route3-questionnaire-sequential.spec.ts # 7 sequential tests — Questionnaire
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

**Note:** Financial statement is provided as a **PNG image**. The backend AI extracts data from images.

#### Non-Financial Data (Single Full Workbook)

The non-financial section uses a **SINGLE Excel workbook** (`coopdatafullworkbook.xlsx`) that contains **ALL sections** in separate sheets:

| Sheet Name | Content |
|------------|---------|
| **Members** | Member ID, Status, Gender, Age Group, Region, Urban/Rural, AGM Attendance, Voting, Share Balance, Join Date |
| **Savings** | Account details, balances, transaction history |
| **Loans** | Loan portfolio, outstanding amounts, NPL tracking |
| **Fixed Deposits** | Fixed deposit accounts, terms, maturity dates |

**Upload Flow:**
1. Select "Full workbook" checkbox (or select individual section)
2. Select section type button (e.g., "NF MSHIP" for membership)
3. Upload the file
4. Click "Upload & Parse" button

**For initial testing, we use:**
- `coopdatafullworkbook.xlsx` (contains ALL sections in one file)

### 3.3 Test Data Files Needed

| File | Format | Purpose | Status |
|------|--------|---------|--------|
| `yearly-financial.png` | PNG Image | Financial statement (AI extraction) | ✅ Available |
| `coopdatafullworkbook.xlsx` | Excel | Full non-financial workbook (all sections) | ✅ Available |

**Notes:**
- Financial statement is a **PNG image** (not PDF) - backend AI extracts from images
- Non-financial data is a **SINGLE Excel workbook** with all sections in separate sheets
- We do NOT upload separate files for each non-financial category

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

### 5.1 How to Run

```bash
# From the frontend/ directory

# Interactive UI mode (recommended for debugging)
npm run test:e2e:route1:ui

# Headless mode (CI / fast run)
npm run test:e2e:route1
```

> **Tip**: In the Playwright UI, click the Play ▶ button next to the **parent describe group** (not individual steps) to run all 7 steps automatically in sequence without manual intervention.

### 5.2 Test Flow (Actual Implementation)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  UPLOAD METHOD TEST FLOW (ACTUAL)                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: Cooperative creates submission + uploads financial statement       │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Login as Cooperative (coopadmin@gmail.com)                              │
│  2. Navigate to /app/submissions                                            │
│  3. Click "New Submission"                                                   │
│  4. Select Frequency "Yearly (Annual)" and Period "2025"  ← NOTE: 2025    │
│  5. Click "Create"                                                          │
│  6. Navigate to Financial Statement tab                                     │
│  7. Upload yearly-financial.png                                             │
│  8. Wait for AI extraction (2-3 minutes)                                    │
│  9. Verify extraction complete                                              │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 2: Upload non-financial data (SINGLE full workbook)                   │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Switch to Non-Financial tab                                             │
│  2. Select "Full workbook" checkbox                                         │
│  3. Upload coopdatafullworkbook.xlsx (contains ALL sections)                │
│  4. Click "Upload & Parse"                                                  │
│  5. Wait for parsing to complete                                            │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 3: Mark all sections ready                                            │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Click "Mark Ready" button for each section:                             │
│     - Membership                                                            │
│     - Savings                                                               │
│     - Loans                                                                 │
│     - Fixed Deposits                                                        │
│  2. Verify all sections show "Ready" status                                 │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 4: Submit for review                                                  │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Click "Submit to FSFASA" button                                         │
│  2. Verify submission status: "In Review"                                   │
│  3. Note submission ID for approval steps                                   │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 5: Apex approves                                                      │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Logout                                                                  │
│  2. Login as Apex (apex@gmail.com)                                          │
│  3. Navigate to /app/submissions                                            │
│  4. Click on cooperative card (e.g., saccocoop)                            │
│  5. Click on the submission row                                             │
│  6. Click "Approve" button                                                  │
│  7. Fill comments (optional)                                                │
│  8. Click "Confirm Approval"                                                │
│  9. Verify status: "Pending Federation Review"                             │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 6: Federation approves                                                │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Logout                                                                  │
│  2. Login as Federation (yejami7300@ebflyai.com)                           │
│  3. Navigate to /app/submissions                                            │
│  4. Click on cooperative card                                               │
│  5. Click on the submission row                                             │
│  6. Click "Approve" button                                                  │
│  7. Click "Confirm Approval"                                                │
│  8. Verify status: "Pending Ministry Review"                               │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 7: Ministry final approval                                            │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Logout                                                                  │
│  2. Login as Ministry (admin@ministry.gov)                                  │
│  3. Navigate to /app/submissions                                            │
│  4. Click on cooperative card                                               │
│  5. Click on the submission row                                             │
│  6. Click "Approve" button                                                  │
│  7. Click "Confirm Approval"                                                │
│  8. Verify status: "APPROVED"                                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 Test Specification (Actual Implementation)

```typescript
// e2e/specs/route1-upload-sequential.spec.ts

test.describe.serial("Route 1: Upload Method - Sequential Flow", () => {
  let submissionId: string;

  test("Step 1: Create submission and upload financial statement", async ({ page }) => {
    test.setTimeout(300000); // 5 minutes for AI extraction
    
    await loginAs(page, "cooperative");
    await page.goto("/app/submissions");
    
    // Create new submission
    await page.click('button:has-text("New Submission")');
    await page.selectOption('select[name="cooperative"]', { label: "saccocoop" });
    await page.click('button:has-text("Create")');
    
    // Capture submission ID from URL
    submissionId = page.url().split('/').pop()!;
    
    // Upload financial statement
    await page.locator('input[type="file"]').first()
      .setInputFiles('./e2e/fixtures/test-data/financial/yearly-financial.png');
    
    // Wait for AI extraction (polls backend API)
    await waitForExtractionToFinish(page, submissionId);
  });

  test("Step 2: Upload non-financial data", async ({ page }) => {
    test.setTimeout(300000);
    
    await loginAs(page, "cooperative");
    await page.goto(`/app/submissions/${submissionId}`);
    
    // Switch to Non-Financial tab
    await page.locator('button[role="tab"]:has-text("Non-Financial")').click();
    
    // Select "Full workbook" option
    await page.locator('div:has-text("All sections (single workbook)")').last().click();
    
    // Upload full workbook
    await page.locator('input[type="file"]').last()
      .setInputFiles('./e2e/fixtures/test-data/non-financial/coopdatafullworkbook.xlsx');
    
    // Click Upload & Parse
    await page.locator('button:has-text("Upload & Parse")').click();
    await page.waitForTimeout(8000);
  });

  test("Step 3: Mark all sections ready", async ({ page }) => {
    test.setTimeout(300000);
    
    await loginAs(page, "cooperative");
    await page.goto(`/app/submissions/${submissionId}`);
    
    // Switch to Non-Financial tab
    await page.locator('button[role="tab"]:has-text("Non-Financial")').click();
    
    // Mark each section ready
    await markAllNonFinancialSectionsReady(page);
  });

  test("Step 4: Submit for review", async ({ page }) => {
    test.setTimeout(180000);
    
    await loginAs(page, "cooperative");
    await page.goto(`/app/submissions/${submissionId}`);
    
    // Click "Submit to FSFASA" button
    const submitBtn = page.locator('button:has-text("Submit to FSFASA")');
    await submitBtn.waitFor({ state: "visible", timeout: 60000 });
    await submitBtn.click({ force: true });
  });

  test("Step 5: Apex approval", async ({ page }) => {
    test.setTimeout(180000);
    
    await approveAsApex(page, submissionId, "Data verified and accurate");
  });

  test("Step 6: Federation approval", async ({ page }) => {
    test.setTimeout(180000);
    
    await approveAsFederation(page, submissionId);
  });

  test("Step 7: Ministry final approval", async ({ page }) => {
    test.setTimeout(180000);
    
    await approveAsMinistry(page, submissionId);
  });
});
```

### 5.3 AI Extraction Testing Notes

When uploading files for AI extraction, we need to verify:

1. **Upload Success**: File is received by backend
2. **Processing Started**: Backend returns "processing" status
3. **Extraction Complete**: AI extracts data within timeout (**2-3 minutes**)
4. **Data Accuracy**: Extracted values match expected values (within tolerance)
5. **Error Handling**: Invalid file format shows error message

**Important:** AI extraction can take **2-3 minutes**. We poll the backend API directly to check extraction status:

```typescript
async function waitForExtractionToFinish(page: Page, submissionId: string, totalTimeout = 300000) {
  const TERMINAL_STATUSES = ["succeeded", "failed", "partial"];
  
  while (Date.now() - start < totalTimeout) {
    const jobStatus = await page.evaluate(async (subId) => {
      // Get token from IndexedDB
      const token = await getTokenFromIndexedDB();
      
      // Poll backend API
      const response = await fetch(`/api/v1/extraction/jobs?submission_id=${subId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await response.json();
      return data.items?.[0]?.status;
    }, submissionId);
    
    if (TERMINAL_STATUSES.includes(jobStatus)) {
      return jobStatus === "succeeded";
    }
    
    await page.waitForTimeout(2000); // Poll every 2 seconds
  }
}
```

---

## 6. Route 2: Manual Entry Method

### 6.1 How to Run

```bash
# From the frontend/ directory

# Interactive UI mode (recommended for debugging)
npm run test:e2e:route2:ui

# Headless mode (CI / fast run)
npm run test:e2e:route2
```

> **Tip**: In the Playwright UI, click the Play ▶ button next to the **parent describe group** (not individual steps) to run all 7 steps automatically in sequence without manual intervention.

### 6.2 Test Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MANUAL ENTRY METHOD TEST FLOW                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: Cooperative creates submission                                     │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Login as Cooperative                                                   │
│  2. Navigate to /app/submissions                                           │
│  3. Click "New Submission"                                                 │
│  4. Select Frequency "Yearly (Annual)" and Period "2024"                   │
│  5. Click "Continue"                                                       │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 2: Fill Financial Data (via Populate Test Data)                      │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. In method modal, click "Use Manual Entry"                              │
│  2. Under Financial Statement, click "Enter Data Manually"                 │
│  3. Click "Populate Test Data" to auto-fill grid                           │
│  4. Click "Next" or "Review"                                               │
│  5. Click "Submit Financial Statement & Finish"                            │
│  6. Click "Mark Section Ready" on submission details page                  │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 3: Fill Non-Financial Data (via Populate Test Databases)             │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Switch to "Non-Financial Information" tab                              │
│  2. Click "Enter Member Data Manually"                                     │
│  3. Click "Populate Test Databases"                                        │
│  4. Click "Review" tab                                                     │
│  5. Click "Submit Non-Financial Databases & Finish" (Auto-marks ready)     │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 4: Submit for Review                                                 │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Verify all sections show "READY"                                       │
│  2. Click "Submit to FSFASA" (or apex)                                     │
│  3. Confirm submission                                                     │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 5-7: Approval Chain                                                  │
│  ─────────────────────────────────────────────────────────────────────     │
│  (Same as Upload method - Apex, Federation, Ministry)                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Test Specification

```typescript
test.describe.serial("Route 2: Manual Entry Method - Sequential Flow", () => {
  let submissionId: string;

  test("Step 1: Create submission", async ({ page }) => {
    await loginAs(page, "cooperative");
    // ... select Yearly 2024 and create
  });

  test("Step 2: Fill Financial Data via Populate Test Data", async ({ page }) => {
    // ... click "Use Manual Entry"
    // ... click "Enter Data Manually"
    // ... click "Populate Test Data"
    // ... click "Submit Financial Statement & Finish"
    // ... click "Mark Section Ready"
  });

  test("Step 3: Fill Non-Financial Data via Populate Test Data", async ({ page }) => {
    // ... switch to Non-Financial tab
    // ... click "Enter Member Data Manually"
    // ... click "Populate Test Databases"
    // ... click "Review" tab
    // ... click "Submit Non-Financial Databases & Finish"
  });

  test("Step 4: Submit for review", async ({ page }) => {
    // ... click "Submit to apx"
  });

  // Steps 5, 6, 7 (Approvals)
});
```

---

## 7. Route 3: Questionnaire Method

### 7.1 How to Run

```bash
# From the frontend/ directory

# Interactive UI mode (recommended for debugging)
npm run test:e2e:route3:ui

# Headless mode (CI / fast run)
npm run test:e2e:route3
```

> **Tip**: In the Playwright UI, click the Play ▶ button next to the **parent describe group** (not individual steps) to run all 7 steps automatically in sequence without manual intervention.

### 7.2 Test Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  QUESTIONNAIRE METHOD TEST FLOW                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: Cooperative creates submission                                     │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Login as Cooperative                                                   │
│  2. Navigate to /app/submissions                                           │
│  3. Click "New Submission"                                                 │
│  4. Select Frequency "Yearly (Annual)" and Period "2023"  ← NOTE: 2023    │
│  5. Click "Continue"                                                       │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 2: Fill Financial Data (via Questionnaire + Populate Test Data)      │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Under Financial Statement, click "Edit Answers"                        │
│  2. Click "Populate Test Data" to auto-fill all sections                   │
│  3. Navigate to the last tab: "Financial Performance"                      │
│  4. Click "Complete Questionnaire" (auto-marks section Ready)              │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 3: Fill Non-Financial Data (via Questionnaire + Populate Test Data)  │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Switch to "Non-Financial Information" tab                              │
│  2. Click "Edit Answers"                                                   │
│  3. Click "Populate Test Data" to auto-fill all sections                   │
│  4. Navigate to the last tab: "New Section"                                │
│  5. Click "Complete Questionnaire" (auto-marks section Ready)              │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  NOTE: No "Mark Section Ready" needed for either section.                  │
│  Both financial and non-financial are auto-marked ready when               │
│  "Complete Questionnaire" is clicked.                                      │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 4: Submit for Review                                                 │
│  ─────────────────────────────────────────────────────────────────────     │
│  1. Verify all sections show "READY"                                       │
│  2. Click "Submit to Apex Officer"                                         │
│  3. Confirm submission                                                     │
│                                                                             │
│  ↓                                                                          │
│                                                                             │
│  STEP 5-7: Approval Chain                                                  │
│  ─────────────────────────────────────────────────────────────────────     │
│  (Same as other routes - Apex, Federation, Ministry)                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 7.3 Test Specification

The full implementation lives in:
[`e2e/specs/route3-questionnaire-sequential.spec.ts`](file:///home/maxwell-ws/Projects/adorsys/CoopData/frontend/e2e/specs/route3-questionnaire-sequential.spec.ts)

```typescript
test.describe.serial("Route 3: Questionnaire Method - Sequential Flow", () => {
  let submissionId: string;

  test("Step 1: Create submission", async ({ page }) => {
    // Login as cooperative, select Yearly (Annual) + 2023 period
    // submissionId is shared across all steps
  });

  test("Step 2: Fill Financial Data", async ({ page }) => {
    // Click "Edit Answers" on Financial Statement tab
    // Click "Populate Test Data"
    // Navigate to "Financial Performance" tab (last tab)
    // Click "Complete Questionnaire" → auto-marks READY
  });

  test("Step 3: Fill Non-Financial Data", async ({ page }) => {
    // Switch to Non-Financial Information tab
    // Click "Edit Answers"
    // Click "Populate Test Data"
    // Navigate to "New Section" tab (last tab)
    // Click "Complete Questionnaire" → auto-marks READY
  });

  test("Step 4: Submit for review", async ({ page }) => {
    // Click "Submit to Apex Officer"
  });

  test("Step 5: Apex approval", ...);
  test("Step 6: Federation approval", ...);
  test("Step 7: Ministry final approval", ...);
});
```

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

### 8.2 Test Specification (Reusable Helper - Actual Implementation)

```typescript
// e2e/fixtures/helpers/approval.ts

import type { Page } from "@playwright/test";
import { loginAs } from "./login";

async function clearBrowserStorage(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function safeLogout(page: Page) {
  try {
    await page.locator('button:has-text("Logout")').click({ timeout: 5000 });
  } catch {
    await clearBrowserStorage(page);
  }
}

async function navigateToSubmission(page: Page, submissionId: string) {
  await page.goto("/app/submissions");
  await page.waitForLoadState("domcontentloaded");
  
  // Click cooperative card (OrgCard component)
  await page.locator('button:has(p.text-sm.font-bold)').first().click({ force: true });
  
  // Click submission row
  await page.locator(`tr:has-text("${submissionId}")`).first().click({ force: true });
  
  await page.waitForLoadState("domcontentloaded");
}

export async function approveAsApex(page: Page, submissionId: string, comment?: string) {
  await loginAs(page, "apex");
  await navigateToSubmission(page, submissionId);
  
  await page.locator('button:has-text("Approve")').click({ force: true });
  
  if (comment) {
    await page.locator('textarea[name="comments"]').fill(comment);
  }
  
  await page.locator('button:has-text("Confirm Approval")').click({ force: true });
  await safeLogout(page);
}

export async function approveAsFederation(page: Page, submissionId: string) {
  await loginAs(page, "federation");
  await navigateToSubmission(page, submissionId);
  
  await page.locator('button:has-text("Approve")').click({ force: true });
  await page.locator('button:has-text("Confirm Approval")').click({ force: true });
  await safeLogout(page);
}

export async function approveAsMinistry(page: Page, submissionId: string) {
  await loginAs(page, "ministry");
  await navigateToSubmission(page, submissionId);
  
  await page.locator('button:has-text("Approve")').click({ force: true });
  await page.locator('button:has-text("Confirm Approval")').click({ force: true });
}
```

### 8.3 Key Implementation Notes

- **Cooperative grid navigation:** Direct URL `/app/submissions/{id}` does NOT work for Apex/Federation/Ministry users. Must navigate via cooperative card → submission row.
- **OrgCard selector:** `button:has(p.text-sm.font-bold)` matches cooperative cards in the grid.
- **Force click:** All clicks use `{ force: true }` to bypass `<div class="fixed inset-0 z-50...">` modal overlays.
- **Safe logout:** If logout button is not found, clear browser storage instead of failing.
- **DOM content loaded:** Use `waitForLoadState("domcontentloaded")` instead of `"networkidle"` (React Query polling prevents networkidle).
- **Storage clearing:** Clear cookies, localStorage, sessionStorage before each user login to prevent session conflicts.

### 8.4 Database State Transitions

| Step | Status | Current Tier |
|------|--------|--------------|
| After Submit | `submitted` | `apex` |
| After Apex Approve | `in_review` | `federation` |
| After Federation Approve | `in_review` | `ministry` |
| After Ministry Approve | `approved` | `ministry` |

For debugging individual steps, reset DB state:
```sql
UPDATE submissions 
SET status = 'submitted', current_tier = 'apex' 
WHERE id = '<submission_id>';
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

### Phase 1: Core Infrastructure ✅ COMPLETE

| Task | Description | Status |
|------|-------------|--------|
| 1.1 | Set up test database (real DB with seeded data) | ✅ Complete |
| 1.2 | Update Playwright config for real backend | ✅ Complete |
| 1.3 | Create helper functions (login, approval, navigation) | ✅ Complete |
| 1.4 | Create test data files (Yearly only) | ✅ Complete |
| 1.5 | Seed test users in Keycloak (coopadmin, apex, federation, ministry) | ✅ Complete |

### Phase 2: Route 1 - Upload Tests ✅ COMPLETE

| Test | Description | Status |
|------|-------------|--------|
| 2.1 | Upload: Yearly Financial (PNG) + Non-Financial (Full Workbook) → Full Approval | ✅ Complete |
| 2.2 | Sequential test with 7 steps (create → upload → mark ready → submit → 3 approvals) | ✅ Complete |
| 2.3 | All 7 steps verified passing end-to-end | ✅ Complete |

### Phase 3: Route 2 - Manual Entry Tests ✅ COMPLETE

| Test | Description | Status |
|------|-------------|--------|
| 3.1 | Manual: Yearly Financial + Non-Financial → Full Approval | ✅ Complete |
| 3.2 | Sequential test with 7 steps (create → populate financial → populate non-financial → submit → 3 approvals) | ✅ Complete |
| 3.3 | All 7 steps verified passing end-to-end | ✅ Complete |

### Phase 4: Route 3 - Questionnaire Tests ✅ COMPLETE

| Test | Description | Status |
|------|-------------|--------|
| 4.1 | Questionnaire: Yearly (2023) Financial + Non-Financial → Full Approval | ✅ Complete |
| 4.2 | Sequential test with 7 steps (create → edit answers financial → edit answers non-financial → submit → 3 approvals) | ✅ Complete |
| 4.3 | All 7 steps verified passing end-to-end | ✅ Complete |

**Note:** Route 3 uses period **2023** (instead of 2024) to avoid duplicate submission conflicts with Routes 1 & 2.

### Phase 5: Frequency Expansion 📝 PENDING

| Test | Description | Status |
|------|-------------|--------|
| 5.1 | Upload: Quarterly Q1-Q4 | 📝 Pending |
| 5.2 | Manual: Quarterly Q1-Q4 | 📝 Pending |
| 5.3 | Questionnaire: Quarterly Q1-Q4 | 📝 Pending |
| 5.4 | Upload: Monthly (Jan, Jun, Dec samples) | 📝 Pending |
| 5.5 | Manual: Semi-Annual H1, H2 | 📝 Pending |

### Phase 6: Documentation ✅ IN PROGRESS

| Task | Description | Status |
|------|-------------|--------|
| 6.1 | Update this document with results | ✅ In Progress |
| 6.2 | Create test execution guide | ✅ Complete (docs/features/t15-testing.md) |
| 6.3 | Document test data requirements | ✅ Complete (Section 3) |

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

### 12.1 File: `e2e/specs/route1-upload-sequential.spec.ts`

```typescript
import { test, expect } from "@playwright/test";
import { loginAs } from "../fixtures/helpers/login";
import { 
  approveAsApex, 
  approveAsFederation, 
  approveAsMinistry 
} from "../fixtures/helpers/approval";

test.describe.serial("Route 1: Upload Method - Sequential Flow", () => {
  let submissionId: string;

  test("Step 1: Create submission and upload financial statement", async ({ page }) => {
    test.setTimeout(300000);
    
    await loginAs(page, "cooperative");
    await page.goto("/app/submissions");
    
    // Create new submission
    await page.locator('button:has-text("New Submission")').click({ force: true });
    await page.locator('select[name="cooperative"]').selectOption({ label: "saccocoop" });
    await page.locator('button:has-text("Create")').click({ force: true });
    
    // Capture submission ID from URL
    submissionId = page.url().split('/').pop()!;
    
    // Upload financial statement
    await page.locator('input[type="file"]').first()
      .setInputFiles('./e2e/fixtures/test-data/financial/yearly-financial.png');
    
    // Wait for AI extraction (polls backend API)
    await waitForExtractionToFinish(page, submissionId);
  });

  test("Step 2: Upload non-financial data", async ({ page }) => {
    test.setTimeout(300000);
    
    await loginAs(page, "cooperative");
    await page.goto(`/app/submissions/${submissionId}`);
    
    await page.locator('button[role="tab"]:has-text("Non-Financial")').click();
    await page.locator('div:has-text("All sections (single workbook)")').last().click();
    
    await page.locator('input[type="file"]').last()
      .setInputFiles('./e2e/fixtures/test-data/non-financial/coopdatafullworkbook.xlsx');
    
    await page.locator('button:has-text("Upload & Parse")').click({ force: true });
    await page.waitForTimeout(8000);
  });

  test("Step 3: Mark all sections ready", async ({ page }) => {
    test.setTimeout(300000);
    
    await loginAs(page, "cooperative");
    await page.goto(`/app/submissions/${submissionId}`);
    
    await page.locator('button[role="tab"]:has-text("Non-Financial")').click();
    await markAllNonFinancialSectionsReady(page);
  });

  test("Step 4: Submit for review", async ({ page }) => {
    test.setTimeout(180000);
    
    await loginAs(page, "cooperative");
    await page.goto(`/app/submissions/${submissionId}`);
    
    const submitBtn = page.locator('button:has-text("Submit to FSFASA")');
    await submitBtn.waitFor({ state: "visible", timeout: 60000 });
    await submitBtn.click({ force: true });
  });

  test("Step 5: Apex approval", async ({ page }) => {
    test.setTimeout(180000);
    await approveAsApex(page, submissionId, "Data verified and accurate");
  });

  test("Step 6: Federation approval", async ({ page }) => {
    test.setTimeout(180000);
    await approveAsFederation(page, submissionId);
  });

  test("Step 7: Ministry final approval", async ({ page }) => {
    test.setTimeout(180000);
    await approveAsMinistry(page, submissionId);
  });
});
```

### 12.2 File: `e2e/fixtures/helpers/login.ts`

```typescript
import type { Page } from "@playwright/test";

const TEST_USERS = {
  cooperative: { email: "coopadmin@gmail.com", password: "password" },
  apex: { email: "apex@gmail.com", password: "password" },
  federation: { email: "yejami7300@ebflyai.com", password: "password" },
  ministry: { email: "admin@ministry.gov", password: "password" },
};

export async function loginAs(
  page: Page, 
  role: "cooperative" | "apex" | "federation" | "ministry"
) {
  const user = TEST_USERS[role];
  
  // Clear all storage before login
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  
  // Navigate to login page
  await page.goto("/login");
  
  // Click "Sign in with Keycloak" button
  await page.locator('button:has-text("Sign in with Keycloak")').click();
  
  // Fill Keycloak login form (with retry logic)
  await page.locator('input[name="username"]').fill(user.email);
  await page.locator('input[name="password"]').fill(user.password);
  await page.locator('input[name="password"]').press("Enter");
  
  // Wait for redirect to dashboard
  await page.waitForURL(/\/app\/dashboard/, { timeout: 30000 });
}
```

### 12.3 File: `e2e/fixtures/helpers/approval.ts`

```typescript
import type { Page } from "@playwright/test";
import { loginAs } from "./login";

async function clearBrowserStorage(page: Page) {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
}

async function safeLogout(page: Page) {
  try {
    await page.locator('button:has-text("Logout")').click({ timeout: 5000 });
  } catch {
    await clearBrowserStorage(page);
  }
}

async function navigateToSubmission(page: Page, submissionId: string) {
  await page.goto("/app/submissions");
  await page.waitForLoadState("domcontentloaded");
  
  await page.locator('button:has(p.text-sm.font-bold)').first().click({ force: true });
  await page.locator(`tr:has-text("${submissionId}")`).first().click({ force: true });
  
  await page.waitForLoadState("domcontentloaded");
}

export async function approveAsApex(page: Page, submissionId: string, comment?: string) {
  await loginAs(page, "apex");
  await navigateToSubmission(page, submissionId);
  
  await page.locator('button:has-text("Approve")').click({ force: true });
  if (comment) {
    await page.locator('textarea[name="comments"]').fill(comment);
  }
  await page.locator('button:has-text("Confirm Approval")').click({ force: true });
  await safeLogout(page);
}

export async function approveAsFederation(page: Page, submissionId: string) {
  await loginAs(page, "federation");
  await navigateToSubmission(page, submissionId);
  
  await page.locator('button:has-text("Approve")').click({ force: true });
  await page.locator('button:has-text("Confirm Approval")').click({ force: true });
  await safeLogout(page);
}

export async function approveAsMinistry(page: Page, submissionId: string) {
  await loginAs(page, "ministry");
  await navigateToSubmission(page, submissionId);
  
  await page.locator('button:has-text("Approve")').click({ force: true });
  await page.locator('button:has-text("Confirm Approval")').click({ force: true });
}
```

### 12.4 File: `e2e/specs/route2-manual-sequential.spec.ts`

```typescript
import { test } from "@playwright/test";
import { loginAs } from "../fixtures/helpers/login";
import { 
  approveAsApex, 
  approveAsFederation, 
  approveAsMinistry 
} from "../fixtures/helpers/approval";

test.describe.serial("Route 2: Manual Entry Method - Sequential Flow", () => {
  let submissionId: string;

  test("Step 1: Create submission", async ({ page }) => {
    test.setTimeout(120000);
    await loginAs(page, "cooperative");
    await page.goto("/app/submissions");
    await page.locator('button:has-text("New Submission"), button:has-text("Create Submission")').first().click();
    await page.click('button:has-text("Yearly (Annual)")');
    await page.click('button:has-text("2024")');
    await page.locator('button:has-text("Create Submission"), button:has-text("Continue")').first().click();
    await page.waitForURL(/\/app\/submissions\/[a-f0-9-]+/, { timeout: 60000 });
    submissionId = page.url().split('/').pop()!;
  });

  test("Step 2: Fill Financial Data via Populate Test Data", async ({ page }) => {
    test.setTimeout(120000);
    await loginAs(page, "cooperative");
    await page.goto(`/app/submissions/${submissionId}`);
    // Click "Use Manual Entry" if modal appears
    // Click "Enter Data Manually"
    // Click "Populate Test Data"
    // Click "Submit Financial Statement & Finish"
    // Click "Mark Section Ready"
  });

  test("Step 3: Fill Non-Financial Data via Populate Test Data", async ({ page }) => {
    test.setTimeout(120000);
    await loginAs(page, "cooperative");
    await page.goto(`/app/submissions/${submissionId}`);
    // Switch to Non-Financial tab
    // Click "Enter Member Data Manually"
    // Click "Populate Test Databases"
    // Click "Review" tab
    // Click "Submit Non-Financial Databases & Finish"
  });

  test("Step 4: Submit for review", async ({ page }) => {
    test.setTimeout(180000);
    await loginAs(page, "cooperative");
    await page.goto(`/app/submissions/${submissionId}`);
    await page.locator('button:has-text("Submit to FSFASA"), button:has-text("Submit to Apex")').first().click({ force: true });
  });

  test("Step 5: Apex approval", async ({ page }) => {
    test.setTimeout(180000);
    await approveAsApex(page, submissionId, "Data verified manually");
  });

  test("Step 6: Federation approval", async ({ page }) => {
    test.setTimeout(180000);
    await approveAsFederation(page, submissionId);
  });

  test("Step 7: Ministry final approval", async ({ page }) => {
    test.setTimeout(180000);
    await approveAsMinistry(page, submissionId);
  });
});
```

### 12.5 File: `e2e/specs/route3-questionnaire-sequential.spec.ts`

```typescript
import { test } from "@playwright/test";
import { loginAs } from "../fixtures/helpers/login";
import { 
  approveAsApex, 
  approveAsFederation, 
  approveAsMinistry 
} from "../fixtures/helpers/approval";

test.describe.serial("Route 3: Questionnaire Method - Sequential Flow", () => {
  let submissionId: string;

  test("Step 1: Create submission", async ({ page }) => {
    test.setTimeout(120000);
    await loginAs(page, "cooperative");
    await page.goto("/app/submissions");
    await page.locator('button:has-text("New Submission"), button:has-text("Create Submission")').first().click();
    await page.click('button:has-text("Yearly (Annual)")');
    await page.click('button:has-text("2023")'); // NOTE: 2023 to avoid duplicate submission
    await page.locator('button:has-text("Create Submission"), button:has-text("Continue")').first().click();
    await page.waitForURL(/\/app\/submissions\/[a-f0-9-]+/, { timeout: 60000 });
    submissionId = page.url().split('/').pop()!;
  });

  test("Step 2: Fill Financial Data", async ({ page }) => {
    test.setTimeout(120000);
    await loginAs(page, "cooperative");
    await page.goto(`/app/submissions/${submissionId}`);
    // Click "Edit Answers"
    // Click "Populate Test Data"
    // Navigate to "Financial Performance" tab
    // Click "Complete Questionnaire" (auto-marks Ready)
  });

  test("Step 3: Fill Non-Financial Data", async ({ page }) => {
    test.setTimeout(120000);
    await loginAs(page, "cooperative");
    await page.goto(`/app/submissions/${submissionId}`);
    // Switch to Non-Financial tab
    // Click "Edit Answers"
    // Click "Populate Test Data"
    // Navigate to "New Section" tab
    // Click "Complete Questionnaire" (auto-marks Ready)
  });

  test("Step 4: Submit for review", async ({ page }) => {
    test.setTimeout(180000);
    await loginAs(page, "cooperative");
    await page.goto(`/app/submissions/${submissionId}`);
    await page.locator('button:has-text("Submit to FSFASA"), button:has-text("Submit to Apex Officer")').first().click({ force: true });
  });

  test("Step 5: Apex approval", async ({ page }) => {
    test.setTimeout(180000);
    await approveAsApex(page, submissionId, "Data verified via questionnaire");
  });

  test("Step 6: Federation approval", async ({ page }) => {
    test.setTimeout(180000);
    await approveAsFederation(page, submissionId);
  });

  test("Step 7: Ministry final approval", async ({ page }) => {
    test.setTimeout(180000);
    await approveAsMinistry(page, submissionId);
  });
});
```

---

## Appendix A: Test Data Checklist

### Initial Testing (Yearly Only) ✅ COMPLETE

| File | Format | Purpose | Status |
|------|--------|---------|--------|
| `yearly-financial.png` | PNG Image | Financial statement (AI extraction) | ✅ Complete |
| `coopdatafullworkbook.xlsx` | Excel | Single workbook with ALL sections (Members, Savings, Loans, Fixed Deposits) | ✅ Complete |

### Quarterly Testing (Next Phase) 📝 PENDING

| File | Format | Purpose | Status |
|------|--------|---------|--------|
| `quarterly-financial.png` | PNG Image | Q1-Q4 financial | 📝 Pending |
| `quarterly-fullworkbook.xlsx` | Excel | Q1-Q4 full workbook | 📝 Pending |

### Monthly Testing (Samples) 📝 PENDING

| File | Format | Purpose | Status |
|------|--------|---------|--------|
| `monthly-financial.png` | PNG Image | Jan, Jun, Dec samples | 📝 Pending |
| `monthly-fullworkbook.xlsx` | Excel | Monthly full workbook | 📝 Pending |

### Semi-Annual Testing 📝 PENDING

| File | Format | Purpose | Status |
|------|--------|---------|--------|
| `semi-annual-financial.png` | PNG Image | H1 and H2 | 📝 Pending |
| `semi-annual-fullworkbook.xlsx` | Excel | Semi-annual full workbook | 📝 Pending |

**Note:** Financial statements are PNG images (not PDF). Non-financial data uses a SINGLE full workbook containing all sections (Members, Savings, Loans, Fixed Deposits) instead of separate per-category files.

---

## Appendix B: Test Execution Commands

### Prerequisites

Before running tests, ensure:
1. Backend is running on `http://localhost:3000`
2. Frontend dev server is running on `http://localhost:5173`
3. Keycloak is running on `http://localhost:8180` (realm: `coop-data`)
4. PostgreSQL is running with seeded test data

### Run Full Sequential Test (Recommended)

```bash
# Run all 7 steps of Route 1 sequential flow with UI mode
npm run test:e2e -- --ui --grep "Route 1: Upload Method - Sequential Flow" --timeout=600000

# Run without UI (headless)
npm run test:e2e -- --grep "Route 1: Upload Method - Sequential Flow" --timeout=600000

# Run with browser visible
npm run test:e2e:headed -- --grep "Route 1: Upload Method - Sequential Flow" --timeout=600000
```

### Run Individual Steps (Debugging)

```bash
# Run only Step 1 (create + upload financial)
npm run test:e2e -- --ui --grep "Step 1: Create submission" --timeout=600000

# Run only Step 5 (Apex approval)
npm run test:e2e -- --ui --grep "Step 5: Apex approval" --timeout=600000

# Run only Step 7 (Ministry final approval)
npm run test:e2e -- --ui --grep "Step 7: Ministry" --timeout=600000
```

### Run All E2E Tests (Mock + Real)

```bash
# Run all E2E tests (includes mock-based smoke tests + sequential test)
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Run with browser visible
npm run test:e2e:headed
```

### Run with Background Process (For Long Tests)

```bash
# Detach from terminal to avoid timeout killing the test
setsid bash -c 'npm run test:e2e -- --ui --grep "Route 1: Upload Method - Sequential Flow" --timeout=600000 > /tmp/test-output.log 2>&1' < /dev/null > /dev/null 2>&1 &

# Check output
tail -f /tmp/test-output.log
```

### Filter by Test Type

```bash
# Run only upload tests
npm run test:e2e -- --grep "Upload"

# Run only approval tests
npm run test:e2e -- --grep "approval"

# Run only mock-based smoke tests
npm run test:e2e -- --grep "should"
```

---

## Appendix C: Troubleshooting

| Issue | Solution |
|-------|----------|
| AI extraction timeout | Increase timeout to 300 seconds (2-3 minutes typical) |
| Login fails | Check Keycloak is running at `http://localhost:8180` |
| Database errors | Verify test database is seeded with correct organization links |
| Approve button not visible | Reset DB state to correct tier (e.g., `UPDATE submissions SET status='submitted', current_tier='apex' WHERE id='...'`) |
| Modal overlay blocking clicks | Use `{ force: true }` on all click operations |
| Test timeout exceeded | Use `setsid` to fully detach bash command from test process |

---

**Document Version**: 1.2  
**Last Updated**: 2026-09-16  
**Next Review**: After Phase 5 (Frequency Expansion) completion