# RBAC Testing Guide

> **Goal**: Comprehensive testing of the Role-Based Access Control system.
> **Coverage**: 129 unit tests + 99 E2E tests verifying role enforcement, navigation filtering, and access denial.

---

## RBAC System Overview

CoopData uses a 4-role hierarchy:

```
ministry (4) > federation (3) > apex (2) > cooperative (1)
```

Each role has access to specific routes and navigation items. The system uses two guard mechanisms:

1. **Component Guard** (`ProtectedRoute`): Most routes use `<ProtectedRoute allowedRoles={[...]}><Page/></ProtectedRoute>`
2. **Function Guard** (`beforeLoad`): `/app/invitations` and `/app/members` use `requireRole("ministry")` in TanStack Router's `beforeLoad`

---

## Unit Test Coverage

### 1. Role Mapping Logic (`roles.test.ts` — 39 tests)

Tests the core RBAC logic without React rendering.

#### Key Test Cases

```typescript
describe("mapKeycloakRolesToRole", () => {
  // Priority: ministry > federation > apex > cooperative
  it("returns ministry when ministry role present alongside others", () => {
    expect(mapKeycloakRolesToRole(["ministry", "federation", "apex"])).toBe("ministry");
  });

  it("returns federation when federation and apex present (no ministry)", () => {
    expect(mapKeycloakRolesToRole(["federation", "apex"])).toBe("federation");
  });

  it("maps regional_officer to apex", () => {
    expect(mapKeycloakRolesToRole(["regional_officer"])).toBe("apex");
  });

  it("maps default-roles-coop-data to cooperative", () => {
    expect(mapKeycloakRolesToRole(["default-roles-coop-data"])).toBe("cooperative");
  });

  it("returns null for unrecognized roles", () => {
    expect(mapKeycloakRolesToRole(["unknown_role", "admin"])).toBeNull();
  });

  it("returns null for empty array", () => {
    expect(mapKeycloakRolesToRole([])).toBeNull();
  });
});

describe("ROLE_HIERARCHY", () => {
  it("ministry has highest hierarchy value", () => {
    expect(ROLE_HIERARCHY.ministry).toBe(4);
    expect(ROLE_HIERARCHY.ministry).toBeGreaterThan(ROLE_HIERARCHY.federation);
  });
});

describe("ROLE_NAV_ITEMS", () => {
  it("ministry sees federations route", () => {
    expect(ROLE_NAV_ITEMS.ministry.oversight).toContain("/app/federations");
  });

  it("cooperative does NOT have system nav group", () => {
    expect(ROLE_NAV_ITEMS.cooperative.system).toBeUndefined();
  });
});
```

### 2. Auth Service (`authService.test.ts` — 40 tests)

Tests token parsing, role extraction, and auth state.

#### Key Test Cases

```typescript
describe("getUserProfile", () => {
  it("extracts realm roles from token", () => {
    mockKeycloakInstance.tokenParsed = {
      sub: "user-123",
      email: "test@example.com",
      realm_access: { roles: ["ministry"] },
    };
    mockKeycloakInstance.authenticated = true;

    const profile = getUserProfile();
    expect(profile?.role).toBe("ministry");
    expect(profile?.realmRoles).toContain("ministry");
  });

  it("returns null when not authenticated", () => {
    mockKeycloakInstance.authenticated = false;
    expect(getUserProfile()).toBeNull();
  });

  it("returns null when no recognized role in token", () => {
    mockKeycloakInstance.tokenParsed = {
      sub: "user-123",
      realm_access: { roles: ["unknown_role"] },
    };
    mockKeycloakInstance.authenticated = true;
    expect(getUserProfile()).toBeNull();
  });
});

describe("hasAnyRole", () => {
  it("returns true when user role is in the list", () => {
    mockGetUserProfile.mockReturnValue({ role: "ministry", ... });
    expect(hasAnyRole(["ministry", "federation"])).toBe(true);
  });

  it("returns false when user role is NOT in the list", () => {
    mockGetUserProfile.mockReturnValue({ role: "cooperative", ... });
    expect(hasAnyRole(["ministry"])).toBe(false);
  });
});
```

