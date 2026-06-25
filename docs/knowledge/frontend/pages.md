# Page Implementation Guide

> **When to use**: Every time you create a new route/view.
> **Rule**: Pages are orchestrators only. They call hooks and render components. No business logic.

---

## What is a Page?

A page is a **top-level component** that:

1. Lives in `frontend/src/pages/`
2. Is connected to a route in `frontend/src/router/`
3. Calls custom hooks (which wrap local repositories) for data
4. Renders UI components
5. Manages local UI state (dialogs, selected items)
6. Orchestrates page-level connectivity state banners and loading skeletons

## File Location

```
frontend/src/pages/
├── admin/               # Global Admin Pages
├── second_admin/        # Organization Admin Pages
├── third_admin/         # Cooperative Admin Pages
├── user/                # Cooperative User Pages
└── shared/              # Shared Pages (e.g. ProfilePage, AssessmentsPage)
```

---

## Standard Page Structure

Every page follows this pattern, utilizing custom hooks for offline-first state and rendering connection banners.

```typescript
// File: frontend/src/pages/UsersPage.tsx
import { useState } from 'react';
import { useUsers, useCreateUser } from '@/hooks/useUsers';  // Step 1: Import hooks
import { useOnlineStatus } from '@/hooks/utils/useOnlineStatus';
import { UserTable } from '@/components/users/UserTable';    // Step 2: Import components
import { UserForm } from '@/components/users/UserForm';
import { ConnectionStatusBanner } from '@/components/shared/ConnectionStatusBanner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export const UsersPage: React.FC = () => {
  const isOnline = useOnlineStatus();

  // Step 3: Call hooks at the top (these wrap offline repositories)
  const { data: users, isLoading } = useUsers();
  const createUser = useCreateUser();

  // Step 4: Local UI state
  const [isFormOpen, setIsFormOpen] = useState(false);

  // Step 5: Event handlers
  const handleCreate = (data) => {
    createUser.mutate(data, {
      onSuccess: () => {
        setIsFormOpen(false);
        toast.success(
          !isOnline
            ? "Saved locally! Will sync when connection is restored."
            : "User created successfully."
        );
      },
    });
  };

  // Step 6: Loading state (hydrating from IndexedDB)
  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="animate-spin text-primary" />
      </div>
    );
  }

  // Step 7: Render
  return (
    <div className="container mx-auto p-6 space-y-4">
      {/* Network Status Banner */}
      <ConnectionStatusBanner />

      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Users</h1>
        {/* Actions requiring network are conditionally disabled or flagged */}
        <Button onClick={() => setIsFormOpen(true)}>Add User</Button>
      </div>

      <UserTable data={users || []} />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent>
          <UserForm onSubmit={handleCreate} isSubmitting={createUser.isPending} />
        </DialogContent>
      </Dialog>
    </div>
  );
};
```

---

## Page Patterns

### Pattern A: List Page

**Use when**: Displaying a table/list of items.

```typescript
export const UsersPage: React.FC = () => {
  const { data, isLoading } = useUsers();

  if (isLoading) return <div className="p-8 text-center">Loading cache...</div>;

  return (
    <div className="container mx-auto p-6 space-y-4">
      <ConnectionStatusBanner />
      <PageHeader title="Users" />
      <UserTable data={data || []} />
    </div>
  );
};
```

### Pattern B: Detail Page

**Use when**: Showing a single item's details, handling localized cache searches and fallback states.

```typescript
import { useParams } from 'react-router-dom';
import { useUser } from '@/hooks/useUsers';
import { useTranslation } from 'react-i18next';

export const UserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { i18n } = useTranslation();
  const lang = i18n.language || 'en';

  // Custom query hook passes localized values down to repositories
  const { data: user, isLoading } = useUser(id!, lang);

  if (isLoading) return <div className="p-8 text-center">Loading details...</div>;
  if (!user) return <div className="p-8 text-center">User not found</div>;

  return (
    <div className="container mx-auto p-6 space-y-4">
      <ConnectionStatusBanner />
      <h1 className="text-2xl font-bold">{user.name}</h1>
      <p className="text-slate-500">{user.email}</p>
    </div>
  );
};
```

### Pattern C: Form Page

**Use when**: Creating/editing a single item.

```typescript
import { useNavigate } from 'react-router-dom';
import { useCreateUser } from '@/hooks/useUsers';
import { useOnlineStatus } from '@/hooks/utils/useOnlineStatus';

export const CreateUserPage: React.FC = () => {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();
  const createUser = useCreateUser();

  const handleSubmit = (data) => {
    createUser.mutate(data, {
      onSuccess: () => navigate('/users'),
    });
  };

  return (
    <div className="container mx-auto p-6 space-y-4">
      <ConnectionStatusBanner />
      <h1 className="text-2xl font-bold">Create User</h1>
      <UserForm
        onSubmit={handleSubmit}
        isLoading={createUser.isPending}
        isOffline={!isOnline}
      />
    </div>
  );
};
```

---

## What Pages Should NOT Do

❌ **Don't** call API directly:

```typescript
// BAD
const [users, setUsers] = useState([]);
useEffect(() => {
  fetch("/api/users")
    .then((r) => r.json())
    .then(setUsers);
}, []);
```

✅ **Do** use hooks that retrieve from local Repositories:

```typescript
// GOOD
const { data: users } = useUsers();
```

❌ **Don't** put complex business or database mapping logic inside page components:

```typescript
// BAD
const handleCreate = (data) => {
  const validated = validateUser(data);
  const transformed = transformUser(validated);
  // database logic...
};
```

✅ **Do** delegate to React hook mutations and Repository sync layers.

---

## Dependencies

**Pages depend on**:

- `frontend/src/hooks/` - Data fetching hooks (see `docs/hooks.md`)
- `frontend/src/components/` - UI components (see `docs/components.md`)
- `frontend/src/types/` - TypeScript types (see `docs/data-types.md`)

**Pages are used by**:

- `frontend/src/router/` - Router configuration (see `docs/routing.md`)

---

## Checklist

Before marking a page complete:

- [ ] Page is in `frontend/src/pages/[subfolder]/[Name]Page.tsx`
- [ ] Uses custom hooks wrapping local repositories (no direct API calls)
- [ ] Renders components (no inline JSX complexity)
- [ ] Incorporates `useOnlineStatus` and connection status banners
- [ ] Disables network-dependent buttons/actions when working offline
- [ ] Handles loading state with Skeletons or spinners
- [ ] Handles error state
- [ ] Handles empty state
- [ ] Route is added to router config
- [ ] No business logic in page
