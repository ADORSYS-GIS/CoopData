use axum::extract::Extension;
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use std::collections::HashMap;
use std::sync::Arc;

use crate::api::dto::apex::ApexResponse;
use crate::api::dto::common::SuccessResponse;
use crate::api::dto::cooperative::{
    CooperativeResponse, CreateCooperativeRequest, UpdateCooperativeRequest,
};
use crate::api::dto::member::{AddMemberRequest, MemberResponse, UpdateMemberRequest};
use crate::auth::claims::Claims;
use crate::auth::rbac::ScopeEnforcement;
use crate::error::{AppError, AppResult};
use crate::AppState;

// ─── Internal scope helper ──────────────────────────────────────────────────

/// Verifies that a cooperative subgroup (by id) actually belongs to the
/// calling apex user's group.
/// Keycloak stores group paths using names (e.g. `/apex-name/coop-name`),
/// so we compare using the apex group's own path as the prefix.
async fn assert_cooperative_belongs_to_apex(
    state: &AppState,
    claims: &Claims,
    cooperative_id: &str,
) -> AppResult<()> {
    let apex_id_or_path = claims
        .get_apex_group_id()
        .ok_or_else(|| AppError::Forbidden("User is not associated with an apex group".into()))?;

    // Resolve to get the apex group's canonical path (e.g. "/we")
    let apex = state
        .keycloak
        .resolve_group(&apex_id_or_path)
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    let coop_group = state
        .keycloak
        .get_group_by_id(cooperative_id)
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    // Keycloak paths use names: apex="/we", coop="/we/do"
    // Check by: apex UUID match OR apex path prefix match
    let apex_path_prefix = apex.path.as_deref().unwrap_or("");
    let belongs = coop_group
        .path
        .as_deref()
        .map(|p| {
            // Path-based: "/we/do".starts_with("/we/")
            (!apex_path_prefix.is_empty() && p.starts_with(&format!("{}/", apex_path_prefix)))
            // UUID-based fallback: "/{apex_uuid}/..."
            || p.starts_with(&format!("/{}/", apex.id))
        })
        .unwrap_or(false);

    if !belongs {
        tracing::warn!(
            apex_id = %apex.id,
            apex_path = %apex_path_prefix,
            cooperative_id = %cooperative_id,
            coop_path = ?coop_group.path,
            "Scope violation: cooperative does not belong to this apex"
        );
        return Err(AppError::Forbidden(
            "Access denied: this cooperative does not belong to your apex".into(),
        ));
    }

    Ok(())
}

// ─── Cooperative CRUD (Apex admin) ─────────────────────────────────────────

#[utoipa::path(
    post,
    path = "/api/v1/apex/cooperatives",
    request_body = CreateCooperativeRequest,
    responses(
        (status = 201, description = "Cooperative created", body = CooperativeResponse),
        (status = 400, description = "Invalid input"),
        (status = 403, description = "Forbidden - apex role required")
    ),
    tag = "Apex"
)]
pub async fn create_cooperative(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(body): Json<CreateCooperativeRequest>,
) -> AppResult<impl IntoResponse> {
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("Cooperative name is required".into()));
    }

    let apex_id_or_path = claims
        .get_apex_group_id()
        .ok_or_else(|| AppError::Forbidden("User is not associated with an apex group".into()))?;

    // Resolve path (e.g. "/we") to the actual group with a UUID
    let apex_resolved = state
        .keycloak
        .resolve_group(&apex_id_or_path)
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    let apex_group_id = apex_resolved.id.clone();

    let mut attrs = HashMap::new();
    if let Some(ref desc) = body.description {
        if !desc.trim().is_empty() {
            attrs.insert("description".to_string(), vec![desc.clone()]);
        }
    }
    attrs.insert("type".to_string(), vec!["cooperative".to_string()]);

    let group = state
        .keycloak
        .create_subgroup(&apex_group_id, &body.name, Some(attrs))
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    tracing::info!(
        group_id = %group.id,
        parent_id = %apex_group_id,
        name = %body.name,
        "Cooperative created"
    );
    Ok((StatusCode::CREATED, Json(CooperativeResponse::from(group))))
}