### 3. Auth Context (`AuthContext.test.tsx` — 16 tests)

Tests the React context that provides auth state to the app.

#### Key Test Cases

```typescript
describe("useAuth", () => {
  it("provides isAuthenticated=false when init returns false", async () => {
    mockInitKeycloak.mockResolvedValue(false);
    mockIsAuthenticated.mockReturnValue(false);

    const { result } = renderHook(() => useAuth(), { wrapper: KeycloakAuthProvider });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it("provides user profile when authenticated", async () => {
    mockInitKeycloak.mockResolvedValue(true);
    mockIsAuthenticated.mockReturnValue(true);
    mockGetUserProfile.mockReturnValue({ role: "ministry", name: "Min Officer", ... });

    const { result } = renderHook(() => useAuth(), { wrapper: KeycloakAuthProvider });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.user?.role).toBe("ministry");
    expect(result.current.role).toBe("ministry");
  });
});

describe("useCanAccess", () => {
  it("returns false when not authenticated", async () => {
    // ... setup unauthenticated state
    const { result } = renderHook(() => useCanAccess("/app/federations"), { wrapper: KeycloakAuthProvider });
    expect(result.current).toBe(false);
  });
});
```

### 4. Route Guards (`route-guards.test.ts` — 18 tests)

Tests the function-based guards used in `beforeLoad`.

#### Key Test Cases

```typescript
describe("requireRole", () => {
  it("throws redirect to /unauthorized when user lacks required role", async () => {
    mockIsAuthenticated.mockReturnValue(true);
    mockGetUserProfile.mockReturnValue({ role: "cooperative", ... });
    mockHasAnyRole.mockReturnValue(false);

    await expect(requireRole("ministry")).rejects.toThrow();
    // redirect is thrown as an error with _isRedirect: true
  });

  it("does not throw when user has required role", async () => {
    mockIsAuthenticated.mockReturnValue(true);
    mockGetUserProfile.mockReturnValue({ role: "ministry", ... });
    mockHasAnyRole.mockReturnValue(true);

    await expect(requireRole("ministry")).resolves.toBeUndefined();
  });

  it("throws redirect to /auth/login when not authenticated", async () => {
    mockIsAuthenticated.mockReturnValue(false);

    await expect(requireRole("ministry")).rejects.toThrow();
  });
});

describe("redirectIfAuthenticated", () => {
  it("throws redirect to dashboard when already authenticated", async () => {
    mockIsAuthenticated.mockReturnValue(true);
    mockGetUserProfile.mockReturnValue({ role: "federation", ... });

    await expect(redirectIfAuthenticated()).rejects.toThrow();
  });

  it("does not throw when not authenticated", async () => {
    mockIsAuthenticated.mockReturnValue(false);

    await expect(redirectIfAuthenticated()).resolves.toBeUndefined();
  });
});
```

### 5. ProtectedRoute Component (`ProtectedRoute.test.tsx` — 16 tests)

Tests the component-based guard.

#### Key Test Cases

```typescript
describe("ProtectedRoute", () => {
  it("shows loading spinner when isLoading", () => {
    mockUseAuth.mockReturnValue({ isLoading: true, isAuthenticated: false, user: null });
    render(<ProtectedRoute><Child /></ProtectedRoute>);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });

  it("redirects to /auth/login when not authenticated", () => {
    mockUseAuth.mockReturnValue({ isLoading: false, isAuthenticated: false, user: null });
    render(<ProtectedRoute><Child /></ProtectedRoute>);
    expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", "/auth/login");
  });

  it("shows UnauthorizedPage when user role not in allowedRoles", () => {
    mockUseAuth.mockReturnValue({
      isLoading: false, isAuthenticated: true,
      user: { role: "cooperative" }
    });
    render(<ProtectedRoute allowedRoles={["ministry"]}><Child /></ProtectedRoute>);
    expect(screen.getByTestId("unauthorized")).toBeInTheDocument();
  });

  it("renders children when user role is in allowedRoles", () => {
    mockUseAuth.mockReturnValue({
      isLoading: false, isAuthenticated: true,
      user: { role: "ministry" }
    });
    render(<ProtectedRoute allowedRoles={["ministry"]}><Child /></ProtectedRoute>);
    expect(screen.getByText("Child")).toBeInTheDocument();
  });
});

describe("RoleRedirect", () => {
  it("redirects ministry user to /app/dashboard", () => {
    mockUseAuth.mockReturnValue({ user: { role: "ministry" }, isAuthenticated: true, isLoading: false });
    render(<RoleRedirect />);
    expect(screen.getByTestId("navigate")).toHaveAttribute("data-to", "/app/dashboard");
  });
});
```

