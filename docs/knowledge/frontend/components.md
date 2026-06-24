# Component Standards

> **Goal**: Build reusable, atomic, and accessible UI components.
> **Rule**: One Component = One File.

## File Structure

```
frontend/src/components/
├── ui/                  # shadcn/ui atomic components
│   ├── button.tsx
│   ├── input.tsx
│   └── dialog.tsx
├── shared/              # App-wide shared components
│   ├── Navbar.tsx
│   └── Footer.tsx
└── users/               # Feature-specific components
    ├── UserTable.tsx
    └── UserForm.tsx
```

---

## Pattern 1: Presentational Component

**File**: `frontend/src/components/users/UserCard.tsx`

```typescript
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mail, Shield } from 'lucide-react';
import type { User } from '@/types/user';

interface UserCardProps {
  user: User;
  onEdit: (user: User) => void;
  onDelete: (id: string) => void;
}

export const UserCard: React.FC<UserCardProps> = ({ user, onEdit, onDelete }) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          {user.name}
          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
            <Shield className="mr-1 h-3 w-3" />
            {user.role}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
          <Mail className="h-4 w-4" />
          {user.email}
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onEdit(user)}>
            Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={() => onDelete(user.id)}>
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
```

**Why**: 
- Component receives data via props
- No business logic
- Uses shadcn/ui components
- Accessible (semantic HTML)

---

## Pattern 2: Compound Component

**File**: `frontend/src/components/shared/PageHeader.tsx`

```typescript
import { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ 
  title, 
  description, 
  actions 
}) => {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        {description && (
          <p className="text-muted-foreground mt-1">{description}</p>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
};
```

**Usage**:
```typescript
<PageHeader
  title="Users"
  description="Manage user accounts"
  actions={
    <Button onClick={handleCreate}>
      <Plus className="mr-2 h-4 w-4" />
      Add User
    </Button>
  }
/>
```

---

## Pattern 3: List Component

**File**: `frontend/src/components/users/UserList.tsx`

```typescript
import { User } from '@/types/user';
import { UserCard } from './UserCard';

interface UserListProps {
  users: User[];
  onEdit: (user: User) => void;
  onDelete: (id: string) => void;
}

export const UserList: React.FC<UserListProps> = ({ users, onEdit, onDelete }) => {
  if (users.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No users found</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {users.map((user) => (
        <UserCard
          key={user.id}
          user={user}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};
```

**Why**: 
- Handles empty state
- Responsive grid layout
- Delegates rendering to child component

---

## Pattern 4: Controlled Input Component

**File**: `frontend/src/components/shared/SearchInput.tsx`

```typescript
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchInput: React.FC<SearchInputProps> = ({ 
  value, 
  onChange, 
  placeholder = 'Search...' 
}) => {
  return (
    <div className="relative">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-10"
      />
    </div>
  );
};
```

---

## Best Practices

1. **Modularity**: If a component exceeds 150 lines, extract sub-components
2. **Props**: Always define strict `interface Props`
3. **No Logic**: Components should be "dumb" (presentational)
4. **Accessibility**: Use semantic HTML (`<button>`, not `<div>`)
5. **Composition**: Build complex UIs from small blocks

## Checklist

- [ ] Component has strict Props interface
- [ ] No business logic (use hooks instead)
- [ ] Uses shadcn/ui components
- [ ] Accessible (aria-labels, semantic HTML)
- [ ] Handles empty/loading states
- [ ] File is under 150 lines
