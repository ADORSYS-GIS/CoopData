use std::sync::Arc;
use std::collections::HashMap;
use axum::{extract::{Path, State}, http::StatusCode, response::IntoResponse, Json};
use axum::extract::Extension;

use crate::api::dto::cooperative::{CreateCooperativeRequest, CooperativeResponse, UpdateCooperativeRequest};
use crate::api::dto::member::{AddMemberRequest, MemberResponse};
use crate::auth::claims::Claims;
use crate::error::AppResult;
use crate::AppState;

#[utoipa::path(
    post,
    path = "/api/v1/apex/cooperatives",
    request_body = CreateCooperativeRequest,
    responses(
        (status = 201, description = "Cooperative created", body = CooperativeResponse),
        (status = 400, description = "Invalid input", body = ErrorResponse),
        (status = 403, description = "Forbidden - apex role required", body = ErrorResponse)
    ),
    tag = "Apex"
)]
pub async fn create_cooperative(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(body): Json<CreateCooperativeRequest>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_apex() {
        return Err(crate::error::AppError::Forbidden("Access denied. Apex role required".into()));
    }

    if body.name.trim().is_empty() {
        return Err(crate::error::AppError::BadRequest("Cooperative name is required".into()));
    }

    let apex_group_id = claims.get_apex_group_id()
        .ok_or_else(|| crate::error::AppError::Forbidden("User is not associated with an apex group".into()))?;

    let mut attrs = HashMap::new();
    if let Some(ref desc) = body.description {
        attrs.insert("description".to_string(), vec![desc.clone()]);
    }
    attrs.insert("type".to_string(), vec!["cooperative".to_string()]);

    let group = state.keycloak.create_subgroup(&apex_group_id, &body.name, if attrs.is_empty() { None } else { Some(attrs) }).await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    tracing::info!(group_id = %group.id, parent_id = %apex_group_id, name = %body.name, "Cooperative created");
    Ok((StatusCode::CREATED, Json(CooperativeResponse::from(group))))
}

#[utoipa::path(
    get,
    path = "/api/v1/apex/cooperatives",
    responses(
        (status = 200, description = "List of cooperatives in user's apex", body = Vec<CooperativeResponse>),
        (status = 403, description = "Forbidden - apex role required", body = ErrorResponse)
    ),
    tag = "Apex"
)]
pub async fn list_cooperatives(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_apex() {
        return Err(crate::error::AppError::Forbidden("Access denied. Apex role required".into()));
    }

    let apex_group_id = claims.get_apex_group_id()
        .ok_or_else(|| crate::error::AppError::Forbidden("User is not associated with an apex group".into()))?;

    let parent_group = state.keycloak.get_group_by_id(&apex_group_id).await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    let cooperatives: Vec<CooperativeResponse> = parent_group.sub_groups.into_iter()
        .filter(|sg| sg.attributes.as_ref()
            .and_then(|attrs| attrs.get("type"))
            .and_then(|vals| vals.first())
            .map(|v| v == "cooperative")
            .unwrap_or(true))
        .map(CooperativeResponse::from)
        .collect();

    Ok((StatusCode::OK, Json(cooperatives)))
}

#[utoipa::path(
    get,
    path = "/api/v1/apex/cooperatives/{id}",
    params(("id" = String, Path, description = "Cooperative (Subgroup) ID")),
    responses(
        (status = 200, description = "Cooperative found", body = CooperativeResponse),
        (status = 404, description = "Cooperative not found", body = ErrorResponse)
    ),
    tag = "Apex"
)]
pub async fn get_cooperative(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_apex() {
        return Err(crate::error::AppError::Forbidden("Access denied. Apex role required".into()));
    }

    let group = state.keycloak.get_group_by_id(&id).await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    Ok((StatusCode::OK, Json(CooperativeResponse::from(group))))
}

