# Authentication Implementation Guide

> **Goal**: Implement Keycloak authentication with RBAC role enforcement.
> **Rule**: Never store tokens in localStorage. Use IndexedDB via `idb-keyval`.
> **Stack**: `keycloak-js` v26.2.4, `idb-keyval`, TanStack Router, TanStack Query.

---

## File Structure

```
frontend/src/
├── services/shared/
│   ├── keycloakConfig.ts          # Keycloak instance from env vars
│   └── authService.ts             # Auth service (init, login, logout, token, profile)
├── context/
│   └── AuthContext.tsx            # KeycloakAuthProvider + useAuth/useRole/useCanAccess hooks
├── lib/
│   ├── auth.tsx                   # Backward-compatible re-exports
│   └── route-guards.ts            # requireAuth, requireRole, redirectIfAuthenticated
├── components/
│   ├── ProtectedRoute.tsx         # Component guard (allowedRoles prop)
│   └── UnauthorizedPage.tsx       # 403 Access Denied page
├── constants/
│   └── roles.ts                   # Role definitions, nav config, Keycloak role mapping
├── types/
│   └── auth.ts                    # UserProfile, AuthContextValue, CustomKeycloakToken
└── routes/
    ├── __root.tsx                 # Wraps app in KeycloakAuthProvider
    ├── auth.login.tsx             # Login handler (redirects to Keycloak)
    ├── unauthorized.tsx           # /unauthorized route
    └── app.tsx                    # /app layout guard (auth + org assignment check)
```

---

## Step 1: Configure Keycloak

**File**: `frontend/src/services/shared/keycloakConfig.ts`

```typescript
import Keycloak from "keycloak-js";

export const keycloak = new Keycloak({
  url: import.meta.env.VITE_KEYCLOAK_URL,
  realm: import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
});
```

**Environment Variables** (`.env`):

```bash
VITE_KEYCLOAK_URL=http://localhost:8180
VITE_KEYCLOAK_REALM=coop-data
VITE_KEYCLOAK_CLIENT_ID=coopdata-frontend
```

---

## Step 2: Auth Service

**File**: `frontend/src/services/shared/authService.ts`

The auth service wraps `keycloak-js` and provides:

| Function | Purpose |
| --- | --- |
| `initKeycloak()` | Initialize Keycloak with `check-sso`, PKCE S256, token caching in IndexedDB |
| `login()` | Redirect to Keycloak login page |
| `logout()` | Clear cached tokens + redirect to Keycloak logout |
| `getAccessToken()` | Get current token (auto-refresh if within 30s of expiry) |
| `getUserProfile()` | Decode JWT, extract realm roles, map to app Role |
| `hasRole(role)` | Check if current user has a specific Role |
| `hasAnyRole(roles[])` | Check if current user has any of the specified Roles |
| `isAuthenticated()` | Returns `keycloak.authenticated` |
| `fetchWithAuth(url, options)` | Fetch wrapper that adds Bearer token |
| `waitForKeycloakReady(timeoutMs)` | Promise that resolves when Keycloak init completes (8s timeout) |

### Token Caching

Tokens are cached in IndexedDB via `idb-keyval` under key `"coopdata_tokens"`:

```typescript
interface CachedTokens {
  token: string;
  refreshToken: string;
  idToken: string;
  timestamp: number;  // 24h TTL
}
```

### JWT Token Claims (CustomKeycloakToken)

```typescript
interface CustomKeycloakToken {
  sub: string;
  email: string;
  name: string;
  given_name?: string;
  family_name?: string;
  realm_access: { roles: string[] };      // Keycloak realm roles
  organization?: Record<string, { id: string }>;  // Federation org
  cooperation?: string[];                  // Group paths: ["/apex-id/coop-id"]
  organization_id?: string;
  cooperation_id?: string;
  assigned_dimensions?: string[];
  is_member_of?: string[];
}
```

---

## Step 3: Role System