---

## E2E Test Coverage

### Test Users

```typescript
const TEST_USERS = {
  ministry:     { email: "ministry@test.coopdata",     realmRoles: ["ministry"] },
  federation:   { email: "federation@test.coopdata",  realmRoles: ["federation"], organization: { "Test Federation": { id: "fed-123" } }, organization_id: "fed-123" },
  apex:         { email: "apex@test.coopdata",         realmRoles: ["regional_officer"], cooperation: ["/apex-456/coop-789"], cooperation_id: "coop-789" },
  cooperative:  { email: "cooperative@test.coopdata",  realmRoles: ["default-roles-coop-data"], cooperation: ["/apex-456/coop-789"], cooperation_id: "coop-789" },
};
```

### 1. Login Flow (`login.spec.ts` — 5 tests)

| Test | What It Verifies |
| --- | --- |
| should redirect to Keycloak login when unauthenticated | Unauthenticated users see "Redirecting to login" |
| should show Sign in button on landing page | Landing page has visible Sign in button |
| should call login when clicking Sign in button | Clicking Sign in calls `window.__E2E_LOGIN_CALLED__` |
| should reach dashboard when already authenticated | Authenticated user navigating to `/app/dashboard` stays there |
| should show welcome toast after login | Authenticated user sees "Welcome back" toast |

### 2. Ministry User (`ministry.spec.ts` — 16 tests)

| Test | What It Verifies |
| --- | --- |
| should access dashboard | Ministry user can access `/app/dashboard` |
| should see ministry dashboard title | Dashboard shows "National Cooperative Intelligence" |
| should access federations management | Ministry user can access `/app/federations` |
| should access invitations page | Ministry user can access `/app/invitations` (beforeLoad guard) |
| should access members page | Ministry user can access `/app/members` (beforeLoad guard) |
| should access settings page | Ministry user can access `/app/settings` |
| should access users page | Ministry user can access `/app/users` |
| should see Federations in sidebar nav | Sidebar contains Federations link |
| should see Invitations in sidebar nav | Sidebar contains Invitations link |
| should see Members in sidebar nav | Sidebar contains Members link |
| should see Settings in sidebar nav | Sidebar contains Settings link |
| should NOT see Apexes in sidebar nav | Sidebar does NOT contain Apexes link |
| should NOT see Cooperatives in sidebar nav | Sidebar does NOT contain Cooperatives link |
| should NOT see Data Collection in sidebar nav | Sidebar does NOT contain Data Collection link |
| should navigate to federations via sidebar | Clicking Federations link navigates to `/app/federations` |
| should navigate to settings via sidebar | Clicking Settings link navigates to `/app/settings` |

### 3. Federation User (`federation.spec.ts` — 18 tests)

