# T15: Unit, Integration & E2E Tests

> **Status:** 🔄 In Progress (Phase 1 & E2E Route 1 Complete)
> **Ticket:** T15
> **Goal:** Comprehensive test coverage across backend, frontend, and E2E

---

## Overview

T15 aims to establish a robust testing strategy covering:

1. **Backend Tests** - Unit tests for services, integration tests for handlers, repository tests
2. **Frontend Tests** - Unit tests for hooks, utilities, components, and pages
3. **E2E Tests** - End-to-end tests for critical user flows using Playwright

---

## Part 1: Backend Tests

### Current State

| Test Type | Count | Status | Location |
|-----------|-------|--------|----------|
| Handler Integration Tests | 22 | ✅ Passing | `backend/tests/` |
| DTO Tests | 7 | ✅ Passing | Inline in `dto/*.rs` |
| Audit Tests | 15 | ✅ Passing | `backend/tests/handlers_audit.rs` |
| Error Handling Tests | 11 | ✅ Passing | `backend/tests/handlers_error_handling.rs` |
| Repository Tests | 0 | ❌ None | N/A |
| Service Unit Tests | ~8 | ⚠️ Partial | Inline in `services/*.rs` |

### What's Missing

#### 1. Repository Tests (HIGH PRIORITY)

**Why:** Repository tests directly test database queries without going through handlers.

**Target Files:**
```
backend/src/repositories/
├── submission.rs      → 0 tests
├── user.rs            → 0 tests
├── cooperative.rs     → 0 tests
├── apex.rs            → 0 tests
├── federation.rs      → 0 tests
├── audit_log.rs       → 0 tests
├── custom_kpi.rs      → 0 tests
└── financial_statement.rs → 0 tests
```

**Example Test Structure:**

```rust
// backend/tests/repositories/submission.rs
#[cfg(test)]
mod tests {
    use super::*;
    use coop_data_backend::entities::prelude::*;
    use coop_data_backend::entities::submission::Status;
    
    async fn setup_test_db() -> Database {
        // Create test database with schema
    }
    
    #[tokio::test]
    async fn test_create_submission() {
        let db = setup_test_db().await;
        let repo = SubmissionRepository::new(db.clone());
        
        let submission = repo.create(/* ... */).await.unwrap();
        
        assert!(submission.id.is_some());
        assert_eq!(submission.status, Status::Draft);
    }
    
    #[tokio::test]
    async fn test_find_by_id_returns_none_for_nonexistent() {
        let db = setup_test_db().await;
        let repo = SubmissionRepository::new(db.clone());
        
        let result = repo.find_by_id(Uuid::new_v4()).await.unwrap();
        
        assert!(result.is_none());
    }
    
    #[tokio::test]
    async fn test_delete_submission() {
        let db = setup_test_db().await;
        let repo = SubmissionRepository::new(db.clone());
        
        // Create and delete
        let submission = repo.create(/* ... */).await.unwrap();
        repo.delete(submission.id).await.unwrap();
        
        // Verify deleted
        let result = repo.find_by_id(submission.id).await.unwrap();
        assert!(result.is_none());
    }
}
```

#### 2. Service Unit Tests (MEDIUM PRIORITY)

**Target Services:**
- `kpi_engine.rs` - Already has 8 tests, expand coverage
- `nf_indicator_engine.rs` - No tests
- `submission_workflow.rs` - No tests
- `audit.rs` - No tests

**Example Test Structure:**

```rust
// backend/src/services/kpi_engine.rs
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_par30_calculation_normal() {
        let loan_balance = 100_000.0;
        let overdue_30 = 5_000.0;
        
        let par30 = calculate_par30(loan_balance, overdue_30);
        
        assert!((par30 - 5.0).abs() < 0.01); // 5% with tolerance
    }
    
    #[test]
    fn test_par30_calculation_zero_balance() {
        let loan_balance = 0.0;
        let overdue_30 = 0.0;
        
        let par30 = calculate_par30(loan_balance, overdue_30);
        
        assert_eq!(par30, 0.0); // Should handle zero division
    }
    
    #[test]
    fn test_roe_calculation() {
        let net_income = 50_000.0;
        let equity = 500_000.0;
        
        let roe = calculate_roe(net_income, equity);
        
        assert!((roe - 10.0).abs() < 0.01); // 10% ROE
    }
}
```

