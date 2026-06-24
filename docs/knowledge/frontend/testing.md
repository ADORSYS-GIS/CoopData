# Testing Strategy & Offline Testing Guide

> **Goal**: Write tests that give confidence, not just coverage.
> **Rule**: Test user behavior, network disruptions, local database integration, and remote synchronization.

---

## Testing Tools

- **Unit/Integration**: Vitest + React Testing Library
- **E2E**: Playwright
- **Mocking**: MSW (Mock Service Worker)
- **Local Cache**: Dexie Mock context

---

## File Structure

```
frontend/src/
├── __tests__/
│   ├── components/
│   │   └── UserCard.test.tsx
│   ├── hooks/
│   │   └── useUsers.test.ts
│   ├── services/
│   │   └── assessmentRepository.test.ts
│   └── utils/
│       └── formatDate.test.ts
└── e2e/
    └── users.spec.ts
```

---

## Pattern 1: Component Testing

**File**: `frontend/src/__tests__/components/UserCard.test.tsx`

```typescript
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { UserCard } from '@/components/users/UserCard';
import { describe, it, expect, vi } from 'vitest';

describe('UserCard', () => {
  const mockUser = {
    id: '1',
    name: 'John Doe',
    email: 'john@example.com',
    role: 'admin',
  };

  it('renders user information', () => {
    render(<UserCard user={mockUser} onEdit={vi.fn()} onDelete={vi.fn()} />);
    
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
  });

  it('calls onEdit when edit button is clicked', async () => {
    const onEdit = vi.fn();
    render(<UserCard user={mockUser} onEdit={onEdit} onDelete={vi.fn()} />);
    
    const editButton = screen.getByRole('button', { name: /edit/i });
    await userEvent.click(editButton);
    
    expect(onEdit).toHaveBeenCalledWith(mockUser);
  });

  it('calls onDelete when delete button is clicked', async () => {
    const onDelete = vi.fn();
    render(<UserCard user={mockUser} onEdit={vi.fn()} onDelete={onDelete} />);
    
    const deleteButton = screen.getByRole('button', { name: /delete/i });
    await userEvent.click(deleteButton);
    
    expect(onDelete).toHaveBeenCalledWith('1');
  });
});
```

---

## Pattern 2: Hook Testing

**File**: `frontend/src/__tests__/hooks/useUsers.test.ts`

```typescript
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useUsers } from '@/hooks/useUsers';
import { UsersService } from '@/openapi-client/services.gen';
import { describe, it, expect, vi } from 'vitest';

// Mock the service
vi.mock('@/openapi-client/services.gen');

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
};

describe('useUsers', () => {
  it('fetches users successfully', async () => {
    const mockUsers = [
      { id: '1', name: 'John', email: 'john@example.com' },
    ];
    
    vi.mocked(UsersService.getUsers).mockResolvedValue(mockUsers);

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(mockUsers);
  });

  it('handles errors', async () => {
    vi.mocked(UsersService.getUsers).mockRejectedValue(new Error('Failed'));

    const { result } = renderHook(() => useUsers(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toBeDefined();
  });
});
```

---

## Pattern 3: Utility Testing

**File**: `frontend/src/__tests__/utils/formatDate.test.ts`

```typescript
import { formatDate } from '@/utils/formatDate';
import { describe, it, expect } from 'vitest';

describe('formatDate', () => {
  it('formats date correctly', () => {
    const date = new Date('2024-01-15T10:30:00Z');
    expect(formatDate(date)).toBe('Jan 15, 2024');
  });

  it('handles invalid dates', () => {
    expect(formatDate(null)).toBe('Invalid date');
  });
});
```

---

## Pattern 4: E2E Testing

