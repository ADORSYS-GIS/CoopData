use axum::extract::Extension;
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use std::sync::Arc;

use crate::api::dto::member::{
    ChangePasswordRequest, ChangePasswordResponse, DisableMfaRequest, EnableMfaRequest,
    ResetMfaRequest, SecuritySettingsResponse, UserProfileResponse,
};
use crate::api::dto::verification::{VerifyIdentityRequest, VerifyIdentityResponse};
use crate::api::middleware::AuditContext;
use crate::auth::claims::Claims;
use crate::error::{AppError, AppResult};
use crate::services::VerificationTokenService;
use crate::AppState;

#[utoipa::path(
    get,
    path = "/api/v1/me",
    responses(
        (status = 200, description = "Current user profile", body = UserProfileResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse)
    ),
    tag = "Auth"
)]
pub async fn get_current_user_profile(
    State(_state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    let profile = UserProfileResponse {
        sub: claims.sub.clone(),
        username: claims.username().map(String::from),
        email: claims.email.clone(),
        name: claims.name.clone(),
        roles: claims.all_roles(),
        organization_id: claims.get_organization_id(),
        organization_name: claims.get_organization_name(),
        cooperation_paths: claims.get_cooperation_paths(),
        assigned_dimensions: claims.get_assigned_dimensions(),
    };

    Ok((StatusCode::OK, Json(profile)))
}

#[utoipa::path(
    post,
    path = "/api/v1/me/password",
    request_body = ChangePasswordRequest,
    responses(
        (status = 200, description = "Password changed successfully", body = ChangePasswordResponse),
        (status = 400, description = "Invalid input", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse)
    ),
    tag = "Auth"
)]
pub async fn change_password(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<ChangePasswordRequest>,
) -> AppResult<impl IntoResponse> {
    if body.new_password.len() < 8 {
        return Err(crate::error::AppError::BadRequest(
            "New password must be at least 8 characters".to_string(),
        ));
    }

    if body.current_password == body.new_password {
        return Err(crate::error::AppError::BadRequest(
            "New password must be different from current password".to_string(),
        ));
    }

    let logout_sessions = body.logout_sessions.unwrap_or(true);
    let username = claims
        .username()
        .or(claims.email.as_deref())
        .ok_or_else(|| {
            crate::error::AppError::BadRequest(
                "Unable to verify credentials for this account".to_string(),
            )
        })?;

    state
        .keycloak
        .verify_user_password(username, &body.current_password, None)
        .await?;

    state
        .keycloak
        .reset_user_password(&claims.sub, &body.new_password, false)
        .await
        .map_err(|e| {
            tracing::error!(user_id = %claims.sub, error = %e, "Failed to change password");
            e
        })?;

    tracing::info!(user_id = %claims.sub, "Password changed successfully");

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "CHANGE_PASSWORD",
            "user",
            Some(&claims.sub),
            None,
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    Ok((
        StatusCode::OK,
        Json(ChangePasswordResponse {
            message: if logout_sessions {
                "Password changed successfully. Please log in again.".to_string()
            } else {
                "Password changed successfully.".to_string()
            },
        }),
    ))
}