#[utoipa::path(
    get,
    path = "/api/v1/apex/cooperatives",
    responses(
        (status = 200, description = "List of cooperatives in user's apex", body = Vec<CooperativeResponse>),
        (status = 403, description = "Forbidden - apex role required")
    ),
    tag = "Apex"
)]
pub async fn list_cooperatives(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    let apex_id_or_path = claims
        .get_apex_group_id()
        .ok_or_else(|| AppError::Forbidden("User is not associated with an apex group".into()))?;

    // Resolve path/name to the actual apex group (gets us the UUID)
    let apex = state
        .keycloak
        .resolve_group(&apex_id_or_path)
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    // Fetch children via the dedicated endpoint — GET /groups/{id} doesn't
    // reliably populate subGroups in all Keycloak versions
    let children = state
        .keycloak
        .get_group_children(&apex.id)
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    let cooperatives: Vec<CooperativeResponse> = children
        .into_iter()
        .filter(|sg| {
            sg.attributes
                .as_ref()
                .and_then(|a| a.get("type"))
                .and_then(|v| v.first())
                .map(|v| v == "cooperative")
                .unwrap_or(true) // include groups with no type attr for backwards compat
        })
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
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Cooperative not found")
    ),
    tag = "Apex"
)]
pub async fn get_cooperative(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    // Cooperative users can only fetch their own cooperative
    if claims.is_cooperative() && !claims.is_apex() {
        let own_coop_id = ScopeEnforcement::get_cooperative_id(&claims)?;
        if own_coop_id != id {
            return Err(AppError::Forbidden(
                "Access denied: you can only view your own cooperative".into(),
            ));
        }
    }

    let group = state
        .keycloak
        .get_group_by_id(&id)
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    Ok((StatusCode::OK, Json(CooperativeResponse::from(group))))
}

#[utoipa::path(
    patch,
    path = "/api/v1/apex/cooperatives/{id}",
    params(("id" = String, Path, description = "Cooperative (Subgroup) ID")),
    request_body = UpdateCooperativeRequest,
    responses(
        (status = 200, description = "Cooperative updated", body = CooperativeResponse),
        (status = 400, description = "No fields to update"),
        (status = 403, description = "Forbidden - apex role required"),
        (status = 404, description = "Cooperative not found")
    ),
    tag = "Apex"
)]
pub async fn update_cooperative(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateCooperativeRequest>,
) -> AppResult<impl IntoResponse> {
    if body.name.is_none() && body.description.is_none() {
        return Err(AppError::BadRequest(
            "Provide at least one field to update (name or description)".into(),
        ));
    }

    // Scope: cooperative must belong to this apex
    assert_cooperative_belongs_to_apex(&state, &claims, &id).await?;

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
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    tracing::info!(group_id = %id, "Cooperative updated");
    Ok((StatusCode::OK, Json(CooperativeResponse::from(group))))
}

#[utoipa::path(
    delete,
    path = "/api/v1/apex/cooperatives/{id}",
    params(("id" = String, Path, description = "Cooperative (Subgroup) ID")),
    responses(
        (status = 204, description = "Cooperative deleted"),
        (status = 403, description = "Forbidden - apex role required"),
        (status = 404, description = "Cooperative not found")
    ),
    tag = "Apex"
)]
pub async fn delete_cooperative(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    // Scope: cooperative must belong to this apex
    assert_cooperative_belongs_to_apex(&state, &claims, &id).await?;

    state
        .keycloak
        .delete_group(&id)
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    tracing::info!(group_id = %id, "Cooperative deleted");
    Ok((StatusCode::NO_CONTENT, ()))
}

// ─── Cooperative Members ────────────────────────────────────────────────────