**File**: `frontend/e2e/users.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'admin@example.com');
    await page.fill('input[name="password"]', 'password');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('creates a new user', async ({ page }) => {
    await page.goto('/users');
    await page.click('button:has-text("Add User")');
    
    await page.fill('input[name="name"]', 'Jane Doe');
    await page.fill('input[name="email"]', 'jane@example.com');
    await page.selectOption('select[name="role"]', 'user');
    
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=Jane Doe')).toBeVisible();
  });

  test('deletes a user', async ({ page }) => {
    await page.goto('/users');
    
    const userRow = page.locator('tr:has-text("John Doe")');
    await userRow.locator('button:has-text("Delete")').click();
    
    await page.click('button:has-text("Confirm")');
    
    await expect(page.locator('text=John Doe')).not.toBeVisible();
  });
});
```

---

## Pattern 5: Offline-First Repository Testing

To verify that repositories switch to the local database cache when the network fails, we stub the global `navigator` object and assert IndexedDB writes.

**File**: `frontend/src/__tests__/services/assessmentRepository.test.ts`

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { assessmentRepository } from "@/services/assessments/assessmentRepository";
import { db } from "@/services/db";
import { SyncStatus } from "@/types/sync";

vi.mock("@/openapi-client/services.gen", () => ({
  getAssessment: vi.fn(),
}));

import { getAssessment } from "@/openapi-client/services.gen";

describe("assessmentRepository - Offline Fallback", () => {
  beforeEach(async () => {
    await db.assessments.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reads from IndexedDB when offline, bypassing API", async () => {
    const cachedItem = {
      id: "a1",
      name: "Offline Cache Item",
      dimensionIds: [],
      syncStatus: SyncStatus.SYNCED,
    };
    await db.assessments.add(cachedItem);

    // Stub navigator to return offline state
    vi.stubGlobal("navigator", { onLine: false });

    const result = await assessmentRepository.getById("a1");

    expect(result).toEqual(cachedItem);
    expect(getAssessment).not.toHaveBeenCalled();
  });

  it("updates IndexedDB on successful online fetch", async () => {
    vi.stubGlobal("navigator", { onLine: true });
    vi.mocked(getAssessment).mockResolvedValue({
      data: {
        assessment_id: "a1",
        document_title: "Fresh API Item",
        dimensions_id: [],
      }
    });

    const result = await assessmentRepository.getById("a1");

    expect(result?.name).toBe("Fresh API Item");
    
    const savedLocal = await db.assessments.get("a1");
    expect(savedLocal?.name).toBe("Fresh API Item");
    expect(savedLocal?.syncStatus).toBe(SyncStatus.SYNCED);
  });
});
```

---

## Mocking API Calls (MSW)

**File**: `frontend/src/__tests__/mocks/handlers.ts`

```typescript
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/users', () => {
    return HttpResponse.json([
      { id: '1', name: 'John', email: 'john@example.com' },
    ]);
  }),

  http.post('/api/users', async ({ request }) => {
    const body = await request.json();
    return HttpResponse.json({ id: '2', ...body });
  }),
];
```

**Setup** (`frontend/src/__tests__/setup.ts`):

```typescript
import { setupServer } from 'msw/node';
import { handlers } from './mocks/handlers';
import { beforeAll, afterEach, afterAll } from 'vitest';

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

---

## Running Tests

```bash
# Unit/Integration tests
npm run test

# Watch mode
npm run test:watch

# Coverage
npm run test:coverage

# E2E tests
npm run test:e2e
```

---

## What to Test

### ✅ Do Test:
- User interactions (clicks, typing)
- Conditional rendering
- Error/loading states and skeleton placeholders
- Repository offline fallbacks and IndexedDB local caches
- E2E flows resolving authentication cookies
- Accessibility (roles, labels, tabIndex triggers)
- Critical business logic

### ❌ Don't Test:
- Implementation details (internal state hook variables)
- Third-party libraries
- Styling/CSS
- Trivial functions

---

## Checklist

- [ ] Component tests use `@testing-library/react`
- [ ] Tests query by role/label (accessible)
- [ ] Hooks tested with `renderHook`
- [ ] API calls mocked with MSW or module mocking
- [ ] E2E tests cover critical login/dashboard flows
- [ ] Repository tests assert IndexedDB data transactions
- [ ] Offline tests stub global `navigator.onLine` to assert local caching path
- [ ] Tests focus on user outcomes, not code paths
