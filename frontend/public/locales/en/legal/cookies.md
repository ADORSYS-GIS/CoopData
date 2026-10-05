# Cookie & Similar Technologies Policy

**Proposed effective date:** 1 October 2026

## 1. Scope

This policy explains the use of cookies and similar technologies on CoopData web interfaces.

## 2. Essential technologies

CoopData may use strictly necessary technologies for authentication, session management, security, load balancing and user preferences. These technologies are required for core functionality and are not intended for advertising.

## 3. Optional technologies

If analytics, performance monitoring, embedded content or other non-essential technologies are introduced, they should be documented and, where required, presented through an appropriate consent mechanism before activation.

## 4. Cookie information

CoopData currently uses only the essential technologies listed below. It does not use analytics, advertising or third-party tracking cookies.

### Cookies

| Name | Purpose | Provider | Duration | Type | Consent status |
|---|---|---|---|---|---|
| `AUTH_SESSION_ID` | Keeps track of a sign-in in progress | First-party (CoopData sign-in service) | Until the browser is closed | Session | Essential |
| `KC_AUTH_SESSION_HASH` | Protects the sign-in process against tampering | First-party (CoopData sign-in service) | A few minutes, during sign-in | Session | Essential |
| `KC_RESTART` | Allows an interrupted sign-in to be resumed | First-party (CoopData sign-in service) | Until sign-in completes or times out | Session | Essential |
| `KEYCLOAK_IDENTITY` | Keeps the user signed in securely | First-party (CoopData sign-in service) | Until sign-out or the sign-in session expires (after 30 minutes of inactivity, at most 10 hours); kept longer if “Remember me” is selected | Session, or persistent with “Remember me” | Essential |
| `KEYCLOAK_SESSION` | Identifies the active sign-in session | First-party (CoopData sign-in service) | Until sign-out or the sign-in session expires (after 30 minutes of inactivity, at most 10 hours); kept longer if “Remember me” is selected | Session, or persistent with “Remember me” | Essential |
| `KEYCLOAK_LOCALE` | Remembers the language chosen on the sign-in page | First-party (CoopData sign-in service) | Until the browser is closed | Session | Essential (preference) |
| `sidebar_state` | Remembers whether the navigation menu is open or collapsed | First-party | 7 days | Persistent | Essential (preference) |

### Similar technologies (browser storage)

| Name | Purpose | Provider | Duration | Type | Consent status |
|---|---|---|---|---|---|
| `i18nextLng` | Remembers the chosen interface language | First-party | Until browser data is cleared | Persistent (local storage) | Essential (preference) |
| `coopdata_theme` | Remembers the light/dark display choice | First-party | Until browser data is cleared | Persistent (local storage) | Essential (preference) |
| `coopdata_cookie_consent` | Records the cookie choice made in the banner | First-party | Until browser data is cleared | Persistent (local storage) | Essential |
| `coopdata_user_profile` | Keeps a copy of the signed-in user’s profile so the Platform works offline | First-party | Until sign-out or browser data is cleared | Persistent (local storage) | Essential |
| `coopdata_draft_financial` | Keeps an unsent financial entry draft so work is not lost | First-party | Until the draft is submitted or discarded | Persistent (local storage) | Essential |
| `coopdata:period-reminders-dismissed` | Remembers reporting reminders the user has dismissed | First-party | Until browser data is cleared | Persistent (local storage) | Essential (preference) |
| `CoopDataOfflineDB` | Stores data and pending submissions so the Platform works without a connection | First-party | Until synchronized, sign-out or browser data is cleared | Persistent (IndexedDB) | Essential |
| `coopdata_tokens` | Keeps the sign-in tokens needed to work offline | First-party | Until sign-out | Persistent (IndexedDB) | Essential |
| `coopdata_query_cache` | Caches recently viewed data for faster, offline-capable loading | First-party | Until browser data is cleared | Persistent (IndexedDB) | Essential |
| Offline application cache | Stores the Platform’s application files so it can start without a connection | First-party | Until the next application update | Persistent (service worker cache) | Essential |

## 5. Managing preferences

Where applicable, Users may manage non-essential cookie preferences through the Platform’s consent interface or their browser settings. Disabling essential technologies may affect Platform functionality.

## 6. Updates

This policy should be updated whenever cookie technologies, analytics providers or tracking mechanisms materially change.
