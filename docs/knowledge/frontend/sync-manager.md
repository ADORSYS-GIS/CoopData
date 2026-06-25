# Sync Manager & Background Sync Guide

> **Core Philosophy**: The `syncManager` is the single orchestrator that bridges offline local writes and online server synchronization. It owns the `online`/`offline` window events, drives the `precacheAll` proactive download, and processes the `sync_queue` table in strict chronological order. Nothing syncs without going through this layer.
>
> **Stop-and-Ask Rule**: If you are adding a new entity that can be created or updated offline, you must add a corresponding sync service and register it inside `syncManager.syncAll()` in the correct dependency order.

---

## 1. File Location

```
frontend/src/services/sync/
├── syncManager.ts                    ← Master orchestrator (this guide)
├── cooperationSyncService.ts
├── cooperationUserSyncService.ts (in cooperationUsers/)
├── dimensionSyncService.ts
├── digitalisationLevelSyncService.ts
├── digitalisationGapSyncService.ts
├── recommendationSyncService.ts
├── userSyncService.ts
├── assessmentSubmissionSyncService.ts
├── dimensionAssessmentSyncService.ts
└── organizationDimensionSyncService.ts
```

---

## 2. Initialization

`syncManager.initialize()` is called **once** at app boot from `main.tsx`, after Keycloak has resolved. It:

1. Registers `window.addEventListener("online")` and `window.addEventListener("offline")`.
2. Runs `syncAll()` immediately if already online (to flush pending queue from a previous session).
3. Runs `precacheAll()` immediately if online (to warm the IndexedDB cache for offline use).

```typescript
// File: frontend/src/main.tsx
const initializeAuth = async () => {
  // ... keycloak init ...
  syncManager.initialize(); // ← Called after auth resolves
};
```

```typescript
// File: frontend/src/services/sync/syncManager.ts
initialize() {
  window.addEventListener("online",  this.handleOnline.bind(this));
  window.addEventListener("offline", this.handleOffline.bind(this));

  if (navigator.onLine) {
    const organizationId = authService.getOrganizationId();
    this.syncAll(organizationId);
    this.precacheAll(organizationId);
  }
},
```

---

## 3. Online/Offline Event Handlers

### `handleOnline()`

Fires when the browser reconnects. Shows a user-facing toast, then calls `syncAll()`. On completion, shows a success toast.

```typescript
handleOnline() {
  toast.info("Back online – syncing saved data…", { id: "sync-start", duration: 3000 });
  const organizationId = authService.getOrganizationId();
  syncManager.syncAll(organizationId).then(() => {
    toast.success("All data synced successfully.", { id: "sync-done", duration: 4000 });
  });
},
```

### `handleOffline()`

Fires when the browser loses connection. Shows an informational warning toast. Does not interrupt ongoing operations.

```typescript
handleOffline() {
  toast.warning(
    "You are offline. Your work will be saved locally and synced when you reconnect.",
    { id: "offline-notice", duration: 6000 }
  );
},
```

---

## 4. `syncAll()` — The Sync Queue Processor

Processes all pending offline mutations in **strict dependency order**. The order matters because some entities depend on others (e.g., dimension assessments reference dimensions).

