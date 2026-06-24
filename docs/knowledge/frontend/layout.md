# Layout Implementation Guide

> **Goal**: Create consistent page layouts (navigation, sidebar, footer).
> **Rule**: Layouts wrap pages and provide the persistent shell.

## What is a Layout?

A layout is a **wrapper component** that:
1. Lives in `frontend/src/layouts/`
2. Provides persistent UI (navbar, sidebar, footer)
3. Renders child routes via `<Outlet />`
4. Is shared across multiple pages

---

## File Structure

```
frontend/src/layouts/
├── MainLayout.tsx      # Authenticated app layout
└── AuthLayout.tsx      # Login/register layout
```

---

## Pattern 1: Main Layout (Authenticated App)

**File**: `frontend/src/layouts/MainLayout.tsx`

```typescript
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/shared/Sidebar';
import { Header } from '@/components/shared/Header';

export const MainLayout: React.FC = () => {
  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar />
      
      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header />
        
        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
```

**Why**: 
- Sidebar and header persist across all pages
- `<Outlet />` renders the current page
- Responsive layout with overflow handling

---

## Pattern 2: Auth Layout (Login/Register)

**File**: `frontend/src/layouts/AuthLayout.tsx`

```typescript
import { Outlet } from 'react-router-dom';

export const AuthLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">My App</h1>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
};
```

**Why**: 
- Centered card design
- No navigation (user isn't logged in)
- Clean, focused on the form

---

## Pattern 3: Layout with Collapsible Sidebar

**File**: `frontend/src/layouts/MainLayout.tsx`

```typescript
import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from '@/components/shared/Sidebar';
import { Header } from '@/components/shared/Header';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </Header>
        
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
```

---

## Using Layouts in Router

**File**: `frontend/src/router/index.tsx`

```typescript
import { Routes, Route } from 'react-router-dom';
import { MainLayout } from '@/layouts/MainLayout';
import { AuthLayout } from '@/layouts/AuthLayout';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Auth Routes */}
      <Route element={<AuthLayout />}>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Route>

      {/* App Routes */}
      <Route element={<MainLayout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/users" element={<UsersPage />} />
      </Route>
    </Routes>
  );
};
```

**Why**: All routes under `<MainLayout />` share the same sidebar/header

---

## Responsive Layouts

### Mobile-First Sidebar

```typescript
export const Sidebar = ({ isOpen, onClose }) => {
  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 lg:hidden z-40"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-50
        w-64 bg-white border-r
        transform transition-transform lg:transform-none
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Sidebar content */}
      </aside>
    </>
  );
};
```

---

## Theme Configuration

Layouts use global theme variables defined in `tailwind.config.js`:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        sidebar: {
          bg: 'hsl(var(--sidebar-bg))',
          text: 'hsl(var(--sidebar-text))',
        },
      },
    },
  },
};
```

**CSS Variables** (`frontend/src/index.css`):

```css
:root {
  --sidebar-bg: 0 0% 100%;
  --sidebar-text: 222 47% 11%;
}

.dark {
  --sidebar-bg: 222 47% 11%;
  --sidebar-text: 0 0% 100%;
}
```

---

## Checklist

- [ ] Layout created in `frontend/src/layouts/`
- [ ] Uses `<Outlet />` to render child routes
- [ ] Applied to routes in router
- [ ] Responsive design (mobile/desktop)
- [ ] Theme variables configured
- [ ] No business logic in layout