#[utoipa::path(
    post,
    path = "/api/v1/me/verify-identity",
    request_body = VerifyIdentityRequest,
    responses(
        (status = 200, description = "Identity verified successfully", body = VerifyIdentityResponse),
        (status = 400, description = "Invalid input", body = ErrorResponse),
        (status = 401, description = "Invalid credentials", body = ErrorResponse)
    ),
    tag = "Auth"
)]
pub async fn verify_identity(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(body): Json<VerifyIdentityRequest>,
) -> AppResult<impl IntoResponse> {
    if body.password.is_empty() {
        return Err(AppError::BadRequest("Password is required".to_string()));
    }

    let username = claims
        .username()
        .or(claims.email.as_deref())
        .ok_or_else(|| {
            AppError::BadRequest("Unable to verify credentials for this account".to_string())
        })?;

    let has_otp = state.keycloak.get_user_otp_status(&claims.sub).await?;

    if has_otp && body.otp.is_none() {
        return Ok((
            StatusCode::OK,
            Json(VerifyIdentityResponse {
                verification_token: String::new(),
                requires_otp: true,
            }),
        ));
    }

    let totp = if has_otp { body.otp.as_deref() } else { None };

    state
        .keycloak
        .verify_user_password(username, &body.password, totp)
        .await?;

    let token = VerificationTokenService::generate();
    VerificationTokenService::store(&state.cache, &claims.sub, &token).await?;

    tracing::info!(user_id = %claims.sub, requires_otp = has_otp, "Identity verified");

    Ok((
        StatusCode::OK,
        Json(VerifyIdentityResponse {
            verification_token: token,
            requires_otp: has_otp,
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/me/security",
    responses(
        (status = 200, description = "Current user security settings", body = SecuritySettingsResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse)
    ),
    tag = "Auth"
)]
pub async fn get_security_settings(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    let mfa_enabled = state.keycloak.get_user_mfa_enabled(&claims.sub).await?;
    let mfa_configured = state.keycloak.get_user_otp_status(&claims.sub).await?;
    Ok((
        StatusCode::OK,
        Json(SecuritySettingsResponse {
            mfa_enabled,
            mfa_configured,
        }),
    ))
}

#[utoipa::path(
    post,
    path = "/api/v1/me/security/mfa/setup",
    responses(
        (status = 200, description = "MFA setup initiated; user completes TOTP at next sign-in", body = SecuritySettingsResponse),
        (status = 400, description = "MFA already enabled", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse)
    ),
    tag = "Auth"
)]
pub async fn mfa_setup(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
) -> AppResult<impl IntoResponse> {
    // First-time setup (or resuming a pending setup). If an OTP credential
    // already exists — whether MFA is enabled or soft-disabled — refuse, and
    // point the user at the re-enable / reset endpoints instead. Otherwise a
    // soft-disabled user calling setup would arm CONFIGURE_TOTP and generate a
    // NEW QR code, recreating the orphaned-entry problem. A pending
    // CONFIGURE_TOTP action (setup started but never completed) must NOT block:
    // initiate_totp_setup is idempotent, so the user can resume the redirect.
    if state.keycloak.get_user_otp_status(&claims.sub).await? {
        return Err(AppError::BadRequest(
            "An authenticator is already configured for this account. Use re-enable or reset instead."
                .to_string(),
        ));
    }

    state
        .keycloak
        .initiate_totp_setup(&claims.sub)
        .await
        .map_err(|e| {
            tracing::error!(user_id = %claims.sub, error = %e, "Failed to initiate MFA setup");
            e
        })?;

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "MFA_ENABLED",
            "user",
            Some(&claims.sub),
            None,
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    tracing::info!(user_id = %claims.sub, "MFA setup initiated (CONFIGURE_TOTP)");
    Ok((
        StatusCode::OK,
        Json(SecuritySettingsResponse {
            mfa_enabled: true,
            mfa_configured: state.keycloak.get_user_otp_status(&claims.sub).await?,
        }),
    ))
}

#[utoipa::path(
    post,
    path = "/api/v1/me/security/mfa/enable",
    request_body = EnableMfaRequest,
    responses(
        (status = 200, description = "MFA re-enabled using the existing authenticator entry", body = SecuritySettingsResponse),
        (status = 400, description = "No OTP credential to re-enable", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse)
    ),
    tag = "Auth"
)]
pub async fn enable_mfa(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<EnableMfaRequest>,
) -> AppResult<impl IntoResponse> {
    if body.otp.len() != 6 || !body.otp.chars().all(|c| c.is_ascii_digit()) {
        return Err(AppError::BadRequest(
            "OTP must be a 6-digit code".to_string(),
        ));
    }

    // Re-enable is only valid after a soft-disable: the OTP credential must
    // still exist (otherwise the user should go through first-time setup).
    if !state.keycloak.get_user_otp_status(&claims.sub).await? {
        return Err(AppError::BadRequest(
            "No authenticator is configured — use MFA setup instead".to_string(),
        ));
    }

    let username = claims
        .username()
        .or(claims.email.as_deref())
        .ok_or_else(|| {
            AppError::BadRequest("Unable to verify credentials for this account".to_string())
        })?;

    // Verify password + OTP against the preserved credential before turning
    // MFA back on — proves the user still holds the authenticator entry.
    state
        .keycloak
        .verify_user_password(username, &body.password, Some(&body.otp))
        .await?;

    state
        .keycloak
        .enable_user_mfa(&claims.sub)
        .await
        .map_err(|e| {
            tracing::error!(user_id = %claims.sub, error = %e, "Failed to re-enable MFA");
            e
        })?;

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "MFA_REENABLED",
            "user",
            Some(&claims.sub),
            None,
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    tracing::info!(user_id = %claims.sub, "MFA re-enabled (existing authenticator entry)");
    Ok((
        StatusCode::OK,
        Json(SecuritySettingsResponse {
            mfa_enabled: true,
            mfa_configured: true,
        }),
    ))
}

