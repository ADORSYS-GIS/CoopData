use axum::extract::Extension;
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use std::sync::Arc;

use crate::api::dto::member::{
    ChangePasswordRequest, ChangePasswordResponse, MfaSetupResponse, MfaVerifyRequest,
    SecuritySettingsResponse, UserProfileResponse,
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
    Ok((
        StatusCode::OK,
        Json(SecuritySettingsResponse { mfa_enabled }),
    ))
}

#[utoipa::path(
    post,
    path = "/api/v1/me/security/mfa/setup",
    responses(
        (status = 200, description = "TOTP setup payload generated", body = MfaSetupResponse),
        (status = 400, description = "MFA already enabled", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse)
    ),
    tag = "Auth"
)]
pub async fn mfa_setup(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    if state.keycloak.get_user_mfa_enabled(&claims.sub).await? {
        return Err(AppError::BadRequest(
            "MFA is already enabled for this account".to_string(),
        ));
    }

    let account_name = claims
        .email
        .clone()
        .or_else(|| claims.username().map(String::from))
        .unwrap_or_else(|| claims.sub.clone());
    let (secret, otpauth_uri) = crate::services::totp::generate_setup(&account_name)?;

    tracing::info!(user_id = %claims.sub, "MFA setup payload generated");
    Ok((
        StatusCode::OK,
        Json(MfaSetupResponse {
            secret,
            otpauth_uri,
        }),
    ))
}

#[utoipa::path(
    post,
    path = "/api/v1/me/security/mfa/verify",
    request_body = MfaVerifyRequest,
    responses(
        (status = 200, description = "MFA enabled after successful verification", body = SecuritySettingsResponse),
        (status = 400, description = "Invalid code or input", body = ErrorResponse),
        (status = 401, description = "Unauthorized", body = ErrorResponse)
    ),
    tag = "Auth"
)]
pub async fn mfa_verify(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<MfaVerifyRequest>,
) -> AppResult<impl IntoResponse> {
    if body.code.len() != 6 || !body.code.chars().all(|c| c.is_ascii_digit()) {
        return Err(AppError::BadRequest(
            "Verification code must be 6 digits".to_string(),
        ));
    }

    // Idempotency guard: a double-submit or retry after a successful enable must
    // not create a duplicate OTP credential.
    if state.keycloak.get_user_mfa_enabled(&claims.sub).await? {
        return Ok((
            StatusCode::OK,
            Json(SecuritySettingsResponse { mfa_enabled: true }),
        ));
    }

    if !crate::services::totp::verify_code(&body.secret, &body.code) {
        return Err(AppError::BadRequest(
            "The code does not match this authenticator app setup. \
             Check the time on your device and try again."
                .to_string(),
        ));
    }

    state
        .keycloak
        .create_otp_credential(&claims.sub, &body.secret)
        .await
        .map_err(|e| {
            tracing::error!(user_id = %claims.sub, error = %e, "Failed to create OTP credential");
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

    tracing::info!(user_id = %claims.sub, "MFA enabled after verification");
    Ok((
        StatusCode::OK,
        Json(SecuritySettingsResponse { mfa_enabled: true }),
    ))
}

#[utoipa::path(
    delete,
    path = "/api/v1/me/security/mfa",
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
) -> AppResult<impl IntoResponse> {
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

    tracing::info!(user_id = %claims.sub, "MFA disabled");
    Ok((
        StatusCode::OK,
        Json(SecuritySettingsResponse { mfa_enabled: false }),
    ))
}