#### 3. Workflow State Machine Tests (HIGH PRIORITY)

**Why:** Submission workflow has complex state transitions that need testing.

```rust
#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_submission_workflow_draft_to_submitted() {
        let workflow = SubmissionWorkflow::new(/* ... */);
        
        // Create draft
        let submission = workflow.create_submission(coop_id, year).await.unwrap();
        assert_eq!(submission.status, SubmissionStatus::Draft);
        
        // Submit
        let submitted = workflow.submit(submission.id, &claims).await.unwrap();
        assert_eq!(submitted.status, SubmissionStatus::Submitted);
    }
    
    #[tokio::test]
    async fn test_submission_workflow_cannot_submit_after_approved() {
        let workflow = SubmissionWorkflow::new(/* ... */);
        
        // Create and approve
        let submission = workflow.create_submission(coop_id, year).await.unwrap();
        workflow.submit(submission.id, &claims).await.unwrap();
        workflow.apex_approve(submission.id, &claims).await.unwrap();
        workflow.federation_approve(submission.id, &claims).await.unwrap();
        let approved = workflow.ministry_approve(submission.id, &claims).await.unwrap();
        
        assert_eq!(approved.status, SubmissionStatus::Approved);
        
        // Try to submit again - should fail
        let result = workflow.submit(submission.id, &claims).await;
        assert!(result.is_err());
    }
    
    #[tokio::test]
    async fn test_submission_workflow_reject_flow() {
        let workflow = SubmissionWorkflow::new(/* ... */);
        
        // Create, submit, reject
        let submission = workflow.create_submission(coop_id, year).await.unwrap();
        workflow.submit(submission.id, &claims).await.unwrap();
        workflow.apex_approve(submission.id, &claims).await.unwrap();
        
        let rejected = workflow.ministry_reject(
            submission.id, 
            &claims, 
            "Data inconsistency detected"
        ).await.unwrap();
        
        assert_eq!(rejected.status, SubmissionStatus::Rejected);
        assert_eq!(rejected.rejection_reason, Some("Data inconsistency detected".to_string()));
    }
}
```

---

## Part 2: Frontend Tests

### Current State

| Test Type | Count | Status | Location |
|-----------|-------|--------|----------|
| Auth Context Tests | 16 | ✅ Passing | `AuthContext.test.tsx` |
| Role Constants Tests | 39 | ✅ Passing | `roles.test.ts` |
| Route Guard Tests | 18 | ✅ Passing | `route-guards.test.ts` |
| Protected Route Tests | 16 | ✅ Passing | `ProtectedRoute.test.tsx` |
| Error Boundary Tests | 9 | ✅ Passing | `ErrorBoundary.test.tsx` |
| Hook Tests | 8 | ✅ Passing | `useLatestSubmission.test.ts` |
| Utility Tests | 14 | ✅ Passing | `passwordPolicy.test.ts`, `line-items.test.ts` |
| Sync Queue Tests | 5 | ✅ Passing | `syncQueueService.test.ts` |
| Offline Cache Tests | 4 | ✅ Passing | `offlineCache.test.ts` |
| Component Tests | 11 | ✅ Passing | `BasicCooperativeComparison.test.tsx` |
| **TOTAL** | **401** | ✅ | **28 files** |

### What's Missing

#### 1. Hook Tests (HIGH PRIORITY)

**Target Hooks:**
```
frontend/src/hooks/
├── submissions/
│   ├── useSubmissions.ts        → Not tested
│   ├── useSubmission.ts        → Partial (useLatestSubmission tested)
│   ├── useCreateSubmission.ts  → Not tested
│   └── useSubmitSubmission.ts  → Not tested
├── federations/
│   ├── useFederations.ts       → Not tested
│   └── useFederationMembers.ts → Not tested
├── cooperatives/
│   ├── useCooperatives.ts      → Not tested
│   └── useCooperativeMembers.ts → Not tested
├── users/
│   ├── useUsers.ts            → Not tested
│   └── useCreateUser.ts       → Not tested
├── analytics/
│   ├── useNfStatistics.ts     → Not tested
│   ├── useNationalOverview.ts → Not tested
│   └── useBenchmarks.ts        → Not tested
└── audit/
    └── useAuditLogs.ts         → Not tested
```