| Test | What It Verifies |
| --- | --- |
| should access dashboard | Federation user can access `/app/dashboard` |
| should see federation dashboard title | Dashboard shows "Federation Workspace" |
| should access apexes management | Federation user can access `/app/apexes` |
| should access users page | Federation user can access `/app/users` |
| should see Apexes in sidebar nav | Sidebar contains Apexes link |
| should see Users & Roles in sidebar nav | Sidebar contains Users & Roles link |
| should NOT see Federations in sidebar nav | Sidebar does NOT contain Federations link |
| should NOT see Settings in sidebar nav | Sidebar does NOT contain Settings link |
| should NOT see Invitations in sidebar nav | Sidebar does NOT contain Invitations link |
| should NOT see Data Collection in sidebar nav | Sidebar does NOT contain Data Collection link |
| should be denied access to federations page | `/app/federations` shows Access Denied |
| should be denied access to settings page | `/app/settings` shows Access Denied |
| should be denied access to invitations page | `/app/invitations` shows Access Denied (beforeLoad guard) |
| should be denied access to members page | `/app/members` shows Access Denied (beforeLoad guard) |
| should navigate to apexes via sidebar | Clicking Apexes link navigates to `/app/apexes` |

### 4. Apex User (`apex.spec.ts` — 16 tests)

| Test | What It Verifies |
| --- | --- |
| should access dashboard | Apex user can access `/app/dashboard` |
| should see apex dashboard title | Dashboard shows "Apex Supervision Workspace" |
| should access cooperatives management | Apex user can access `/app/cooperatives` |
| should access users page | Apex user can access `/app/users` |
| should see Cooperatives in sidebar nav | Sidebar contains Cooperatives link |
| should see Users & Roles in sidebar nav | Sidebar contains Users & Roles link |
| should NOT see Federations in sidebar nav | Sidebar does NOT contain Federations link |
| should NOT see Apexes in sidebar nav | Sidebar does NOT contain Apexes link |
| should NOT see Settings in sidebar nav | Sidebar does NOT contain Settings link |
| should NOT see Invitations in sidebar nav | Sidebar does NOT contain Invitations link |
| should NOT see Data Collection in sidebar nav | Sidebar does NOT contain Data Collection link |
| should be denied access to federations page | `/app/federations` shows Access Denied |
| should be denied access to apexes page | `/app/apexes` shows Access Denied |
| should be denied access to settings page | `/app/settings` shows Access Denied |
| should navigate to cooperatives via sidebar | Clicking Cooperatives link navigates to `/app/cooperatives` |

### 5. Cooperative User (`cooperative.spec.ts` — 21 tests)

| Test | What It Verifies |
| --- | --- |
| should access dashboard | Cooperative user can access `/app/dashboard` |
| should see cooperative dashboard title | Dashboard shows "Cooperative Workspace" |
| should access data collection | Cooperative user can access `/app/data-collection` |
| should access financial statement | Cooperative user can access `/app/financial-statement` |
| should access non-financial data | Cooperative user can access `/app/non-financial-data` |
| should see Data Collection in sidebar nav | Sidebar contains Data Collection link |
| should NOT see Federations, Apexes, Cooperatives, Settings, Invitations, Users | Sidebar filtering |
| should be denied access to federations, apexes, cooperatives, settings, users, invitations, members | Cross-role access denial |
| should navigate to data collection via sidebar | Clicking Data Collection navigates correctly |

### 6. Role-Based Redirect (`role-redirect.spec.ts` — 7 tests)