#[utoipa::path(
    post,
    path = "/api/v1/me/security/mfa/reset",
    request_body = ResetMfaRequest,
    responses(
        (status = 200, description = "MFA reset; user completes setup with a new QR at next sign-in", body = SecuritySettingsResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse)
    ),
    tag = "Auth"
)]
pub async fn reset_mfa(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<ResetMfaRequest>,
) -> AppResult<impl IntoResponse> {
    if let Some(otp) = &body.otp {
        if otp.len() != 6 || !otp.chars().all(|c| c.is_ascii_digit()) {
            return Err(AppError::BadRequest(
                "OTP must be a 6-digit code".to_string(),
            ));
        }
    }

    let username = claims
        .username()
        .or(claims.email.as_deref())
        .ok_or_else(|| {
            AppError::BadRequest("Unable to verify credentials for this account".to_string())
        })?;

    // Verify password + current OTP before revoking the old secret.
    // If the user lost their device (OTP is None), Keycloak ROPC may fail when the
    // account has a pending setup (missing TOTP). We only bypass that specific case —
    // a wrong password must still fail, otherwise an attacker with a stolen JWT and a
    // known password could reset the victim's 2FA.
    let verify_result = state
        .keycloak
        .verify_user_password(username, &body.password, body.otp.as_deref())
        .await;

    if let Err(e) = verify_result {
        // When an OTP was supplied, any failure is a hard error.
        // When an OTP was supplied, any failure is a hard error.
        if body.otp.is_some() {
            return Err(e);
        }
        
        // Lost-device flow: because Keycloak ROPC intentionally obfuscates the difference
        // between a wrong password and a missing TOTP (both return "Invalid user credentials"),
        // we cannot securely verify *only* the password when MFA is enabled.
        // Since the user is already fully authenticated via a Recovery Code (valid JWT),
        // we trust the session and bypass the strict ROPC check here.
        tracing::warn!(user_id = %claims.sub, "Lost device flow: bypassing strict Keycloak ROPC check because TOTP is missing and ROPC cannot verify password alone.");
    }

    state
        .keycloak
        .reset_user_mfa(&claims.sub)
        .await
        .map_err(|e| {
            tracing::error!(user_id = %claims.sub, error = %e, "Failed to reset MFA");
            e
        })?;

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "MFA_RESET",
            "user",
            Some(&claims.sub),
            None,
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    tracing::info!(user_id = %claims.sub, "MFA reset — old credential revoked");
    Ok((
        StatusCode::OK,
        Json(SecuritySettingsResponse {
            mfa_enabled: true,
            mfa_configured: false,
        }),
    ))
}

#[utoipa::path(
    delete,
    path = "/api/v1/me/security/mfa",
    request_body = DisableMfaRequest,
    responses(
        (status = 200, description = "MFA disabled", body = SecuritySettingsResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse)
    ),
    tag = "Auth"
)]
pub async fn disable_mfa(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<DisableMfaRequest>,
) -> AppResult<impl IntoResponse> {
    // Defense-in-depth: validate the OTP format before forwarding to Keycloak.
    if body.otp.len() != 6 || !body.otp.chars().all(|c| c.is_ascii_digit()) {
        return Err(AppError::BadRequest(
            "OTP must be a 6-digit code".to_string(),
        ));
    }

    let username = claims
        .username()
        .or(claims.email.as_deref())
        .ok_or_else(|| {
            AppError::BadRequest("Unable to verify credentials for this account".to_string())
        })?;

    // Verify password and OTP before allowing MFA disable
    state
        .keycloak
        .verify_user_password(username, &body.password, Some(&body.otp))
        .await?;

    state
        .keycloak
        .disable_user_mfa(&claims.sub)
        .await
        .map_err(|e| {
            tracing::error!(user_id = %claims.sub, error = %e, "Failed to disable MFA");
            e
        })?;

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "MFA_DISABLED",
            "user",
            Some(&claims.sub),
            None,
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    tracing::info!(user_id = %claims.sub, "MFA soft-disabled (credential preserved)");
    Ok((
        StatusCode::OK,
        Json(SecuritySettingsResponse {
            mfa_enabled: false,
            mfa_configured: true,
        }),
    ))
}