**Example Test Structure:**

```typescript
// frontend/src/hooks/submissions/useSubmissions.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSubmissions } from './useSubmissions';

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useSubmissions', () => {
  it('should fetch submissions successfully', async () => {
    // Mock API response
    mockApiClient.GET.mockResolvedValue({
      data: {
        items: [{ id: '1', reference: 'SUB-001', status: 'Draft' }],
        total: 1,
        page: 1,
        per_page: 20,
      },
    });
    
    const { result } = renderHook(() => useSubmissions({}), {
      wrapper: createWrapper(),
    });
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    
    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0].reference).toBe('SUB-001');
  });
  
  it('should handle API errors', async () => {
    mockApiClient.GET.mockRejectedValue(new Error('Network error'));
    
    const { result } = renderHook(() => useSubmissions({}), {
      wrapper: createWrapper(),
    });
    
    await waitFor(() => expect(result.current.isError).toBe(true));
    
    expect(result.current.error).toBeDefined();
  });
  
  it('should filter by status', async () => {
    mockApiClient.GET.mockResolvedValue({
      data: {
        items: [{ id: '1', status: 'Submitted' }],
        total: 1,
        page: 1,
        per_page: 20,
      },
    });
    
    const { result } = renderHook(
      () => useSubmissions({ status: 'submitted' }),
      { wrapper: createWrapper() }
    );
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    
    expect(mockApiClient.GET).toHaveBeenCalledWith(
      '/api/v1/cooperative/submissions',
      expect.objectContaining({
        params: expect.objectContaining({
          query: expect.objectContaining({
            status: 'submitted',
          }),
        }),
      })
    );
  });
});
```

#### 2. Component Tests (MEDIUM PRIORITY)

**Target Components:**
```
frontend/src/components/
├── ui/                    → shadcn/ui components (already tested by library)
├── shared/
│   ├── ErrorBoundary.tsx  → Already tested ✅
│   └── DeleteConfirmationDialog.tsx → Not tested
├── submissions/
│   ├── SubmissionTable.tsx → Not tested
│   └── SubmissionForm.tsx  → Not tested
├── analytics/
│   ├── BenchmarkInsightPanel.tsx → Not tested
│   └── KpiScorecard.tsx   → Not tested
└── dashboards/
    └── KeyFinancialMetrics.tsx → Not tested
```

**Example Test Structure:**

```typescript
// frontend/src/components/submissions/SubmissionTable.test.tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubmissionTable } from './SubmissionTable';

const mockSubmissions = [
  { id: '1', reference: 'SUB-001', status: 'Draft', reporting_year: 2026 },
  { id: '2', reference: 'SUB-002', status: 'Submitted', reporting_year: 2026 },
];

describe('SubmissionTable', () => {
  it('should render submission rows', () => {
    render(<SubmissionTable submissions={mockSubmissions} />);
    
    expect(screen.getByText('SUB-001')).toBeInTheDocument();
    expect(screen.getByText('SUB-002')).toBeInTheDocument();
  });
  
  it('should display status badges', () => {
    render(<SubmissionTable submissions={mockSubmissions} />);
    
    const draftBadge = screen.getByTestId('status-badge-1');
    const submittedBadge = screen.getByTestId('status-badge-2');
    
    expect(within(draftBadge).getByText('Draft')).toBeInTheDocument();
    expect(within(submittedBadge).getByText('Submitted')).toBeInTheDocument();
  });
  
  it('should call onRowClick when row is clicked', async () => {
    const onRowClick = vi.fn();
    render(
      <SubmissionTable 
        submissions={mockSubmissions} 
        onRowClick={onRowClick} 
      />
    );
    
    await userEvent.click(screen.getByText('SUB-001'));
    
    expect(onRowClick).toHaveBeenCalledWith(mockSubmissions[0]);
  });
  
  it('should show empty state when no submissions', () => {
    render(<SubmissionTable submissions={[]} />);
    
    expect(screen.getByText('No submissions found')).toBeInTheDocument();
  });
});
```

