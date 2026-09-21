# Keycloak Conditional MFA Troubleshooting & Configuration

This document summarizes the debugging process and the correct configuration required to enable Conditional Two-Factor Authentication (MFA) in Keycloak.

## The Problem
Users who successfully completed the MFA setup process (saved an OTP credential and had the `mfa_enabled` attribute set to `true`) were not being prompted for their OTP passcode upon subsequent logins.

## The Investigation
We first verified that the backend API was working perfectly: the OTP credential was successfully created in Keycloak, and the `mfa_enabled` attribute was correctly set to `true` on the user profile. This isolated the issue entirely to the **Keycloak Authentication Flow** (specifically the `browser` flow).

## The Root Causes & Fixes

During the debugging process, we uncovered and resolved three specific misconfigurations in the Keycloak Admin UI:

### 1. The Conditional Flow and Child Fields were Disabled or Incorrect
* **Issue:** The `CoopData Conditional 2FA` sub-flow was set to `Disabled`, meaning Keycloak completely ignored the MFA checks regardless of user attributes. Furthermore, the individual steps inside this flow (like the `OTP Form` and conditions) were also left disabled or set to the wrong requirement type.
* **Fix:** 
  * Changed the parent sub-flow requirement from `Disabled` to `Conditional`.
  * Ensured the condition checks were set to `Required`.
  * Ensured the `OTP Form` and `Recovery Authentication Code Form` were set to `Alternative` so the user only has to pass one of them.

### 2. Missing Condition Configuration (400 Bad Request)
* **Issue:** When the flow was set to `Conditional`, Keycloak crashed with a `400 Bad Request` during login. This happened because the condition executions were added to the flow but lacked the internal configuration needed to evaluate them (Keycloak had no idea *what* attribute to check).
* **Fix:** 
  * Clicked the gear icon (⚙️) on `Condition - user attribute` and explicitly set **Attribute name** to `mfa_enabled` and **Expected attribute value** to `true`.
  * Clicked the gear icon on `Condition - user configured` and provided the required **Alias** field so Keycloak would stop marking it as unconfigured.

### 3. Early Flow Exit (The "Alternative" Trap)
* **Issue:** Even with the conditions set, Keycloak bypassed the MFA screen. This was because the `Username Password Form` was set to `Alternative`. Keycloak interpreted this as: *"The user completed an alternative step, so they satisfy this entire block. No need to evaluate the 2FA conditions below it!"*
* **Fix (Working around the UI Bug):** Keycloak's UI often hides the requirement dropdown for child steps. To fix this, we:
  1. Kept the parent block (`CoopData Forms`) set to `Alternative` (to allow SSO Cookies to work).
  2. Deleted the stuck `Username Password Form`.
  3. Re-added `Username Password Form`, which restored the dropdown.
  4. Set it to `Required`, forcing Keycloak to evaluate the Conditional 2FA block immediately after password entry.

## The Final (Correct) Flow Structure

To ensure that regular logins force an MFA check (if enabled), but Silent SSO (Cookies) still work, the `browser` flow must strictly follow this structure:

```text
- Cookie (Alternative)
- Identity Provider Redirector (Alternative)
- CoopData Forms (Alternative)
    |
    |-- Username Password Form (Required)
    |
    |-- CoopData Conditional 2FA (Conditional)
        |
        |-- Condition - user attribute [mfa_enabled=true] (Required)
        |-- Condition - user configured (Required)
        |-- OTP Form (Alternative)
        |-- Recovery Authentication Code Form (Alternative)
```

