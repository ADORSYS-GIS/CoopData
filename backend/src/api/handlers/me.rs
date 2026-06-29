use std::sync::Arc;
use axum::{extract::State, http::StatusCode, response::IntoResponse, Json};
use axum::extract::Extension;

use crate::api::dto::member::UserProfileResponse;
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