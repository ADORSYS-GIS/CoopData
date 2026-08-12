# CoopData — Offline-First Architecture Design

> **Branch:** `72-offline-support-implementation`
> **Status:** DESIGN — Pending Implementation
> **Last Updated:** 2026-08-12

---

## Table of Contents

1. [Vision & Goals](#1-vision--goals)
2. [Core Design Principles](#2-core-design-principles)
3. [Offline-Capable Feature Matrix (by Role)](#3-offline-capable-feature-matrix-by-role)
4. [Authentication — Keycloak Offline Token Strategy](#4-authentication--keycloak-offline-token-strategy)
5. [Local Database — IndexedDB Schema with Dexie.js](#5-local-database--indexeddb-schema-with-dexie)
6. [Service Worker Architecture](#6-service-worker-architecture)
7. [Data Synchronization — Sync Queue & Conflict Resolution](#7-data-synchronization--sync-queue--conflict-resolution)
8. [Dual-Mode Data Layer (Hooks & Services)](#8-dual-mode-data-layer-hooks--services)
9. [Auth Context — Offline-Aware Enhancement](#9-auth-context--offline-aware-enhancement)
10. [Connectivity Detection & UI/UX](#10-connectivity-detection--uiux)
11. [PWA Manifest & App Shell](#11-pwa-manifest--app-shell)
12. [Backend — Sync Endpoints](#12-backend--sync-endpoints)
13. [Security Considerations](#13-security-considerations)
14. [Phased Implementation Roadmap](#14-phased-implementation-roadmap)
15. [File & Folder Changes](#15-file--folder-changes)

---

## 1. Vision & Goals

### Problem Statement

Currently, if a CoopData user loses internet connectivity:
- Refreshing the page causes a blank screen or logout.
- Keycloak token refresh fails and the user is redirected to `/login`.
- All data fetched via `useQuery` hooks returns `undefined` with errors.
- The app is completely unusable.

### What We Want

| Scenario | Expected Behavior |
|----------|------------------|
| User goes offline mid-session | App continues to work seamlessly with cached data |
| User **refreshes** the page while offline | App loads fully from Service Worker cache, user stays authenticated |
| User runs out of data and opens the app | App loads, shows all previously cached data |
| User performs a write action offline | Action is queued; syncs automatically when back online |
| User's Keycloak session expires offline | Offline token keeps the session alive for up to 30 days |
| Internet comes back | Sync queue drains automatically, data refreshes in background |

### Non-Goals (Out of Scope)

- Real-time collaboration / CRDTs
- Offline AI narrative generation
- Offline PDF export
- Full offline file upload for financial statements

---

## 2. Core Design Principles

1. **Cache-First for reads** — All read operations check local IndexedDB before hitting the network.
2. **Queue-First for writes** — All write operations are queued locally first, then synced when online.
3. **Offline token** — Keycloak issues an offline `refresh_token` (scope: `offline_access`) that is valid for 30 days without Keycloak being reachable.
4. **App Shell Model** — The entire React bundle, icons, fonts, and `/silent-check-sso.html` are pre-cached by the Service Worker on first load.
5. **Transparent to the UI** — All existing hooks keep the same API surface; offline fallback is an implementation detail inside each hook.
6. **No logout on refresh** — The app must **never** redirect to `/login` when offline if the user was previously authenticated.

---

## 3. Offline-Capable Feature Matrix (by Role)

### Read Access (Cache-First — Available Offline)

| Feature | Cooperative | Apex | Federation | Ministry |
|---------|:-----------:|:----:|:----------:|:--------:|
| Dashboard / Stats | YES | YES | YES | YES |
| My Submissions list | YES | YES | YES | YES |
| Submission detail & sections | YES | YES | YES | YES |
| Analytics (benchmark, trends, KPIs) | YES | YES | YES | YES |
| Federations list | — | — | YES | YES |
| Apexes list | — | YES | YES | YES |
| Users list | — | YES | YES | YES |
| Cooperatives list | — | YES | YES | YES |
| Non-financial indicators | YES | YES | YES | YES |
| Questionnaire templates | — | YES | YES | YES |
| Reports & narratives | YES | YES | YES | YES |
| User profile | YES | YES | YES | YES |

### Write Access (Queue-First — Synced When Online)

| Action | Offline Support |
|--------|:--------------:|
| Save manual entry draft | QUEUED |
| Save questionnaire answers | QUEUED |
| Submit a submission (status change) | QUEUED |
| Approve / reject submission | QUEUED |
| Add a review comment | QUEUED |
| Upload a financial statement file | REQUIRES NETWORK |
| Create a new submission | QUEUED (with local UUID) |
| Invite a user | REQUIRES NETWORK |
| AI extraction trigger | REQUIRES NETWORK |

---

## 4. Authentication — Keycloak Offline Token Strategy

### 4.1 Understanding the Problem

The current `authService.ts` uses `check-sso` with a standard `refresh_token`. Standard Keycloak refresh tokens are short-lived (typically 30 minutes) and **require Keycloak to be reachable** to exchange. When offline:

1. `keycloak.updateToken()` throws (no network)
2. `getAccessToken()` falls back to the cached token from IndexedDB
3. The cached `access_token` expires in ~5 minutes — API calls start failing
4. On page **refresh**: `keycloak.init({ onLoad: "check-sso" })` tries the silent iframe check, fails, returns `authenticated = false`, and redirects to `/login`

### 4.2 Solution: Keycloak Offline Token (`offline_access` scope)

Keycloak supports an **offline refresh token** (via the `offline_access` OIDC scope). This token:

- Is valid for up to **30 days** regardless of network connectivity
- Persisted in IndexedDB just like the regular tokens
- When offline, we skip token refresh entirely and serve data from IndexedDB using the cached user profile

#### Keycloak Admin Configuration (one-time setup)

In the Keycloak Admin Console:
1. **Client** `coopdata-frontend` → **Settings** → enable `Offline Access` in Standard Flow scopes
2. **Realm Settings** → **Sessions** → set `Offline Session Max` to `2592000` (30 days)
3. **Realm Settings** → **Sessions** → set `Offline Session Idle` to `2592000` (30 days)

#### Frontend Change to Login Scope

```typescript
// authService.ts — add offline_access to login scope
export async function login(): Promise<void> {
  await keycloak.login({
    redirectUri: window.location.origin + "/app/dashboard",
    scope: "openid profile email offline_access",  // ADD offline_access
    locale: currentLang,
  });
}
```

### 4.3 Offline Auth Flow on Page Refresh

```
User refreshes page (offline)
  |
  v
Service Worker intercepts -> serves cached index.html from pre-cache
  |
  v
React app boots -> KeycloakAuthProvider.init()
  |
  v
authService.initKeycloak()
  |- Loads cached tokens from IndexedDB (always present if user logged in before)
  |- keycloak.init({ token, refreshToken, idToken }) with cached tokens
  |
  v
keycloak.init() result:
  |- If Keycloak IS reachable: normal flow (token refreshed online)
  `- If Keycloak is NOT reachable:
       keycloak.init() throws OR returns authenticated=false
       --> OFFLINE RECOVERY PATH:
         --> Check IndexedDB for cached tokens (within 30-day window)
         --> Decode JWT locally to extract UserProfile (no network needed)
         --> Set isAuthenticated = true in OFFLINE MODE
         --> Set offlineModeActive = true (module-level flag)
  |
  v
App renders normally with all data served from IndexedDB
```

### 4.4 Extended `CachedTokens` Interface

```typescript
// NEW — store user profile in the token cache
interface CachedTokens {
  token: string;              // access_token (short-lived, ~5 min)
  refreshToken: string;       // offline refresh_token (30 days)
  idToken: string;
  timestamp: number;          // when tokens were last refreshed online (Unix ms)
  tokenExpiry: number;        // access_token expiry (Unix ms)
  refreshTokenExpiry: number; // refresh_token expiry (Unix ms)
  userProfile: UserProfile;   // CACHED: decoded user profile (available offline)
  offlineToken: boolean;      // whether offline_access scope was granted
}
```

### 4.5 Offline Token Validation (no network required)

```typescript
function isOfflineTokenValid(cached: CachedTokens): boolean {
  // Offline refresh token stays valid for 30 days from last online refresh
  const OFFLINE_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
  const age = Date.now() - cached.timestamp;
  return cached.offlineToken && age < OFFLINE_TOKEN_MAX_AGE_MS;
}
```

### 4.6 Access Token for Offline API Calls

When offline, API calls are served by the Service Worker from IndexedDB — the backend never sees them. The access token is still passed as-is for the Service Worker to use as an identity signal:

```typescript
export async function getAccessToken(): Promise<string> {
  if (offlineModeActive) {
    const cached = await loadCachedTokens();
    if (cached?.token) {
      console.warn("[auth] Offline mode — returning cached access token");
      return cached.token;  // SW will route to IDB anyway, not the network
    }
    throw new Error("No cached token available offline");
  }
  // ... normal online token refresh flow
}
```

---

## 5. Local Database — IndexedDB Schema with Dexie

### 5.1 Why Dexie.js

The project already uses `idb-keyval` for token storage. For structured offline data we need:
- **Indexes** (query by userId, submission ID, role)
- **Transactions** (atomic multi-table writes)
- **Versioned migrations** (schema evolution without data loss)
- **TypeScript support** out of the box

**Package to add:** `npm install dexie`

### 5.2 Database Class

**File:** `frontend/src/services/shared/offlineDb.ts`

```typescript
import Dexie, { type Table } from "dexie";

export interface CachedSubmission {
  id: string;
  userId: string;
  role: string;
  data: unknown;
  cachedAt: number;
  isDirty: boolean;        // Has local uncommitted changes
  localVersion: number;    // Optimistic concurrency counter
}

export interface CachedAnalytics {
  key: string;             // e.g. "benchmark:2025:coop-uuid"
  userId: string;
  data: unknown;
  cachedAt: number;
}

export interface CachedFederation {
  id: string; userId: string; data: unknown; cachedAt: number;
}

export interface CachedApex {
  id: string; userId: string; data: unknown; cachedAt: number;
}

export interface CachedUser {
  id: string; userId: string; data: unknown; cachedAt: number;
}

export interface CachedCooperative {
  id: string; userId: string; data: unknown; cachedAt: number;
}

export interface CachedFormTemplate {
  id: string; userId: string; data: unknown; cachedAt: number;
}

export interface CachedReport {
  id: string; userId: string; data: unknown; cachedAt: number;
}

export interface SyncQueueItem {
  id?: number;              // Auto-increment primary key
  correlationId: string;    // Client-generated UUID for idempotency
  userId: string;
  endpoint: string;
  method: "POST" | "PUT" | "PATCH" | "DELETE";
  pathParams?: Record<string, string>;
  body?: unknown;
  createdAt: number;
  retryCount: number;
  lastError?: string;
  status: "pending" | "syncing" | "failed" | "done";
  optimisticData?: unknown;
}

export interface OfflineMeta {
  key: string;
  value: unknown;
}

export class CoopDataOfflineDB extends Dexie {
  submissions!: Table<CachedSubmission>;
  analytics!: Table<CachedAnalytics>;
  federations!: Table<CachedFederation>;
  apexes!: Table<CachedApex>;
  users!: Table<CachedUser>;
  cooperatives!: Table<CachedCooperative>;
  formTemplates!: Table<CachedFormTemplate>;
  reports!: Table<CachedReport>;
  syncQueue!: Table<SyncQueueItem>;
  meta!: Table<OfflineMeta>;

  constructor() {
    super("CoopDataOfflineDB");
    this.version(1).stores({
      submissions:   "&id, userId, role, isDirty, cachedAt",
      analytics:     "&key, userId, cachedAt",
      federations:   "&id, userId, cachedAt",
      apexes:        "&id, userId, cachedAt",
      users:         "&id, userId, cachedAt",
      cooperatives:  "&id, userId, cachedAt",
      formTemplates: "&id, userId, cachedAt",
      reports:       "&id, userId, cachedAt",
      syncQueue:     "++id, userId, status, correlationId, createdAt",
      meta:          "&key",
    });
  }
}

export const offlineDb = new CoopDataOfflineDB();
```

### 5.3 Cache TTL Strategy

| Table | TTL | Rationale |
|-------|-----|-----------|
| `submissions` | 7 days | Core data, review cycles are weekly |
| `analytics` | 1 hour | Computed data; refresh when online |
| `federations` | 24 hours | Organizational structure rarely changes |
| `apexes` | 24 hours | Same |
| `users` | 6 hours | User accounts change occasionally |
| `cooperatives` | 24 hours | Rarely changes |
| `formTemplates` | 7 days | Template versioning is explicit |
| `reports` | 24 hours | Reports are regenerated on demand |

```typescript
export const CACHE_TTL_MS = {
  submissions: 7 * 24 * 60 * 60 * 1000,
  analytics: 60 * 60 * 1000,
  federations: 24 * 60 * 60 * 1000,
  apexes: 24 * 60 * 60 * 1000,
  users: 6 * 60 * 60 * 1000,
  cooperatives: 24 * 60 * 60 * 1000,
  formTemplates: 7 * 24 * 60 * 60 * 1000,
  reports: 24 * 60 * 60 * 1000,
} as const;
```

---

## 6. Service Worker Architecture

### 6.1 Purpose

The Service Worker serves three roles:
1. **App Shell pre-cache** — `index.html`, JS bundles, CSS, fonts, icons, `silent-check-sso.html`
2. **Network-first with IDB fallback** — Fetch API responses and store in IDB; serve IDB when offline
3. **Background Sync** — Process `syncQueue` when connectivity is restored

### 6.2 Workbox Integration via vite-plugin-pwa

**Package to add:** `npm install -D vite-plugin-pwa`

**File:** `frontend/vite.config.ts` addition:

```typescript
import { VitePWA } from "vite-plugin-pwa";

// Add to plugins[]:
VitePWA({
  registerType: "autoUpdate",
  injectRegister: "auto",
  workbox: {
    globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}", "silent-check-sso.html"],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com/,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts",
          expiration: { maxAgeSeconds: 365 * 24 * 60 * 60 },
        },
      },
    ],
    importScripts: ["sw-api-handler.js"],
  },
  devOptions: { enabled: true, type: "module" },
}),
```

### 6.3 API Request Interception Strategy

```
Incoming Request to /api/v1/*
         |
         v
    Is browser online?
   /                 \
 YES                  NO
  |                    |
  v                    v
Network First         Serve from IndexedDB
(fetch -> update IDB) (return cached JSON)
  |                    |
  v                    v
Return response       Show offline indicator
```

#### Routing Table

| Endpoint Pattern | Online | Offline |
|-----------------|--------|---------|
| `GET /api/v1/*/submissions*` | Network -> update IDB | Serve `submissions` table |
| `GET /api/v1/analytics/*` | Network -> update IDB | Serve `analytics` table |
| `GET /api/v1/*/federations*` | Network -> update IDB | Serve `federations` table |
| `GET /api/v1/*/apexes*` | Network -> update IDB | Serve `apexes` table |
| `GET /api/v1/*/users*` | Network -> update IDB | Serve `users` table |
| `POST/PATCH/PUT /api/v1/*` | Network | Add to `syncQueue` -> return optimistic response |
| `DELETE /api/v1/*` | Network | Add to `syncQueue` -> return optimistic 204 |
| `POST /api/v1/*/upload` | Network only | Return structured offline error |

### 6.4 Background Sync in Service Worker

```javascript
// In sw-api-handler.js (public/)
self.addEventListener("sync", (event) => {
  if (event.tag === "coopdata-sync") {
    event.waitUntil(processSyncQueue());
  }
});

async function processSyncQueue() {
  // Open IDB, get all status="pending" items
  // For each item: fetch to backend, mark "done" or "failed"
  // On 409 conflict: notify main thread via postMessage
  // On success: notify main thread to invalidate TanStack Query cache
}
```

---

## 7. Data Synchronization — Sync Queue & Conflict Resolution

### 7.1 Sync Queue Service

**File:** `frontend/src/services/shared/syncQueueService.ts`

```typescript
import { offlineDb, type SyncQueueItem } from "./offlineDb";

export async function enqueue(
  item: Omit<SyncQueueItem, "id" | "correlationId" | "createdAt" | "retryCount" | "status">
): Promise<string> {
  const correlationId = crypto.randomUUID();
  await offlineDb.syncQueue.add({
    ...item,
    correlationId,
    createdAt: Date.now(),
    retryCount: 0,
    status: "pending",
  });
  // Register background sync with SW
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    const sw = await navigator.serviceWorker.ready;
    await sw.sync.register("coopdata-sync");
  }
  return correlationId;
}

export async function getPendingCount(): Promise<number> {
  return offlineDb.syncQueue.where("status").equals("pending").count();
}

export async function retryFailed(): Promise<void> {
  await offlineDb.syncQueue
    .where("status").equals("failed")
    .modify({ status: "pending", retryCount: 0, lastError: undefined });
  if ("serviceWorker" in navigator) {
    const sw = await navigator.serviceWorker.ready;
    await sw.sync.register("coopdata-sync");
  }
}
```

### 7.2 Conflict Resolution Policy

When the sync returns HTTP 409:

```
Server returns 409 Conflict
         |
         v
SyncQueueItem marked status="failed", lastError="conflict"
         |
         v
SyncConflictResolver dialog shown to user
         |
   ______v______
  |             |
  v             v
Keep Mine    Use Server Version
  |             |
  v             v
Force push   Discard local
             update from IDB
```

**Per-entity conflict policy:**

| Entity | Default | Rationale |
|--------|---------|-----------|
| Submission status | Server wins | Status is controlled by reviewer workflow |
| Manual entry data | User wins (with warning) | User is authoritative on their own financial data |
| Questionnaire answers | User wins | User input is authoritative |
| Review comments | Merge (both kept) | Comments are append-only |

### 7.3 Optimistic Updates Flow

```typescript
async function offlineMutate(payload) {
  // Step 1: Write optimistic data to IDB immediately (UI updates instantly)
  await offlineDb.submissions.update(id, {
    isDirty: true,
    data: applyOptimisticUpdate(currentData, payload),
  });

  // Step 2: Enqueue for sync
  const correlationId = await enqueue({
    userId: user.id,
    endpoint: `/api/v1/cooperative/submissions/${id}/manual-entry`,
    method: "PATCH",
    body: payload,
    optimisticData: payload,
  });

  // Step 3: Return immediately — background sync will confirm later
  return correlationId;
}
```

---

## 8. Dual-Mode Data Layer (Hooks & Services)

### 8.1 Architecture Overview

Every existing hook is wrapped with an offline-aware pattern. The hook's **public API remains identical** — offline logic is an implementation detail.

```
useCooperativeSubmissions()     <- Same hook, same API
         |
         v
useOfflineQuery(queryKey, queryFn, offlineFallback)
  |- Online:  TanStack Query -> network -> update IDB
  `- Offline: TanStack Query -> offlineFallback() -> IDB
```

### 8.2 `useOfflineQuery` — Core Read Abstraction

**File:** `frontend/src/hooks/shared/useOfflineQuery.ts`

```typescript
import { useQuery, type UseQueryOptions } from "@tanstack/react-query";
import { useNetworkStatus } from "@/hooks/shared/useNetworkStatus";

interface UseOfflineQueryOptions<T> extends Omit<UseQueryOptions<T>, "queryFn"> {
  queryFn: () => Promise<T>;
  offlineFallback: () => Promise<T | undefined>;
}

export function useOfflineQuery<T>({
  queryKey,
  queryFn,
  offlineFallback,
  ...options
}: UseOfflineQueryOptions<T>) {
  const { isOnline } = useNetworkStatus();

  return useQuery<T>({
    ...options,
    queryKey,
    networkMode: "always",
    retry: isOnline ? (options.retry ?? 3) : false,
    staleTime: isOnline ? (options.staleTime ?? 0) : Infinity,
    queryFn: async () => {
      if (!isOnline) {
        // Serve from IndexedDB
        const cached = await offlineFallback();
        if (cached !== undefined) return cached;
        throw new Error("No cached data available offline");
      }
      try {
        return await queryFn();
      } catch {
        // Flaky connection: try IDB fallback before propagating error
        const cached = await offlineFallback();
        if (cached !== undefined) return cached;
        throw new Error("Network request failed and no cache available");
      }
    },
  });
}
```

### 8.3 `useOfflineMutation` — Core Write Abstraction

**File:** `frontend/src/hooks/shared/useOfflineMutation.ts`

```typescript
export function useOfflineMutation<TData, TVariables>(options: {
  mutationFn: (variables: TVariables) => Promise<TData>;
  offlineQueue: {
    endpoint: string;
    method: "POST" | "PUT" | "PATCH" | "DELETE";
    buildBody?: (variables: TVariables) => unknown;
    buildOptimisticData?: (variables: TVariables) => TData;
    applyOptimisticUpdate?: (variables: TVariables) => Promise<void>;
  };
  onSuccess?: (data: TData, variables: TVariables) => void;
  invalidateKeys?: string[][];
}) {
  const { isOnline } = useNetworkStatus();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation<TData, Error, TVariables>({
    mutationFn: async (variables) => {
      if (!isOnline) {
        // Apply optimistic IDB update
        await options.offlineQueue.applyOptimisticUpdate?.(variables);
        // Enqueue for later sync
        await enqueue({
          userId: user!.id,
          endpoint: options.offlineQueue.endpoint,
          method: options.offlineQueue.method,
          body: options.offlineQueue.buildBody?.(variables) ?? variables,
          optimisticData: options.offlineQueue.buildOptimisticData?.(variables),
        });
        return (options.offlineQueue.buildOptimisticData?.(variables) ?? variables) as TData;
      }
      return options.mutationFn(variables);
    },
    onSuccess: (data, variables) => {
      options.onSuccess?.(data, variables);
      options.invalidateKeys?.forEach((key) =>
        queryClient.invalidateQueries({ queryKey: key })
      );
    },
  });
}
```

### 8.4 Hook Migration Example — Submissions

```typescript
// BEFORE (online-only):
export const useCooperativeSubmissions = (enabled = true) =>
  useQuery({
    queryKey: [SUBMISSIONS_KEY],
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/cooperative/submissions");
      if (error) throw new Error(extractErrorMessage(error));
      return (data as SubmissionResponse[]) ?? [];
    },
  });

// AFTER (offline-aware):
export const useCooperativeSubmissions = (enabled = true) => {
  const { user } = useAuth();
  return useOfflineQuery<SubmissionResponse[]>({
    queryKey: [SUBMISSIONS_KEY],
    enabled,
    queryFn: async () => {
      const { data, error } = await apiClient.GET("/api/v1/cooperative/submissions");
      if (error) throw new Error(extractErrorMessage(error));
      const submissions = (data as SubmissionResponse[]) ?? [];
      // Write-through cache to IDB
      await Promise.all(
        submissions.map((s) =>
          offlineDb.submissions.put({
            id: s.id,
            userId: user!.id,
            role: user!.role,
            data: s,
            cachedAt: Date.now(),
            isDirty: false,
            localVersion: 0,
          })
        )
      );
      return submissions;
    },
    offlineFallback: async () => {
      const cached = await offlineDb.submissions
        .where("userId").equals(user?.id ?? "")
        .toArray();
      return cached.map((c) => c.data as SubmissionResponse);
    },
  });
};
```

### 8.5 Cache Hydration on App Start

**File:** `frontend/src/services/shared/cacheHydrationService.ts`

Runs on app startup (online) to pre-warm all IDB caches:

```typescript
export async function hydrateOfflineCache(user: UserProfile): Promise<void> {
  const tasks: Promise<void>[] = [
    hydrateSubmissions(user),
    hydrateAnalytics(user),
  ];

  if (["federation", "ministry"].includes(user.role)) tasks.push(hydrateFederations(user));
  if (["apex", "federation", "ministry"].includes(user.role)) {
    tasks.push(hydrateApexes(user), hydrateUsers(user));
  }

  // Non-blocking — don't delay app startup
  void Promise.allSettled(tasks).then(async () => {
    await offlineDb.meta.put({ key: "last_full_sync", value: Date.now() });
    console.log("[cache-hydration] Complete");
  });
}
```

---

## 9. Auth Context — Offline-Aware Enhancement

### 9.1 Extended `AuthContextValue`

```typescript
// frontend/src/types/auth.ts — new fields
export interface AuthContextValue extends AuthState {
  login: () => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (role: Role) => boolean;
  hasAnyRole: (roles: Role[]) => boolean;
  getAccessToken: () => Promise<string>;
  // NEW:
  isOffline: boolean;               // true when network is unavailable
  isOfflineAuthenticated: boolean;  // true when authenticated via cached offline token
}
```

### 9.2 `KeycloakAuthProvider` — New Network Listeners

```typescript
// In KeycloakAuthProvider:
const [isOffline, setIsOffline] = useState(!navigator.onLine);
const [isOfflineAuthenticated, setIsOfflineAuthenticated] = useState(false);

useEffect(() => {
  const handleOnline = () => setIsOffline(false);
  const handleOffline = () => setIsOffline(true);
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  return () => {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
  };
}, []);

// In init():
const authenticated = await initKeycloak();
setIsOfflineAuthenticated(isOfflineModeActive()); // new export from authService
```

### 9.3 Route Guard Fix — Never Logout When Offline

```typescript
// frontend/src/routes/app.tsx — BEFORE:
if (!isAuthenticated) {
  return <Navigate to="/login" />;
}

// AFTER — only redirect if we're online AND not authenticated:
const { isAuthenticated, isLoading, isOffline, isOfflineAuthenticated, user } = useAuth();

if (isLoading) return <LoadingSpinner />;

if (!isAuthenticated && !isOfflineAuthenticated && !isOffline) {
  // Online, not authenticated -> go to login
  return <Navigate to="/login" />;
}

if (!isAuthenticated && !isOfflineAuthenticated && isOffline) {
  // Offline, never authenticated -> show offline login screen (not redirect)
  return <OfflineLoginMessage />;
}

// Either authenticated online, or authenticated offline -> render the app
return <Outlet />;
```

---

## 10. Connectivity Detection & UI/UX

### 10.1 `useNetworkStatus` Hook

**File:** `frontend/src/hooks/shared/useNetworkStatus.ts`

```typescript
import { useState, useEffect } from "react";
import { getPendingCount } from "@/services/shared/syncQueueService";

export interface NetworkStatus {
  isOnline: boolean;
  wasOffline: boolean;       // true briefly after coming back online
  pendingSyncCount: number;  // items waiting to sync
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      setWasOffline(true);
      // Register background sync
      if ("serviceWorker" in navigator && "SyncManager" in window) {
        const sw = await navigator.serviceWorker.ready;
        await sw.sync.register("coopdata-sync");
      }
      setTimeout(() => setWasOffline(false), 5000);
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(async () => {
      setPendingSyncCount(await getPendingCount());
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return { isOnline, wasOffline, pendingSyncCount };
}
```

### 10.2 Offline Status Banner

**File:** `frontend/src/components/shared/OfflineStatusBanner.tsx`

Mounted in `__root.tsx` — always present, only visible when needed:

```typescript
export function OfflineStatusBanner() {
  const { isOnline, wasOffline, pendingSyncCount } = useNetworkStatus();

  if (isOnline && !wasOffline && pendingSyncCount === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed top-0 inset-x-0 z-50 flex items-center justify-center gap-2 py-1.5 text-sm font-medium",
        !isOnline && "bg-amber-500/90 text-amber-950 backdrop-blur-sm",
        isOnline && wasOffline && "bg-emerald-500/90 text-emerald-950 backdrop-blur-sm",
      )}
    >
      {!isOnline && (
        <>
          <WifiOff className="size-3.5" />
          <span>You are offline — showing cached data</span>
          {pendingSyncCount > 0 && (
            <span className="rounded-full bg-amber-950/20 px-2 py-0.5 text-xs">
              {pendingSyncCount} change{pendingSyncCount > 1 ? "s" : ""} pending
            </span>
          )}
        </>
      )}
      {isOnline && wasOffline && (
        <>
          <Wifi className="size-3.5" />
          <span>Back online — syncing your changes</span>
        </>
      )}
    </div>
  );
}
```

### 10.3 Stale Data Timestamp

When data is served from IDB cache, show when it was last fetched:

```tsx
// In Submissions page or any list page:
{query.isFromCache && (
  <p className="text-xs text-muted-foreground flex items-center gap-1">
    <Clock className="size-3" />
    Cached {formatDistanceToNow(cachedAt, { addSuffix: true })}
  </p>
)}
```

### 10.4 Actions Unavailable Offline

For features that require network (file upload, AI trigger, invite user), show a clear disabled state:

```tsx
<Button
  disabled={!isOnline}
  title={!isOnline ? "This action requires an internet connection" : undefined}
>
  {!isOnline && <WifiOff className="size-4 mr-2" />}
  Upload Financial Statement
</Button>
```

---

## 11. PWA Manifest & App Shell

### 11.1 Web App Manifest

**File:** `frontend/public/manifest.json`

```json
{
  "name": "CoopData",
  "short_name": "CoopData",
  "description": "Cooperative Financial Data Management Platform",
  "start_url": "/app/dashboard",
  "display": "standalone",
  "background_color": "#0f172a",
  "theme_color": "#0f172a",
  "orientation": "portrait-primary",
  "icons": [
    {
      "src": "/icons/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "maskable any"
    },
    {
      "src": "/icons/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "maskable any"
    }
  ],
  "categories": ["finance", "productivity"],
  "lang": "en"
}
```

### 11.2 Critical: `silent-check-sso.html` Must Be Pre-Cached

The Keycloak silent SSO check uses an iframe pointing to this file. **If it is not in the Service Worker pre-cache, the SSO check fails offline and the user gets logged out on page refresh.**

The Workbox `globPatterns` must explicitly include it:

```typescript
globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}", "silent-check-sso.html"],
```

Alternatively, add it explicitly to the `additionalManifestEntries` Workbox option.

---

## 12. Backend — Sync Endpoints

### 12.1 `POST /api/v1/sync/push` — Batch Process Offline Changes

```
POST /api/v1/sync/push
Authorization: Bearer <token>

{
  "items": [
    {
      "correlation_id": "uuid-v4",
      "endpoint": "/api/v1/cooperative/submissions/{id}/manual-entry",
      "method": "PATCH",
      "path_params": { "id": "submission-uuid" },
      "body": { ... },
      "created_at": 1234567890
    }
  ]
}
```

Response:

```json
{
  "results": [
    { "correlation_id": "uuid", "status": "ok", "data": { ... } },
    { "correlation_id": "uuid", "status": "conflict", "server_data": { ... } },
    { "correlation_id": "uuid", "status": "error", "message": "Validation failed: ..." }
  ]
}
```

- Each item is processed **independently** (one failure does not abort others)
- Returns a result for every item in the request
- `correlation_id` is used for idempotency — duplicate requests return the same result

### 12.2 `GET /api/v1/sync/pull` — Full Snapshot for Initial Offline Cache

```
GET /api/v1/sync/pull?since=1234567890
Authorization: Bearer <token>
```

Response:

```json
{
  "user_id": "uuid",
  "pulled_at": 1234567890,
  "submissions": [...],
  "analytics_snapshot": { ... },
  "federations": [...],
  "apexes": [...],
  "users": [...]
}
```

- The `since` parameter enables **incremental sync** (only changed records)
- Omitting `since` returns a full snapshot (used on first offline setup)
- Data is scoped to the authenticated user's role and organization

### 12.3 Idempotency via `X-Correlation-Id`

All mutation handlers must implement idempotency:

```rust
// In each mutation handler:
if let Some(correlation_id) = headers.get("X-Correlation-Id").and_then(|v| v.to_str().ok()) {
    if let Ok(Some(existing)) = repo.find_by_correlation_id(correlation_id).await {
        return Ok(Json(existing)); // Return cached result, do not reprocess
    }
}
// Store correlation_id with the created/updated entity
```

---

## 13. Security Considerations

### 13.1 Offline Token Security

| Risk | Mitigation |
|------|-----------|
| Stolen offline refresh token | Token is bound to device via PKCE; Keycloak admin can revoke individual offline tokens |
| Stale role/permissions after offline period | On reconnect, app validates token against Keycloak; role changes force re-auth |
| Data leakage via IndexedDB | All IDB queries are scoped to `userId`; IDB cleared completely on logout |
| Sensitive data in SW cache | Only app shell (HTML/JS/CSS) in SW cache; sensitive data stays in IDB only |
| Expired access token used offline | Access tokens are still passed to SW, but SW routes to IDB — backend never sees expired tokens |

### 13.2 IDB Data Scoping — Mandatory

Every IDB query **must** filter by `userId`:

```typescript
// CORRECT — scoped to authenticated user
const submissions = await offlineDb.submissions
  .where("userId").equals(user.id)
  .toArray();

// WRONG — returns all users' data (NEVER do this)
const submissions = await offlineDb.submissions.toArray();
```

Use Dexie compound indexes (`[userId+role]`) for additional scoping.

### 13.3 Complete IDB Cleanup on Logout

```typescript
export async function logout(): Promise<void> {
  isLoggingOut = true;
  await clearCachedTokens();

  // Clear ALL offline data (security: prevent data leakage to next user)
  await Promise.all([
    offlineDb.submissions.clear(),
    offlineDb.analytics.clear(),
    offlineDb.federations.clear(),
    offlineDb.apexes.clear(),
    offlineDb.users.clear(),
    offlineDb.cooperatives.clear(),
    offlineDb.formTemplates.clear(),
    offlineDb.reports.clear(),
    offlineDb.syncQueue.clear(),
    offlineDb.meta.clear(),
  ]);

  keycloakInitialized = false;
  offlineModeActive = false;
  await keycloak.logout({ redirectUri: window.location.origin + "/" });
}
```

---

## 14. Phased Implementation Roadmap

### Phase 1 — Auth Hardening & Service Worker (Week 1)

> Goal: App never shows a blank page on page refresh while offline.

- [ ] 1.1 Add `offline_access` scope to Keycloak login call in `authService.ts`
- [ ] 1.2 Extend `CachedTokens` to include `userProfile`, `offlineToken`, `tokenExpiry`, `refreshTokenExpiry`
- [ ] 1.3 Persist `userProfile` to `CachedTokens` on every successful `persistTokens()` call
- [ ] 1.4 Add offline recovery path in `doInitKeycloak()` (use `isOfflineTokenValid()` + `loadCachedProfile()`)
- [ ] 1.5 Add `isOfflineModeActive()` export from `authService.ts`
- [ ] 1.6 Add `getUserProfile()` offline fallback (returns cached profile when `offlineModeActive = true`)
- [ ] 1.7 Add `isOffline` + `isOfflineAuthenticated` to `AuthContextValue`
- [ ] 1.8 Add `online`/`offline` event listeners to `KeycloakAuthProvider`
- [ ] 1.9 Fix `app.tsx` route guard — respect offline + isOfflineAuthenticated
- [ ] 1.10 Install `vite-plugin-pwa`, configure Workbox with globPatterns
- [ ] 1.11 Create `manifest.json` + app icons
- [ ] 1.12 Ensure `silent-check-sso.html` is in Workbox pre-cache
- [ ] 1.13 Create `useNetworkStatus` hook
- [ ] 1.14 Create `OfflineStatusBanner` component
- [ ] 1.15 Wire `OfflineStatusBanner` into `__root.tsx`
- [ ] 1.16 Update Keycloak Admin settings (Offline Session Max, idle, scope)

**Success Criteria:** Turn off WiFi → refresh the page → app loads → user sees dashboard (even empty) → no redirect to `/login`.

---

### Phase 2 — IndexedDB Schema & Cache Layer (Week 2)

> Goal: Submissions and analytics available offline.

- [ ] 2.1 Install `dexie`
- [ ] 2.2 Create `offlineDb.ts` with full schema (all 10 tables)
- [ ] 2.3 Create `cacheHydrationService.ts`
- [ ] 2.4 Create `useOfflineQuery` hook
- [ ] 2.5 Migrate `useCooperativeSubmissions` to `useOfflineQuery` + write-through cache
- [ ] 2.6 Migrate `useApexSubmissions`, `useFederationSubmissions`, `useMinistrySubmissions`
- [ ] 2.7 Migrate `useSubmission` (single submission detail)
- [ ] 2.8 Migrate all analytics hooks (`useBenchmark`, `useNationalOverview`, `useMonthlyTrend`, etc.)
- [ ] 2.9 Call `hydrateOfflineCache(user)` after successful auth in `KeycloakAuthProvider`
- [ ] 2.10 Add stale data timestamp indicator to submissions and analytics pages

**Success Criteria:** Go offline → navigate to Submissions page → data loads from IDB → "Cached X ago" label shown.

---

### Phase 3 — Offline Writes & Sync Queue (Week 3)

> Goal: Users can save data offline; it syncs automatically when back online.

- [ ] 3.1 Create `syncQueueService.ts`
- [ ] 3.2 Create `useOfflineMutation` hook
- [ ] 3.3 Implement SW `sync` event handler in `sw-api-handler.js`
- [ ] 3.4 Implement SW POST/PATCH/DELETE interception → enqueue when offline
- [ ] 3.5 Migrate `useManualEntry` saves to `useOfflineMutation`
- [ ] 3.6 Migrate questionnaire answer saves to `useOfflineMutation`
- [ ] 3.7 Migrate submission status changes (submit, approve, reject) to `useOfflineMutation`
- [ ] 3.8 Backend: implement `POST /api/v1/sync/push` endpoint
- [ ] 3.9 Backend: add `X-Correlation-Id` idempotency check to all mutation handlers
- [ ] 3.10 Show pending sync count in `OfflineStatusBanner`
- [ ] 3.11 Create `SyncConflictResolver` dialog component
- [ ] 3.12 IDB full clear on logout
- [ ] 3.13 Disable upload/AI/invite buttons when offline with tooltip explanation

**Success Criteria:** Save questionnaire answers offline → go online → sync triggers automatically → answers appear in backend.

---

### Phase 4 — Full Feature Coverage & Polish (Week 4)

> Goal: All read features work offline; PWA is installable.

- [ ] 4.1 Migrate federations hooks to `useOfflineQuery`
- [ ] 4.2 Migrate apexes hooks to `useOfflineQuery`
- [ ] 4.3 Migrate users hooks to `useOfflineQuery`
- [ ] 4.4 Migrate cooperatives hooks to `useOfflineQuery`
- [ ] 4.5 Migrate form template hooks to `useOfflineQuery`
- [ ] 4.6 Migrate reports/narratives hooks to `useOfflineQuery`
- [ ] 4.7 Backend: implement `GET /api/v1/sync/pull` incremental snapshot endpoint
- [ ] 4.8 Add PWA install prompt component
- [ ] 4.9 Add i18n keys for all new offline UI strings (EN + PT)
- [ ] 4.10 Write Playwright e2e tests for offline scenarios (network throttling)
- [ ] 4.11 Manual QA on Android Chrome and iOS Safari

**Success Criteria:** Full offline feature matrix satisfied; app installable as PWA; all e2e offline tests pass.

---

## 15. File & Folder Changes

### New Files

```
frontend/
├── public/
│   ├── manifest.json
│   ├── sw-api-handler.js          (SW API interception & sync)
│   └── icons/
│       ├── icon-192.png
│       └── icon-512.png
└── src/
    ├── services/shared/
    │   ├── offlineDb.ts            (Dexie DB schema + singleton)
    │   ├── syncQueueService.ts     (enqueue/retry/count)
    │   └── cacheHydrationService.ts (startup pre-warm)
    ├── hooks/shared/
    │   ├── useNetworkStatus.ts     (online/offline/pending count)
    │   ├── useOfflineQuery.ts      (cache-first query wrapper)
    │   └── useOfflineMutation.ts   (queue-first mutation wrapper)
    └── components/shared/
        ├── OfflineStatusBanner.tsx (top bar: offline / syncing)
        └── SyncConflictResolver.tsx (conflict resolution dialog)

backend/src/
├── api/handlers/sync.rs            (push + pull handlers)
├── api/routes/sync.rs              (route wiring)
└── repositories/sync_repository.rs (snapshot + correlation ID dedup)
```

### Modified Files

```
frontend/
├── vite.config.ts                  (add VitePWA plugin)
└── src/
    ├── services/shared/authService.ts   (offline recovery, offline_access scope)
    ├── context/AuthContext.tsx          (isOffline, isOfflineAuthenticated)
    ├── types/auth.ts                    (extend AuthContextValue)
    ├── routes/__root.tsx                (add OfflineStatusBanner)
    ├── routes/app.tsx                   (fix route guard for offline)
    └── hooks/
        ├── submissions/useSubmissions.ts
        ├── analytics/*.ts
        ├── federations/useFederations.ts
        ├── apexes/useApexes.ts
        └── users/useUsers.ts
```

---

## Appendix A — Keycloak Admin Checklist

Before starting Phase 1, verify these settings:

- [ ] Client `coopdata-frontend` → Client Scopes → `offline_access` is an assigned default scope
- [ ] Realm Settings → Sessions → `Offline Session Idle` = 2592000 (30 days)
- [ ] Realm Settings → Sessions → `Offline Session Max` = 2592000 (30 days)
- [ ] Realm Settings → Sessions → `Client Offline Session Idle` = 2592000
- [ ] Realm Settings → Tokens → `Refresh Token Max Reuse` = 0 (rotating tokens)

## Appendix B — Browser Support Matrix

| Feature | Chrome | Firefox | Safari | Edge |
|---------|:------:|:-------:|:------:|:----:|
| Service Worker | YES | YES | YES 15.4+ | YES |
| Background Sync API | YES | NO* | NO* | YES |
| IndexedDB / Dexie | YES | YES | YES | YES |
| PWA Install | YES | Partial | YES iOS 16.4+ | YES |

*For Firefox and Safari, Background Sync degrades gracefully to **foreground sync**: a `useEffect` listens for the `online` event and calls `processSyncQueue()` directly in the main thread when the browser comes back online.

## Appendix C — Playwright Offline Test Template

```typescript
test("app shows cached data after offline page refresh", async ({ page, context }) => {
  // 1. Authenticate online
  await page.goto("/app/submissions");
  await waitForNetworkData(page); // helper to wait for API responses
  
  // 2. Verify data loaded
  await expect(page.getByTestId("submissions-list")).toBeVisible();
  
  // 3. Go offline
  await context.setOffline(true);
  
  // 4. Refresh the page
  await page.reload();
  
  // 5. Assertions
  await expect(page).not.toHaveURL(/\/login/);  // No redirect to login
  await expect(page.getByTestId("offline-banner")).toBeVisible();
  await expect(page.getByTestId("submissions-list")).toBeVisible(); // IDB data shown
  
  // 6. Come back online
  await context.setOffline(false);
  await expect(page.getByTestId("sync-success-banner")).toBeVisible();
});
```