**File**: `frontend/src/constants/roles.ts`

### 4 Roles with Hierarchy

```typescript
type Role = "ministry" | "federation" | "apex" | "cooperative";

// Hierarchy: ministry(4) > federation(3) > apex(2) > cooperative(1)
const ROLE_HIERARCHY: Record<Role, number> = {
  ministry: 4,
  federation: 3,
  apex: 2,
  cooperative: 1,
};
```

### Keycloak → App Role Mapping

```typescript
const KEYCLOAK_ROLE_MAP: Record<string, Role> = {
  ministry: "ministry",
  federation: "federation",
  regional_officer: "apex",           // Keycloak uses "regional_officer" for apex
  "default-roles-coop-data": "cooperative",  // Default role maps to cooperative
};

// Priority order: ministry > federation > apex > cooperative
function mapKeycloakRolesToRole(realmRoles: string[]): Role | null {
  // Returns highest-priority role found, or null if no recognized role
}
```

### Navigation Config

```typescript
// Which nav groups each role sees
const ROLE_NAV: Record<Role, NavGroupId[]> = {
  ministry: ["oversight", "intelligence", "system"],
  federation: ["oversight", "intelligence", "system"],
  apex: ["oversight", "intelligence", "system"],
  cooperative: ["oversight", "intelligence"],
};

// Which routes within each group
const ROLE_NAV_ITEMS: Record<Role, Partial<Record<NavGroupId, string[]>>> = {
  ministry: {
    oversight: ["/app/dashboard", "/app/federations", "/app/invitations", "/app/members", "/app/submissions"],
    intelligence: ["/app/reports", "/app/analytics"],
    system: ["/app/users", "/app/settings"],
  },
  // ... other roles
};

// All roles redirect to /app/dashboard after login
const ROLE_DEFAULT_ROUTE: Record<Role, string> = {
  ministry: "/app/dashboard",
  federation: "/app/dashboard",
  apex: "/app/dashboard",
  cooperative: "/app/dashboard",
};
```

---

## Step 4: Auth Context

**File**: `frontend/src/context/AuthContext.tsx`

```typescript
interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: UserProfile | null;
  role: Role | null;
  accessToken: string | null;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: Role) => boolean;
  hasAnyRole: (roles: Role[]) => boolean;
  getAccessToken: () => Promise<string>;
}
```

### Provider Lifecycle

1. `KeycloakAuthProvider` mounts in `__root.tsx`
2. Calls `initKeycloak()` on mount (check-sso, PKCE S256, token caching)
3. Sets `isLoading=true` during init, then `false` when complete
4. If authenticated, calls `getUserProfile()` to extract role from JWT
5. Exposes `useAuth()`, `useRole()`, `useUserRole()`, `useCanAccess(path)` hooks

### Convenience Hooks

```typescript
// Get full auth context
const { isAuthenticated, user, role, login, logout } = useAuth();

// Get just the role
const role = useRole();  // Role | null

// Get user + role together
const { user, role } = useUserRole();

// Check if current user can access a path
const canAccess = useCanAccess("/app/federations");  // boolean
```

---

## Step 5: Route Guards (Two Mechanisms)

### Component Guard: ProtectedRoute

Used by most routes. Wraps page component.

```typescript
// File: frontend/src/components/ProtectedRoute.tsx

<ProtectedRoute allowedRoles={["ministry"]}>
  <FederationsPage />
</ProtectedRoute>
```

**Logic**:
1. `isLoading` → spinner
2. `!isAuthenticated` → `<Navigate to="/auth/login" />`
3. `!user` → `<UnauthorizedPage />`
4. `allowedRoles && !allowedRoles.includes(user.role)` → `<UnauthorizedPage />`
5. Otherwise → render children

### Function Guard: beforeLoad

Used by `/app/invitations` and `/app/members` only.

