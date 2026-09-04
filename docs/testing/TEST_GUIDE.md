# Unit Testing Guide — CoopData

> **Purpose:** Complete reference for every developer on the CoopData project. This document tells you what tests exist, what each test verifies, why it exists, how to run them, and how to write new ones.
>
> **Last Updated:** September 2026
> **Status:** 369 FE tests, 275 BE tests — all passing

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Test Inventory — Frontend](#2-test-inventory--frontend)
3. [Test Inventory — Backend](#3-test-inventory--backend)
4. [How to Run Tests](#4-how-to-run-tests)
5. [Testing Patterns & Conventions](#5-testing-patterns--conventions)
6. [Mocking Reference](#6-mocking-reference)
7. [Writing New Tests](#7-writing-new-tests)
8. [Coverage](#8-coverage)

---

## 1. Quick Start

### Run All Tests
```bash
# Frontend
cd frontend && npx vitest run

# Backend
cd backend && cargo test --lib
```

### Run One File
```bash
# Frontend
npx vitest run src/lib/utils.test.ts

# Backend
cargo test --lib utils::tests
```

### Run With Coverage
```bash
# Frontend
npx vitest run --coverage

# Backend (requires cargo-llvm-cov — Phase 4)
cargo llvm-cov --lib
```

---

## 2. Test Inventory — Frontend

### Overview

| File | Tests | Category | What It Verifies |
|------|-------|----------|-----------------|
| `src/lib/utils.test.ts` | 13 | Utilities | `cn()` — Tailwind class merging |
| `src/lib/financial-data.test.ts` | 37 | Financial Math | Balance sheet calculations |
| `src/lib/kpi-calculations.test.ts` | 52 | KPIs | All dashboard KPI computations |
| `src/lib/route-guards.test.ts` | 23 | Auth/Routing | Route access control |
| `src/constants/roles.test.ts` | 39 | Constants | Role hierarchy and mappings |
| `src/services/shared/authService.test.ts` | 37 | Auth | Keycloak token parsing, role mapping |
| `src/context/AuthContext.test.tsx` | 14 | Auth Context | Auth provider, useAuth, useRole, useCanAccess |
| `src/context/OrganizationLabelsContext.test.tsx` | 14 | i18n | Organization label translations |
| `src/hooks/shared/useOfflineQuery.test.tsx` | 10 | Offline Data | Offline-first query with IndexedDB caching |
| `src/hooks/shared/useNetworkStatus.test.ts` | 8 | Network | Network connectivity detection |
| `src/hooks/submissions/useLatestSubmission.test.ts` | 8 | Submissions | Latest submission sort logic |
| `src/hooks/auth/useVerifyIdentity.test.ts` | 9 | Auth | Identity verification flow |
| `src/hooks/auth/useSecuritySettings.test.tsx` | 10 | Security | MFA setup/disable/enable/reset |
| `src/services/shared/offlineCache.test.ts` | 4 | Offline Cache | IndexedDB cache get/set/delete/clear |
| `src/services/shared/syncQueueService.test.ts` | 5 | Sync Queue | Offline mutation queue |
| `src/services/shared/offlineDb.test.ts` | 3 | Offline DB | IndexedDB schema |
| `src/components/shared/DeleteConfirmationDialog.test.tsx` | 30 | Components | 3-step delete confirmation dialog |
| `src/components/shared/ResetMfaDialog.test.tsx` | 7 | Components | MFA reset dialog |
| `src/components/ProtectedRoute.test.tsx` | 17 | Components | Route protection and role redirects |
| `src/components/analytics/BenchmarkInsightPanel.test.tsx` | 13 | Analytics | Benchmark insight generation |
| `src/components/analytics/BasicCooperativeComparison.test.tsx` | 11 | Analytics | Basic cooperative comparison |
| `src/components/analytics/CooperativeComparison.test.tsx` | 2 | Analytics | Full comparison widget |
| `src/pages/ministry/__tests__/SettingsPage.test.tsx` | 6 | Pages | Settings page theme switching |
| `src/pages/cooperative/__tests__/QuestionnaireWizard.test.tsx` | 4 | Pages | Questionnaire wizard validation |

---

### Detailed Test Breakdown

---

#### `src/lib/utils.test.ts` — 13 tests

**File:** `frontend/src/lib/utils.ts`
**Purpose:** The `cn()` utility merges Tailwind CSS class names. Used everywhere in the codebase for conditional class names.

**Why it matters:** If `cn()` breaks, every button, modal, and form in the app gets wrong classes. Layouts collapse. Colors disappear.

**Tests:**

| Test | Input | Expected | Why |
|------|-------|----------|-----|
| `merges simple class names` | `cn("foo", "bar")` | `"foo bar"` | Basic string merging |
| `merges multiple class names` | `cn("flex", "items-center", "p-4")` | `"flex items-center p-4"` | Multiple classes |
| `filters out falsy values` | `cn("foo", false && "bar", undefined, "baz")` | `"foo baz"` | Conditional classes like `isActive && "active"` |
| `handles null as falsy` | `cn("foo", null, "bar")` | `"foo bar"` | Null inputs filtered |
| `handles empty string as falsy` | `cn("foo", "", "bar")` | `"foo bar"` | Empty strings filtered |
| `handles zero as falsy` | `cn("foo", 0, "bar")` | `"foo bar"` | Numeric zero filtered |
| `handles conditional classes with boolean` | `cn("base", true && "active", false && "disabled")` | `"base active"` | Boolean conditionals |
| `handles conditional classes with false` | `cn("base", false && "active")` | `"base"` | False conditionals |
| `handles template literal inputs` | `cn("button", \`btn-${size}\`)` | `"button btn-lg"` | Template literals |
| `handles clsx type inputs` | `cn(["foo", "bar"])` | `"foo bar"` | Array inputs |
| `handles nested arrays` | `cn("foo", [["bar", "baz"]])` | `"foo bar baz"` | Nested arrays |
| `handles no arguments` | `cn()` | `""` | Empty call |
| `deduplicates conflicting Tailwind classes` | `cn("p-4 p-6")` | `"p-6"` | Last Tailwind class wins |

---

#### `src/lib/financial-data.test.ts` — 37 tests

**File:** `frontend/src/lib/financial-data.ts`
**Purpose:** All balance sheet calculations for cooperative financial reporting. This is the core math layer — wrong numbers mean wrong compliance reports.

**Why it matters:** Cooperatives submit financial statements to the Ministry. If these calculations are wrong, the entire national financial intelligence system produces incorrect data.

**Helper:** `createMinimalBalanceSheet()` creates a fully-populated balance sheet with known values for testing.

**Tests:**

| Test Group | Tests | What It Verifies |
|-----------|-------|-----------------|
| `calculateTotalLiquidAssets` | 2 | Cash + bank + savings + short-term investments sum correctly |
| `calculateGrossLoanPortfolio` | 2 | All loan categories (performing + arrears stages) sum |
| `calculateTotalLoanLossProvisions` | 2 | General + specific provisions sum |
| `calculateNetLoanPortfolio` | 1 | Gross portfolio minus provisions |
| `calculateTotalOtherAssets` | 2 | Net fixed assets (cost minus depreciation) + receivables + intangibles |
| `calculateTotalAssets` | 2 | All asset categories sum; zero when empty |
| `calculateTotalMemberDeposits` | 1 | Voluntary + mandatory + fixed-term deposits sum |
| `calculateTotalBorrowings` | 1 | Short-term + long-term borrowings sum |
| `calculateTotalOtherLiabilities` | 1 | Payables + accrued + deferred income sum |
| `calculateTotalLiabilities` | 1 | All liability categories sum |
| `calculateTotalMemberShares` | 1 | Permanent + withdrawable share capital sum |
| `calculateTotalReserves` | 1 | Statutory + general + risk reserves sum |
| `calculateTotalRetainedEarnings` | 1 | Accumulated + current year surplus sum |
| `calculateTotalEquity` | 1 | Equity = Total Assets − Total Liabilities |
| `calculateTotalFinancialIncome` | 1 | Interest + fees/commissions income sum |
| `calculateTotalOtherIncome` | 1 | Other operating income |
| `calculateTotalIncome` | 1 | Financial + other income sum |
| `calculateTotalFinancialExpenses` | 1 | Deposit interest + borrowing interest sum |
| `calculateTotalOperatingExpenses` | 1 | Personnel + admin + governance + depreciation sum |
| `calculateTotalExpenses` | 1 | Financial + operating + credit loss sum |
| `calculateNetSurplus` | 3 | Net surplus = Income − Expenses; handles positive, zero, negative |
| `validateBalanceSheet` | 5 | Detects unbalanced sheets, negative values, PAR > 20%, zero assets, negative surplus |
| `createEmptyBalanceSheet` | 3 | Creates zeroed structure with USD currency, calendar year |

---

#### `src/lib/kpi-calculations.test.ts` — 52 tests

**File:** `frontend/src/lib/kpi-calculations.ts`
**Purpose:** Computes all dashboard KPIs from raw balance sheet and member data. These KPIs drive the entire analytics dashboard.

**Why it matters:** Ministry officials and federation officers make decisions based on these numbers. Wrong KPIs = wrong decisions.

**Test Groups:**

**`calculateFinancialKPIs` (22 tests):**
- Total assets, gross/net loan portfolio
- PAR30, PAR60, PAR90 (Portfolio at Risk — 30/60/90 days)
- ROA (Return on Assets), ROE (Return on Equity)
- Loan loss coverage
- Current ratio, capital adequacy ratio
- Deposits-to-loans ratio, savings-to-assets ratio
- Operational self-sufficiency
- Status thresholds (green/yellow/red)
- Formatting (currency symbol, percent symbol)

**`calculateMembershipKPIs` (12 tests):**
- Total members, women %, youth %, rural %
- Active members ratio, dormancy rate, exit rate
- AGM participation rate
- Membership growth rate
- Women in governance %
- Empty array handling

**`calculateSavingsKPIs` (6 tests):**
- Savings penetration, active savers ratio
- Dormant savings %, zero balance %
- Empty array handling

**`calculateLoanKPIs` (10 tests):**
- Credit penetration, on-time repayment ratio
- Loans in arrears %, women/youth/rural borrowers %
- Average loan size, loans per member
- Empty array handling

**`calculateFixedDepositKPIs` (5 tests):**
- FD penetration, long-term FD ratio
- Early withdrawal rate, FD rollover rate
- Empty array handling

---

#### `src/lib/route-guards.test.ts` — 23 tests

**File:** `frontend/src/lib/route-guards.ts`
**Purpose:** Controls which users can access which routes based on their role.

**Why it matters:** A cooperative user must never see federation-only pages. A ministry user sees everything. These guards are the security layer for the entire frontend.

**Test Groups:**

**`requireAuth` (4 tests):**
- Allows access when authenticated with valid profile
- Redirects to `/login` when not authenticated
- Redirects to `/login` when Keycloak init times out
- Redirects to `/unauthorized` when authenticated but no profile

**`requireRole` (6 tests):**
- Allows access when user has required role
- Allows access when user has one of multiple allowed roles
- Redirects to `/login` when not authenticated
- Redirects to `/unauthorized` when role doesn't match
- Redirects to `/unauthorized` when user has lower role in hierarchy

**`redirectIfAuthenticated` (4 tests):**
- Redirects to `/app/dashboard` when already authenticated
- Redirects to `/unauthorized` when authenticated but no profile
- Does nothing when not authenticated
- Does nothing when Keycloak init times out

**`ROUTE_ACCESS map` (9 tests):**
- All major routes defined
- Dashboard accessible to all roles
- `/app/federations` → ministry only
- `/app/apexes` → federation only
- `/app/cooperatives` → apex only
- `/app/submissions` → all roles
- `/app/users` → ministry/federation/apex (not cooperative)
- `/app/settings` → ministry only

---

#### `src/constants/roles.test.ts` — 39 tests

**File:** `frontend/src/constants/roles.ts`
**Purpose:** Defines the 4-role hierarchy (ministry → federation → apex → cooperative) and all role-related constants.

**Why it matters:** Every navigation decision, every API call, every page render depends on these role constants. The hierarchy is the backbone of the entire permission system.

**Test Groups:**

**`ROLES` (2 tests):** Exactly 4 roles defined with label, shortLabel, description, icon.

**`ROLE_NAV` (4 tests):** Navigation groups defined per role; ministry gets all 3 groups; cooperative doesn't get system group.

**`ROLE_NAV_ITEMS` (8 tests):** Specific route access per role — federations only for ministry, apexes only for federation, cooperatives only for apex, etc.

**`ROLE_DASHBOARD` (2 tests):** Title and subtitle defined for every role.

**`ROLE_HIERARCHY` (4 tests):** Ministry=4, federation=3, apex=2, cooperative=1. Ordering enforced.

**`ROLE_DEFAULT_ROUTE` (1 test):** All roles redirect to `/app/dashboard`.

**`KEYCLOAK_ROLE_MAP` (6 tests):** Maps Keycloak roles to app roles. `regional_officer` → `apex`, `default-roles-coop-data` → `cooperative`.

**`mapKeycloakRolesToRole` (12 tests):** Priority: ministry > federation > apex > cooperative. Handles empty arrays, unknown roles, Keycloak built-in roles (`uma_authorization`, `offline_access`), deduplication, mixed role arrays.

---

#### `src/services/shared/authService.test.ts` — 37 tests

**File:** `frontend/src/services/shared/authService.ts`
**Purpose:** Keycloak authentication — token parsing, role extraction, login/logout.

**Why it matters:** If auth breaks, no user can log in. The entire app is inaccessible.

**Test Groups:**

**`isAuthenticated` (3 tests):** Returns true/false based on Keycloak state; handles undefined.

**`getUserProfile` (18 tests):** The most critical function. Extracts profile from JWT token:
- Returns null when not authenticated
- Returns null when no recognized role
- Returns correct profile for ministry, federation, apex, cooperative roles
- Extracts initials from `given_name` + `family_name`
- Falls back to `name` split when given/family names missing
- Uses `??` for initials when no name info
- Sets region: "National" for ministry, orgName for federation, "Unknown" when no org
- Includes `assigned_dimensions` and `realmRoles`
- Merges `is_member_of` into `realmRoles`
- Deduplicates roles
- Prioritizes higher roles in mixed tokens

**`hasRole` (3 tests):** Returns true when user has the role, false otherwise.

**`hasAnyRole` (4 tests):** Returns true when user has one of the roles; false when not authenticated or no recognized role.

**`login` (1 test):** Calls Keycloak login with correct redirect URI and scope.

**`logout` (1 test):** Calls Keycloak logout and clears tokens.

**`getAccessToken` (3 tests):** Returns token when authenticated; throws when not; handles refresh failure.

**`initKeycloak` (2 tests):** Initializes Keycloak with correct config; returns false on init failure.

**`waitForKeycloakReady` (1 test):** Resolves true when already initialized.

---

#### `src/context/AuthContext.test.tsx` — 14 tests

**File:** `frontend/src/context/AuthContext.tsx`
**Purpose:** React context that provides auth state to the entire app.

**Why it matters:** Every component that needs auth data uses this context. If it breaks, nothing auth-related works.

**Test Groups:**

**`useAuth` (7 tests):**
- Throws when used outside provider
- Shows loading state while initializing
- Sets authenticated state when init succeeds
- Sets unauthenticated when init returns false
- Handles init errors gracefully
- Exposes login function
- Exposes logout function that clears state

**`hasRole / hasAnyRole from context` (2 tests):** Context methods work correctly.

**`useRole` (2 tests):** Returns role when authenticated, null when not.

**`useUserRole` (2 tests):** Returns null while loading, role when loaded.

**`useCanAccess` (3 tests):** Returns true/false for route access; false when not authenticated.

---

#### `src/context/OrganizationLabelsContext.test.tsx` — 14 tests

**File:** `frontend/src/context/OrganizationLabelsContext.tsx`
**Purpose:** Provides translated organization labels (federation/cooperative/apex/ministry) for i18n.

**Why it matters:** The app uses Swazi names for organizations ("Umphakatsi" for federation). This context provides the right translation based on language.

**Test Groups:**

**`getLabel` (4 tests):**
- Returns translated label for current language
- Returns default label when no translation exists
- Returns provided fallback when key not found
- Returns key itself when no fallback provided

**`replaceOrgTerms` (4 tests):**
- Replaces plural org terms in text
- Replaces singular org terms in text
- Handles empty string
- Handles null/undefined gracefully

**`short labels` (1 test):** Provides fedShort, apexShort, coopShort, ministryShort.

**`isLoading` (2 tests):** Reflects loading state from hook.

**`labels array` (2 tests):** Provides labels from hook; empty array when undefined.

---

#### `src/hooks/shared/useOfflineQuery.test.tsx` — 10 tests

**File:** `frontend/src/hooks/shared/useOfflineQuery.ts`
**Purpose:** Offline-first query hook — wraps TanStack Query with IndexedDB caching. The core of the app's offline capability.

**Why it matters:** Field workers in rural Eswatini may lose connectivity. This hook ensures the app works offline by caching API responses in IndexedDB and serving from cache when offline.

**Test Groups:**

**Online behavior (3 tests):**
- Fetches data online and caches it to IndexedDB
- Does not cache null/undefined responses
- Sets networkMode to offlineFirst

**Offline behavior (4 tests):**
- Returns cached data when offline
- Falls back to cache when API fails
- Returns empty array fallback when offline with no cache (for list-type keys)
- Returns empty object fallback when offline with no cache (for non-list keys)

**Edge cases (3 tests):**
- Uses custom fallbackData when provided
- Respects isOfflineModeActive() flag from auth service
- Does not call queryFn when offline (no retry)

---

#### `src/hooks/shared/useNetworkStatus.test.ts` — 8 tests

**File:** `frontend/src/hooks/shared/useNetworkStatus.ts`
**Purpose:** Tracks browser network connectivity and pending offline mutations.

**Why it matters:** The app needs to know when the user goes offline to switch to cached data, and needs to show pending sync count so users know their offline changes haven't been uploaded yet.

**Test Groups:**

**Network state (3 tests):**
- Returns isOnline=true when navigator is online
- Returns isOnline=false when navigator is offline
- Returns isOnline=false when offline mode is active

**Reconnection (2 tests):**
- Sets wasOffline=true briefly after coming back online
- Resets wasOffline=false after 5 seconds

**Sync queue (3 tests):**
- Tracks pending sync count from IndexedDB
- Initializes with pending count from sync queue
- Flushes sync queue when coming online

---

#### `src/hooks/submissions/useLatestSubmission.test.ts` — 8 tests

**File:** `frontend/src/hooks/submissions/useLatestSubmission.ts`
**Purpose:** Picks the submission with the highest reporting year from a list.

**Why it matters:** Cooperatives submit yearly. If they have a 2025 submission in draft (returned by apex), we still show 2025 — not fall back to 2024 approved. Year always wins over status.

**Tests:**
- Returns undefined for empty array
- Returns submission with highest reporting_year
- Year wins over status (2025 draft > 2024 approved)
- Does not mutate original array
- Handles single submission
- Works with many years
- Falls back to last year when no current year submission exists

---

#### `src/hooks/auth/useVerifyIdentity.test.ts` — 9 tests

**File:** `frontend/src/hooks/auth/useVerifyIdentity.ts`
**Purpose:** Verifies user identity with password (+ optional OTP) before sensitive actions like deletion.

**Why it matters:** Before deleting a federation, the system must verify the user's password. This prevents unauthorized deletions.

**Tests:**
- Returns ok=true with verification_token on success
- Passes OTP in request body when provided
- Does not include OTP when not provided
- Returns ok=false on HTTP error with error message
- Returns ok=false on network error
- Handles OTP challenge (requires_otp=true without token)
- Handles error without message field
- Handles malformed error response with status code
- Sets isPending during call, resets after

---

#### `src/hooks/auth/useSecuritySettings.test.tsx` — 10 tests

**File:** `frontend/src/hooks/auth/useSecuritySettings.ts`
**Purpose:** MFA management hooks — fetch status, setup, enable, disable, reset.

**Tests:**
- Fetches MFA status from `/api/v1/me/security`
- Throws readable error when fetch fails
- POSTs to setup endpoint, marks MFA enabled
- Surfaces backend error when setup fails
- DELETE credentials and return updated settings
- Surfaces backend error when disabling fails
- POSTs enable endpoint with credential preserved
- Surfaces backend error when re-enabling fails
- POSTs reset endpoint with credential cleared
- Surfaces backend error when resetting fails

---

#### `src/services/shared/offlineCache.test.ts` — 4 tests

**File:** `frontend/src/services/shared/offlineCache.ts`
**Purpose:** IndexedDB cache layer — stores API responses for offline access.

**Tests:**
- Sets and gets cache values successfully
- Returns null on cache miss (not unrelated entities)
- Deletes cache entries
- Clears cache for specific user

---

#### `src/services/shared/syncQueueService.test.ts` — 5 tests

**File:** `frontend/src/services/shared/syncQueueService.ts`
**Purpose:** Offline mutation queue — stores mutations made offline, replays them when back online.

**Tests:**
- Enqueues sync item with correct status
- Replays verification token in headers on flush
- Scopes runMutation items to current user ID
- Throws online error on runMutation failure
- Blocks offline delete immediately (destructive actions can't be done offline)

---

#### `src/services/shared/offlineDb.test.ts` — 3 tests

**File:** `frontend/src/services/shared/offlineDb.ts`
**Purpose:** IndexedDB schema definition.

**Tests:**
- Exports instance of CoopDataOfflineDB
- Defines all required tables (submissions, analytics, federations, apexes, users, cooperatives, formTemplates, reports, syncQueue, meta)
- Has correct version (>= 2)

---

#### `src/components/shared/DeleteConfirmationDialog.test.tsx` — 30 tests

**File:** `frontend/src/components/shared/DeleteConfirmationDialog.tsx`
**Purpose:** 3-step delete confirmation — type name → verify password → delete.

**Why it matters:** Deleting a federation cascades to delete all apexes, cooperatives, and members under it. This dialog prevents accidental deletions with a multi-step confirmation.

**Step 1 — Confirm (8 tests):**
- Renders dialog with entity name and cascade counts
- Shows loading state while calculating cascade impact
- Disables Continue button when typed name doesn't match
- Enables Continue when name matches exactly
- Ignores partial match
- Calls onOpenChange(false) on Cancel
- Ignores leading/trailing whitespace
- Only shows non-zero cascade counts

**Step 2 — Verify (8 tests):**
- Transitions to verify step after typing name and clicking Continue
- Shows password input on verify step
- Disables Verify button when password is empty
- Enables Verify when password entered
- Calls onVerifyIdentity with password on Verify click
- Shows error message when verification fails
- Goes back to confirm step on Back click

**Step 3 — Deleting (5 tests):**
- Shows deleting spinner after successful verification
- Calls onConfirmDelete with verification token
- Closes dialog after successful delete
- Shows error and returns to verify step when delete fails

**OTP (2FA) support (3 tests):**
- Shows OTP field after backend returns requires_otp=true
- Reveals OTP field when backend returns OTP challenge (ok=false, requires_otp=true)
- Completes delete flow with OTP

**State reset (1 test):** Resets all state when dialog is reopened.

---

#### `src/components/shared/ResetMfaDialog.test.tsx` — 7 tests

**File:** `frontend/src/components/shared/ResetMfaDialog.tsx`
**Purpose:** MFA reset dialog — lets users reset their authenticator device.

**Tests:**
- Renders dialog when open, hides when closed
- Calls resetMfa with password and OTP on success
- Disables reset button until password + 6-digit OTP provided
- Calls resetMfa without OTP in lost-device mode
- Allows returning to standard method from lost-device mode
- Redirects through Keycloak to scan new QR after successful reset

---

#### `src/components/ProtectedRoute.test.tsx` — 17 tests

**File:** `frontend/src/components/ProtectedRoute.tsx`
**Purpose:** Route wrapper that checks auth and role before rendering children.

**Test Groups:**

**ProtectedRoute (9 tests):**
- Shows loading spinner while isLoading=true
- Redirects to login when not authenticated
- Shows unauthorized page when authenticated but no profile
- Renders children when authenticated with valid user
- Renders children when user has allowed role
- Shows unauthorized when user role not in allowedRoles
- Renders children when allowedRoles is empty (no restriction)
- Renders children for federation user with multi-role allowedRoles
- Shows unauthorized for cooperative with ministry-only allowedRoles

**RoleRedirect (5 tests):**
- Shows unauthorized when no user
- Redirects to dashboard for ministry/federation/apex/cooperative users

---

#### `src/components/analytics/BenchmarkInsightPanel.test.tsx` — 13 tests

**File:** `frontend/src/components/analytics/BenchmarkInsightPanel.tsx`
**Purpose:** Generates performance insights by comparing KPIs against sector benchmarks.

**Test Groups:**

**`generateInsights` (10 tests):** Pure function tests:
- Returns empty when no benchmarks match
- Returns empty when difference < 5% (no actionable insight)
- Generates positive insight when higher-is-better KPI is above average
- Generates critical insight when higher-is-better KPI is 30% below average
- Generates positive insight when lower-is-better KPI is below average
- Generates warning insight when lower-is-better KPI is 20% above average
- Sorts insights: critical → warning → positive
- Skips benchmarks with zero sample_count
- Skips benchmarks with zero sector_average (avoids division by zero)
- Includes kpi.formatted in generated message

**BenchmarkInsightPanel rendering (3 tests):**
- Renders loading skeletons when isLoading=true
- Renders empty state when benchmarks array is empty
- Renders "all metrics within" message when no actionable insights
- Renders insight panel title
- Shows expand button when > 3 insights exist
- Expand button toggles to show all insights

---

#### `src/components/analytics/BasicCooperativeComparison.test.tsx` — 11 tests

**File:** `frontend/src/components/analytics/BasicCooperativeComparison.tsx`
**Purpose:** Compares a cooperative's basic metrics against national/regional/sector averages.

**Test Groups:**

**`computeKpiAverages` (3 tests):**
- Averages each metric over cooperatives-with-data
- Returns 0 for metrics with no values
- Is agnostic to value getter shape

**`buildBasicMetrics` (4 tests):**
- Covers all 15 questionnaire metric keys with correct units
- Groups metrics into membership (8), balances (4), income (3)
- Marks expenditure as lower-is-better

**BasicCooperativeComparison rendering (4 tests):**
- Renders no-approved-data empty state for coop without row
- Shows amber notice when coop exists but has no data
- Shows load-error state on fetch failure
- Renders full comparison widget for admin callers with population
- Renders no-population empty state for admins without rows

---

#### `src/components/analytics/CooperativeComparison.test.tsx` — 2 tests

**File:** `frontend/src/components/analytics/CooperativeComparison.tsx`
**Purpose:** Full KPI comparison widget with financial + non-financial data.

**Tests:**
- Renders full widget for coop user with financial + non-financial data
- Renders no-data empty state for coop without row

---

#### `src/pages/ministry/__tests__/SettingsPage.test.tsx` — 6 tests

**File:** `frontend/src/pages/ministry/SettingsPage.tsx`
**Purpose:** Ministry settings page — theme switching, language, configuration shortcuts.

**Tests:**
- Renders Appearance card with Light/Dark/System options
- Applies dark theme when Dark selected, saves to localStorage
- Renders language switcher
- Re-applies light theme after dark
- Renders configuration shortcuts linking to correct pages
- Opens Non-Financial Indicators manager and returns to settings

---

#### `src/pages/cooperative/__tests__/QuestionnaireWizard.test.tsx` — 4 tests

**File:** `frontend/src/pages/cooperative/QuestionnaireWizard.tsx`
**Purpose:** Multi-step questionnaire form for cooperative data submission.

**Tests:**
- Blocks Save & Next, toasts and focuses first missing field when field omitted
- Clears error ring once user types into flagged field
- Advances to next section after Save & Next when all fields filled
- Jumps to section with first missing field when completing questionnaire

---

## 3. Test Inventory — Backend

### Overview

| File | Tests | Category | What It Verifies |
|------|-------|----------|-----------------|
| `src/services/cache.rs` | 14 | Caching | Redis/in-memory cache get/set/delete/exists |
| `src/services/object_storage.rs` | 13 | Storage | Local file storage (S3 not needed) |
| `src/services/pdf_templates.rs` | 14 | PDF | HTML header/footer templates |
| `src/services/verification_token.rs` | 3 | Auth | Token generation and key format |
| `src/utils.rs` | 4 | Utils | Error mapping |
| `src/error.rs` | 2 | Error | Error type conversions |
| `src/config.rs` | 2 | Config | Config loading |
| `src/auth/claims.rs` | 5 | Auth | JWT claims parsing |
| `src/auth/rbac.rs` | 4 | Auth | RBAC role checks |
| `src/auth/middleware.rs` | 3 | Auth | Middleware extraction |
| `src/api/dto/*.rs` | 12 | DTOs | Serialization/deserialization |
| `src/api/handlers/*.rs` | 8 | Handlers | Handler integration |
| `src/services/benchmark.rs` | 4 | Analytics | Benchmark calculations |
| `src/services/kpi_engine.rs` | 3 | KPIs | KPI engine |
| `src/services/localization.rs` | 2 | i18n | Localization |
| `src/services/keycloak.rs` | 2 | Auth | Keycloak client |
| `src/services/nf_excel_parser.rs` | 2 | Parser | Excel parsing |
| `src/services/nf_indicator_engine.rs` | 2 | Indicators | Indicator engine |
| `src/models/keycloak.rs` | 2 | Models | Keycloak model |
| `src/api/dto/common.rs` | 4 | DTOs | Common types |

---

### Detailed Test Breakdown

---

#### `src/services/cache.rs` — 14 tests

**File:** `backend/src/services/cache.rs`
**Purpose:** Redis + in-memory caching layer with a `memory://` URL mode for zero-dependency testing.

**Why it matters:** Cache is used for session data, benchmark results, and KPI computations. Without it, every request hits the database.

**Tests:**

| Test | What It Verifies |
|------|-----------------|
| `get_returns_none_for_missing_key` | Cache miss returns `None`, not an error |
| `set_and_get_roundtrip` | Data written to cache can be read back, identical |
| `set_overwrites_existing` | Updating a key replaces the old value |
| `delete_removes_key` | Deleted keys no longer retrievable |
| `delete_nonexistent_is_ok` | Deleting a non-existent key doesn't error |
| `exists_returns_true_for_present_key` | `exists()` correctly identifies cached keys |
| `exists_returns_false_for_missing_key` | `exists()` returns false for cache misses |
| `invalidate_pattern_deletes_matching_keys` | Pattern invalidation (e.g., `user:*`) removes all matching keys |
| `invalidate_pattern_ignores_non_matching` | Non-matching keys survive pattern invalidation |
| `memory_backend_clone_is_independent` | Cloning a memory backend creates an independent copy |
| `memory_backend_is_send_sync` | The backend is `Send + Sync` (safe for async) |
| `batch_set_and_get` | Writing multiple keys and reading them all back works |
| `batch_delete_removes_all` | Batch delete removes all specified keys |
| `batch_delete_nonexistent_keys_are_ok` | Batch delete of non-existent keys doesn't error |

---

#### `src/services/object_storage.rs` — 13 tests

**File:** `backend/src/services/object_storage.rs`
**Purpose:** Local file storage (S3/MinIO backend available but not needed for tests).

**Why it matters:** Stores uploaded files, exported reports, generated PDFs. Uses `tempfile::TempDir` for zero-dependency testing.

**Tests:**

| Test | What It Verifies |
|------|-----------------|
| `local_storage_store_and_retrieve` | File written to disk can be read back byte-for-byte |
| `local_storage_retrieve_not_found` | Reading non-existent file returns `NotFound` error |
| `local_storage_delete_removes_file` | `delete()` removes file from disk |
| `local_storage_delete_nonexistent_is_ok` | Deleting non-existent file returns `Ok`, not error |
| `local_storage_store_creates_parent_dirs` | `store()` auto-creates nested directories |
| `local_storage_overwrites_existing_file` | Re-writing same key replaces old content |
| `local_storage_handles_binary_data` | Binary data (0x00–0xFF) survives roundtrip |
| `local_storage_handles_empty_file` | Zero-byte files can be stored and retrieved |
| `object_storage_service_wraps_local_backend` | `ObjectStorageService` delegates to backend |
| `object_storage_service_delete_object` | `ObjectStorageService.delete()` removes objects |
| `object_storage_service_defaults_content_type` | `None` content type defaults gracefully |

---

#### `src/services/pdf_templates.rs` — 14 tests

**File:** `backend/src/services/pdf_templates.rs`
**Purpose:** HTML header/footer templates used by Gotenberg for PDF rendering.

**Why it matters:** Every PDF report has the same header/footer. If the template is broken, every report looks broken.

**Tests:**

| Test | What It Verifies |
|------|-----------------|
| `pdf_header_html_is_valid_html` | Header has `<!DOCTYPE html>`, `<body>`, `</html>` |
| `pdf_header_html_contains_brand` | Header contains "CoopData" brand name |
| `pdf_header_html_uses_a4_page` | Header specifies A4 page size |
| `pdf_header_html_has_gradient_bar` | Header has blue gradient bar styling |
| `pdf_footer_html_is_valid_html` | Footer has valid HTML structure |
| `pdf_footer_html_contains_brand` | Footer contains "COOPDATA" and "Confidential" |
| `pdf_footer_html_has_page_number_placeholders` | Footer has `.pageNumber` and `.totalPages` spans |
| `pdf_footer_html_uses_a4_page` | Footer specifies A4 page size |
| `pdf_footer_html_has_gradient_rule` | Footer has gradient rule styling |
| `both_templates_use_same_font_family` | Both use "Helvetica Neue" font |
| `both_templates_use_utf8_charset` | Both declare UTF-8 charset |
| `header_and_footer_are_distinct` | Header and footer are different strings |
| `header_contains_no_footer_markers` | Header doesn't include "Confidential" or page numbers |
| `footer_contains_no_header_markers` | Footer doesn't include report title |

---

#### `src/services/verification_token.rs` — 3 tests

**File:** `backend/src/services/verification_token.rs`
**Purpose:** Generates secure tokens for sensitive operations (delete, MFA reset).

**Tests:**
- `test_redis_key_format` — Redis key format is correct
- `test_token_key_format` — Token key format is correct
- `test_generate_token_is_unique` — Generated tokens are unique

---

#### `src/utils.rs` — 4 tests

**File:** `backend/src/utils.rs`
**Purpose:** Utility functions for error mapping.

**Tests:**
- `test_from_io_error` — IO errors map to appropriate AppError
- `test_from_serde_json_error` — JSON errors map to appropriate AppError
- `test_into_app_result_err_maps_to_internal_server_error` — Result errors map to 500
- `test_into_app_result_ok` — Result ok passes through

---

#### `src/error.rs` — 2 tests

**File:** `backend/src/error.rs`
**Purpose:** AppError enum and IntoResponse implementation.

**Tests:** Error type conversions and HTTP response mapping.

---

#### `src/config.rs` — 2 tests

**File:** `backend/src/config.rs`
**Purpose:** Configuration loading from environment variables.

**Tests:** Config loads correctly from environment; handles missing variables gracefully.

---

#### `src/auth/claims.rs` — 5 tests

**File:** `backend/src/auth/claims.rs`
**Purpose:** JWT claims extraction and validation.

**Tests:** Claims parsing, role extraction, organization ID extraction.

---

#### `src/auth/rbac.rs` — 4 tests

**File:** `backend/src/auth/rbac.rs`
**Purpose:** Role-based access control checks.

**Tests:** Role hierarchy checks, permission validation.

---

#### `src/auth/middleware.rs` — 3 tests

**File:** `backend/src/auth/middleware.rs`
**Purpose:** Auth middleware extraction.

**Tests:** JWT extraction from headers, token validation.

---

#### `src/api/dto/*.rs` — 12 tests

**File:** `backend/src/api/dto/*.rs`
**Purpose:** DTO serialization/deserialization with serde.

**Tests:** JSON roundtrip, validation, error responses.

---

#### `src/api/handlers/*.rs` — 8 tests

**File:** `backend/src/api/handlers/*.rs`
**Purpose:** Handler integration tests.

**Tests:** API endpoint behavior, request/response handling.

---

#### `src/services/benchmark.rs` — 4 tests

**File:** `backend/src/services/benchmark.rs`
**Purpose:** Benchmark calculation engine.

**Tests:** Percentile calculations, sector averages, national averages.

---

#### `src/services/kpi_engine.rs` — 3 tests

**File:** `backend/src/services/kpi_engine.rs`
**Purpose:** KPI computation engine.

**Tests:** KPI calculations, threshold checks.

---

#### `src/services/localization.rs` — 2 tests

**File:** `backend/src/services/localization.rs`
**Purpose:** Server-side localization.

**Tests:** Translation lookups.

---

#### `src/services/keycloak.rs` — 2 tests

**File:** `backend/src/services/keycloak.rs`
**Purpose:** Keycloak client integration.

**Tests:** User lookup, organization management.

---

#### `src/services/nf_excel_parser.rs` — 2 tests

**File:** `backend/src/services/nf_excel_parser.rs`
**Purpose:** Non-financial Excel parsing.

**Tests:** Excel parsing, data extraction.

---

#### `src/services/nf_indicator_engine.rs` — 2 tests

**File:** `backend/src/services/nf_indicator_engine.rs`
**Purpose:** Non-financial indicator computation.

**Tests:** Indicator calculations.

---

#### `src/models/keycloak.rs` — 2 tests

**File:** `backend/src/models/keycloak.rs`
**Purpose:** Keycloak model types.

**Tests:** Model serialization.

---

#### `src/api/dto/common.rs` — 4 tests

**File:** `backend/src/api/dto/common.rs`
**Purpose:** Common DTO types (PaginatedResponse, ErrorResponse).

**Tests:** Pagination, error response format.

---

## 4. How to Run Tests

### Frontend

```bash
# All tests
cd frontend && npx vitest run

# One file
npx vitest run src/lib/utils.test.ts

# Watch mode (re-runs on file change)
npx vitest run --watch

# With coverage
npx vitest run --coverage

# With coverage report
npx vitest run --coverage --coverage.reporter=text --coverage.reporter=html
```

### Backend

```bash
# All unit tests
cd backend && cargo test --lib

# One module
cargo test --lib utils::tests

# All tests including integration
cargo test

# With output
cargo test --lib -- --nocapture

# Watch mode (requires cargo-watch)
cargo watch -x test --lib

# With coverage (Phase 4 — cargo-llvm-cov not yet installed)
cargo llvm-cov --lib
```

---

## 5. Testing Patterns & Conventions

### Frontend Conventions

**File naming:**
- Test files live next to the code they test
- Extension: `.test.ts` for pure TS, `.test.tsx` for React components/hooks
- Location: `src/lib/utils.test.ts`, `src/hooks/shared/useNetworkStatus.test.ts`

**Test structure — Arrange/Act/Assert (AAA):**
```typescript
it("does X when Y", () => {
  // 1. ARRANGE — set up test data
  const input = { id: "1", name: "Test" };

  // 2. ACT — run the function
  const result = myFunction(input);

  // 3. ASSERT — check the result
  expect(result).toBe("expected");
});
```

**describe blocks group related tests:**
```typescript
describe("myFunction", () => {
  describe("when input is valid", () => {
    it("returns correct result", () => { ... });
  });

  describe("when input is invalid", () => {
    it("throws an error", () => { ... });
  });
});
```

**Mocking external dependencies:**
```typescript
// Mock at module level with vi.hoisted for stable references
const mockGetPendingCount = vi.hoisted(() =>
  vi.fn<() => Promise<number>>().mockResolvedValue(0),
);

vi.mock("@/services/shared/syncQueueService", () => ({
  getPendingCount: mockGetPendingCount,
}));

// Use relative paths from test file location
vi.mock("../../services/shared/authService", () => ({
  isOfflineModeActive: mockIsOfflineModeActive,
}));
```

**Fake timers for setInterval/setTimeout:**
```typescript
beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
});

// Advance time past intervals
act(() => {
  vi.advanceTimersByTime(3000); // Past the 2-second interval
});
```

**React hook testing:**
```typescript
const { result } = renderHook(() => myHook());

await waitFor(() => {
  expect(result.current.data).toBeDefined();
});
```

### Backend Conventions

**Inline test modules:**
```rust
#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_data() -> Vec<u8> {
        b"Hello, CoopData!".to_vec()
    }

    #[tokio::test]
    async fn my_test() {
        let cache = CacheService::new("memory://").await.unwrap();
        cache.set("key", &create_test_data(), Duration::from_secs(300)).await.unwrap();
        let result = cache.get::<Vec<u8>>("key").await.unwrap();
        assert_eq!(result, Some(create_test_data()));
    }
}
```

**Test naming:** `snake_case` with descriptive names:
- `set_and_get_roundtrip`
- `returns_none_for_missing_key`
- `handles_empty_array`

**Assertions:**
- `assert_eq!(actual, expected)` — most common
- `assert!(condition)` — boolean checks
- `assert!(matches!(value, Pattern))` — pattern matching
- `debug_assert!` — only in debug builds

---

## 6. Mocking Reference

### Frontend Mocking

| What | How | Example |
|------|-----|---------|
| Service module | `vi.mock()` with `vi.hoisted()` | `vi.mock("@/services/shared/authService", ...)` |
| React Query | `QueryClientProvider` wrapper | `renderHook(() => hook(), { wrapper: createWrapper() })` |
| TanStack Router | Mock `Navigate` component | `vi.mock("@tanstack/react-router", ...)` |
| IndexedDB | Mock `offlineDb` table | `vi.mock("./offlineDb", ...)` |
| Keycloak | Mock `keycloak` instance | `vi.mock("./keycloakConfig", ...)` |
| i18next | Mock `useTranslation` | `vi.mock("react-i18next", ...)` |
| Sonner toast | Mock `toast` | `vi.mock("sonner", ...)` |
| Browser APIs | `Object.defineProperty` | `Object.defineProperty(navigator, "onLine", ...)` |
| Timers | `vi.useFakeTimers()` | `vi.advanceTimersByTime(3000)` |
| Fetch | `global.fetch = vi.fn()` | `global.fetch = vi.fn().mockResolvedValue(...)` |

### Backend Mocking

| What | How | Example |
|------|-----|---------|
| Redis | Use `memory://` URL | `CacheService::new("memory://")` |
| File storage | `tempfile::TempDir` | `let temp = TempDir::new()` |
| Database | SeaORM `MockDatabase` | `MockDatabase::new(...)` |
| External APIs | `mockall` crate | `#[mockable]` trait with mock impl |

---

## 7. Writing New Tests

### Frontend — Step by Step

**1. Identify the file to test:**
```
src/lib/financial-data.ts → src/lib/financial-data.test.ts
src/hooks/shared/useNetworkStatus.ts → src/hooks/shared/useNetworkStatus.test.ts
src/components/shared/DeleteConfirmationDialog.tsx → src/components/shared/DeleteConfirmationDialog.test.tsx
```

**2. Create the test file with the right extension:**
- Pure functions/hooks → `.test.ts`
- React components/context → `.test.tsx`

**3. Import the code and testing utilities:**
```typescript
import { describe, it, expect, vi } from "vitest";
import { myFunction } from "./myFunction";
```

**4. Write tests following AAA pattern:**
```typescript
describe("myFunction", () => {
  it("returns X when given Y", () => {
    const input = { key: "value" };
    const result = myFunction(input);
    expect(result).toBe("expected");
  });

  it("throws when given invalid input", () => {
    expect(() => myFunction(null)).toThrow();
  });
});
```

**5. Mock external dependencies:**
```typescript
vi.mock("@/services/shared/authService", () => ({
  getUserProfile: vi.fn(() => ({ id: "user-123" })),
  isOfflineModeActive: vi.fn(() => false),
}));
```

**6. Run the tests:**
```bash
npx vitest run src/lib/myFunction.test.ts
```

### Backend — Step by Step

**1. Add tests inside the source file:**
```rust
// backend/src/services/my_service.rs
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn my_test() {
        let service = MyService::new().await.unwrap();
        service.set("key", "value").await.unwrap();
        let result = service.get("key").await.unwrap();
        assert_eq!(result, Some("value".to_string()));
    }
}
```

**2. Use `memory://` for cache tests, `tempfile::TempDir` for file tests:**
```rust
use tempfile::TempDir;

#[tokio::test]
async fn test_file_storage() {
    let temp = TempDir::new().unwrap();
    let storage = LocalFileStorage::new(temp.path().to_str().unwrap());
    // test code
}
```

**3. Run the tests:**
```bash
cargo test --lib my_service::tests
```

---

## 8. Coverage

### Current State

| Side | Tests | Coverage Tool | Threshold |
|------|-------|-------------|----------|
| Frontend | 369 | `@vitest/coverage-v8` (configured) | Not yet enforced |
| Backend | 275 | None (Phase 4) | Not yet enforced |

### Frontend Coverage Configuration

```typescript
// frontend/vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
    },
  },
});
```

### Backend Coverage (Phase 4)

Install `cargo-llvm-cov`:
```bash
cargo install cargo-llvm-cov
```

Run with coverage:
```bash
cargo llvm-cov --lib --open
```

Set thresholds in CI (Phase 5):
```yaml
# .github/workflows/test.yml
- name: Backend Coverage
  run: cargo llvm-cov --lib --fail-under-lines 70
```

---

## Appendix: Test Data Factories

### Frontend

```typescript
// Balance sheet factory used across financial-data and kpi-calculations tests
function createMinimalBalanceSheet(): BalanceSheet {
  return {
    reportingPeriod: "2024-12",
    cooperativeId: "coop-001",
    cooperativeName: "Test Cooperative",
    submissionDate: "2024-12-31",
    currency: "USD",
    accountingYear: "calendar",
    liquidAssets: {
      cashOnHand: 1000,
      cashAtBankCurrent: 5000,
      cashAtBankSavings: 10000,
      shortTermInvestments: 2000,
    },
    loanPortfolio: {
      performingLoanPortfolio: 50000,
      loansInArrears_1_30: 2000,
      loansInArrears_31_60: 1000,
      loansInArrears_61_90: 500,
      nonPerformingLoans: 500,
    },
    // ... all other fields
  };
}

// User profile factory
function makeProfile(role: Role): UserProfile {
  return {
    id: "user-1",
    email: "test@example.com",
    name: "Test User",
    role,
    // ...
  };
}
```

### Backend

```rust
fn create_test_data() -> Vec<u8> {
    b"Hello, CoopData!".to_vec()
}

fn create_test_cache() -> CacheService {
    let backend = MemoryBackend::new();
    CacheService { backend: Arc::new(backend) }
}
```

---

## Troubleshooting

### "Cannot find module" errors
- Check the import path matches the mock path
- Use relative paths for sibling modules: `../../services/shared/...`
- Use absolute paths for `@/` aliases

### "Test timed out" errors
- Use `vi.useFakeTimers()` for `setInterval`/`setTimeout`
- Advance time with `vi.advanceTimersByTime(ms)`
- Use `act()` to wrap timer-triggering state updates

### "Objects are not valid as React child" errors
- Check the `createWrapper` function — it must return a valid React element
- Use `QueryClientProvider` wrapper for React Query hooks
- Don't pass `renderHook` result as children

### "Mock not applied" errors
- Use `vi.hoisted()` for mock factories that need stable references
- Mocks must be declared before any imports that use them
- Clear mocks in `beforeEach` with `vi.clearAllMocks()`

### Backend "unresolved import tempfile"
- `tempfile` must be in `[dev-dependencies]` in `Cargo.toml`
- Already added: `tempfile = "3"`

### Backend compilation errors in tests
- Tests are compiled with `#[cfg(test)]` — they only exist in test mode
- Inline tests in the source file use `mod tests { ... }`
- Integration tests in `tests/` directory are separate binaries