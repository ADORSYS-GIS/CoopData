# UI/UX Design System & Prompt Refinement Guide

> **Core Philosophy**: A premium SaaS interface feels clean, responsive, and alive. In an offline-first app, the UI must also communicate network connectivity changes, local cache loading states, and synchronization progress with zero layout shifts.

---

## 1. Visual Identity & Design Tokens

Every page must leverage smart design tokens to ensure a premium look. Avoid hardcoding custom tailwind color codes (like `text-blue-600`); instead, use the application's semantic classes.

### Color Palette & Spacing Rules
*   **Neutral Backgrounds**: Use off-white or muted slate surfaces (`bg-background`, `bg-slate-50/50`) with high contrast text.
*   **Borders & Radii**: Prefer soft rounded corners (`rounded-xl` or `rounded-2xl`) and thin, light borders (`border border-slate-100` or `border-border`) paired with subtle shadows (`shadow-sm` or `shadow-md`).
*   **Typography**: Use font size and weights for clear hierarchical layouts. Headings should be bold/semibold (`font-bold tracking-tight text-slate-900`). Primary metrics should stand out clearly.
*   **Spacing**: Ensure generous padding inside elements. Avoid crowding input fields and tables.

---

## 2. Network Status Banners

When the user transitions to an offline state, the app must display a non-intrusive status banner. This banner should be absolute-positioned or embedded in the main layout frame to prevent layout shifts.

### Style Standard: Connectivity Banner
```tsx
import { useOnlineStatus } from "@/hooks/utils/useOnlineStatus";
import { WifiOff } from "lucide-react";

export const ConnectionStatusBanner = () => {
  const isOnline = useOnlineStatus();
  
  if (isOnline) return null;

  return (
    <div className="bg-amber-500 text-white text-xs sm:text-sm font-medium py-2 px-4 w-full flex items-center justify-center gap-2 animate-slide-down">
      <WifiOff className="h-4 w-4 animate-bounce" />
      <span>You are currently working offline. Changes will be saved locally and synced when connection is restored.</span>
    </div>
  );
};
```

*   **Design Rule**: Place at the very top of the application layout shell (`sticky top-0 z-50`). Do not overlay critical navigation links.

---

## 3. Hydration Skeletons (Double-Pass Rendering)

Offline-first apps experience "Double-Pass Rendering": they show cached data instantly, fetch fresh data in the background, and then update the UI.

When local data is missing or loading from IndexedDB, render **Skeleton Loaders** instead of plain spinners to maintain visual structures.

### Style Standard: Metric Card Skeleton
```tsx
import { Skeleton } from "@/components/ui/skeleton";

export const MetricCardSkeleton = () => {
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24 bg-slate-100" />
        <Skeleton className="h-8 w-8 rounded-full bg-slate-100" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-8 w-16 bg-slate-100" />
        <Skeleton className="h-3 w-32 bg-slate-100" />
      </div>
    </div>
  );
};
```

---

## 4. Background Sync & Progress Indicators

Background syncing must occur silently without blocking the viewport with modals or loaders. Use non-intrusive UI widgets to reflect queue status.

### A. Toast Indicators (using Sonner)
- **Start Syncing**: Show a loading toast when processing the sync queue.
  `toast.loading("Synchronizing local changes...", { id: "sync-status" });`
- **End Syncing**: Update the same toast to success.
  `toast.success("Synchronization complete!", { id: "sync-status" });`

### B. Header Sync Status Icons
Place a small indicator icon inside the navigation header to show when local data is writing or syncing.

```tsx
import { CloudLightning, CloudCheck } from "lucide-react";

export const HeaderSyncIndicator = ({ isSyncing, hasPendingItems }: { isSyncing: boolean; hasPendingItems: boolean }) => {
  if (isSyncing) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-slate-500" title="Syncing changes...">
        <CloudLightning className="h-4 w-4 animate-spin text-primary" />
        <span className="hidden sm:inline">Syncing...</span>
      </div>
    );
  }

  if (hasPendingItems) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-amber-600" title="Offline changes waiting to sync">
        <CloudLightning className="h-4 w-4 text-amber-500 animate-pulse" />
        <span className="hidden sm:inline">Pending Sync</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-emerald-600" title="All changes synced">
      <CloudCheck className="h-4 w-4 text-emerald-500" />
      <span className="hidden sm:inline">Synced</span>
    </div>
  );
};
```

---

## Checklist

- [ ] Interactive cards incorporate `hover:-translate-y-0.5 transition-all duration-200 hover:shadow-md`.
- [ ] Active and hover states are configured for buttons, input forms, and navigation cards.
- [ ] Network status banners are responsive and sit sticky at the page boundary.
- [ ] No viewport blocking spinners are used during background sync operations.
- [ ] Empty state elements render custom graphics, helpful descriptions, and primary CTA buttons.
- [ ] Form submit buttons show loading spinners and disable clicking during transition periods.
- [ ] Loading screens use Skeleton components mapped to the layout's structural shape.
- [ ] Non-intrusive header icons display real-time background sync state (`Syncing`, `Pending Sync`, `Synced`).
