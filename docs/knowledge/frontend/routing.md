# Routing Implementation Guide

> **Goal**: Configure routes using React Router v6+.
> **Rule**: One route = One page component.

## File Structure

```
frontend/src/router/
├── index.tsx           # Main router configuration
├── ProtectedRoute.tsx  # Auth guard
└── routes.ts           # Route constants
```

---

## Step 1: Define Route Constants

**File**: `frontend/src/router/routes.ts`

```typescript
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  USERS: {
    LIST: '/users',
    CREATE: '/users/new',
    DETAIL: (id: string) => `/users/${id}`,
    EDIT: (id: string) => `/users/${id}/edit`,
  },
  SETTINGS: '/settings',
} as const;
```

**Why**: Centralized routes prevent typos and make refactoring easier

---

## Step 2: Create Protected Route Guard

**File**: `frontend/src/router/ProtectedRoute.tsx`

```typescript
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};
```

**Why**: Prevents unauthenticated users from accessing protected pages

---

## Step 3: Configure Router

**File**: `frontend/src/router/index.tsx`

```typescript
import { Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { MainLayout } from '@/layouts/MainLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { ProtectedRoute } from './ProtectedRoute';
import { ROUTES } from './routes';
import { Loader2 } from 'lucide-react';

// Lazy load pages
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const UsersPage = lazy(() => import('@/pages/UsersPage'));
const UserDetailPage = lazy(() => import('@/pages/UserDetailPage'));

const LoadingFallback = () => (
  <div className="flex h-screen items-center justify-center">
    <Loader2 className="h-8 w-8 animate-spin" />
  </div>
);

export const AppRoutes = () => {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <Routes>
        {/* Public Routes */}
        <Route element={<AuthLayout />}>
          <Route path={ROUTES.LOGIN} element={<LoginPage />} />
        </Route>

        {/* Protected Routes */}
        <Route element={<ProtectedRoute />}>
          <Route element={<MainLayout />}>
            <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
            <Route path={ROUTES.USERS.LIST} element={<UsersPage />} />
            <Route path="/users/:id" element={<UserDetailPage />} />
          </Route>
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to={ROUTES.DASHBOARD} replace />} />
      </Routes>
    </Suspense>
  );
};
```

**Why**: 
- Lazy loading improves initial load time
- Nested routes share layouts
- Protected routes require authentication

---

## Step 4: Use in App

**File**: `frontend/src/App.tsx`

```typescript
import { BrowserRouter } from 'react-router-dom';
import { AppRoutes } from './router';

export const App = () => {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
};
```

---

## Navigation

### Programmatic Navigation

```typescript
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/router/routes';

const MyComponent = () => {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(ROUTES.USERS.LIST);
  };

  const handleUserClick = (userId: string) => {
    navigate(ROUTES.USERS.DETAIL(userId));
  };

  return <button onClick={handleClick}>Go to Users</button>;
};
```

### Link Navigation

```typescript
import { Link } from 'react-router-dom';
import { ROUTES } from '@/router/routes';

const Navbar = () => {
  return (
    <nav>
      <Link to={ROUTES.DASHBOARD}>Dashboard</Link>
      <Link to={ROUTES.USERS.LIST}>Users</Link>
    </nav>
  );
};
```

---

## Route Parameters

```typescript
import { useParams } from 'react-router-dom';

const UserDetailPage = () => {
  const { id } = useParams<{ id: string }>();
  const { data: user } = useUser(id!);

  return <div>{user?.name}</div>;
};
```

---

## Nested Routes

```typescript
<Route path="/settings" element={<SettingsLayout />}>
  <Route index element={<SettingsOverview />} />
  <Route path="profile" element={<ProfileSettings />} />
  <Route path="security" element={<SecuritySettings />} />
</Route>
```

---

## Checklist

- [ ] Route constants defined in `routes.ts`
- [ ] Protected route guard created
- [ ] Router configured in `router/index.tsx`
- [ ] Pages lazy loaded
- [ ] Layouts applied to route groups
- [ ] Fallback route configured
- [ ] Navigation uses route constants
