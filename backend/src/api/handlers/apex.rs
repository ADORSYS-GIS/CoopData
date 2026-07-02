use axum::extract::Extension;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::collections::HashMap;
use std::sync::Arc;

use crate::api::dto::apex::{ApexResponse, CreateApexRequest, UpdateApexRequest};
use crate::api::dto::common::SuccessResponse;
use crate::api::dto::member::{AddMemberRequest, MemberResponse, UpdateMemberRequest};
use crate::auth::claims::Claims;
use crate::auth::rbac::ScopeEnforcement;
use crate::error::AppResult;
use crate::AppState;

#[utoipa::path(
    post,
    path = "/api/v1/federation/apexes",
    request_body = CreateApexRequest,
    responses(
        (status = 201, description = "Apex created", body = ApexResponse),
        (status = 400, description = "Invalid input", body = ErrorResponse),
        (status = 403, description = "Forbidden - federation role required", body = ErrorResponse)
    ),
    tag = "Federation"
)]
pub async fn create_apex(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(body): Json<CreateApexRequest>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_federation() {
        return Err(crate::error::AppError::Forbidden(
            "Access denied. Federation role required".into(),
        ));
    }

    if body.name.trim().is_empty() {
        return Err(crate::error::AppError::BadRequest(
            "Apex name is required".into(),
        ));
    }

    let org_id = claims.get_organization_id().ok_or_else(|| {
        crate::error::AppError::Forbidden("User is not associated with an organization".into())
    })?;

    let group_name = format!("{}-{}", org_id, body.name);

    let mut attrs = HashMap::new();
    if let Some(ref desc) = body.description {
        attrs.insert("description".to_string(), vec![desc.clone()]);
    }
    attrs.insert("organization_id".to_string(), vec![org_id.clone()]);
    attrs.insert("type".to_string(), vec!["apex".to_string()]);

    let group = state
        .keycloak
        .create_group(&group_name, Some(attrs))
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    tracing::info!(group_id = %group.id, name = %group_name, "Apex created");
    Ok((StatusCode::CREATED, Json(ApexResponse::from(group))))
}

#[utoipa::path(
    get,
    path = "/api/v1/federation/apexes",
    responses(
        (status = 200, description = "List of apexes in federation", body = Vec<ApexResponse>),
        (status = 403, description = "Forbidden - federation role required", body = ErrorResponse)
    ),
    tag = "Federation"
)]
pub async fn list_apexes(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_federation() {
        return Err(crate::error::AppError::Forbidden(
            "Access denied. Federation role required".into(),
        ));
    }

    let org_id = claims.get_organization_id().ok_or_else(|| {
        crate::error::AppError::Forbidden("User is not associated with an organization".into())
    })?;

    let search_prefix = format!("{}-", org_id);
    let groups = state
        .keycloak
        .get_groups(Some(&search_prefix))
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    let apexes: Vec<ApexResponse> = groups.into_iter().map(ApexResponse::from).collect();
    Ok((StatusCode::OK, Json(apexes)))
}

#[utoipa::path(
    get,
    path = "/api/v1/federation/apexes/{id}",
    params(("id" = String, Path, description = "Apex (Group) ID")),
    responses(
        (status = 200, description = "Apex found", body = ApexResponse),
        (status = 404, description = "Apex not found", body = ErrorResponse)
    ),
    tag = "Federation"
)]
pub async fn get_apex(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_federation() {
        return Err(crate::error::AppError::Forbidden(
            "Access denied. Federation role required".into(),
        ));
    }

    let group = state
        .keycloak
        .get_group_by_id(&id)
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    Ok((StatusCode::OK, Json(ApexResponse::from(group))))
}

#[utoipa::path(
    patch,
    path = "/api/v1/federation/apexes/{id}",
    params(("id" = String, Path, description = "Apex (Group) ID")),
    request_body = UpdateApexRequest,
    responses(
        (status = 200, description = "Apex updated", body = ApexResponse),
        (status = 404, description = "Apex not found", body = ErrorResponse)
    ),
    tag = "Federation"
)]
pub async fn update_apex(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateApexRequest>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_federation() {
        return Err(crate::error::AppError::Forbidden(
            "Access denied. Federation role required".into(),
        ));
    }

    let mut attrs = HashMap::new();
    if let Some(ref desc) = body.description {
        attrs.insert("description".to_string(), vec![desc.clone()]);
    }

    let group = state
        .keycloak
        .update_group(
            &id,
            body.name.as_deref(),
            if attrs.is_empty() { None } else { Some(attrs) },
        )
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    tracing::info!(group_id = %id, "Apex updated");
    Ok((StatusCode::OK, Json(ApexResponse::from(group))))
}

#[utoipa::path(
    delete,
    path = "/api/v1/federation/apexes/{id}",
    params(("id" = String, Path, description = "Apex (Group) ID")),
    responses(
        (status = 204, description = "Apex deleted"),
        (status = 403, description = "Forbidden", body = ErrorResponse),
        (status = 404, description = "Apex not found", body = ErrorResponse)
    ),
    tag = "Federation"
)]
pub async fn delete_apex(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_federation() {
        return Err(crate::error::AppError::Forbidden(
            "Access denied. Federation role required".into(),
        ));
    }

    state
        .keycloak
        .delete_group(&id)
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    tracing::info!(group_id = %id, "Apex deleted");
    Ok((StatusCode::NO_CONTENT, ()))
}

