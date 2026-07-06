# Frontend Testing Guide

> **Goal**: Write tests that give confidence, not just coverage.
> **Rule**: Test user behavior, RBAC enforcement, and auth flows.
> **Status**: 129 unit tests + 99 E2E tests — all passing.

---

## Testing Tools

| Tool | Version | Purpose |
| --- | --- | --- |
| **vitest** | ^3.2.4 | Unit/integration test runner |
| **@testing-library/react** | ^16.3.0 | Component rendering & queries |
| **@testing-library/jest-dom** | ^6.6.3 | DOM matchers (`toBeInTheDocument`, etc.) |
| **jsdom** | ^26.1.0 | DOM environment for vitest |
| **@vitest/coverage-v8** | ^3.2.4 | Coverage reporting |
| **@playwright/test** | latest | E2E browser testing |

---

## File Structure

```
frontend/
├── src/
│   ├── test/
│   │   └── setup.ts                    # vitest setup (jest-dom, cleanup, env stubs)
│   ├── constants/
│   │   └── roles.test.ts               # 39 tests — role mapping, hierarchy, nav config
│   ├── services/shared/
│   │   └── authService.test.ts         # token parsing, hasRole, hasAnyRole, init
│   ├── context/
│   │   └── AuthContext.test.tsx        # 16 tests — useAuth, useRole, useCanAccess
│   ├── lib/
│   │   └── route-guards.test.ts        # 18 tests — requireAuth, requireRole, redirectIfAuthenticated
│   └── components/
│       └── ProtectedRoute.test.tsx     # 16 tests — loading, redirect, unauthorized, RoleRedirect
├── e2e/
│   ├── fixtures/
│   │   └── auth.ts                     # TEST_USERS, createFakeJWT, mockKeycloak, mockBackendApi
│   ├── login.spec.ts                   # 5 tests — login flow, Sign in button, welcome toast
│   ├── ministry.spec.ts                # 16 tests — ministry user navigation & access
│   ├── federation.spec.ts              # 18 tests — federation user navigation & access
│   ├── apex.spec.ts                    # 16 tests — apex user navigation & access
│   ├── cooperative.spec.ts             # 21 tests — cooperative user navigation & access
│   ├── role-redirect.spec.ts           # 7 tests — role-based redirect after login
│   └── unauthorized.spec.ts            # 20 tests — Access Denied for cross-role access
├── e2e-mock-auth.ts                    # Vite plugin: mocks keycloak-js for E2E
├── vitest.config.ts                    # vitest configuration
├── playwright.config.ts               # Playwright configuration
└── package.json                        # test scripts
```

---

## Configuration

### vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      exclude: [
        "src/main.tsx",
        "src/routeTree.gen.ts",
        "src/test/",
        "src/**/*.d.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

### src/test/setup.ts

```typescript
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Stub import.meta.env for consistent test environment
vi.stubEnv("VITE_KEYCLOAK_URL", "http://localhost:8180");
vi.stubEnv("VITE_KEYCLOAK_REALM", "coop-data");
vi.stubEnv("VITE_KEYCLOAK_CLIENT_ID", "coopdata-frontend");
```

### playwright.config.ts

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30_000,
  expect: { timeout: 10_000 },

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

  webServer: process.env.E2E_SKIP_SERVER
    ? undefined
    : {
        command: "VITE_E2E_MOCK_AUTH=1 npm run dev",
        url: "http://localhost:5173",
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
      },
});
```

---

## Unit Test Patterns

### Pattern 1: Constants/Logic Testing (roles.test.ts)

Tests pure functions and constants without React rendering.

```typescript
import { describe, it, expect } from "vitest";
import {
  ROLES,
  ROLE_NAV,
  ROLE_NAV_ITEMS,
  ROLE_HIERARCHY,
  KEYCLOAK_ROLE_MAP,
  mapKeycloakRolesToRole,
} from "@/constants/roles";

