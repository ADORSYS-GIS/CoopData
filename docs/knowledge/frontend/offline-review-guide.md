# Offline Mode — Review & Test Guide

> **Use this page to go through everything fixed in the October 2026 offline review and check each fix yourself.**
> For how offline mode works in general, see [`offline-mode.md`](offline-mode.md). For the issue history, see [`offline-known-issues.md`](offline-known-issues.md).

---

## 0. Before You Start

**Setup (once):**

1. Start the stack: `docker compose up -d`. Make sure `frontend-pwa` was built from the current code: `docker compose up -d --build frontend-pwa`.
2. Open **http://localhost:5174** in a **normal** Chrome window (not incognito). Port `5173` can't work offline; see [`offline-local-testing.md`](offline-local-testing.md).
3. Open **DevTools** (F12). You'll use three panels:
   - **Network → throttling dropdown:** `Offline` / `No throttling` to cut and restore the connection.
   - **Application → IndexedDB → `CoopDataOfflineDB`:** what's saved on the device. **`syncQueue`** is the outbox. Press **↻** to refresh a table.
   - **Console:** errors and warnings.
4. Accounts: the `E2E_*` users in `frontend/.env` (ministry, federation, apex, cooperative).
5. For a clean start: **Application → Storage → Clear site data**, then sign in again.

**Deleting one row in IndexedDB:** type its key in **Filter by key**, click the row, then the **🗑** button. Don't use **⊘**: it empties the whole table.

**Automated alternative:** everything below is also covered by `cd frontend && npm run test:e2e:offline` (≈1.5 minutes) and `npm run test:unit`.

---

## 1. Overview

| ID              | The problem (before)                                                                             | Now                                                                                                 | Commit    |
| --------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- | --------- |
| **A**           | Opening a submission offline could crash the page ("This page didn't load")                      | Shows _"This information isn't available offline yet"_ instead                                      | `f6b1b5a` |
| **H**           | After reconnecting, pages kept showing wrong offline data (e.g. "0 members") for up to 5 minutes | Pages reload by themselves when the connection returns                                              | `f6b1b5a` |
| **G**           | Data downloaded in advance was saved under wrong labels and never shown offline                  | One shared list of labels. Members, ministry stats and cooperatives show offline, in every language | `438c826` |
| **B**           | Submit/approve/return could be clicked offline and were applied hours later                      | Disabled offline with _"This action needs an internet connection."_ Drafts still work offline       | `95318c8` |
| **Apex drafts** | Apexes couldn't create submissions offline                                                       | They can now, like cooperatives (submit stays online-only)                                          | `95318c8` |
| **C**           | After opening the app offline, nothing was sent when the connection returned (until a reload)    | Sent automatically when the connection returns                                                      | `ffd3a07` |
| **D**           | A save could be applied twice if the server's reply was lost                                     | Every attempt carries the same tracking id. The server ignores replays                              | `a752f11` |
| **E**           | "Already exists" answers were counted as **saved**                                               | Counted as **failed**, with the server's message                                                    | `e1d621c` |
| **F**           | Failed changes were invisible and retried pointlessly                                            | **"Not saved: N"** badge and panel with Retry/Dismiss. Smarter retries                              | `fdbedd7` |
| **I**           | The saved page snapshot kept failing (`DataCloneError`)                                          | Saves correctly                                                                                     | `816f920` |
| **D-3**         | Offline invitations said "Invitation sent"                                                       | Say _"saved on this device, sent when you're back online"_                                          | `caaaddc` |
| **#10**         | On a shared device, one user could see another user's saved data                                 | Only the current user's data (plus truly global data)                                               | `2fd60ff` |
| **D-5**         | Idle logout deleted half-filled forms; logout could silently fail                                | Forms and unsent changes kept; warning before logout; logout race fixed                             | `5d74205` |
| **J**           | The app counted 30 days from the last online use; Keycloak counts from the password sign-in      | The app follows Keycloak's real deadline, warns 3 days before, and logs out when it passes          | `b831a2e` |

---

