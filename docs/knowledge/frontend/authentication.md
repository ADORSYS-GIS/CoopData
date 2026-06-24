# Authentication Implementation Guide

> **Goal**: Implement Keycloak authentication.
> **Rule**: Never store tokens in localStorage if avoidable. Use HttpOnly cookies.

## File Structure

```
frontend/src/
├── services/shared/
│   └── keycloakConfig.ts    # Keycloak configuration
├── context/
│   └── AuthContext.tsx      # Auth state provider
└── router/
    └── ProtectedRoute.tsx   # Route guard
```

---

## Step 1: Configure Keycloak

**File**: `frontend/src/services/shared/keycloakConfig.ts`

```typescript
export const keycloakConfig = {
  url: import.meta.env.VITE_KEYCLOAK_URL,
  realm: import.meta.env.VITE_KEYCLOAK_REALM,
  clientId: import.meta.env.VITE_KEYCLOAK_CLIENT_ID,
};
```

**Environment Variables** (`.env`):
```bash
VITE_KEYCLOAK_URL=https://keycloak.example.com
VITE_KEYCLOAK_REALM=my-realm
VITE_KEYCLOAK_CLIENT_ID=my-client
```

---

## Step 2: Create Auth Context

**File**: `frontend/src/context/AuthContext.tsx`

```typescript
import { createContext, useContext, useEffect, useState } from 'react';
import Keycloak from 'keycloak-js';
import { keycloakConfig } from '@/services/shared/keycloakConfig';

interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: {
    username?: string;
    email?: string;
    roles?: string[];
  } | null;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [keycloak, setKeycloak] = useState<Keycloak | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const kc = new Keycloak(keycloakConfig);
    
    kc.init({ onLoad: 'check-sso' }).then((authenticated) => {
      setKeycloak(kc);
      setIsAuthenticated(authenticated);
      setIsLoading(false);
    });
  }, []);

  const login = () => keycloak?.login();
  const logout = () => keycloak?.logout();

  const user = keycloak?.tokenParsed ? {
    username: keycloak.tokenParsed.preferred_username,
    email: keycloak.tokenParsed.email,
    roles: keycloak.tokenParsed.realm_access?.roles || [],
  } : null;

  return (
    <AuthContext.Provider value={{ isAuthenticated, isLoading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};
```

---

## Step 3: Wrap App with Provider

**File**: `frontend/src/main.tsx`

```typescript
import { AuthProvider } from './context/AuthContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <AuthProvider>
    <App />
  </AuthProvider>
);
```

---

## Step 4: Use in Components

### Check Authentication

```typescript
import { useAuth } from '@/context/AuthContext';

const MyComponent = () => {
  const { isAuthenticated, user, login } = useAuth();

  if (!isAuthenticated) {
    return <button onClick={login}>Login</button>;
  }

  return <div>Welcome, {user?.username}</div>;
};
```

### Check Roles

```typescript
const { user } = useAuth();
const isAdmin = user?.roles?.includes('admin');

{isAdmin && <AdminPanel />}
```

---

## Step 5: Protect Routes

**File**: `frontend/src/router/ProtectedRoute.tsx`

```typescript
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div className="flex h-screen items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>;
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
};
```

**Usage in Router**:
```typescript
<Route element={<ProtectedRoute />}>
  <Route path="/dashboard" element={<DashboardPage />} />
</Route>
```

---

## Step 6: Add Token to API Requests

**File**: `frontend/src/main.tsx`

```typescript
import { OpenAPI } from '@/openapi-client';

// Configure OpenAPI client
OpenAPI.interceptors.request.use(async (request) => {
  const token = keycloak?.token;
  if (token) {
    request.headers.set('Authorization', `Bearer ${token}`);
  }
  return request;
});
```

---

## Role-Based Access Control

Define role constants:

**File**: `frontend/src/constants/roles.ts`

```typescript
export const ROLES = {
  ADMIN: 'admin',
  ORG_ADMIN: 'org_admin',
  USER: 'user',
} as const;
```

Check roles in components:

```typescript
import { useAuth } from '@/context/AuthContext';
import { ROLES } from '@/constants/roles';

const { user } = useAuth();
const canDelete = user?.roles?.includes(ROLES.ADMIN);

{canDelete && <Button onClick={handleDelete}>Delete</Button>}
```

---

## Checklist

- [ ] Keycloak config created
- [ ] Auth context created
- [ ] App wrapped with AuthProvider
- [ ] Protected route guard created
- [ ] Token added to API requests
- [ ] Role constants defined
- [ ] RBAC implemented in UI
