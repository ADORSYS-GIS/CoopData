# MFA (TOTP Authenticator) — Full Stack Implementation

> **Feature**: Self-service Multi-Factor Authentication (TOTP)  \
> **Status**: Complete (v2: soft-disable + re-enable + reset, see issue #88)  \
> **Branch**: `settingsQuickfixes`

## Scope

Allow every user to protect their CoopData account with time-based one-time passwords (TOTP) from any authenticator app (Google Authenticator, Authy, etc.). Users click "Enable" on their Profile page, are redirected through Keycloak to complete TOTP setup (re-authenticate → scan QR → enter code), and from then on Keycloak enforces the OTP credential at login and during identity re-verification for destructive actions.

## Why Keycloak-native setup?

Keycloak's Admin REST API (verified against 26.3.1 source) has **no endpoint to create an OTP credential**. The `/users/{id}/credentials` path only supports listing, deleting, relabeling, and reordering — a `POST` to that path returns `404 Not Found`. The supported way to enable TOTP is to add the **`CONFIGURE_TOTP` required action** and let Keycloak's own (already CoopData-branded) TOTP setup screen complete the flow. The user is redirected immediately via `kc_action=CONFIGURE_TOTP` (application-initiated action) so setup happens in one sitting.

---

## Backend Implementation

### 1. Keycloak Service — `backend/src/services/keycloak.rs`

| Function | Purpose |
|----------|---------|
| `get_user_otp_status(user_id)` | Lists the user's credentials via the Admin API and checks for type `"otp"` |
| `get_user_mfa_enabled(user_id)` | True when the `mfa_enabled` user attribute is `"true"`, or a pending `CONFIGURE_TOTP` required action exists (covers accounts mid-setup). Legacy fallback: users with an OTP credential but no attribute are treated as enabled (preserves pre-v2 accounts) |
| `initiate_totp_setup(user_id)` | Adds the `CONFIGURE_TOTP` required action via `PUT /users/{id}` (idempotent) and sets `mfa_enabled=true`. The user completes setup on Keycloak's TOTP screen at their next authentication |
| `disable_user_mfa(user_id)` | **Soft-disable**: keeps the OTP credential, clears pending `CONFIGURE_TOTP`, and sets `mfa_enabled=false` — the user is no longer prompted at login, but their authenticator entry stays valid |
| `enable_user_mfa(user_id)` | Re-enables after a soft-disable: verifies password + current OTP, then flips `mfa_enabled=true`. **No new QR / no new credential** — the existing entry works again |
| `reset_user_mfa(user_id)` | Change-device: verifies password + current OTP, deletes the old OTP credential, arms a fresh `CONFIGURE_TOTP`, sets `mfa_enabled=true` |
| `verify_user_password(username, password, totp)` | Accepts an optional TOTP code (passed as the `totp` form param during password-grant verification) |

### 2. API DTOs — `backend/src/api/dto/member.rs`

| DTO | Fields |
|-----|--------|
| `SecuritySettingsResponse` | `mfa_enabled: bool`, `mfa_configured: bool` — configured = an OTP credential actually exists (used to decide re-enable vs fresh setup) |
| `EnableMfaRequest` | `password`, `totp` — for re-enabling after a soft-disable |
| `ResetMfaRequest` | `password`, `totp` — for changing device |

### 3. Handlers — `backend/src/api/handlers/me.rs`

| Method | Endpoint | Handler | Behavior |
|--------|----------|---------|----------|
| `GET` | `/api/v1/me/security` | `get_security_settings` | Returns current MFA status |
| `POST` | `/api/v1/me/security/mfa/setup` | `mfa_setup` | Arms the `CONFIGURE_TOTP` required action (idempotent — a pending, uncompleted setup can be resumed). Rejects with 400 only when a real OTP credential already exists. Logs `MFA_ENABLED` audit event |
| `DELETE` | `/api/v1/me/security/mfa` | `disable_mfa` | Soft-disable: keeps the credential, sets `mfa_enabled=false`. Logs `MFA_DISABLED` audit event |
| `POST` | `/api/v1/me/security/mfa/enable` | `enable_mfa` | Re-enable: verifies password + OTP, flips `mfa_enabled=true` (no new QR). Logs `MFA_ENABLED` audit event |
| `POST` | `/api/v1/me/security/mfa/reset` | `reset_mfa` | Change device: verifies password + OTP, deletes old credential, arms new setup. Logs audit event |
| `POST` | `/api/v1/me/password` | `change_password` | Password change verifies the current password; OTP verification here is a known follow-up (see issue #88) |

Also: `verify_identity` detects an active OTP credential and returns `requires_otp: true` so the client prompts for an authenticator code before destructive actions; when OTP is on, the code is forwarded to Keycloak during password verification.

All schemas are registered in `backend/src/api/openapi.rs`, and routes are wired in `backend/src/api/routes/shared.rs`.

---

## Frontend Implementation

### 1. Data Layer — `frontend/src/hooks/auth/useSecuritySettings.ts`

All API calls go through the generated OpenAPI client. TanStack Query hooks:

| Hook | Endpoint | Notes |
|------|----------|-------|
| `useSecuritySettings()` | `GET /api/v1/me/security` | Query, cached under `me-security-settings` |
| `useMfaSetup()` | `POST /api/v1/me/security/mfa/setup` | Mutation; arms `CONFIGURE_TOTP`, updates cached status on success |
| `useDisableMfa()` | `DELETE /api/v1/me/security/mfa` | Soft-disable mutation; updates cached status on success |
| `useEnableMfa()` | `POST /api/v1/me/security/mfa/enable` | Re-enable mutation (password + OTP); updates cached status |
| `useResetMfa()` | `POST /api/v1/me/security/mfa/reset` | Change-device mutation (password + OTP); updates cached status |

### 2. Setup Dialog — `frontend/src/components/shared/MfaSetupDialog.tsx`

- Branded confirmation dialog (CoopData logo + explainer): explains the user will be asked to sign in once more and scan a QR with their authenticator app, then be returned to their profile.
- "Start setup" arms `CONFIGURE_TOTP` via the backend, then redirects through Keycloak:

```ts
await keycloak.login({
  redirectUri: `${window.location.origin}/app/profile`,
  scope: "openid profile email",
  action: "CONFIGURE_TOTP", // keycloak-js maps this to kc_action
  locale: localStorage.getItem("i18nextLng") || "en",
});
```

- Keycloak shows its CoopData-branded TOTP setup screen (theme `login-config-totp.ftl`), the user scans + verifies, the credential is stored, the required action is consumed, and Keycloak redirects back to the profile page with a fresh session.

### 3. Profile Page — `frontend/src/pages/shared/ProfilePage.tsx`

- MFA **toggle switch** in the Security Preferences card, reflecting live status (`aria-checked` for accessibility).
- **Fresh setup** (no credential exists) opens `MfaSetupDialog` → Keycloak TOTP screen → scan QR → new credential.
- **Re-enable** (`mfa_configured=true`, currently off) opens `ReEnableMfaDialog` — password + current OTP from the **existing** authenticator entry, no new QR.
- **Disable** opens `DisableMfaDialog` — password + OTP; soft-disable (credential kept).
- **Change device** (`ResetMfaDialog`, shown when enabled) — password + current OTP → deletes old credential → new QR.
- Disabled + spinner while requests are in flight; loading hint while the status query is pending.

### 4. Internationalization

MFA strings in `frontend/src/i18n/locales/{en,fr,pt,ss}.json`:

`mfa`, `mfaDesc`, `mfaEnabledToast`, `mfaDisabledToast`, `mfaSetupTitle`, `mfaSetupDesc`, `mfaStartSetup`, `mfaRedirectHint`, `mfaCancel`, `loadingSecurity`, plus `mfaReEnable*`, `mfaReset*`, `mfaSoftDisabledHint` keys in all four locales.

### 5. Tests

- `frontend/src/hooks/auth/useSecuritySettings.test.tsx` — status query, setup/enable/reset/disable mutations (success + error).
- `backend/src/api/dto/member.rs` — DTO serialization/deserialization.
- `backend/src/services/keycloak.rs` — `mfa_enabled_from_parts` unit tests (attribute true/false/pending-setup/legacy fallback).
- `backend/tests/handlers_verify_identity.rs` — integration tests for the new enable/reset routes (registration + auth + validation).

---

## Security Properties

- **Keycloak-enforced**: the OTP credential is created and stored by Keycloak itself through its supported flow — no custom credential writes.
- **Re-authentication required**: Keycloak forces a fresh sign-in before allowing credential setup.
- **Enforced at login**: the realm's bound `browser` flow → `forms` → `Browser - Conditional 2FA` (CONDITIONAL: `conditional-user-attribute` REQUIRED with config `mfa enabled condition` = `mfa_enabled == "true"`, + `auth-otp-form` ALTERNATIVE, + `auth-recovery-authn-code-form` ALTERNATIVE) — verified in `keycloak/realm-coopdata.json`. A soft-disabled user (attribute `false`) is **not** prompted; the preserved credential is inert until re-enabled.
- **Idempotent setup**: setting the `CONFIGURE_TOTP` action twice is a no-op.
- **No orphaned authenticator entries**: soft-disable keeps the credential, so re-enabling never creates a second entity to delete by mistake (the lockout scenario from issue #88).
- **Recovery codes enforced at setup**: with Keycloak `26.4.6` + `add-recovery-codes=true`, Keycloak itself shows the recovery-codes screen (12 one-time codes, shown exactly once) immediately after TOTP setup — same session as the QR scan.
- **Audit trail**: `MFA_ENABLED` / `MFA_DISABLED` audit events with IP + user-agent (Keycloak additionally logs its own `SETUP_TOTP` event).
- **Enforced re-verification**: destructive-action identity checks require the OTP code when MFA is active.

---

## Technical Stack

### Backend
- **Axum** handlers + **utoipa** OpenAPI schemas
- **Keycloak Admin API** for credential lifecycle (`GET/DELETE /users/{id}/credentials`, `PUT /users/{id}` required actions + attributes)

### Deployment
- **Realm change**: `Browser - Conditional 2FA` now keys off `mfa_enabled` attribute — `keycloak/backfill-mfa-attribute.sh` (auto-run from `provision.sh`) sets `mfa_enabled=true` and arms `CONFIGURE_RECOVERY_AUTHN_CODES` for existing OTP users so nobody silently loses 2FA or misses recovery codes
- **Keycloak upgraded 26.3.1 → 26.4.6**: required for the `add-recovery-codes` switch on `CONFIGURE_TOTP` (docker-compose.yml, docker-compose.ghcr.yaml, docs). DB schema migrates automatically on first boot; users/credentials/realm data are preserved. Rollback to 26.3.1 after migration is not supported.

### Frontend
- **TanStack Query** for server state
- **keycloak-js** (`login({ action: "CONFIGURE_TOTP" })`) for the AIA redirect
- **shadcn/ui** `Dialog`
- **react-i18next** for 4-language support

---

## Verification

- [x] Backend `cargo check` — passes
- [x] Backend unit tests — pass
- [x] Frontend `tsc --noEmit` — no errors (strict mode)
- [x] Frontend `eslint` on MFA files — no errors
- [x] Frontend hook tests (`useSecuritySettings.test.tsx`) — pass
- [x] OpenAPI spec regenerated (`backend/openapi.json`, `frontend/openapi.json`, `api.d.ts`)
- [x] All MFA strings localized in EN / FR / PT / SiSwati

---

## Testing Notes

- After changing the backend, **restart the dev backend** (e.g. `cargo run`) so the running API picks up the new handler/OpenAPI — otherwise the frontend client and the live API disagree.
- `CONFIGURE_TOTP` is an enabled required action in `keycloak/realm-coopdata.json`, and the bound `browser` flow includes the conditional OTP form, so a user who completes setup is prompted for a code at their next sign-in.
- An interrupted setup (redirect abandoned) can be resumed: clicking Enable again re-arms the action and redirects; there is no lock-out because `CONFIGURE_TOTP` simply forces the setup screen at the next authentication.

---

## Acceptance Criteria Checklist

**Backend:**
- [x] `GET /api/v1/me/security` returns accurate MFA status (credential OR pending `CONFIGURE_TOTP`)
- [x] Setup endpoint arms `CONFIGURE_TOTP` (idempotent; an abandoned setup can be resumed) and rejects with 400 only when a real OTP credential exists
- [x] Disable endpoint removes credentials and clears the required action
- [x] `verify-identity` requires OTP when MFA is active
- [x] Enable/disable are audit-logged

**Frontend:**
- [x] Profile page toggle reflects live MFA status
- [x] Enabling opens the branded setup dialog with the CoopData logo
- [x] "Start setup" redirects through Keycloak with `kc_action=CONFIGURE_TOTP`
- [x] User returns to the profile page with MFA enabled after completing setup
- [x] Success/error toasts on enable and disable
- [x] TypeScript strict mode and lint pass