| Test | What It Verifies |
| --- | --- |
| should redirect ministry user to /app/dashboard after login | All 4 roles tested |
| should redirect authenticated user from /auth/login to dashboard | Authenticated user visiting login page gets redirected |
| should redirect unauthenticated user from /app to /auth/login | Unauthenticated user visiting /app sees "Redirecting to login" |
| should redirect unauthenticated user from any /app/* route to /auth/login | Unauthenticated user visiting /app/federations sees "Redirecting to login" |

### 7. Unauthorized Access (`unauthorized.spec.ts` — 20 tests)

| Test | What It Verifies |
| --- | --- |
| should show Access Denied when cooperative user visits federations | Component guard denial |
| should show Access Denied when cooperative user visits settings | Component guard denial |
| should show Access Denied when federation user visits federations | Component guard denial |
| should show Access Denied when apex user visits apexes | Component guard denial |
| should show Access Denied when apex user visits settings | Component guard denial |
| should show Access Denied when federation user visits cooperatives | Component guard denial |
| should show Access Denied when cooperative user visits users | Component guard denial |
| should show Access Denied when cooperative user visits invitations | beforeLoad guard denial |
| should show Access Denied when cooperative user visits members | beforeLoad guard denial |
| should show Access Denied when federation user visits invitations | beforeLoad guard denial |
| should show Access Denied when federation user visits members | beforeLoad guard denial |
| should show Access Denied when apex user visits invitations | beforeLoad guard denial |
| should show Access Denied when apex user visits members | beforeLoad guard denial |
| should show Return Home button on unauthorized page | UnauthorizedPage has Return Home link |
| should show Sign in with different account button | UnauthorizedPage has Sign in button |
| should allow all roles to access dashboard | All 4 roles can access /app/dashboard |
| should allow all roles to access submissions | All 4 roles can access /app/submissions |
| should allow all roles to access reports | All 4 roles can access /app/reports |
| should allow all roles to access analytics | All 4 roles can access /app/analytics |

---

## Route Access Matrix (Verified by Tests)

| Route | ministry | federation | apex | cooperative | Guard Type |
| --- | --- | --- | --- | --- | --- |
| `/app/dashboard` | ✅ | ✅ | ✅ | ✅ | ProtectedRoute (no role restriction) |
| `/app/federations` | ✅ | ❌ | ❌ | ❌ | ProtectedRoute `allowedRoles=["ministry"]` |
| `/app/apexes` | ❌ | ✅ | ❌ | ❌ | ProtectedRoute `allowedRoles=["federation"]` |
| `/app/cooperatives` | ❌ | ❌ | ✅ | ❌ | ProtectedRoute `allowedRoles=["apex"]` |
| `/app/data-collection` | ❌ | ❌ | ❌ | ✅ | ProtectedRoute `allowedRoles=["cooperative"]` |
| `/app/financial-statement` | ❌ | ❌ | ❌ | ✅ | ProtectedRoute `allowedRoles=["cooperative"]` |
| `/app/non-financial-data` | ❌ | ❌ | ❌ | ✅ | ProtectedRoute `allowedRoles=["cooperative"]` |
| `/app/invitations` | ✅ | ❌ | ❌ | ❌ | beforeLoad `requireRole("ministry")` |
| `/app/members` | ✅ | ❌ | ❌ | ❌ | beforeLoad `requireRole("ministry")` |
| `/app/users` | ✅ | ✅ | ✅ | ❌ | ProtectedRoute `allowedRoles=["ministry","federation","apex"]` |
| `/app/settings` | ✅ | ❌ | ❌ | ❌ | ProtectedRoute `allowedRoles=["ministry"]` |
| `/app/submissions` | ✅ | ✅ | ✅ | ✅ | ProtectedRoute (no role restriction) |
| `/app/reports` | ✅ | ✅ | ✅ | ✅ | ProtectedRoute (no role restriction) |
| `/app/analytics` | ✅ | ✅ | ✅ | ✅ | ProtectedRoute (no role restriction) |
| `/app/profile` | ✅ | ✅ | ✅ | ✅ | ProtectedRoute (no role restriction) |

---

## Keycloak Test Realm Seed

**File**: `keycloak/seed-test-users.sh`

Creates 4 test users in the Keycloak `coop-data` realm:

| User | Email | Password | Realm Role |
| --- | --- | --- | --- |
| Ministry Officer | `ministry@test.coopdata` | `Test@Password2026!` | `ministry` |
| Federation Officer | `federation@test.coopdata` | `Test@Password2026!` | `federation` |
| Apex Officer | `apex@test.coopdata` | `Test@Password2026!` | `regional_officer` |
| Cooperative Manager | `cooperative@test.coopdata` | `Test@Password2026!` | `default-roles-coop-data` |

### Usage

```bash
# Start Keycloak first
docker-compose up -d keycloak

# Wait for Keycloak to be ready, then seed
bash keycloak/seed-test-users.sh
```

The script is idempotent — it checks if users exist before creating them.