```typescript
async syncAll(organizationId: string | null) {
  if (!navigator.onLine) return; // Guard: never run offline

  try {
    // 1. Core metadata (no dependencies)
    await dimensionSyncService.sync();
    await digitalisationLevelSyncService.sync();
    await digitalisationGapSyncService.sync();

    // 2. Refresh gap cache in all supported languages
    const { digitalisationGapRepository } = await import("../digitalisationGaps/digitalisationGapRepository");
    const langs = ["en", "fr", "pt", "ss"];
    for (const lang of langs) {
      await digitalisationGapRepository.getAll(lang).catch(() => {});
    }

    // 3. Recommendations and users
    await recommendationSyncService.sync();
    await userSyncService.sync();

    // 4. Individual dimension answers BEFORE full submission flush
    await dimensionAssessmentSyncService.sync();

    // 5. Organization-scoped entities
    if (organizationId) {
      await cooperationSyncService.sync(organizationId);
      await organizationDimensionSyncService.syncPendingAssignments();
      await cooperationUserSyncService.sync();
    }

    // 6. Full assessment submissions last (depends on dimension assessments)
    await assessmentSubmissionSyncService.sync();

  } catch (error) {
    console.error("An error occurred during sync:", error);
  } finally {
    // Always invalidate queries so UI reflects latest state
    queryClient.invalidateQueries({ queryKey: ["digitalisationLevels"] });
    queryClient.invalidateQueries({ queryKey: ["recommendations"] });
    queryClient.invalidateQueries({ queryKey: ["digitalisationGaps"] });
  }
},
```

### Dependency Order Rule

When adding a new sync service, determine where it belongs in the chain:

```
1. Core metadata (no FK dependencies)          ← dimensions, gaps, levels
2. Reference data                              ← recommendations, users
3. User mutations (depend on metadata)         ← dimension assessments
4. Org-scoped mutations                        ← cooperations, org dimensions
5. Full record submissions (depend on step 3)  ← assessment submissions
```

---

## 5. `precacheAll()` — Proactive Offline Pre-Warming

Runs once per auth session (guarded by a `sessionStorage` key in `AuthContext`). Downloads and caches everything the user is likely to need offline, based on their role and organization.

### Pre-cache Flow

```
precacheAll(organizationId)
    │
    ├── 1. Always cache: organizations list
    │
    ├── 2. Shared metadata for all 4 languages (en, fr, pt, ss)
    │       ├── digitalisationGapRepository.getAll(lang)
    │       └── recommendationRepository.getAll(lang)
    │
    ├── 3. If organizationId exists (org_admin / admin)
    │       ├── assessmentRepository.syncAssessments(listByOrganization)
    │       ├── submissionRepository.listByOrganization(orgId)
    │       ├── userRepository.getMembers(orgId)
    │       ├── cooperationRepository.getAll(orgId)
    │       ├── consolidatedReportRepository (role-gated: dgrv_admin / org_admin)
    │       └── For each assessment:
    │               ├── assessmentRepository.getById(assessment.id)
    │               └── actionPlanRepository.getActionPlanByAssessmentId(assessment.id)
    │
    ├── 4. If coop-related role (coop_admin / coop_user)
    │       ├── assessmentRepository.syncAssessments(listByCooperation)
    │       ├── submissionRepository.listByCooperation(cooperationId)
    │       └── For each coop assessment:
    │               ├── assessmentRepository.getById
    │               └── actionPlanRepository.getActionPlanByAssessmentId
    │
    └── 5. For all unique dimension IDs found across assessments
            ├── dimensionRepository.getById(dimId)  ← cache dimension_key
            └── For each lang + "all":
                    └── dimensionAssessmentRepository.getDimensionWithStates(dimId, lang)
```

### Session Guard (Prevents Re-Running After Login)

```typescript
// File: frontend/src/context/AuthContext.tsx
const PRECACHE_KEY = "__gap_precache_after_auth_v1__";
if (sessionStorage.getItem(PRECACHE_KEY)) return; // Already ran this session
sessionStorage.setItem(PRECACHE_KEY, "1");

const orgId = authService.getOrganizationId();
syncManager.precacheAll(orgId).catch((e: unknown) => {
  console.warn("Pre-cache after auth failed:", e);
});
```

---

## 6. Adding a New Sync Service

When adding a new entity that supports offline writes, follow this exact pattern:

### Step 1 — Create the sync service

