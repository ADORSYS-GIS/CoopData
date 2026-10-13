# How Offline Mode Works

> **This is the current, accurate description of offline mode (October 2026).**
> Older documents (`features/offline-first-architecture.md`, `sync-manager.md`, `offline-sync-conflict.md`) describe an earlier plan that was never built as written. Trust this page.
>
> Related: [`offline-review-guide.md`](offline-review-guide.md) (what was fixed and how to test it) · [`offline-local-testing.md`](offline-local-testing.md) (how to run offline locally) · [`offline-known-issues.md`](offline-known-issues.md) (issue tracker)

---

## 1. In One Minute

| The user wants to…                | What makes it work                                                                                                                     |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Open the app** without internet | A **service worker** saves the app's files on the first online visit                                                                   |
| **Sign in** without internet      | A **saved login** from the last online sign-in, valid 30 days, unless they logged out                                                  |
| **See data** without internet     | Copies saved on the device: pages save what they load, and a **background download** (the "seeder") fetches the rest right after login |
| **Save changes** without internet | Changes go into an **outbox** on the device and are sent automatically when the connection returns                                     |
| **Know what didn't save**         | A red **"Not saved: N"** badge opens a list of refused changes with **Retry** and **Dismiss**                                          |

Some actions **always need internet**: see [section 3](#3-what-works-offline).

---

## 2. The Building Blocks

| Piece             | File(s)                                                                                          | Job                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| Service worker    | `frontend/vite.config.ts` (`vite-plugin-pwa`), registered in `main.tsx`                          | Precaches the app shell. **Production builds only**: the dev server (`:5173`) never registers it. Test on `:5174` |
| Offline database  | `services/shared/offlineDb.ts` (Dexie, `CoopDataOfflineDB`)                                      | Tables for cached data, the outbox (`syncQueue`) and wizard drafts (`drafts`)                                     |
| Cache labels      | `services/shared/offlineCacheKeys.ts`                                                            | **Single source** of where each dataset is stored (table + label). Used by both the seeder and the hooks          |
| Seeder            | `services/shared/offlineSeeder.ts`                                                               | After login (and on reconnect), downloads the user's role data in all UI languages                                |
| Reading hook      | `hooks/shared/useOfflineQuery.ts`                                                                | Server first, device copy as fallback. Never invents data                                                         |
| Page snapshot     | `routes/__root.tsx` (`PersistQueryClientProvider`)                                               | Saves finished page data so a reload shows it instantly                                                           |
| Outbox            | `services/shared/syncQueueService.ts` (`runMutation`, `flushSyncQueue`)                          | Queues writes, sends them, retries, records failures                                                              |
| Duplicate guard   | `services/shared/correlation.ts` + backend `idempotency_middleware`                              | Every attempt of a write carries the same `X-Correlation-Id`, so a replay isn't saved twice                       |
| Online-only guard | `services/shared/networkGuard.ts` (`assertOnline`, `isAppOffline`)                               | Refuses actions that need the server, with a clear message                                                        |
| Offline sign-in   | `services/shared/authService.ts`                                                                 | Saved login, offline mode, `restoreOnlineSession()`, `logout()`                                                   |
| Status UI         | `components/shared/OfflineStatusBanner.tsx`, `SyncProblemsDialog.tsx`, `LogoutConfirmDialog.tsx` | Online/offline pill, pending count, "Not saved" panel, logout warning                                             |

---

## 3. What Works Offline

Decided in [`offline-known-issues.md`](offline-known-issues.md#1-product-decisions): **drafts yes, decisions no.**

| ✅ Works offline                                                                                                                                      | ❌ Needs internet (button disabled with "This action needs an internet connection.") |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **View** anything already saved on the device                                                                                                         | **Submit** a submission (for an apex this is the final approval)                     |
| **Create a draft** submission (cooperative and apex)                                                                                                  | **Approve / Return / Reject**                                                        |
| **Fill in a draft you hold**: sections, questionnaire, manual entry, narratives, indicators, line items, members, savings, loans, deposits, farm data | **Delegate / Reclaim / Claim edit**                                                  |
| **Invite / resend invitation**: queued; the screen says _"saved on this device, sent when you're back online"_                                        | **Delete** anything; **upload** files; **AI validation**; reports                    |
| Other admin edits (organisations, federations, custom KPIs…)                                                                                          |                                                                                      |

---

## 4. Reading Data Offline

**Where data comes from**, in this order:

1. **The server**, when online. The answer is also saved on the device.
2. **The device copy**, when offline or when the request fails. Copies are found by **label** (`offlineCacheKeys`), and only the user's own copy is used, except for data that's identical for everyone (organisation labels, questionnaire templates, indicator catalogs).
3. **Nothing saved?** The page shows _"This information isn't available offline yet. Open it once while online to make it available offline."_ (`OfflineDataUnavailableError`). It **never** shows invented placeholder data.

**When the connection returns**, data shown from the device is treated as **old** and reloaded automatically, without a page reload.

**What's downloaded in advance** (the seeder, by role): submissions and their details (sections, questionnaires, reviews, flags, financial statements, line items), dashboard stats, cooperative profiles and members (apex), federations, apexes and users (ministry), organisation labels, templates and indicator catalogs in **every UI language** (en, fr, pt, ss). Anything else is saved the first time the page is opened online.

> **Adding a dataset to the seeder?** Add its location to `offlineCacheKeys.ts` and use that same entry in the hook. Never type a label by hand in two places.

---

## 5. Saving Offline: the Outbox

Every queued write is a row in `syncQueue`:

```
created ──► pending ──► syncing ──► done
               ▲            │
               └─ retry ◄───┤  (network error or 5xx/401/429: wait, then try again)
                            └──► failed  (refused: 400/403/404/409/410/422, or out of retries)
```

| Rule                       | Detail                                                                                                                                                                           |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **When it sends**          | Right away if online. Otherwise when the connection returns, and every few seconds while the app is open. **The app must be open**: there's no background sync while it's closed |
| **Order**                  | Oldest first, so a "create" reaches the server before its follow-up edits                                                                                                        |
| **Retries**                | Waits **10s → 30s → 1m → 5m → 15m → 30m**, then marks the change `failed`                                                                                                        |
| **Refusals**               | Don't change on retry, so they're marked `failed` immediately with the server's message (e.g. _"A submission already exists for this period"_)                                   |
| **Duplicates**             | The first attempt and every retry carry the same `X-Correlation-Id`. The backend answers _"already done"_ to a replay instead of saving it twice                                 |
| **Online saves**           | Refused by the server → the error is shown, and it isn't retried in the background. Network drop mid-request → queued like an offline save                                       |
| **Failures**               | Listed in the **"Not saved"** panel (badge on the network pill), with **Retry**, **Dismiss** and **Retry all**                                                                   |
| **Drafts created offline** | Get their id on the device. The backend keeps that id (cooperative and apex create endpoints accept `id`), so follow-up edits still point at the right submission                |

---

## 6. Signing In and Out Offline

| Situation                                               | What happens                                                                                                                                                     |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sign in **online**                                      | Keycloak sign-in (`offline_access` scope). The login is saved on the device for 30 days                                                                          |
| Open the app **offline**                                | Uses the saved login ("offline mode"). Signing in for the first time offline is impossible                                                                       |
| Connection **returns** after starting offline           | `restoreOnlineSession()` completes the skipped Keycloak start-up, leaves offline mode, sends the outbox and reloads data. No page reload needed                  |
| **Idle 10 minutes**                                     | Logs out automatically. Saved copies and the saved login are removed. **The outbox and the user's drafts are kept** and resume at their next online sign-in      |
| Click **Log out** while offline, or with unsent changes | A warning first: offline you can't sign in again until you have internet, and unsent changes stay on the device. **Log out anyway** offline opens the start page |
| Another user signs in on the same device                | They never see the previous user's drafts or queued changes. Those wait for their owner                                                                          |

**Limitation:** if Keycloak was unreachable **at startup while the browser was online**, the session can't be restored without a page reload (keycloak-js can only initialise once per page load).

---

## 7. Checklist for Developers

When you add a feature that reads or writes data:

- **Reading:** use `useOfflineQuery({ ...offlineCacheKeys.x(...), queryKey, queryFn })`. Add the entry to `offlineCacheKeys.ts`. Pass `fallbackData` only if an empty value is genuinely correct.
- **Should it be pre-downloaded?** Add it to `offlineSeeder.ts` **using the same `offlineCacheKeys` entry**.
- **Writing, allowed offline:** wrap the request in `runMutation(endpoint, method, { body, pathParams, optimisticData, online })`. If the server needs a client id (like drafts), generate it on the device and make the endpoint accept it.
- **Writing, needs the server:** call `assertOnline()` as the **first line** of the mutation (before any cache update), and disable the button with `isOffline` from `useAuth()` plus the `offline.actionRequiresConnection` hint. If it goes through `runMutation`, also pass `requiresConnection: true`.
- **Messages:** if the screen says something was "sent" or "saved", say _"saved on this device"_ when `isAppOffline()` is true.
- **Test it** on `:5174` (see [`offline-local-testing.md`](offline-local-testing.md)) and add a case to the e2e specs in `frontend/e2e/specs/offline*.spec.ts`.

---

## 8. Known Limitations

- Changes are only sent while the app is open (no Background Sync; tracker #12).
- Queued invitations don't appear in member or invitation lists until they're sent.
- If the connection drops _during_ a click, the screen may still say "sent" for a queued change. It still appears in the "Not saved" panel if it later fails.
- No way to reopen an approved submission (decision D-6, for the team).
- The SiSwati (`ss`) texts for offline messages were written without a native speaker and should be reviewed.