#[utoipa::path(
    post,
    path = "/api/v1/apex/cooperatives/{id}/members",
    params(("id" = String, Path, description = "Cooperative (Subgroup) ID")),
    request_body = AddMemberRequest,
    responses(
        (status = 201, description = "Member added", body = MemberResponse),
        (status = 400, description = "Invalid input or wrong role"),
        (status = 403, description = "Forbidden - apex role required or scope violation"),
        (status = 409, description = "User already in a group")
    ),
    tag = "Apex"
)]
pub async fn add_cooperative_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
    Json(body): Json<AddMemberRequest>,
) -> AppResult<impl IntoResponse> {
    if body.email.trim().is_empty() {
        return Err(AppError::BadRequest("Email is required".into()));
    }
    if body.first_name.trim().is_empty() {
        return Err(AppError::BadRequest("First name is required".into()));
    }
    if body.last_name.trim().is_empty() {
        return Err(AppError::BadRequest("Last name is required".into()));
    }
    if body.role != "cooperative" {
        return Err(AppError::BadRequest(
            "Only 'cooperative' role is allowed when adding members to a cooperative".into(),
        ));
    }

    // Scope: cooperative must belong to this apex
    assert_cooperative_belongs_to_apex(&state, &claims, &id).await?;

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
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    let first_name = user.first_name_str().to_string();
    let last_name = user.last_name_str().to_string();

    tracing::info!(
        group_id = %id,
        email = %body.email,
        user_id = %user.id,
        "Member added to cooperative"
    );

    Ok((
        StatusCode::CREATED,
        Json(MemberResponse {
            id: user.id,
            username: user.username.into(),
            email: user.email,
            first_name: Some(first_name).filter(|s| !s.is_empty()),
            last_name: Some(last_name).filter(|s| !s.is_empty()),
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/apex/cooperatives/{id}/members",
    params(("id" = String, Path, description = "Cooperative (Subgroup) ID")),
    responses(
        (status = 200, description = "List of cooperative members", body = Vec<MemberResponse>),
        (status = 403, description = "Forbidden")
    ),
    tag = "Apex"
)]
pub async fn list_cooperative_members(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    // Cooperative users may only list members of their own cooperative
    if claims.is_cooperative() && !claims.is_apex() {
        let own_coop_id = ScopeEnforcement::get_cooperative_id(&claims)?;
        if own_coop_id != id {
            return Err(AppError::Forbidden(
                "Access denied: you can only view members of your own cooperative".into(),
            ));
        }
    }

    let members = state
        .keycloak
        .get_group_members(&id)
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    let responses: Vec<MemberResponse> = members.into_iter().map(MemberResponse::from).collect();
    Ok((StatusCode::OK, Json(responses)))
}

#[utoipa::path(
    patch,
    path = "/api/v1/apex/cooperatives/{group_id}/members/{user_id}",
    params(
        ("group_id" = String, Path, description = "Cooperative (Subgroup) ID"),
        ("user_id" = String, Path, description = "User ID to update")
    ),
    request_body = UpdateMemberRequest,
    responses(
        (status = 200, description = "Member updated", body = MemberResponse),
        (status = 403, description = "Forbidden - apex role required")
    ),
    tag = "Apex"
)]
pub async fn update_cooperative_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path((group_id, user_id)): Path<(String, String)>,
    Json(body): Json<UpdateMemberRequest>,
) -> AppResult<impl IntoResponse> {
    if body.first_name.is_none() && body.last_name.is_none() {
        return Err(AppError::BadRequest(
            "Provide at least one field to update".into(),
        ));
    }

    // Scope: cooperative must belong to this apex
    assert_cooperative_belongs_to_apex(&state, &claims, &group_id).await?;

    state
        .keycloak
        .update_user_name(
            &user_id,
            body.first_name.as_deref(),
            body.last_name.as_deref(),
        )
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    let updated = state
        .keycloak
        .get_user_by_id(&user_id)
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    tracing::info!(group_id = %group_id, user_id = %user_id, "Cooperative member updated");
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
    delete,
    path = "/api/v1/apex/cooperatives/{group_id}/members/{user_id}",
    params(
        ("group_id" = String, Path, description = "Cooperative (Subgroup) ID"),
        ("user_id" = String, Path, description = "User ID to remove")
    ),
    responses(
        (status = 204, description = "Member removed"),
        (status = 403, description = "Forbidden - apex role required")
    ),
    tag = "Apex"
)]
pub async fn remove_cooperative_member(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path((group_id, user_id)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
    // Scope: cooperative must belong to this apex
    assert_cooperative_belongs_to_apex(&state, &claims, &group_id).await?;

    state
        .keycloak
        .remove_user_from_group(&user_id, &group_id)
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    tracing::info!(
        user_id = %user_id,
        group_id = %group_id,
        "Member removed from cooperative"
    );
    Ok((StatusCode::NO_CONTENT, ()))
}

#[utoipa::path(
    post,
    path = "/api/v1/apex/cooperatives/{group_id}/members/{user_id}/resend-verification",
    params(
        ("group_id" = String, Path, description = "Cooperative (Subgroup) ID"),
        ("user_id" = String, Path, description = "User ID")
    ),
    responses(
        (status = 200, description = "Verification email resent", body = SuccessResponse),
        (status = 403, description = "Forbidden - apex role required")
    ),
    tag = "Apex"
)]
pub async fn resend_cooperative_member_verification(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path((group_id, user_id)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
    // Scope: cooperative must belong to this apex
    assert_cooperative_belongs_to_apex(&state, &claims, &group_id).await?;

    state
        .keycloak
        .trigger_email_verification_for_user(&user_id)
        .await
        .map_err(|e| {
            tracing::error!(
                group_id = %group_id,
                user_id = %user_id,
                error = %e,
                "Failed to resend verification email"
            );
            AppError::ExternalServiceError(e.to_string())
        })?;

    tracing::info!(
        group_id = %group_id,
        user_id = %user_id,
        "Verification email resent for cooperative member"
    );
    Ok((
        StatusCode::OK,
        Json(SuccessResponse {
            message: "Verification email resent".to_string(),
            id: None,
        }),
    ))
}

// ─── Apex Profile ───────────────────────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/v1/apex/profile",
    responses(
        (status = 200, description = "Apex group profile", body = ApexResponse),
        (status = 403, description = "Forbidden - apex role required")
    ),
    tag = "Apex"
)]
pub async fn get_apex_profile(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    let apex_id_or_path = ScopeEnforcement::get_apex_group_id(&claims)?;

    let group = state
        .keycloak
        .resolve_group(&apex_id_or_path)
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    tracing::info!(apex_path = %apex_id_or_path, group_id = %group.id, user_id = %claims.sub, "Apex profile fetched");
    Ok((StatusCode::OK, Json(ApexResponse::from(group))))
}