## 2. Step-by-Step Checks

Each check says what to do, and what you should see **now** (✅). Where useful, it also says what the old version did (❌), so you can compare with the deployed site.

### A — Submission page doesn't crash offline (ministry)

1. Sign in, open **Submissions** and click into one submission. Note its id in the URL.
2. Network → **Offline**.
3. IndexedDB → `CoopDataOfflineDB` → `submissions`: delete the row `submission-<id>`. Then `keyval-store` → `keyval`: delete `coopdata_query_cache`.
4. Press **F5**.

✅ _"This information isn't available offline yet…"_ ❌ old: "This page didn't load".

### H — Pages refresh by themselves after reconnecting (apex)

1. Sign in, open **Cooperatives**, then a cooperative's **members** page. Note the member count.
2. Network → **Offline**. Delete `cooperatives` → `cooperative-<id>-members` and `keyval` → `coopdata_query_cache`.
3. **F5**: the page shows 0 members.
4. Network → **No throttling**. **Don't reload.**

✅ The real member count appears within seconds. ❌ old: stays at 0 for up to 5 minutes.

### G — Downloaded data is found offline (apex, then ministry)

1. Clear site data, sign in as **apex**, wait 15 seconds, and **don't** open any members page.
2. IndexedDB → `cooperatives`: rows named `cooperative-<id>-members` (❌ old: `cooperative-members-<id>`).
3. Network → **Offline** → open a cooperative's members.

✅ Members are listed.

4. Clear site data, sign in as **ministry**, wait 15 seconds. `analytics` has `ministry-stats-{}` and `custom-kpis-en/-fr/-pt/-ss`. `cooperatives` has `cooperatives-list`.
5. Offline: the dashboard stats and **Basic Analytics**' cooperative filter load.

### B — Decisions need internet, drafts don't

1. **Cooperative**, offline: **New Submission** is clickable. In a draft you hold, **Submit** is greyed out; hover to see _"This action needs an internet connection."_
2. **Apex**, offline: **Approve / Return** (on a submitted submission) and **Delegate** (on a draft you hold) are greyed out with the same hint.
3. IndexedDB → `syncQueue`: clicking a greyed-out button adds **nothing**.

### Apex drafts offline

1. **Apex**, offline → **New Submission** → choose a cooperative and a year it doesn't have yet → **Create**.
2. The new draft opens immediately. `syncQueue` holds a `pending` item for `/api/v1/apex/submissions`.
3. Network → **No throttling**, wait about 10 seconds. The item becomes `done`, and the submission is in the list after a refresh.
4. Delete the test draft afterwards (online).

### C — Changes are sent after starting offline

1. Sign in (online). Network → **Offline** → **F5** (the app now _starts_ offline).
2. Save something allowed offline (for example, create a draft).
3. Network → **No throttling**. **Don't reload.**

✅ The pill switches to **Online** and the `syncQueue` item becomes `done` within seconds. ❌ old: stays `pending` until a reload.

### D — No duplicate saves

Hard to trigger by hand, because the server's reply has to be lost. To check the mechanism:

1. Online, open DevTools → **Network**, then save something (for example, a custom KPI as ministry).
2. Click the request → **Headers**: it has **`X-Correlation-Id`**.

✅ The id is present on the first attempt. ❌ old: missing, so a retry used a different id. A full lost-reply test exists in `e2e/specs/offline-sync.spec.ts` (D).

### E + F — Refused changes are shown, not counted as saved

You need **two browsers**: your normal Chrome as the **cooperative** and an incognito window as the **apex**.

1. Chrome (cooperative): Network → **Offline**.
2. Incognito (apex, online): create a submission for **that cooperative** for a year, e.g. 2023.
3. Chrome (still offline): **New Submission** for the same year.
4. Chrome: Network → **No throttling**, wait about 15 seconds.

✅ A red **"Not saved: 1"** badge appears bottom-right. Click it: _"Create · Submission — A submission already exists…"_, with **Retry** / **Dismiss**. ❌ old: marked as saved, then lost silently.