describe("mapKeycloakRolesToRole", () => {
  it("returns ministry when ministry role present", () => {
    expect(mapKeycloakRolesToRole(["ministry", "federation"])).toBe("ministry");
  });

  it("returns null for unrecognized roles", () => {
    expect(mapKeycloakRolesToRole(["unknown_role"])).toBeNull();
  });

  it("returns null for empty array", () => {
    expect(mapKeycloakRolesToRole([])).toBeNull();
  });
});
```

### Pattern 2: Service Testing with vi.hoisted (authService.test.ts)

Uses `vi.hoisted()` for mock objects referenced inside `vi.mock()` factory closures.

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockKeycloakInstance } = vi.hoisted(() => ({
  mockKeycloakInstance: {
    authenticated: false,
    token: undefined as string | undefined,
    tokenParsed: undefined as Record<string, unknown> | undefined,
    init: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    updateToken: vi.fn(),
  },
}));

vi.mock("idb-keyval", () => ({
  get: vi.fn().mockResolvedValue(null),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/services/shared/keycloakConfig", () => ({
  keycloak: mockKeycloakInstance,
}));

import { getUserProfile, hasRole, hasAnyRole } from "@/services/shared/authService";

beforeEach(() => {
  vi.clearAllMocks();
  mockKeycloakInstance.authenticated = false;
  mockKeycloakInstance.token = undefined;
  mockKeycloakInstance.tokenParsed = undefined;
});
```

### Pattern 3: Context Testing with Auto-Mock (AuthContext.test.tsx)

Uses the auto-mock pattern: `vi.mock(path, () => ({fn: vi.fn()}))` then `vi.mocked(fn)`.

```typescript
import { render, waitFor } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Auto-mock authService — each function becomes a vi.fn()
vi.mock("@/services/shared/authService", () => ({
  initKeycloak: vi.fn(),
  login: vi.fn(),
  logout: vi.fn(),
  getUserProfile: vi.fn(),
  hasRole: vi.fn(),
  hasAnyRole: vi.fn(),
  isAuthenticated: vi.fn(),
  getAccessToken: vi.fn(),
  waitForKeycloakReady: vi.fn(),
}));

// Must mock sonner toast if rendering KeycloakAuthProvider
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
  Toaster: () => null,
}));

import { KeycloakAuthProvider, useAuth } from "@/context/AuthContext";
import { initKeycloak, getUserProfile, isAuthenticated } from "@/services/shared/authService";

// Access individual mocks via vi.mocked()
const mockInitKeycloak = vi.mocked(initKeycloak);
const mockGetUserProfile = vi.mocked(getUserProfile);
const mockIsAuthenticated = vi.mocked(isAuthenticated);
```

### Pattern 4: Component Testing (ProtectedRoute.test.tsx)

```typescript
import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Mock Navigate and useLocation from TanStack Router
vi.mock("@tanstack/react-router", () => ({
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate" data-to={to} />,
  useLocation: () => ({ pathname: "/app/federations" }),
}));

// Mock UnauthorizedPage
vi.mock("@/components/UnauthorizedPage", () => ({
  UnauthorizedPage: () => <div data-testid="unauthorized">Access Denied</div>,
}));

// Auto-mock authService
vi.mock("@/services/shared/authService", () => ({
  isAuthenticated: vi.fn(),
  getUserProfile: vi.fn(),
  hasAnyRole: vi.fn(),
  waitForKeycloakReady: vi.fn(),
}));

import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/context/AuthContext";
```

### Key Testing Rules

1. **`vi.hoisted()`** required for mock objects referenced inside `vi.mock()` factory (hoisting issue)
2. **Auto-mock pattern** (`vi.mock(path, () => ({fn: vi.fn()}))` + `vi.mocked(fn)`) works better than `vi.hoisted` for complex mocks
3. **`waitFor`** from `@testing-library/react` needed for React state updates (not `vi.waitFor`)
4. **Mock `sonner` toast** in any test that renders `KeycloakAuthProvider`
5. **Mock `@/components/UnauthorizedPage`** in `ProtectedRoute` tests
6. **Mock `@tanstack/react-router`** `Navigate` and `useLocation` in `ProtectedRoute` tests

---

## E2E Test Patterns

### E2E Mock Auth Architecture

The E2E tests use a Vite plugin (`e2e-mock-auth.ts`) that replaces `keycloak-js` with a mock when `VITE_E2E_MOCK_AUTH=1`. See [E2E Mock Auth Guide](./e2e-mock-auth.md) for full details.

### Test Fixture: mockKeycloakAuthenticated

```typescript
import { mockKeycloakAuthenticated, mockBackendApi } from "./fixtures/auth";

test.beforeEach(async ({ page }) => {
  await mockKeycloakAuthenticated(page, "ministry");
  await mockBackendApi(page);
});

test("should access federations management", async ({ page }) => {
  await page.goto("/app/federations");
  await expect(page).toHaveURL(/\/app\/federations/);
});
```

### Test Fixture: Unauthenticated (mockKeycloak)

```typescript
import { mockKeycloak, mockBackendApi } from "./fixtures/auth";

test("should redirect to Keycloak login when unauthenticated", async ({ page }) => {
  await mockKeycloak(page, "ministry");
  await mockBackendApi(page);

  await page.goto("/auth/login");
  await expect(page.getByText("Redirecting to login")).toBeVisible({ timeout: 10000 });
});
```