#### 3. Page Tests (LOW-MEDIUM PRIORITY)

**Target Pages:**
```
frontend/src/pages/
├── submissions/
│   └── SubmissionsPage.tsx → Not tested
├── analytics/
│   └── AnalyticsPage.tsx  → Not tested
├── dashboard/
│   └── DashboardPage.tsx  → Not tested
└── settings/
    └── SettingsPage.tsx   → Not tested
```

**Example Test Structure:**

```typescript
// frontend/src/pages/submissions/SubmissionsPage.test.tsx
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SubmissionsPage } from './SubmissionsPage';
import { TestWrapper } from '@/tests/TestWrapper';

describe('SubmissionsPage', () => {
  it('should render page title', () => {
    render(<SubmissionsPage />, { wrapper: TestWrapper });
    
    expect(screen.getByRole('heading', { name: /submissions/i })).toBeInTheDocument();
  });
  
  it('should render new submission button', () => {
    render(<SubmissionsPage />, { wrapper: TestWrapper });
    
    expect(screen.getByRole('button', { name: /new submission/i })).toBeInTheDocument();
  });
  
  it('should open new submission modal when button clicked', async () => {
    render(<SubmissionsPage />, { wrapper: TestWrapper });
    
    await userEvent.click(screen.getByRole('button', { name: /new submission/i }));
    
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  
  it('should display submissions table', async () => {
    render(<SubmissionsPage />, { wrapper: TestWrapper });
    
    await waitFor(() => {
      expect(screen.queryByRole('table')).toBeInTheDocument();
    });
  });
});
```

---

## Part 3: E2E Tests

### Current State

| Spec File | Tests | Status | Notes |
|-----------|-------|--------|-------|
| `route1-upload-sequential.spec.ts` | 7 | ✅ Passing | Full upload + approval chain (sequential) |
| `route2-manual-sequential.spec.ts` | 7 | ✅ Passing | Manual entry via "Populate Test Data" + approval chain |
| `route3-questionnaire-sequential.spec.ts` | 7 | ✅ Passing | Questionnaire via "Edit Answers" + approval chain |
| **TOTAL** | **21** | ✅ Passing | **Real Keycloak auth, real backend API** |

### Test Coverage

All three sequential test files cover the complete submission flow for each route:

| Step | Description | Route 1 | Route 2 | Route 3 |
|------|-------------|---------|---------|---------|
| Step 1 | Create submission | ✅ | ✅ | ✅ |
| Step 2 | Fill Financial data | Upload PNG (AI extraction) | "Populate Test Data" | "Edit Answers" + "Populate Test Data" |
| Step 3 | Fill Non-Financial data | Upload full workbook | "Populate Test Databases" | "Edit Answers" + "Populate Test Data" |
| Step 4 | Submit for review | ✅ | ✅ | ✅ |
| Step 5 | Apex approval | ✅ | ✅ | ✅ |
| Step 6 | Federation approval | ✅ | ✅ | ✅ |
| Step 7 | Ministry final approval | ✅ | ✅ | ✅ |

**Note:** Route 3 uses period **2023** (instead of 2024) to avoid duplicate submission conflicts with Routes 1 & 2.

### Test Architecture

- **Real Keycloak authentication** (not mocked) - tests against actual Keycloak realm
- **Real backend API** - tests against actual backend services
- **Sequential execution** using `describe.serial()` - stops at first failure for easy debugging
- **UI mode support** - can run with `--ui` flag for visual debugging
- **Force clicks** - bypass modal overlays that intercept pointer events
- **DOM content loaded** - avoids networkidle issues with React Query polling

### Test Users (Real Keycloak)

