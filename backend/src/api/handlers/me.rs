use axum::extract::Extension;
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use std::sync::Arc;

use crate::api::dto::member::{ChangePasswordRequest, ChangePasswordResponse, UserProfileResponse};
use crate::auth::claims::Claims;
use crate::error::AppResult;
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
                "Unable to verify current password for this account".to_string(),
            )
        })?;

    state
        .keycloak
        .verify_user_password(username, &body.current_password)
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