### Cross-Role Access Denial

```typescript
test("should show Access Denied when cooperative user visits federations", async ({ page }) => {
  await mockKeycloakAuthenticated(page, "cooperative");
  await mockBackendApi(page);

  await page.goto("/app/federations");
  await expect(page.getByText("Access Denied")).toBeVisible({ timeout: 10000 });
});
```

---

## Running Tests

```bash
# Unit tests
npm run test:unit

# Unit tests (watch mode)
npm run test:unit:watch

# Unit tests with coverage
npm run test:coverage

# E2E tests (headless)
npm run test:e2e

# E2E tests (headed, visible browser)
npm run test:e2e:headed

# E2E tests (Playwright UI mode)
npm run test:e2e:ui
```

### Test Scripts (package.json)

```json
{
  "scripts": {
    "test:unit": "vitest run",
    "test:unit:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:headed": "playwright test --headed"
  }
}
```

---

## Test Inventory

### Unit Tests (129 total)

| File | Tests | Coverage |
| --- | --- | --- |
| `roles.test.ts` | 39 | ROLES, ROLE_NAV, ROLE_NAV_ITEMS, ROLE_DASHBOARD, ROLE_HIERARCHY, ROLE_DEFAULT_ROUTE, KEYCLOAK_ROLE_MAP, mapKeycloakRolesToRole |
| `authService.test.ts` | 40 | getUserProfile, hasRole, hasAnyRole, isAuthenticated, login, logout, getAccessToken, initKeycloak, waitForKeycloakReady, extractRealmRoles, extractOrgName, extractOrgId |
| `AuthContext.test.tsx` | 16 | useAuth, useRole, useUserRole, useCanAccess, hasRole/hasAnyRole from context, login/logout, init error handling |
| `route-guards.test.ts` | 18 | requireAuth, requireRole, redirectIfAuthenticated, ROUTE_ACCESS map |
| `ProtectedRoute.test.tsx` | 16 | loading spinner, redirect to login, unauthorized page, children rendering, RoleRedirect for all 4 roles |

### E2E Tests (99 total)

| File | Tests | Coverage |
| --- | --- | --- |
| `login.spec.ts` | 5 | Login flow, Sign in button, login call, authenticated dashboard, welcome toast |
| `ministry.spec.ts` | 16 | Dashboard, federations, invitations, members, settings, users, sidebar nav, navigation |
| `federation.spec.ts` | 18 | Dashboard, apexes, users, sidebar nav, denied access to federations/settings/invitations/members |
| `apex.spec.ts` | 16 | Dashboard, cooperatives, users, sidebar nav, denied access to federations/apexes/settings |
| `cooperative.spec.ts` | 21 | Dashboard, data-collection, financial-statement, non-financial-data, sidebar nav, denied access |
| `role-redirect.spec.ts` | 7 | Role-based redirect to dashboard, authenticated/unauthenticated redirect |
| `unauthorized.spec.ts` | 20 | Access Denied for cross-role, Return Home button, Sign in with different account, all-roles-allowed routes |

---

## What to Test

### Do Test

- Role mapping logic (mapKeycloakRolesToRole priority, edge cases)
- Token parsing (realm roles extraction, org/cooperation extraction)
- Auth context state transitions (loading → authenticated/unauthenticated)
- Route guard redirects (unauthenticated → login, wrong role → unauthorized)
- ProtectedRoute rendering (loading spinner, redirect, unauthorized page, children)
- E2E: Login flow, role-based navigation, cross-role access denial
- E2E: Sidebar nav visibility per role
- E2E: All-roles-allowed routes (dashboard, submissions, reports, analytics)

### Don't Test

- Implementation details (internal state variables)
- Third-party libraries (keycloak-js internals, TanStack Router internals)
- Styling/CSS
- Trivial getter/setter functions
- Auto-generated code (routeTree.gen.ts)

---

## Checklist

- [x] vitest setup file created (`src/test/setup.ts`)
- [x] Component tests use `@testing-library/react`
- [x] Tests query by role/label (accessible queries)
- [x] Hooks tested with `renderHook` + `waitFor`
- [x] API calls mocked with `vi.mock()` module mocking
- [x] E2E tests cover critical login/dashboard flows
- [x] E2E tests verify RBAC enforcement (cross-role access denial)
- [x] E2E tests verify sidebar nav filtering by role
- [x] E2E tests verify role-based redirect after login
- [x] Tests focus on user outcomes, not code paths
- [x] All 129 unit tests passing
- [x] All 99 E2E tests passing