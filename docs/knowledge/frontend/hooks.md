# Custom Hooks Guide

> **Goal**: Encapsulate logic, side effects, and data fetching.
> **Rule**: If it's not UI, it belongs in a Hook.

## File Structure

```
frontend/src/hooks/
├── useUsers.ts          # Feature-specific data hooks
├── useAuth.ts           # Auth state hook
├── useDebounce.ts       # Utility hook
└── useLocalStorage.ts   # Browser API hook
```

---

## Pattern 1: Data Fetching Hook (React Query)

**File**: `frontend/src/hooks/useUsers.ts`

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UsersService } from '@/openapi-client/services.gen';
import type { User, CreateUserDto, UpdateUserDto } from '@/types/user';

// ============================================
// QUERY KEYS (Centralized)
// ============================================
const QUERY_KEYS = {
  all: ['users'] as const,
  lists: () => [...QUERY_KEYS.all, 'list'] as const,
  list: (filters: string) => [...QUERY_KEYS.lists(), { filters }] as const,
  details: () => [...QUERY_KEYS.all, 'detail'] as const,
  detail: (id: string) => [...QUERY_KEYS.details(), id] as const,
};

// ============================================
// QUERIES
// ============================================
export const useUsers = (filters?: string) => {
  return useQuery({
    queryKey: QUERY_KEYS.list(filters || ''),
    queryFn: () => UsersService.getUsers({ filters }),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useUser = (id: string) => {
  return useQuery({
    queryKey: QUERY_KEYS.detail(id),
    queryFn: () => UsersService.getUser({ id }),
    enabled: !!id, // Only fetch if id exists
  });
};

// ============================================
// MUTATIONS
// ============================================
export const useCreateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateUserDto) => 
      UsersService.createUser({ requestBody: data }),
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lists() });
    },
  });
};

export const useUpdateUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateUserDto }) =>
      UsersService.updateUser({ id, requestBody: data }),
    onSuccess: (_, variables) => {
      // Invalidate both list and specific item
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lists() });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.detail(variables.id) });
    },
  });
};

export const useDeleteUser = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (id: string) => UsersService.deleteUser({ id }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.lists() });
    },
  });
};
```

**Why**: 
- Query keys are centralized for easy cache management
- Each operation (CRUD) has its own hook
- Cache invalidation is automatic

---

## Pattern 2: State Management Hook

**File**: `frontend/src/hooks/useToggle.ts`

```typescript
import { useState, useCallback } from 'react';

export const useToggle = (initialValue: boolean = false) => {
  const [value, setValue] = useState(initialValue);

  const toggle = useCallback(() => {
    setValue(v => !v);
  }, []);

  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);

  return { value, toggle, setTrue, setFalse };
};
```

**Usage**:
```typescript
const { value: isOpen, setTrue: open, setFalse: close } = useToggle();
```

---

## Pattern 3: Browser API Hook

**File**: `frontend/src/hooks/useLocalStorage.ts`

```typescript
import { useState, useEffect } from 'react';

export const useLocalStorage = <T>(key: string, initialValue: T) => {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue] as const;
};
```

**Usage**:
```typescript
const [theme, setTheme] = useLocalStorage('theme', 'light');
```

---

## Pattern 4: Debounce Hook

**File**: `frontend/src/hooks/useDebounce.ts`

```typescript
import { useState, useEffect } from 'react';

export const useDebounce = <T>(value: T, delay: number = 500): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};
```

**Usage**:
```typescript
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearch = useDebounce(searchTerm, 300);

useEffect(() => {
  // API call with debouncedSearch
}, [debouncedSearch]);
```

---

## Best Practices

1. **Naming**: Always prefix with `use`
2. **Return**: Use objects for scalability: `{ data, isLoading, actions }`
3. **Types**: Explicitly type return values
4. **SRP**: One hook = One responsibility
5. **Extraction**: If a component has > 3 `useEffect` calls, extract to a hook

## Checklist

- [ ] Hook name starts with `use`
- [ ] Return value is typed
- [ ] No UI logic in hook
- [ ] Query keys are centralized (for data hooks)
- [ ] Mutations invalidate relevant queries
