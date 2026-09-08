# T3: Session Management & Token Expiry

> **Status:** DESIGN — Pending Implementation
> **Last Updated:** 2026-09-08
> **Branch:** `securityReliability` (based on `develop`)

---

## Table of Contents

1. [Overview](#1-overview)
2. [Token Timing Specifications](#2-token-timing-specifications)
3. [Current Implementation Status](#3-current-implementation-status)
4. [Token Lifecycle Diagram](#4-token-lifecycle-diagram)
5. [Implementation Plan: Inactivity Timeout](#5-implementation-plan-inactivity-timeout)
6. [File Changes](#6-file-changes)
7. [Test Plan](#7-test-plan)
8. [Acceptance Criteria](#8-acceptance-criteria)

---

## 1. Overview

### Objective

Minimize the vulnerability window of stolen credentials/tokens and ensure inactive sessions are terminated.

### Requirements (from Issue #107)

| Requirement | Value | Status |
|------------|-------|--------|
| Access token lifespan | 5 minutes | ✅ Keycloak config |
| Refresh token idle timeout | 30 minutes | ✅ Keycloak config |
| Inactivity timeout | 10 minutes | ❌ Not implemented |
| Activity tracking events | mousemove, mousedown, keydown, touchstart, scroll | ❌ Not implemented |
| Store tokens in IndexedDB | Yes | ✅ Implemented |
| No localStorage for JWTs | Yes | ✅ Implemented |
| Logout invalidates Keycloak session | Yes | ✅ Implemented |
| Logout clears local auth data | Yes | ✅ Implemented |

---

## 2. Token Timing Specifications

### 2.1 Access Token (5 minutes)

| Property | Value |
|----------|-------|
| **Lifespan** | 5 minutes (300 seconds) |
| **Purpose** | Short-lived token for API authentication |
| **Security rationale** | Limits exposure window if token is stolen |
| **Configuration** | Keycloak realm settings |

### 2.2 Auto-Refresh (30 seconds before expiry)

| Property | Value |
|----------|-------|
| **Threshold** | 30 seconds before expiry |
| **Purpose** | Silently obtain new access token before expiry |
| **User experience** | Seamless — user doesn't notice |

### 2.3 Refresh Token (30 minutes idle)

| Property | Value |
|----------|-------|
| **Idle timeout** | 30 minutes |
| **Purpose** | Backup token for re-authentication |
| **Behavior** | Resets on any user activity |
| **Offline validity** | 30 days (with `offline_access` scope) |

### 2.4 Inactivity Timeout (10 minutes) — TO BE IMPLEMENTED

| Property | Value |
|----------|-------|
| **Timeout** | 10 minutes of no activity |
| **Purpose** | Force logout if user leaves computer unattended |
| **Activity events** | mousemove, mousedown, keydown, touchstart, scroll |

---

## 3. Current Implementation Status

### 3.1 Already Implemented ✅

#### Auto-Refresh Threshold (30 seconds)

**File:** `frontend/src/services/shared/authService.ts`
**Line:** 8

```typescript
const REFRESH_THRESHOLD_SECONDS = 30;
```

**Usage:** Lines 111, 209

```typescript
// Line 111 - Initial token refresh after login
await keycloak.updateToken(REFRESH_THRESHOLD_SECONDS);

// Line 209 - Token refresh on API calls
const refreshed = await keycloak.updateToken(REFRESH_THRESHOLD_SECONDS);
```

---

#### Token Storage in IndexedDB

**File:** `frontend/src/services/shared/authService.ts`

```typescript
// Line 1 - IndexedDB library
import { get, set, del } from "idb-keyval";

// Line 530 - Store tokens
await set(TOKEN_CACHE_KEY, tokens);

// Line 556 - Clear tokens
await del(TOKEN_CACHE_KEY);
```

**Storage Key:** `coopdata_tokens`

**Stored Data:**
```typescript
interface CachedTokens {
  token: string;           // Access token
  refreshToken: string;     // Refresh token
  idToken: string;         // ID token
  timestamp: number;       // Cache timestamp
  tokenExpiry: number;     // Access token expiry (Unix ms)
  refreshTokenExpiry: number; // Refresh token expiry (Unix ms)
  userProfile: UserProfile | null; // Cached profile
  offlineToken: boolean;   // True if offline_access scope granted
}
```

---

#### 30-Day Offline Token Validity

**File:** `frontend/src/services/shared/authService.ts`
**Lines:** 9-10, 472-473

```typescript
// Line 9-10 - 30-day offline window
const OFFLINE_TOKEN_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days in ms

// Line 472-473 - Validation function
function isOfflineTokenValid(cached: CachedTokens): boolean {
  return cached.offlineToken && Date.now() - cached.timestamp < OFFLINE_TOKEN_MAX_AGE_MS;
}
```

---

#### Access Token Expiry Parsing

**File:** `frontend/src/services/shared/authService.ts`
**Lines:** 490-498

```typescript
// Line 490 - Default fallback (5 minutes)
let tokenExpiry = Date.now() + 5 * 60 * 1000; // default 5 min

// Lines 493-498 - Parse actual expiry from JWT
try {
  const [, tp] = keycloak.token.split(".");
  const claims = JSON.parse(atob(tp.replace(/-/g, "+").replace(/_/g, "/"))) as Record<string, number>;
  if (claims.exp) tokenExpiry = claims.exp * 1000;
} catch {
  /* ignore parse errors */
}
```

---

#### Logout Clears All Auth Data

**File:** `frontend/src/context/AuthContext.tsx`
**Lines:** 129-143

```typescript
const logout = useCallback(async () => {
  console.log("[auth-context] logout() called — redirecting");
  try {
    // Clear offline database (except sync queue)
    await Promise.all(
      offlineDb.tables.filter((t) => t.name !== "syncQueue").map((t) => t.clear()),
    );
  } catch (e) {
    console.warn("[auth-context] Failed to clear offline database on logout:", e);
  }
  await keycloakLogout();  // Invalidates Keycloak session
  setIsAuthenticated(false);
  setUser(null);
  setAccessToken(null);
}, []);
```

**File:** `frontend/src/services/shared/authService.ts`
**Lines:** 188-198

```typescript
export async function logout(): Promise<void> {
  console.log("[auth] logout() called");
  isLoggingOut = true;
  offlineModeActive = false;
  await clearCachedTokens();  // Clears IndexedDB tokens
  keycloakInitialized = false;
  await keycloak.logout({    // Calls Keycloak logout
    redirectUri: window.location.origin + "/",
  });
  isLoggingOut = false;
}
```

---

### 3.2 Not Implemented ❌

#### Inactivity Timeout (10 minutes)

**Missing:** Activity tracking with 10-minute timeout

**Required behavior:**
1. Track user activity events: `mousemove`, `mousedown`, `keydown`, `touchstart`, `scroll`
2. Reset timer on any activity
3. Log out user after 10 minutes of no activity
4. Use debouncing for performance (Option B)

---

## 4. Token Lifecycle Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TIMELINE (30 minutes)                               │
└─────────────────────────────────────────────────────────────────────────────┘

0 min                              10 min              25 min           30 min
 │                                   │                  │               │
 │                                   │                  │               │
 ▼                                   ▼                  ▼               ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  ACCESS TOKEN (5 min lifespan)                                              │
│  ├── Expires at 5 min ──────────────────────────────────────────────────────►│
│  │                                                                          │
│  │   ┌─────────────────────────────────────────────────────────────────┐    │
│  │   │ REFRESH at 4:30 (30 sec before expiry)                         │    │
│  │   │ Gets NEW access token                                           │    │
│  │   └─────────────────────────────────────────────────────────────────┘    │
│  │                                                                          │
│  │   ┌─────────────────────────────────────────────────────────────────┐    │
│  │   │ REFRESH at 9:30 (30 sec before expiry)                         │    │
│  │   │ Gets NEW access token                                           │    │
│  │   └─────────────────────────────────────────────────────────────────┘    │
│  │                                                                          │
│  │   ┌─────────────────────────────────────────────────────────────────┐    │
│  │   │ REFRESH at 14:30 ... (keeps going while user is active)         │    │
│  │   └─────────────────────────────────────────────────────────────────┘    │
│  │                                                                          │
│  └───► REFRESH TOKEN IDLE TIMEOUT (30 min)                                  │
│        └── Resets every time user does something ──────────────────────────►  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

INACTIVITY TIMEOUT (10 min) ──► If no activity for 10 min, FORCE LOGOUT
```

---

## 5. Implementation Plan: Inactivity Timeout

### 5.1 Selected Approach: Option B (Debounced Activity Tracking)

**Why Option B?**
- Uses `requestAnimationFrame` to batch high-frequency events (mouse moves)
- 100+ events per second → 60 timer resets per second (max)
- Better performance, lower CPU/battery usage
- Production-ready choice

### 5.2 Implementation Details

**File to modify:** `frontend/src/context/AuthContext.tsx`

**Location:** Add new `useEffect` hook after existing useEffect hooks

**Code:**

```typescript
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

useEffect(() => {
  let timeoutId: ReturnType<typeof setTimeout>;
  let rafId: number | null = null;
  let lastActivity = Date.now();

  // The actual timer that logs out after 10 min of no activity
  const checkInactivity = () => {
    const idleTime = Date.now() - lastActivity;
    if (idleTime >= INACTIVITY_TIMEOUT_MS) {
      console.log("[auth] Inactivity timeout — logging out");
      logout();
    }
  };

  // Reset the timer and update last activity time
  const resetTimer = () => {
    clearTimeout(timeoutId);
    lastActivity = Date.now();
    timeoutId = setTimeout(checkInactivity, INACTIVITY_TIMEOUT_MS);
  };

  // Debounced activity handler using requestAnimationFrame
  // This batches rapid events (mouse moves, scrolls) into single resets
  const handleActivity = () => {
    if (rafId) return; // Already scheduled for next frame
    rafId = requestAnimationFrame(() => {
      rafId = null;
      resetTimer();
    });
  };

  // Track these user activities
  const events = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
  
  // Add listeners with passive: true for better scroll performance
  events.forEach(e => window.addEventListener(e, handleActivity, { passive: true }));
  
  // Start the timer immediately
  resetTimer();

  // Cleanup on unmount
  return () => {
    clearTimeout(timeoutId);
    if (rafId) cancelAnimationFrame(rafId);
    events.forEach(e => window.removeEventListener(e, handleActivity));
  };
}, [logout]);
```

### 5.3 How It Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    User Activity → Debounced Reset                          │
└─────────────────────────────────────────────────────────────────────────────┘

Timeline (horizontal = time)

User types "hello" (keyboard events)
│
├─ keydown 'h' ─┐
├─ keydown 'e' ─┤
├─ keydown 'l' ─┤
├─ keydown 'l' ─┤──► requestAnimationFrame ──► resetTimer() (1 call)
└─ keydown 'o' ─┘

User scrolls page
│
├─ scroll ─┐
├─ scroll ─┤
├─ scroll ─┤──► requestAnimationFrame ──► resetTimer() (1 call)
├─ scroll ─┤
└─ scroll ─┘

User moves mouse
│
├─ mousemove ─┐
├─ mousemove ─┤
├─ mousemove ─┤──► requestAnimationFrame ──► resetTimer() (1 call)
├─ mousemove ─┤
└─ mousemove ─┘

Result: 100+ events → 1 timer reset (per frame)
```

### 5.4 Performance Comparison

| Metric | Option A (Naive) | Option B (Debounced) |
|--------|------------------|---------------------|
| Timer resets per second (active user) | 50-200+ | 60 (max) |
| CPU usage | Higher | Lower |
| Memory | Normal | Normal |
| Battery impact | Higher | Lower |
| Complexity | Simple | Moderate |

---

## 6. File Changes

### 6.1 Modified Files

| File | Change |
|------|--------|
| `frontend/src/context/AuthContext.tsx` | Add inactivity timeout useEffect |

### 6.2 New Test Files

| File | Description |
|------|-------------|
| `frontend/src/context/AuthContext.inactivity.test.tsx` | Inactivity timeout tests |

---

## 7. Test Plan

### 7.1 Unit Tests

#### Test File: `AuthContext.inactivity.test.tsx`

```typescript
describe('Inactivity Timeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should reset timer on mousemove', () => {
    // Simulate user activity
    // Verify timer is reset
  });

  it('should reset timer on keydown', () => {
    // Simulate keyboard activity
    // Verify timer is reset
  });

  it('should reset timer on scroll', () => {
    // Simulate scroll activity
    // Verify timer is reset
  });

  it('should logout after 10 minutes of inactivity', () => {
    // Advance timer by 10 minutes
    // Verify logout is called
  });

  it('should NOT logout if activity occurs before timeout', () => {
    // Simulate activity at 9 minutes
    // Advance timer to 10 minutes
    // Verify logout is NOT called
  });

  it('should debounce rapid events', () => {
    // Fire 100 mousemove events
    // Verify resetTimer is called once (not 100 times)
  });

  it('should cleanup listeners on unmount', () => {
    // Mount component
    // Unmount component
    // Verify all event listeners are removed
  });
});
```

### 7.2 Test Scenarios

| Scenario | Expected Result |
|----------|-----------------|
| User moves mouse after 9 min | Timer resets, no logout at 10 min |
| User types after 9 min | Timer resets, no logout at 10 min |
| User scrolls after 9 min | Timer resets, no logout at 10 min |
| No activity for 10 min | User is logged out |
| User opens new tab, returns at 15 min | User is logged out |
| Rapid mouse movements (100 events) | Timer reset once (debounced) |

### 7.3 Manual Test Checklist

- [ ] Login to the application
- [ ] Wait 10 minutes without any activity
- [ ] Verify automatic logout occurs
- [ ] Verify redirect to login page
- [ ] Verify IndexedDB tokens are cleared
- [ ] Verify Keycloak session is invalidated

---

## 8. Acceptance Criteria

### 8.1 Functional Requirements

- [ ] User is automatically logged out after 10 minutes of inactivity
- [ ] Activity events (mousemove, mousedown, keydown, touchstart, scroll) reset the timer
- [ ] Timer starts on component mount
- [ ] Timer is cleaned up on component unmount
- [ ] Debouncing prevents excessive timer resets

### 8.2 Security Requirements

- [ ] No sensitive data exposed in console logs
- [ ] Timer cannot be bypassed by rapid events
- [ ] Logout properly clears all auth data

### 8.3 Performance Requirements

- [ ] Timer resets are debounced (max 60 per second)
- [ ] No memory leaks from event listeners
- [ ] Passive event listeners don't block scrolling

### 8.4 Verification Commands

```bash
# Run unit tests
npm run test:unit -- AuthContext.inactivity

# Run all tests
npm run test:unit

# Type check
npm run typecheck

# Lint
npm run lint
```

---

## Appendix: Keycloak Configuration

The following Keycloak realm settings must be configured (server-side):

| Setting | Value |
|---------|-------|
| Access Token Lifespan | 5 minutes |
| Access Token Lifespan For Implicit Flow | 5 minutes |
| Client Session Idle Timeout | 30 minutes |
| Client Session Max Timeout | 30 minutes |
| Offline Session Idle Timeout | 30 days |

These settings are configured in the Keycloak Admin Console under:
**Realm Settings → Tokens**