#[utoipa::path(
    patch,
    path = "/api/v1/apex/cooperatives/{id}",
    params(("id" = String, Path, description = "Cooperative (Subgroup) ID")),
    request_body = UpdateCooperativeRequest,
    responses(
        (status = 200, description = "Cooperative updated", body = CooperativeResponse),
        (status = 404, description = "Cooperative not found", body = ErrorResponse)
    ),
    tag = "Apex"
)]
pub async fn update_cooperative(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateCooperativeRequest>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_apex() {
        return Err(crate::error::AppError::Forbidden("Access denied. Apex role required".into()));
    }

    let mut attrs = HashMap::new();
    if let Some(ref desc) = body.description {
        attrs.insert("description".to_string(), vec![desc.clone()]);
    }

    let group = state.keycloak.update_group(&id, body.name.as_deref(), if attrs.is_empty() { None } else { Some(attrs) }).await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    tracing::info!(group_id = %id, "Cooperative updated");
    Ok((StatusCode::OK, Json(CooperativeResponse::from(group))))
}

#[utoipa::path(
    delete,
    path = "/api/v1/apex/cooperatives/{id}",
    params(("id" = String, Path, description = "Cooperative (Subgroup) ID")),
    responses(
        (status = 204, description = "Cooperative deleted"),
        (status = 403, description = "Forbidden", body = ErrorResponse)
    ),
    tag = "Apex"
)]
pub async fn delete_cooperative(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_apex() {
        return Err(crate::error::AppError::Forbidden("Access denied. Apex role required".into()));
    }

    state.keycloak.delete_group(&id).await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    tracing::info!(group_id = %id, "Cooperative deleted");
    Ok((StatusCode::NO_CONTENT, ()))
}

#[utoipa::path(
    post,
    path = "/api/v1/apex/cooperatives/{id}/members",
    params(("id" = String, Path, description = "Cooperative (Subgroup) ID")),
    request_body = AddMemberRequest,
    responses(
        (status = 201, description = "Member added to cooperative"),
        (status = 403, description = "Forbidden", body = ErrorResponse),
        (status = 409, description = "User already in a group", body = ErrorResponse)
    ),
    tag = "Apex"
)]
pub async fn add_cooperative_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
    Json(body): Json<AddMemberRequest>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_apex() {
        return Err(crate::error::AppError::Forbidden("Access denied. Apex role required".into()));
    }

    if body.role != "cooperative" {
        return Err(crate::error::AppError::BadRequest("Only 'cooperative' role is allowed when adding members to a cooperative".into()));
    }

    let user = state.keycloak.add_member_to_group(
        &body.email,
        &body.first_name,
        &body.last_name,
        &body.role,
        &id,
        body.assigned_dimensions.clone(),
    ).await.map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    let first_name = user.first_name_str().to_string();
    let last_name = user.last_name_str().to_string();
    let email = user.email.clone();
    let user_id = user.id.clone();

    tracing::info!(group_id = %id, email = %body.email, "Member added to cooperative");
    Ok((StatusCode::CREATED, Json(MemberResponse {
        id: user_id,
        username: user.username.into(),
        email,
        first_name: Some(first_name).filter(|s| !s.is_empty()),
        last_name: Some(last_name).filter(|s| !s.is_empty()),
    })))
}

#[utoipa::path(
    get,
    path = "/api/v1/apex/cooperatives/{id}/members",
    params(("id" = String, Path, description = "Cooperative (Subgroup) ID")),
    responses(
        (status = 200, description = "List of cooperative members", body = Vec<MemberResponse>)
    ),
    tag = "Apex"
)]
pub async fn list_cooperative_members(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_apex() && !claims.is_cooperative() {
        return Err(crate::error::AppError::Forbidden("Access denied. Apex or cooperative role required".into()));
    }

    let members = state.keycloak.get_group_members(&id).await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    let responses: Vec<MemberResponse> = members.into_iter().map(MemberResponse::from).collect();
    Ok((StatusCode::OK, Json(responses)))
}

#[utoipa::path(
    delete,
    path = "/api/v1/apex/cooperatives/{group_id}/members/{user_id}",
    params(
        ("group_id" = String, Path, description = "Cooperative (Subgroup) ID"),
        ("user_id" = String, Path, description = "User ID to remove")
    ),
    responses(
        (status = 204, description = "Member removed from cooperative")
    ),
    tag = "Apex"
)]
pub async fn remove_cooperative_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path((group_id, user_id)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_apex() {
        return Err(crate::error::AppError::Forbidden("Access denied. Apex role required".into()));
    }

    state.keycloak.remove_user_from_group(&user_id, &group_id).await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    tracing::info!(user_id = %user_id, group_id = %group_id, "Member removed from cooperative");
    Ok((StatusCode::NO_CONTENT, ()))
}