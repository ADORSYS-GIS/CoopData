use axum::{extract::{Path, Query, State}, http::StatusCode, response::IntoResponse, Json};
use uuid::Uuid;

use crate::api::dto::{CreateUserRequest, UpdateUserRequest, UserResponse, AssignRoleRequest, PaginationParams, PaginatedResponse};
use crate::error::{AppError, AppResult};
use crate::repositories::UserRepository;
use crate::AppState;
use sea_orm::Set;

const VALID_ROLES: [&str; 4] = ["ministry", "federation", "cooperative", "regional_officer"];

fn validate_role(role: &str) -> Result<(), AppError> {
    if !VALID_ROLES.contains(&role) {
        return Err(AppError::BadRequest(
            format!("Invalid role '{}'. Valid roles: {}", role, VALID_ROLES.join(", "))
        ));
    }
    Ok(())
}

#[utoipa::path(
    get,
    path = "/api/v1/users",
    responses(
        (status = 200, description = "List of users", body = PaginatedResponse<UserResponse>),
        (status = 500, description = "Internal server error", body = ErrorResponse)
    ),
    tag = "Users"
)]
pub async fn list_users(
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> AppResult<impl IntoResponse> {
    let repo = UserRepository::new(state.db.clone());
    let users = repo.find_all().await?;

    let responses: Vec<UserResponse> = users.into_iter().map(Into::into).collect();
    let total = responses.len() as u64;

    Ok((StatusCode::OK, Json(PaginatedResponse::new(responses, total, params.page, params.per_page))))
}

#[utoipa::path(
    get,
    path = "/api/v1/users/{id}",
    params(
        ("id" = Uuid, Path, description = "User ID")
    ),
    responses(
        (status = 200, description = "User found", body = UserResponse),
        (status = 404, description = "User not found", body = ErrorResponse)
    ),
    tag = "Users"
)]
pub async fn get_user(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let repo = UserRepository::new(state.db.clone());
    let user_model = repo.find_by_id(id).await?
        .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;

    Ok((StatusCode::OK, Json(UserResponse::from(user_model))))
}

#[utoipa::path(
    post,
    path = "/api/v1/users",
    request_body = CreateUserRequest,
    responses(
        (status = 201, description = "User created in Keycloak and database", body = UserResponse),
        (status = 400, description = "Invalid input", body = ErrorResponse),
        (status = 409, description = "User already exists", body = ErrorResponse),
        (status = 502, description = "Keycloak error", body = ErrorResponse)
    ),
    tag = "Users"
)]
pub async fn create_user(
    State(state): State<AppState>,
    Json(body): Json<CreateUserRequest>,
) -> AppResult<impl IntoResponse> {
    if body.email.trim().is_empty() {
        return Err(AppError::BadRequest("Email is required".into()));
    }
    validate_role(&body.role)?;

    let user_repo = UserRepository::new(state.db.clone());

    if user_repo.find_by_email(&body.email).await?.is_some() {
        return Err(AppError::Conflict("User with this email already exists".into()));
    }

    let first_name = body.full_name.as_ref()
        .and_then(|n| n.split_whitespace().next())
        .unwrap_or("User");
    let last_name = body.full_name.as_ref()
        .and_then(|n| {
            let parts: Vec<&str> = n.split_whitespace().collect();
            if parts.len() > 1 { Some(parts[1..].join(" ")) } else { None }
        })
        .unwrap_or_default();

    let keycloak_response = state.keycloak.create_user(
        &body.email,
        &body.email,
        &body.temporary_password,
        &body.role,
        first_name,
        &last_name,
    ).await.map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    let now = chrono::Utc::now();
    let active_model = crate::entities::user::ActiveModel {
        id: Set(Uuid::new_v4()),
        keycloak_id: Set(keycloak_response.id.clone()),
        email: Set(body.email.clone()),
        full_name: Set(body.full_name.clone()),
        role: Set(body.role.clone()),
        organization_id: Set(body.organization_id),
        region: Set(body.region.clone()),
        is_active: Set(true),
        last_login_at: Set(None),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let user_model = user_repo.create(active_model).await?;
    tracing::info!(user_id = %user_model.id, keycloak_id = %keycloak_response.id, "User created in Keycloak and database");

    if let Err(e) = state.cache.delete("users:all").await {
        tracing::warn!("Failed to invalidate user cache: {}", e);
    }

    Ok((StatusCode::CREATED, Json(UserResponse::from(user_model))))
}

#[utoipa::path(
    patch,
    path = "/api/v1/users/{id}",
    params(
        ("id" = Uuid, Path, description = "User ID")
    ),
    request_body = UpdateUserRequest,
    responses(
        (status = 200, description = "User updated", body = UserResponse),
        (status = 404, description = "User not found", body = ErrorResponse)
    ),
    tag = "Users"
)]
pub async fn update_user(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateUserRequest>,
) -> AppResult<impl IntoResponse> {
    if let Some(ref role) = body.role {
        validate_role(role)?;
    }

    let user_repo = UserRepository::new(state.db.clone());

    let current = user_repo.find_by_id(id).await?
        .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;

    if let Some(ref role) = body.role {
        if role != &current.role {
            state.keycloak.assign_role(&current.keycloak_id, role)
                .await
                .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;
            tracing::info!(user_id = %id, role = %role, "Role updated in Keycloak");
        }
    }

    let updated = user_repo.update(id, body).await?;
    tracing::info!(user_id = %id, "User updated");

    if let Err(e) = state.cache.delete("users:all").await {
        tracing::warn!("Failed to invalidate user cache: {}", e);
    }

    Ok((StatusCode::OK, Json(UserResponse::from(updated))))
}

#[utoipa::path(
    post,
    path = "/api/v1/users/{id}/assign-role",
    params(
        ("id" = Uuid, Path, description = "User ID")
    ),
    request_body = AssignRoleRequest,
    responses(
        (status = 200, description = "Role assigned successfully", body = UserResponse),
        (status = 400, description = "Invalid role", body = ErrorResponse),
        (status = 404, description = "User not found", body = ErrorResponse),
        (status = 502, description = "Keycloak error", body = ErrorResponse)
    ),
    tag = "Users"
)]
pub async fn assign_role(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<AssignRoleRequest>,
) -> AppResult<impl IntoResponse> {
    validate_role(&body.role)?;

    let user_repo = UserRepository::new(state.db.clone());
    let current = user_repo.find_by_id(id).await?
        .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;

    state.keycloak.assign_role(&current.keycloak_id, &body.role)
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    let role_str = body.role.clone();
    let updated = user_repo.update_role(id, body.role).await?;
    tracing::info!(user_id = %id, role = %role_str, "Role assigned via Keycloak");

    Ok((StatusCode::OK, Json(UserResponse::from(updated))))
}

#[utoipa::path(
    delete,
    path = "/api/v1/users/{id}",
    params(
        ("id" = Uuid, Path, description = "User ID")
    ),
    responses(
        (status = 204, description = "User deleted"),
        (status = 404, description = "User not found", body = ErrorResponse)
    ),
    tag = "Users"
)]
pub async fn delete_user(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let user_repo = UserRepository::new(state.db.clone());

    let user_model = user_repo.find_by_id(id).await?
        .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;

    state.keycloak.delete_user(&user_model.keycloak_id)
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    user_repo.delete(id).await?;
    tracing::info!(user_id = %id, "User deleted from Keycloak and database");

    if let Err(e) = state.cache.delete("users:all").await {
        tracing::warn!("Failed to invalidate user cache: {}", e);
    }

    Ok((StatusCode::NO_CONTENT, ()))
}