| Role | Email | Password |
|------|-------|----------|
| Cooperative | coopadmin@gmail.com | password |
| Apex | apex@gmail.com | password |
| Federation | yejami7300@ebflyai.com | password |
| Ministry | admin@ministry.gov | password |

### Test Data Files

| File | Purpose |
|------|---------|
| `e2e/fixtures/test-data/financial/yearly-financial.png` | AI-extracted financial statement |
| `e2e/fixtures/test-data/non-financial/coopdatafullworkbook.xlsx` | Full non-financial workbook (all sections) |
| `e2e/fixtures/test-data/non-financial/yearly-members.xlsx` | Membership data |
| `e2e/fixtures/test-data/non-financial/yearly-fixdeposit.xlsx` | Fixed deposits data |

### Helpers

| File | Purpose |
|------|---------|
| `e2e/fixtures/helpers/login.ts` | Real Keycloak login with storage clearing and retry logic |
| `e2e/fixtures/helpers/approval.ts` | Approval chain helpers (Apex/Federation/Ministry) with cooperative grid navigation |

### Running the Test

```bash
# Run full sequential test with UI mode
npm run test:e2e -- --ui --grep "Route 1: Upload Method - Sequential Flow" --timeout=600000

# Run specific step
npm run test:e2e -- --ui --grep "Step 5: Apex approval" --timeout=600000
```

### What's Missing

#### 1. Reject/Return Flow E2E Tests (MEDIUM PRIORITY)

**Why:** The current tests only cover the happy path (approve). We need to test rejection and return-for-correction flows.

```typescript
// frontend/e2e/specs/reject-return-flow.spec.ts
test.describe("Reject/Return Flow", () => {
  test("Apex should be able to return submission for changes", async ({ page }) => {
    // Login as apex
    // Navigate to submitted submission
    // Click "Request Changes" button
    // Fill return reason
    // Verify submission returned to cooperative
  });
  
  test("Ministry should be able to reject submission", async ({ page }) => {
    // Login as ministry
    // Navigate to submitted submission
    // Click "Reject" button
    // Fill rejection reason
    // Verify submission rejected
  });
});
```

#### 3. Offline-First E2E Tests (MEDIUM PRIORITY)

**Why:** App supports offline mode with sync queue - needs E2E coverage.

```typescript
// frontend/e2e/specs/offline-sync.spec.ts
test.describe("Offline Sync", () => {
  test("should queue actions when offline and sync when online", async ({ page }) => {
    // Go offline
    // Create submission
    // Verify queued in IndexedDB
    // Go online
    // Verify synced to backend
  });
});
```

#### 4. Audit Log E2E Tests (MEDIUM PRIORITY)

```typescript
// frontend/e2e/specs/audit-log.spec.ts
test.describe("Audit Log", () => {
  test("should show recent audit entries", async ({ page }) => {
    await loginAs(page, 'ministry');
    await page.goto('/app/audit-logs');
    await expect(page.getByText(/submission created/i)).toBeVisible();
  });
  
  test("should filter by action type", async ({ page }) => {
    await loginAs(page, 'ministry');
    await page.goto('/app/audit-logs');
    await page.getByLabel(/action type/i).selectOption('create');
    const rows = page.getByRole('row').filter({ hasText: /create/i });
    await expect(rows).toHaveCount(await rows.count());
  });
  
  test("should show actor information", async ({ page }) => {
    await loginAs(page, 'ministry');
    await page.goto('/app/audit-logs');
    await page.getByRole('row').first().click();
    await expect(page.getByText(/actor:/i)).toBeVisible();
    await expect(page.getByText(/timestamp:/i)).toBeVisible();
  });
});
```

---

## Part 4: Test Infrastructure

### Test Database Setup

```rust
// backend/tests/common/mod.rs
pub async fn setup_test_db() -> Database {
    // Use test database URL from environment
    let database_url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://localhost/coop_data_test".to_string());
    
    // Run migrations
    let db = Database::connect(&database_url).await.unwrap();
    
    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&db)
        .await
        .unwrap();
    
    db
}

pub async fn cleanup_test_db(db: &Database) {
    // Clean up test data
    sqlx::query("DELETE FROM audit_logs").execute(db).await.unwrap();
    sqlx::query("DELETE FROM submissions").execute(db).await.unwrap();
    // ... other tables
}
```

