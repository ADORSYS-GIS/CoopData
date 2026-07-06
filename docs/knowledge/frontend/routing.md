# Routing Implementation Guide

> **Goal**: Configure routes using TanStack Router (file-based routing).
> **Rule**: One route file = One page component. Guards via `ProtectedRoute` or `beforeLoad`.

---

## File Structure

```
frontend/src/
├── routes/
│   ├── __root.tsx              # Root route: wraps app in ThemeProvider > KeycloakAuthProvider > QueryClientProvider
│   ├── index.tsx               # / → LandingPage
│   ├── app.tsx                 # /app layout guard (auth + org assignment check)
│   ├── app.index.tsx           # /app → redirect to /app/dashboard
│   ├── app.dashboard.tsx       # /app/dashboard (all roles)
│   ├── app.federations.tsx     # /app/federations (ministry only)
│   ├── app.apexes.tsx          # /app/apexes (federation only)
│   ├── app.cooperatives.tsx    # /app/cooperatives (apex only)
│   ├── app.data-collection.tsx # /app/data-collection (cooperative only)
│   ├── app.financial-statement.tsx  # /app/financial-statement (cooperative only)
│   ├── app.non-financial-data.tsx   # /app/non-financial-data (cooperative only)
│   ├── app.invitations.tsx     # /app/invitations (ministry only, beforeLoad guard)
│   ├── app.members.tsx         # /app/members (ministry only, beforeLoad guard)
│   ├── app.users.tsx           # /app/users layout (ministry, federation, apex)
│   ├── app.users.index.tsx     # /app/users/ → UsersPage
│   ├── app.users.$apexId.tsx   # /app/users/:apexId → ApexUsersPage
│   ├── app.settings.tsx        # /app/settings (ministry only)
│   ├── app.submissions.tsx     # /app/submissions (all roles)
│   ├── app.submissions_.$id.tsx # /app/submissions/:id
│   ├── app.reports.tsx         # /app/reports (all roles)
│   ├── app.analytics.tsx       # /app/analytics (all roles)
│   ├── app.profile.tsx         # /app/profile (all roles)
│   ├── app.debug-auth.tsx      # /app/debug-auth (no guard — known issue)
│   ├── auth.tsx                # /auth layout
│   ├── auth.login.tsx          # /auth/login → Keycloak login handler
│   ├── unauthorized.tsx        # /unauthorized → UnauthorizedPage
│   └── routeTree.gen.ts        # Auto-generated route tree (DO NOT EDIT)
├── router.tsx                  # createRouter({ routeTree, context: { queryClient } })
└── main.tsx                    # Entry point
```

---

## Step 1: File-Based Routing

TanStack Router uses file-based routing. Each `.tsx` file in `src/routes/` becomes a route:

- `app.tsx` → `/app` (layout route)
- `app.dashboard.tsx` → `/app/dashboard`
- `app.users.$apexId.tsx` → `/app/users/:apexId`
- `auth.login.tsx` → `/auth/login`

The route tree is auto-generated in `routeTree.gen.ts` by `@tanstack/router-plugin`.

---

## Step 2: Route Guards

### Component Guard: ProtectedRoute

Most routes use `ProtectedRoute` with `allowedRoles`:

```typescript
// File: frontend/src/routes/app.federations.tsx
import { createFileRoute } from "@tanstack/react-router";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FederationsPage } from "@/pages/ministry/FederationsPage";

export const Route = createFileRoute("/app/federations")({
  component: () => (
    <ProtectedRoute allowedRoles={["ministry"]}>
      <FederationsPage />
    </ProtectedRoute>
  ),
});
```

### Function Guard: beforeLoad

Some routes use `requireRole()` in `beforeLoad`:

```typescript
// File: frontend/src/routes/app.invitations.tsx
import { createFileRoute } from "@tanstack/react-router";
import { requireRole } from "@/lib/route-guards";
import { InvitationList } from "@/pages/ministry/InvitationList";

export const Route = createFileRoute("/app/invitations")({
  beforeLoad: async () => {
    await requireRole("ministry");
  },
  component: InvitationList,
});
```

### Layout Guard: app.tsx

The `/app` layout checks auth and org assignment:

```typescript
// File: frontend/src/routes/app.tsx
function AppLayout() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) return <LoadingSpinner />;
  if (!isAuthenticated) return <Navigate to="/auth/login" />;

  // Check org assignment
  if (user?.role === "federation" && !user.organizationId) {
    return <NotPartOfOrg orgLabel="a federation" />;
  }
  if (user?.role === "apex" && !user.cooperationId) {
    return <NotPartOfOrg orgLabel="an apex" />;
  }
  if (user?.role === "cooperative" && !user.cooperationId) {
    return <NotPartOfOrg orgLabel="a cooperative" />;
  }

  return <Outlet />;
}
```

---

## Step 3: Route → Role Mapping

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
| `/auth/login` | redirectIfAuthenticated | public |
| `/unauthorized` | none | public |

---

## Step 4: Router Configuration

```typescript
// File: frontend/src/router.tsx
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { queryClient } from "./lib/query-client";

export const router = createRouter({
  routeTree,
  context: { queryClient },
  scrollRestoration: true,
  defaultPreloadStaleTime: 0,
});
```

---

## Step 5: Navigation

### Programmatic Navigation

```typescript
import { useNavigate } from "@tanstack/react-router";

const MyComponent = () => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate({ to: "/app/federations" });
  };

  return <button onClick={handleClick}>Go to Federations</button>;
};
```

### Link Navigation

```typescript
import { Link } from "@tanstack/react-router";

const Navbar = () => (
  <nav>
    <Link to="/app/dashboard">Dashboard</Link>
    <Link to="/app/federations">Federations</Link>
  </nav>
);
```

### Route Parameters

```typescript
import { useParams } from "@tanstack/react-router";

const ApexUsersPage = () => {
  const { apexId } = useParams({ from: "/app/users/$apexId" });
  // Use apexId...
};
```

---

## Checklist

- [x] File-based routing configured with TanStack Router
- [x] Route tree auto-generated (`routeTree.gen.ts`)
- [x] Protected routes use `ProtectedRoute` with `allowedRoles`
- [x] `beforeLoad` guards for invitations/members routes
- [x] App layout guard checks auth + org assignment
- [x] Auth login route redirects authenticated users to dashboard
- [x] Unauthorized route renders `UnauthorizedPage`
- [x] Navigation uses TanStack Router `Link` and `useNavigate`