#[utoipa::path(
    post,
    path = "/api/v1/federation/apexes/{id}/members",
    params(("id" = String, Path, description = "Apex (Group) ID")),
    request_body = AddMemberRequest,
    responses(
        (status = 201, description = "Member added to apex"),
        (status = 403, description = "Forbidden", body = ErrorResponse),
        (status = 409, description = "User already in a group", body = ErrorResponse)
    ),
    tag = "Federation"
)]
pub async fn add_apex_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
    Json(body): Json<AddMemberRequest>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_federation() {
        return Err(crate::error::AppError::Forbidden(
            "Access denied. Federation role required".into(),
        ));
    }

    let valid_roles = ["apex", "cooperative"];
    if !valid_roles.contains(&body.role.as_str()) {
        return Err(crate::error::AppError::BadRequest(format!(
            "Invalid role '{}'. Valid roles: {}",
            body.role,
            valid_roles.join(", ")
        )));
    }

    let user = state
        .keycloak
        .add_member_to_group(
            &body.email,
            &body.first_name,
            &body.last_name,
            &body.role,
            &id,
            body.assigned_dimensions.clone(),
        )
        .await?;

    let first_name = user.first_name_str().to_string();
    let last_name = user.last_name_str().to_string();
    let email = user.email.clone();
    let user_id = user.id.clone();

    tracing::info!(group_id = %id, email = %body.email, role = %body.role, "Member added to apex");
    Ok((
        StatusCode::CREATED,
        Json(MemberResponse {
            id: user_id,
            username: user.username.into(),
            email,
            first_name: Some(first_name).filter(|s| !s.is_empty()),
            last_name: Some(last_name).filter(|s| !s.is_empty()),
        }),
    ))
}

#[utoipa::path(
    patch,
    path = "/api/v1/federation/apexes/{group_id}/members/{user_id}",
    params(
        ("group_id" = String, Path, description = "Apex (Group) ID"),
        ("user_id" = String, Path, description = "User ID to update")
    ),
    request_body = UpdateMemberRequest,
    responses(
        (status = 200, description = "Member updated", body = MemberResponse),
        (status = 403, description = "Forbidden", body = ErrorResponse)
    ),
    tag = "Federation"
)]
pub async fn update_apex_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path((group_id, user_id)): Path<(String, String)>,
    Json(body): Json<UpdateMemberRequest>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_federation() {
        return Err(crate::error::AppError::Forbidden(
            "Access denied. Federation role required".into(),
        ));
    }

    state
        .keycloak
        .update_user_name(
            &user_id,
            body.first_name.as_deref(),
            body.last_name.as_deref(),
        )
        .await?;

    let updated = state.keycloak.get_user_by_id(&user_id).await?;

    tracing::info!(group_id = %group_id, user_id = %user_id, "Apex member updated");
    Ok((
        StatusCode::OK,
        Json(MemberResponse {
            id: updated.id,
            username: Some(updated.username),
            email: updated.email,
            first_name: updated.first_name,
            last_name: updated.last_name,
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/federation/apexes/{id}/members",
    params(("id" = String, Path, description = "Apex (Group) ID")),
    responses(
        (status = 200, description = "List of apex members", body = Vec<MemberResponse>)
    ),
    tag = "Federation"
)]
pub async fn list_apex_members(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_federation() {
        return Err(crate::error::AppError::Forbidden(
            "Access denied. Federation role required".into(),
        ));
    }

    let members = state
        .keycloak
        .get_group_members(&id)
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    let responses: Vec<MemberResponse> = members.into_iter().map(MemberResponse::from).collect();
    Ok((StatusCode::OK, Json(responses)))
}

#[utoipa::path(
    delete,
    path = "/api/v1/federation/apexes/{group_id}/members/{user_id}",
    params(
        ("group_id" = String, Path, description = "Apex (Group) ID"),
        ("user_id" = String, Path, description = "User ID to remove")
    ),
    responses(
        (status = 204, description = "Member removed from apex")
    ),
    tag = "Federation"
)]
pub async fn remove_apex_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path((group_id, user_id)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_federation() {
        return Err(crate::error::AppError::Forbidden(
            "Access denied. Federation role required".into(),
        ));
    }

    state
        .keycloak
        .remove_user_from_group(&user_id, &group_id)
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    tracing::info!(user_id = %user_id, group_id = %group_id, "Member removed from apex");
    Ok((StatusCode::NO_CONTENT, ()))
}

#[utoipa::path(
    post,
    path = "/api/v1/federation/apexes/{group_id}/members/{user_id}/resend-verification",
    params(
        ("group_id" = String, Path, description = "Apex (Group) ID"),
        ("user_id" = String, Path, description = "User ID")
    ),
    responses(
        (status = 200, description = "Verification email resent", body = SuccessResponse)
    ),
    tag = "Federation"
)]
pub async fn resend_apex_member_verification(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path((group_id, user_id)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
    let org_id = ScopeEnforcement::get_federation_org_id(&claims)?;

    let group = state
        .keycloak
        .get_group_by_id(&group_id)
        .await
        .map_err(|e| {
            tracing::error!(group_id = %group_id, error = %e, "Failed to get apex for resend verification");
            e
        })?;

    let group_org_id = group
        .attributes
        .as_ref()
        .and_then(|attrs| attrs.get("organization_id"))
        .and_then(|vals| vals.first())
        .cloned()
        .unwrap_or_default();

    if group_org_id != org_id {
        return Err(crate::error::AppError::Forbidden(
            "Access denied: apex does not belong to your federation".into(),
        ));
    }

    state
        .keycloak
        .trigger_email_verification_for_user(&user_id)
        .await
        .map_err(|e| {
            tracing::error!(group_id = %group_id, user_id = %user_id, error = %e, "Failed to resend verification email");
            e
        })?;

    tracing::info!(group_id = %group_id, user_id = %user_id, "Verification email resent");
    Ok((
        StatusCode::OK,
        Json(SuccessResponse {
            message: "Verification email resent".to_string(),
            id: None,
        }),
    ))
}