### Mock API Setup (Frontend)

```typescript
// frontend/tests/setup.ts
import { vi } from 'vitest';
import { mockApiClient } from '@/openapi-client';

export const setupMockApi = () => {
  vi.mock('@/openapi-client', () => ({
    apiClient: {
      GET: vi.fn(),
      POST: vi.fn(),
      PATCH: vi.fn(),
      DELETE: vi.fn(),
    },
  }));
};

export const mockApiResponse = <T>(data: T) => {
  return { data, error: undefined };
};

export const mockApiError = (message: string) => {
  return { 
    data: undefined, 
    error: { message, code: 'API_ERROR' } 
  };
};
```

---

## Part 5: Test Execution Commands

### Backend Tests

```bash
# Run all tests
cargo test

# Run with coverage (CI uses --fail-under 70)
cargo tarpaulin --workspace --all-features --out Xml --output-dir ./coverage --skip-clean --timeout 120 --exclude-files "src/main.rs" --fail-under 70

# Run specific test file
cargo test --test handlers_audit

# Run tests matching pattern
cargo test test_submission

# Run with logging
RUST_LOG=debug cargo test
```

### Frontend Tests

```bash
# Run all unit tests
npm run test:unit

# Run with coverage (CI enforces thresholds from vitest.config.ts)
npm run coverage

# Run specific file
npm run test:unit -- src/hooks/submissions/useSubmissions.test.ts

# Run in watch mode
npm run test:unit:watch

# Run E2E tests
npm run test:e2e

# Run E2E with UI
npm run test:e2e:ui

# Run E2E headed (see browser)
npm run test:e2e:headed

# Run full sequential workflow test (Route 1)
npm run test:e2e:workflow

# Run sequential workflow with UI
npm run test:e2e:workflow:ui

# Run sequential workflow headed
npm run test:e2e:workflow:headed
```

---

## Part 6: Coverage Targets

| Area | Current | Target | Priority |
|------|---------|--------|----------|
| Backend Handlers | ~60% | 80% | High |
| Backend Repositories | 0% | 70% | High |
| Backend Services | ~30% | 70% | Medium |
| Frontend Hooks | ~5% | 60% | High |
| Frontend Components | ~10% | 60% | Medium |
| Frontend Pages | 0% | 50% | Medium |
| E2E Critical Flows | ~40% | 80% | High |

---

## Part 7: Implementation Plan

### Phase 1: Fix E2E Environment (Day 1) ✅ COMPLETE
- [x] Run `npx playwright install`
- [x] Verify E2E tests run
- [x] Fix any broken tests
- [x] Implement real Keycloak auth (not mock)
- [x] Implement sequential test structure with `describe.serial()`
- [x] Implement approval chain helpers (Apex/Federation/Ministry)

### Phase 2: Backend Repository Tests (Day 2)
- [ ] Add submission repository tests
- [ ] Add user repository tests
- [ ] Add cooperative repository tests

### Phase 3: Frontend Hook Tests (Day 3)
- [ ] Add useSubmissions tests
- [ ] Add useFederations tests
- [ ] Add useCooperatives tests
- [ ] Add useUsers tests

### Phase 4: E2E Form Tests (Day 4)
- [x] Add upload submission E2E tests (Route 1 - Upload Method)
- [x] Add manual entry E2E tests (Route 2)
- [x] Add questionnaire E2E tests (Route 3)
- [ ] Add reject/return flow E2E tests
- [ ] Add offline sync E2E tests

### Phase 5: Component Tests (Day 5)
- [ ] Add SubmissionTable tests
- [ ] Add BenchmarkInsightPanel tests
- [ ] Add KeyFinancialMetrics tests

---

## References

- [Rust Testing Best Practices](https://doc.rust-lang.org/book/ch11-00-testing.html)
- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Trophy](https://kentcdodds.com/blog/the-testing-trophy)