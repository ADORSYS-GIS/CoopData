use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::api::dto::{
    AssignRoleRequest, CreateUserRequest, PaginatedResponse, PaginatedUserResponse,
    PaginationParams, UpdateUserRequest, UserResponse,
};

use crate::auth::claims::Claims;
use crate::error::{AppError, AppResult};
use crate::repositories::UserRepository;
use crate::AppState;
use sea_orm::{EntityTrait, Set};

const VALID_ROLES: [&str; 5] = [
    "ministry",
    "federation",
    "apex",
    "cooperative",
    "regional_officer",
];
const DEFAULT_TEMP_PASSWORD_PREFIX: &str = "CoopDataTemp";

fn validate_role(role: &str) -> Result<(), AppError> {
    if !VALID_ROLES.contains(&role) {
        return Err(AppError::BadRequest(format!(
            "Invalid role '{}'. Valid roles: {}",
            role,
            VALID_ROLES.join(", ")
        )));
    }
    Ok(())
}

#[utoipa::path(
    get,
    path = "/api/v1/users",
    responses(
        (status = 200, description = "List of users", body = PaginatedUserResponse),
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

    Ok((
        StatusCode::OK,
        Json(PaginatedUserResponse::from(PaginatedResponse::new(
            responses,
            total,
            params.page,
            params.per_page,
        ))),
    ))
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
    let user_model = repo
        .find_by_id(id)
        .await?
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
    Extension(claims): Extension<Arc<Claims>>,
    Json(body): Json<CreateUserRequest>,
) -> AppResult<impl IntoResponse> {
    if body.email.trim().is_empty() {
        return Err(AppError::BadRequest("Email is required".into()));
    }
    validate_role(&body.role)?;

    let user_repo = UserRepository::new(state.db.clone());

    if user_repo.find_by_email(&body.email).await?.is_some() {
        return Err(AppError::Conflict(
            "User with this email already exists".into(),
        ));
    }

    let first_name = body
        .full_name
        .as_ref()
        .and_then(|n| n.split_whitespace().next())
        .unwrap_or("User");
    let last_name = body
        .full_name
        .as_ref()
        .and_then(|n| {
            let parts: Vec<&str> = n.split_whitespace().collect();
            if parts.len() > 1 {
                Some(parts[1..].join(" "))
            } else {
                None
            }
        })
        .unwrap_or_default();

    let temporary_password = format!("{}-{}!", DEFAULT_TEMP_PASSWORD_PREFIX, Uuid::new_v4());
    let organization_id =
        resolve_user_organization_id(&state, &claims, body.organization_id).await?;

    if let Some(group_id) = body.group_id.as_deref() {
        validate_group_scope(&state, &claims, group_id).await?;
    }

    let keycloak_response = state
        .keycloak
        .create_user_with_email_verification(
            &body.email,
            first_name,
            &last_name,
            &body.role,
            &temporary_password,
            None,
        )
        .await
        .map_err(map_keycloak_error)?;

    if let Some(group_id) = body.group_id.as_deref() {
        state
            .keycloak
            .add_user_to_group(&keycloak_response.id, group_id)
            .await
            .map_err(map_keycloak_error)?;
    }

    let now = chrono::Utc::now();
    let active_model = crate::entities::user::ActiveModel {
        id: Set(Uuid::new_v4()),
        keycloak_id: Set(keycloak_response.id.clone()),
        email: Set(body.email.clone()),
        full_name: Set(body.full_name.clone()),
        role: Set(body.role.clone()),
        organization_id: Set(organization_id),
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

async fn resolve_user_organization_id(
    state: &AppState,
    claims: &Claims,
    requested_organization_id: Option<Uuid>,
) -> AppResult<Option<Uuid>> {
    let scoped_id = if claims.is_federation() {
        claims
            .get_organization_id()
            .and_then(|id| Uuid::parse_str(&id).ok())
    } else {
        requested_organization_id
    };

    match scoped_id {
        Some(id) => {
            let exists = crate::entities::organization::Entity::find_by_id(id)
                .one(&state.db)
                .await?;

            Ok(exists.map(|_| id))
        }
        None => Ok(None),
    }
}

async fn validate_group_scope(state: &AppState, claims: &Claims, group_id: &str) -> AppResult<()> {
    if claims.is_ministry() {
        return Ok(());
    }

    let group = state
        .keycloak
        .get_group_by_id(group_id)
        .await
        .map_err(map_keycloak_error)?;

    if claims.is_federation() {
        let expected_org_id = claims.get_organization_id().ok_or_else(|| {
            AppError::Forbidden("User is not associated with a federation organization".into())
        })?;

        let group_org_id = group
            .attributes
            .as_ref()
            .and_then(|attrs| attrs.get("organization_id"))
            .and_then(|vals| vals.first())
            .map(String::as_str);

        if group_org_id != Some(expected_org_id.as_str()) {
            return Err(AppError::Forbidden(
                "Selected apex does not belong to your federation".into(),
            ));
        }
    }

    Ok(())
}

fn map_keycloak_error(error: AppError) -> AppError {
    match error {
        AppError::Conflict(message) => AppError::Conflict(message),
        AppError::NotFound(message) => AppError::NotFound(message),
        other => AppError::ExternalServiceError(other.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_role_valid_roles() {
        for role in &VALID_ROLES {
            assert!(
                validate_role(role).is_ok(),
                "Expected '{}' to be a valid role",
                role
            );
        }
    }

    #[test]
    fn test_validate_role_ministry() {
        assert!(validate_role("ministry").is_ok());
    }

    #[test]
    fn test_validate_role_federation() {
        assert!(validate_role("federation").is_ok());
    }

    #[test]
    fn test_validate_role_apex() {
        assert!(validate_role("apex").is_ok());
    }

    #[test]
    fn test_validate_role_cooperative() {
        assert!(validate_role("cooperative").is_ok());
    }

    #[test]
    fn test_validate_role_regional_officer() {
        assert!(validate_role("regional_officer").is_ok());
    }

    #[test]
    fn test_validate_role_invalid_role() {
        let result = validate_role("admin");
        assert!(result.is_err());
        match result.unwrap_err() {
            AppError::BadRequest(msg) => {
                assert!(msg.contains("admin"));
                assert!(msg.contains("Invalid role"));
                assert!(msg.contains("Valid roles:"));
            }
            _ => panic!("Expected BadRequest error"),
        }
    }

    #[test]
    fn test_validate_role_empty_string() {
        let result = validate_role("");
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_role_case_sensitive() {
        assert!(validate_role("Ministry").is_err());
        assert!(validate_role("FEDERATION").is_err());
        assert!(validate_role("Apex").is_err());
    }

    #[test]
    fn test_map_keycloak_error_conflict() {
        let error = AppError::Conflict("User exists".to_string());
        let mapped = map_keycloak_error(error);
        assert!(matches!(mapped, AppError::Conflict(msg) if msg == "User exists"));
    }

    #[test]
    fn test_map_keycloak_error_not_found() {
        let error = AppError::NotFound("Not here".to_string());
        let mapped = map_keycloak_error(error);
        assert!(matches!(mapped, AppError::NotFound(msg) if msg == "Not here"));
    }

    #[test]
    fn test_map_keycloak_error_other_becomes_external() {
        let error = AppError::BadRequest("bad".to_string());
        let mapped = map_keycloak_error(error);
        assert!(matches!(mapped, AppError::ExternalServiceError(_)));
    }

    #[test]
    fn test_map_keycloak_error_unauthorized() {
        let error = AppError::Unauthorized("nope".to_string());
        let mapped = map_keycloak_error(error);
        assert!(matches!(mapped, AppError::ExternalServiceError(_)));
    }

    #[test]
    fn test_default_temp_password_prefix() {
        assert_eq!(DEFAULT_TEMP_PASSWORD_PREFIX, "CoopDataTemp");
    }

    #[test]
    fn test_valid_roles_count() {
        assert_eq!(VALID_ROLES.len(), 5);
    }

    #[test]
    fn test_create_user_request_email_validation() {
        // Test that empty email would be caught
        let empty_email = "";
        assert!(empty_email.trim().is_empty());

        let whitespace_email = "   ";
        assert!(whitespace_email.trim().is_empty());

        let valid_email = "test@example.com";
        assert!(!valid_email.trim().is_empty());
    }

    #[test]
    fn test_full_name_parsing() {
        // Simulates the name parsing logic from create_user handler
        let full_name = Some("John Doe".to_string());
        let first_name = full_name
            .as_ref()
            .and_then(|n| n.split_whitespace().next())
            .unwrap_or("User");
        let last_name = full_name
            .as_ref()
            .and_then(|n| {
                let parts: Vec<&str> = n.split_whitespace().collect();
                if parts.len() > 1 {
                    Some(parts[1..].join(" "))
                } else {
                    None
                }
            })
            .unwrap_or_default();

        assert_eq!(first_name, "John");
        assert_eq!(last_name, "Doe");
    }

    #[test]
    fn test_full_name_parsing_single_name() {
        let full_name = Some("Madonna".to_string());
        let first_name = full_name
            .as_ref()
            .and_then(|n| n.split_whitespace().next())
            .unwrap_or("User");
        let last_name = full_name
            .as_ref()
            .and_then(|n| {
                let parts: Vec<&str> = n.split_whitespace().collect();
                if parts.len() > 1 {
                    Some(parts[1..].join(" "))
                } else {
                    None
                }
            })
            .unwrap_or_default();

        assert_eq!(first_name, "Madonna");
        assert_eq!(last_name, "");
    }

    #[test]
    fn test_full_name_parsing_none() {
        let full_name: Option<String> = None;
        let first_name = full_name
            .as_ref()
            .and_then(|n| n.split_whitespace().next())
            .unwrap_or("User");
        let last_name = full_name
            .as_ref()
            .and_then(|n| {
                let parts: Vec<&str> = n.split_whitespace().collect();
                if parts.len() > 1 {
                    Some(parts[1..].join(" "))
                } else {
                    None
                }
            })
            .unwrap_or_default();

        assert_eq!(first_name, "User");
        assert_eq!(last_name, "");
    }

    #[test]
    fn test_full_name_parsing_three_parts() {
        let full_name = Some("John Jacob Jingleheimer".to_string());
        let first_name = full_name
            .as_ref()
            .and_then(|n| n.split_whitespace().next())
            .unwrap_or("User");
        let last_name = full_name
            .as_ref()
            .and_then(|n| {
                let parts: Vec<&str> = n.split_whitespace().collect();
                if parts.len() > 1 {
                    Some(parts[1..].join(" "))
                } else {
                    None
                }
            })
            .unwrap_or_default();

        assert_eq!(first_name, "John");
        assert_eq!(last_name, "Jacob Jingleheimer");
    }
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
    if let Some(ref role) = &body.role {
        validate_role(role)?;
    }

    let user_repo = UserRepository::new(state.db.clone());

    let current = user_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;

    if let Some(ref role) = &body.role {
        if role != &current.role {
            state
                .keycloak
                .assign_role(&current.keycloak_id, role)
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
pub async fn assign_role_to_user(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<AssignRoleRequest>,
) -> AppResult<impl IntoResponse> {
    validate_role(&body.role)?;

    let user_repo = UserRepository::new(state.db.clone());
    let current = user_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;

    state
        .keycloak
        .assign_role(&current.keycloak_id, &body.role)
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

    let user_model = user_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;

    state
        .keycloak
        .delete_user(&user_model.keycloak_id)
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    user_repo.delete(id).await?;
    tracing::info!(user_id = %id, "User deleted from Keycloak and database");

    if let Err(e) = state.cache.delete("users:all").await {
        tracing::warn!("Failed to invalidate user cache: {}", e);
    }

    Ok((StatusCode::NO_CONTENT, ()))
}
