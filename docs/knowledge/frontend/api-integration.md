# API Integration Guide

> **Goal**: Use the generated OpenAPI client for all backend communication.
> **Rule**: NEVER write manual `fetch` or `axios` calls.

## What is the API Layer?

The API layer consists of:
1. **Generated Client**: `frontend/src/openapi-client/services.gen.ts` (auto-generated from OpenAPI spec)
2. **Type Definitions**: `frontend/src/openapi-client/types.gen.ts` (auto-generated types)
3. **Custom Hooks**: `frontend/src/hooks/use[Feature].ts` (wraps API calls with React Query)

---

## Step 1: Locate the API Method

**File**: `frontend/src/openapi-client/services.gen.ts`

```typescript
// This file is AUTO-GENERATED. Do not edit manually.
export class UsersService {
  public static getUsers(params?: { filters?: string }): Promise<User[]> { ... }
  public static getUser(params: { id: string }): Promise<User> { ... }
  public static createUser(params: { requestBody: CreateUserDto }): Promise<User> { ... }
  public static updateUser(params: { id: string; requestBody: UpdateUserDto }): Promise<User> { ... }
  public static deleteUser(params: { id: string }): Promise<void> { ... }
}
```

**Action**: Find the service method you need (e.g., `UsersService.getUsers`)

---

## Step 2: Check the Types

**File**: `frontend/src/openapi-client/types.gen.ts`

```typescript
// This file is AUTO-GENERATED. Do not edit manually.
export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user';
  isActive: boolean;
}

export interface CreateUserDto {
  email: string;
  name: string;
  role: 'admin' | 'user';
}
```

**Action**: Verify what types the method expects and returns

---

## Step 3: Wrap in React Query Hook

**File**: `frontend/src/hooks/useUsers.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UsersService } from '@/openapi-client/services.gen';
import type { User, CreateUserDto } from '@/openapi-client/types.gen';

// Query for fetching
export const useUsers = () => {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => UsersService.getUsers(),
  });
};

// Mutation for creating
export const useCreateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateUserDto) => 
      UsersService.createUser({ requestBody: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
};
```

**Why**: 
- React Query handles caching, loading states, and refetching
- Mutations automatically invalidate stale data
- No manual state management needed

---

## Step 4: Use in Component

**File**: `frontend/src/pages/UsersPage.tsx`

```typescript
import { useUsers, useCreateUser } from '@/hooks/useUsers';

export const UsersPage = () => {
  const { data: users, isLoading, error } = useUsers();
  const createUser = useCreateUser();

  const handleCreate = (data) => {
    createUser.mutate(data);
  };

  if (isLoading) return <Loader />;
  if (error) return <Error message={error.message} />;

  return <UserTable data={users || []} onCreate={handleCreate} />;
};
```

---

## API Configuration

**File**: `frontend/src/main.tsx`

The OpenAPI client is configured once at app startup:

```typescript
import { OpenAPI } from '@/openapi-client';

// Set base URL
OpenAPI.BASE = import.meta.env.VITE_API_URL;

// Add auth token to all requests
OpenAPI.interceptors.request.use(async (request) => {
  const token = await authService.getAccessToken();
  if (token) {
    request.headers.set('Authorization', `Bearer ${token}`);
  }
  return request;
});

// Handle global errors
OpenAPI.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);
```

**Why**: 
- Auth tokens are added automatically
- Global error handling (401 redirects)
- No need to configure in each request

---

## Error Handling

React Query provides built-in error handling:

```typescript
const { data, error, isError } = useUsers();

if (isError) {
  return <div>Error: {error.message}</div>;
}
```

For mutations:

```typescript
const createUser = useCreateUser();

const handleCreate = (data) => {
  createUser.mutate(data, {
    onSuccess: () => {
      toast.success('User created');
    },
    onError: (error) => {
      toast.error(`Failed: ${error.message}`);
    },
  });
};
```

---

## What NOT to Do

❌ **Don't** call the API directly in components:
```typescript
// BAD
const [users, setUsers] = useState([]);
useEffect(() => {
  UsersService.getUsers().then(setUsers);
}, []);
```

✅ **Do** use a custom hook:
```typescript
// GOOD
const { data: users } = useUsers();
```

❌ **Don't** write manual fetch calls:
```typescript
// BAD
fetch('/api/users').then(r => r.json());
```

✅ **Do** use the generated client:
```typescript
// GOOD
UsersService.getUsers();
```

---

## Checklist

- [ ] Located method in `services.gen.ts`
- [ ] Checked types in `types.gen.ts`
- [ ] Created hook in `frontend/src/hooks/`
- [ ] Wrapped with `useQuery` or `useMutation`
- [ ] Used hook in component
- [ ] No manual fetch calls
