## Phase 1 — Auth Hardening, Service Worker & Network Status ✅ COMPLETE

> Goal: App never shows blank page on refresh while offline. No redirect to /login when offline.

### 1.1 Install packages
- [x] `npm install @tanstack/react-query-persist-client dexie`
- [x] `npm install -D vite-plugin-pwa`

### 1.2 Auth Service — offline token + recovery
- [x] Extend `CachedTokens` interface with `userProfile`, `offlineToken`, `tokenExpiry`
- [x] Persist `userProfile` inside `persistTokens()`
- [x] Add `offlineModeActive` module flag + `isOfflineModeActive()` export
- [x] Add `isOfflineTokenValid()` helper
- [x] Add offline recovery path inside `doInitKeycloak()` catch block
- [x] Update `getUserProfile()` to return cached profile when `offlineModeActive = true`
- [x] Update `getAccessToken()` to return cached token when offline
- [x] Update `login()` scope to include `offline_access`

### 1.3 Auth Types
- [x] Add `isOffline: boolean` to `AuthContextValue`
- [x] Add `isOfflineAuthenticated: boolean` to `AuthContextValue`

### 1.4 Auth Context — offline awareness
- [x] Add `isOffline` state with `online`/`offline` event listeners
- [x] Add `isOfflineAuthenticated` state set from `isOfflineModeActive()`
- [x] Expose both in the context value

### 1.5 Router — QueryClient offline defaults
- [x] Set `networkMode: "offlineFirst"` for queries and mutations
- [x] Set `gcTime: 7 days` (match persister maxAge)
- [x] Set `staleTime: 5 min` (use cache for 5 min before refetch)

### 1.6 Root Route — PersistQueryClientProvider
- [x] Replace `QueryClientProvider` with `PersistQueryClientProvider`
- [x] Create `createIDBPersister` using existing `idb-keyval`
- [x] Wire `onSuccess` → `queryClient.resumePausedMutations()`
- [x] Mount `OfflineStatusBanner` inside provider

### 1.7 App Route — offline-aware route guard
- [x] Guard reads `isOffline` + `isOfflineAuthenticated` from `useAuth()`
- [x] Never redirect to `/login` when offline + previously authenticated
- [x] Show friendly "no connection" message for first-time offline

### 1.8 useNetworkStatus hook
- [x] Create `frontend/src/hooks/shared/useNetworkStatus.ts`
- [x] Returns `{ isOnline, wasOffline }`

### 1.9 OfflineStatusBanner component
- [x] Create `frontend/src/components/shared/OfflineStatusBanner.tsx`
- [x] Amber when offline, green when reconnected
- [x] Mounted in `__root.tsx`

### 1.10 PWA / Service Worker
- [x] Configure `vite-plugin-pwa` with Workbox in `vite.config.ts`
- [x] `navigateFallback: "/index.html"` — SPA offline support
- [x] `additionalManifestEntries` includes `silent-check-sso.html`
- [x] Create `frontend/public/manifest.json`

### 1.11 i18n — offline strings
- [x] Add offline keys to `en.json`
- [x] Add offline keys to `pt.json`
- [x] Add offline keys to `fr.json`
- [x] Add offline keys to `ss.json`

### 1.12 TypeScript & Lint Verification
- [x] `npx tsc --noEmit` passed with 0 errors
- [x] `npm run lint` passed with 0 errors

---

## Phase 2 — IndexedDB Sync Queue (Durable Offline Writes)

> Goal: Writes queued offline survive page reload and sync on reconnect.

- [ ] Create `frontend/src/services/shared/offlineDb.ts` (Dexie schema — syncQueue table only)
- [ ] Create `frontend/src/services/shared/syncQueueService.ts`
- [ ] Wire sync queue count to `useNetworkStatus`
- [ ] Handle SW `online` event → `queryClient.resumePausedMutations()` + drain queue

---

## Phase 3 — Polish & Verification

- [ ] Test offline behaviour: go offline → refresh → app loads → no login redirect
- [ ] Test write queue: save data offline → go online → data syncs
- [ ] Lint check: `npm run lint` in frontend/
- [ ] TypeScript check: `npx tsc --noEmit`
