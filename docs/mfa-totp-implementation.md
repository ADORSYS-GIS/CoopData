# MFA (TOTP Authenticator) — Full Stack Implementation

> **Feature**: Self-service Multi-Factor Authentication (TOTP)  \
> **Status**: Complete  \
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
| `get_user_mfa_enabled(user_id)` | True if the user has an OTP credential **or** a pending `CONFIGURE_TOTP` required action (covers accounts mid-setup) |
| `initiate_totp_setup(user_id)` | Adds the `CONFIGURE_TOTP` required action via `PUT /users/{id}` (idempotent). The user completes setup on Keycloak's TOTP screen at their next authentication |
| `disable_user_mfa(user_id)` | Deletes all OTP credentials and clears any pending `CONFIGURE_TOTP` required action |
| `verify_user_password(username, password, totp)` | Accepts an optional TOTP code (passed as the `totp` form param during password-grant verification) |

### 2. API DTOs — `backend/src/api/dto/member.rs`

| DTO | Fields |
|-----|--------|
| `SecuritySettingsResponse` | `mfa_enabled: bool` — true when an OTP credential exists or `CONFIGURE_TOTP` is pending |

### 3. Handlers — `backend/src/api/handlers/me.rs`

| Method | Endpoint | Handler | Behavior |
|--------|----------|---------|----------|
| `GET` | `/api/v1/me/security` | `get_security_settings` | Returns current MFA status |
| `POST` | `/api/v1/me/security/mfa/setup` | `mfa_setup` | Arms the `CONFIGURE_TOTP` required action (idempotent — a pending, uncompleted setup can be resumed). Rejects with 400 only when a real OTP credential already exists. Logs `MFA_ENABLED` audit event |
| `DELETE` | `/api/v1/me/security/mfa` | `disable_mfa` | Removes the credential and clears the required action immediately. Logs `MFA_DISABLED` audit event |

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
| `useDisableMfa()` | `DELETE /api/v1/me/security/mfa` | Mutation; updates cached status on success |

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
- Enabling opens `MfaSetupDialog`; disabling deletes the credential immediately.
- Disabled + spinner while requests are in flight; loading hint while the status query is pending.

### 4. Internationalization

MFA strings in `frontend/src/i18n/locales/{en,fr,pt,ss}.json`:

`mfa`, `mfaDesc`, `mfaEnabledToast`, `mfaDisabledToast`, `mfaSetupTitle`, `mfaSetupDesc`, `mfaStartSetup`, `mfaRedirectHint`, `mfaCancel`, `loadingSecurity`.

### 5. Tests

- `frontend/src/hooks/auth/useSecuritySettings.test.tsx` — status query, setup mutation (success + error), disable mutation.
- `backend/src/api/dto/member.rs` — DTO serialization/deserialization.

---

## Security Properties

- **Keycloak-enforced**: the OTP credential is created and stored by Keycloak itself through its supported flow — no custom credential writes.
- **Re-authentication required**: Keycloak forces a fresh sign-in before allowing credential setup.
- **Enforced at login**: the realm's bound `browser` flow → `forms` → `Browser - Conditional 2FA` (CONDITIONAL: `conditional-user-configured` REQUIRED + `auth-otp-form` ALTERNATIVE) — verified in `keycloak/realm-coopdata.json` — prompts users who have an OTP credential.
- **Idempotent setup**: setting the `CONFIGURE_TOTP` action twice is a no-op.
- **Audit trail**: `MFA_ENABLED` / `MFA_DISABLED` audit events with IP + user-agent (Keycloak additionally logs its own `SETUP_TOTP` event).
- **Enforced re-verification**: destructive-action identity checks require the OTP code when MFA is active.

---

## Technical Stack

### Backend
- **Axum** handlers + **utoipa** OpenAPI schemas
- **Keycloak Admin API** for credential lifecycle (`GET/DELETE /users/{id}/credentials`, `PUT /users/{id}` required actions)

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