```typescript
// File: frontend/src/services/sync/myEntitySyncService.ts
import { db } from "../db";
import { SyncStatus } from "@/types/sync";
import { MyEntityService } from "@/openapi-client/services.gen";

export const myEntitySyncService = {
  async sync() {
    // 1. Get all pending items for this entity type
    const pending = await db.sync_queue.where("entityType").equals("myEntities").toArray();

    for (const item of pending) {
      try {
        // 2. Replay the mutation against the backend API
        if (item.action === "CREATE") {
          await MyEntityService.createMyEntity({ requestBody: item.payload as any });
        } else if (item.action === "UPDATE") {
          await MyEntityService.updateMyEntity({
            id: item.entityId,
            requestBody: item.payload as any,
          });
        } else if (item.action === "DELETE") {
          await MyEntityService.deleteMyEntity({ id: item.entityId });
        }

        // 3. Remove from queue on success
        await db.sync_queue.delete(item.id!);

        // 4. Update entity syncStatus to SYNCED
        await db.table("myEntities").update(item.entityId, {
          syncStatus: SyncStatus.SYNCED,
          lastError: undefined,
        });
      } catch (error) {
        // 5. On failure, mark as FAILED and store error
        await db.table("myEntities").update(item.entityId, {
          syncStatus: SyncStatus.FAILED,
          lastError: error instanceof Error ? error.message : "Sync failed",
        });
        console.error(`Failed to sync myEntity ${item.entityId}:`, error);
      }
    }
  },
};
```

### Step 2 — Register in `syncManager.syncAll()`

Place it at the correct position in the dependency chain:

```typescript
// File: frontend/src/services/sync/syncManager.ts
import { myEntitySyncService } from "./myEntitySyncService";

async syncAll(organizationId: string | null) {
  // ... existing syncs ...
  await myEntitySyncService.sync(); // Add at correct dependency position
  // ...
}
```

### Step 3 — Add to `precacheAll()` if needed

If the entity should be pre-downloaded, add it to `precacheAll()` in the appropriate role-gated section.

---

## 7. `usePendingSyncCount` Hook

Components that display a sync status indicator use this hook to reactively poll the `sync_queue` count:

```typescript
// File: frontend/src/hooks/usePendingSyncCount.ts

export const usePendingSyncCount = () => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      const n = await db.sync_queue.count();
      if (!cancelled) setCount(n);
    };

    refresh();

    // Poll every 3 seconds — lightweight and avoids Dexie observable complexity
    const interval = setInterval(refresh, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return count;
};
```

**Usage in layout header**:

```tsx
import { usePendingSyncCount } from "@/hooks/usePendingSyncCount";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { CloudLightning, CloudCheck } from "lucide-react";

export const SyncStatusIndicator = () => {
  const { isOnline } = useOnlineStatus();
  const pendingCount = usePendingSyncCount();

  if (!isOnline && pendingCount > 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-amber-600">
        <CloudLightning className="h-3.5 w-3.5 animate-pulse" />
        {pendingCount} pending
      </span>
    );
  }

  if (isOnline && pendingCount === 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-emerald-600">
        <CloudCheck className="h-3.5 w-3.5" />
        Synced
      </span>
    );
  }

  return null;
};
```

---

## Checklist

- [ ] `syncManager.initialize()` is called once in `main.tsx` after `initializeAuth()` resolves.
- [ ] `handleOnline()` shows a toast and calls `syncAll()`.
- [ ] `handleOffline()` shows a warning toast and does nothing else.
- [ ] `syncAll()` is guarded by `if (!navigator.onLine) return`.
- [ ] New sync services are added to `syncAll()` in the correct dependency order.
- [ ] `precacheAll()` is guarded by a `sessionStorage` key in `AuthContext` to run once per session.
- [ ] `precacheAll()` fetches metadata for all 4 languages: `["en", "fr", "pt", "ss"]`.
- [ ] `usePendingSyncCount` polls every 3000ms and cleans up with `clearInterval` on unmount.
- [ ] Every sync service removes successfully processed items from `db.sync_queue`.
- [ ] Failed sync items update the entity's `syncStatus` to `FAILED` and store `lastError`.