```typescript
// File: frontend/src/routes/app.invitations.tsx

export const Route = createFileRoute("/app/invitations")({
  beforeLoad: async () => {
    await requireRole("ministry");  // throws redirect to /unauthorized
  },
  component: InvitationList,
});
```

### Route → Role Mapping

| Route | Guard Type | Allowed Roles |
| --- | --- | --- |
| `/app/dashboard` | ProtectedRoute | all roles |
| `/app/federations` | ProtectedRoute | ministry |
| `/app/apexes` | ProtectedRoute | federation |
| `/app/cooperatives` | ProtectedRoute | apex |
| `/app/data-collection` | ProtectedRoute | cooperative |
| `/app/financial-statement` | ProtectedRoute | cooperative |
| `/app/non-financial-data` | ProtectedRoute | cooperative |
| `/app/invitations` | beforeLoad | ministry |
| `/app/members` | beforeLoad | ministry |
| `/app/users` | ProtectedRoute | ministry, federation, apex |
| `/app/settings` | ProtectedRoute | ministry |
| `/app/submissions` | ProtectedRoute | all roles |
| `/app/reports` | ProtectedRoute | all roles |
| `/app/analytics` | ProtectedRoute | all roles |
| `/app/profile` | ProtectedRoute | all roles |
| `/app/debug-auth` | none | (no guard — known issue) |

---

## Step 6: App Layout Guard

**File**: `frontend/src/routes/app.tsx`

The `/app` layout checks:
1. `isLoading` → spinner
2. `!isAuthenticated` → `<Navigate to="/auth/login" />`
3. If user is `federation` without `organizationId` → "not part of a federation" message
4. If user is `apex` without `cooperationId` → "not part of an apex" message
5. If user is `cooperative` without `cooperationId` → "not part of a cooperative" message
6. Otherwise → render `<Outlet />`

---

## Step 7: API Client Auth

**File**: `frontend/src/openapi-client/index.ts`

```typescript
import { createClient } from "openapi-fetch";
import { getAccessToken } from "@/services/shared/authService";

export const apiClient = createClient<paths>({
  baseUrl: "http://localhost:3000",
});

// onRequest: add Bearer token
apiClient.use({
  onRequest: async (req) => {
    try {
      const token = await getAccessToken();
      req.headers.set("Authorization", `Bearer ${token}`);
    } catch {
      // Token expired — let the response handler deal with 401
    }
    return req;
  },
  // onResponse: redirect to login on 401 (outside /app routes)
  onResponse: async (res, ctx) => {
    if (res.status === 401 && !window.location.pathname.startsWith("/app")) {
      window.location.href = "/auth/login";
    }
  },
});
```

---

## Step 8: Unauthorized Page

**File**: `frontend/src/components/UnauthorizedPage.tsx`

Displayed when:
- User is authenticated but has wrong role for the route
- User has no recognized role in their JWT

Shows:
- "Access Denied" heading
- Explanation text
- "Return Home" button (links to `/`)
- "Sign in with different account" button (calls `login()`)

---

## Checklist

- [x] Keycloak config created (`keycloakConfig.ts`)
- [x] Auth service created (`authService.ts`) with token caching
- [x] Auth context created (`AuthContext.tsx`) with `KeycloakAuthProvider`
- [x] App wrapped with `KeycloakAuthProvider` in `__root.tsx`
- [x] Protected route guard created (`ProtectedRoute.tsx`)
- [x] Function guards created (`route-guards.ts`)
- [x] Token added to API requests via `openapi-fetch` interceptor
- [x] Role constants defined (`roles.ts`) with Keycloak role mapping
- [x] RBAC enforced via `allowedRoles` on `ProtectedRoute`
- [x] RBAC enforced via `requireRole()` in `beforeLoad`
- [x] Unauthorized page created (`UnauthorizedPage.tsx`)
- [x] App layout guard checks org assignment (`app.tsx`)
- [x] Silent SSO check configured (`silent-check-sso.html`)