5. Click **Dismiss**: the badge disappears. Delete the apex's test submission afterwards.

### I — Page snapshot saves correctly

1. Online, open the Console, then browse 4–5 pages.

✅ No `[persister] Failed to persist… DataCloneError` warnings, and `keyval-store` → `keyval` → `coopdata_query_cache` exists. ❌ old: the warning repeats.

### D-3 — Offline invitations are honest

1. **Apex**, offline → a cooperative's members → **Invite member** → use a test email → **Send invitation**.

✅ _"Invitation saved on this device — … the person only receives the email then."_

2. ⚠️ To avoid a real email, delete the item from `syncQueue` (filter on `/members`) **before** going back online, or use an address you own.

### #10 — No data leaks between users on one device

Covered by an automated test (`offlineCache.test.ts`). It only happens on a shared device, when the previous user closed the browser without logging out **and** a request fails. To try it by hand: sign in as apex A and close the tab **without** logging out. Sign in as a user of **another** organisation in the same browser, go offline, and open the national overview. ✅ You never see A's figures.

### D-5 — Logout keeps work and warns first

1. **Warning:** sign in, Network → **Offline** → click **Logout** (icon next to your name). ✅ _"You're offline. If you log out now, you won't be able to sign in again…"_ Click **Stay signed in**: nothing happens.
2. **Log out anyway** (offline): ✅ the app's start page, not a browser error.
3. **Drafts survive:** online, start the manual-entry wizard on a draft and fill part of it. Log out, sign in again, reopen the wizard. ✅ Your answers are still there. ❌ old: deleted at logout.
4. **Logout really logs out:** online → Logout. ✅ You land on the start page and stay signed out. ❌ old: you were sometimes signed straight back in.

### J — The saved login follows Keycloak's deadline

The deadline is 30 days after the password sign-in. To try it without waiting 30 days, move it in DevTools:

1. Sign in as any user (online).
2. Console:
   ```js
   const r = indexedDB.open("keyval-store");
   r.onsuccess = () => {
     const s = r.result
       .transaction("keyval", "readwrite")
       .objectStore("keyval");
     const g = s.get("coopdata_tokens");
     g.onsuccess = () =>
       s.put(
         { ...g.result, refreshTokenExpiry: Date.now() + 2.5 * 864e5 },
         "coopdata_tokens",
       );
   };
   ```
3. Network → **Offline** → **F5**.

✅ The pill shows **"Sign-in ends in 2 days"**. Tap it for the explanation.

4. Repeat step 2 with `Date.now() - 60000` (deadline already passed), then **F5** while offline.

✅ _"Please connect to the internet to sign in."_ ❌ old: the app opened, because it only counted 30 days from the last online use.

---

## 3. Automated Tests

| Command                                   | What it covers                                                                                                                                                                                                     |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `cd frontend && npm run test:unit`        | All unit tests (≈890), including every fix above                                                                                                                                                                   |
| `cd frontend && npm run test:e2e:offline` | 21 end-to-end checks on the real app (`:5174`) in 4 files: `offline.spec.ts` (A, G, H, I), `offline-actions.spec.ts` (B, apex drafts, D-3), `offline-sync.spec.ts` (C, D, E, F), `offline-logout.spec.ts` (D-5, J) |
| `cd backend && cargo test`                | Backend tests, including the apex create endpoint accepting a client id                                                                                                                                            |

Each e2e check was confirmed to **fail on the code before its fix** and pass after. One check (_"submitting a draft needs a connection"_) skips when no cooperative account holds an editable draft.

---

## 4. Still Open

| Item                                                    | Status                                                 |
| ------------------------------------------------------- | ------------------------------------------------------ |
| D-6 — reopening an approved submission                  | For the team to discuss (not part of the offline work) |
| #12 — Background Sync code that does nothing            | Parked (remove it, or build real background sync)      |
| SiSwati (`ss`) translations of the new offline messages | Need review by a native speaker                        |
| D-5 step 2 — PIN lock screen                            | Not planned; needs a security owner's approval         |
