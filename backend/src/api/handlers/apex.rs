use axum::extract::Extension;
use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::api::dto::apex::{ApexResponse, CreateApexRequest, UpdateApexRequest};
use crate::api::dto::common::SuccessResponse;
use crate::api::dto::member::{
    derive_status_from_user, AddMemberRequest, MemberResponse, UpdateMemberRequest,
};
use crate::api::dto::verification::DeletePreviewResponse;
use crate::api::middleware::AuditContext;
use crate::auth::claims::Claims;
use crate::auth::rbac::ScopeEnforcement;
use crate::entities::apex;
use crate::error::{AppError, AppResult};
use crate::services::VerificationTokenService;
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
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<CreateApexRequest>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_federation() && !claims.is_service_account() {
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

    let group_name = body.name.clone();

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

    // Track in PostgreSQL — look up federation PG record by KC org ID
    let federation_pg = state
        .federation_repo
        .find_by_keycloak_id(&org_id)
        .await
        .ok()
        .flatten();

    let federation_pg_id = match federation_pg {
        Some(f) => f.id,
        None => {
            tracing::warn!(org_id = %org_id, "Federation PG record not found, auto-backfilling");
            let backfill_model = crate::entities::federation::ActiveModel {
                id: sea_orm::Set(Uuid::new_v4()),
                keycloak_id: sea_orm::Set(org_id.clone()),
                display_name: sea_orm::Set(body.name.clone()),
                is_active: sea_orm::Set(true),
                metadata: sea_orm::Set(None),
                created_at: sea_orm::Set(chrono::Utc::now()),
                updated_at: sea_orm::Set(chrono::Utc::now()),
            };
            match state.federation_repo.create(backfill_model).await {
                Ok(fed_row) => fed_row.id,
                Err(e) => {
                    tracing::error!(error = %e, "Failed to backfill federation PG record");
                    return Err(crate::error::AppError::InternalServerError(
                        "Failed to create federation tracking record".into(),
                    ));
                }
            }
        }
    };

    let apex_model = apex::ActiveModel {
        id: sea_orm::Set(Uuid::new_v4()),
        keycloak_id: sea_orm::Set(group.id.clone()),
        federation_id: sea_orm::Set(federation_pg_id),
        organization_keycloak_id: sea_orm::Set(org_id.clone()),
        display_name: sea_orm::Set(body.name.clone()),
        metadata: sea_orm::Set(None),
        created_at: sea_orm::Set(chrono::Utc::now()),
        updated_at: sea_orm::Set(chrono::Utc::now()),
    };
    if let Err(e) = state.apex_repo.create(apex_model).await {
        tracing::warn!("Failed to track apex in PG: {}", e);
    }

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "CREATE",
            "apex",
            Some(&group.id),
            Some(serde_json::json!({"name": &body.name, "org_id": &org_id})),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

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
    if !claims.is_federation() && !claims.is_service_account() {
        return Err(crate::error::AppError::Forbidden(
            "Access denied. Federation role required".into(),
        ));
    }

    let org_id = claims.get_organization_id().ok_or_else(|| {
        crate::error::AppError::Forbidden("User is not associated with an organization".into())
    })?;

    let all_groups = state
        .keycloak
        .get_groups(None)
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    let apexes: Vec<ApexResponse> = all_groups
        .into_iter()
        .filter(|g| {
            g.attributes
                .as_ref()
                .and_then(|attrs| attrs.get("organization_id"))
                .and_then(|vals| vals.first())
                .map(|v| v.as_str())
                .unwrap_or("")
                == org_id
        })
        .map(ApexResponse::from)
        .collect();
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
    if !claims.is_federation() && !claims.is_service_account() {
        return Err(crate::error::AppError::Forbidden(
            "Access denied. Federation role required".into(),
        ));
    }

    let mut group = state
        .keycloak
        .get_group_by_id(&id)
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    if let Ok(children) = state.keycloak.get_group_children(&id).await {
        group.sub_groups = children;
    }

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
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<String>,
    Json(body): Json<UpdateApexRequest>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_federation() && !claims.is_service_account() {
        return Err(crate::error::AppError::Forbidden(
            "Access denied. Federation role required".into(),
        ));
    }

    let existing = state
        .keycloak
        .get_group_by_id(&id)
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    let mut attrs = existing.attributes.unwrap_or_default();
    if let Some(ref desc) = body.description {
        if desc.is_empty() {
            attrs.remove("description");
        } else {
            attrs.insert("description".to_string(), vec![desc.clone()]);
        }
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

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "UPDATE",
            "apex",
            Some(&id),
            Some(serde_json::json!({"name": body.name, "description": body.description})),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    tracing::info!(group_id = %id, "Apex updated");
    Ok((StatusCode::OK, Json(ApexResponse::from(group))))
}

#[utoipa::path(
    get,
    path = "/api/v1/federation/apexes/{id}/delete-preview",
    params(("id" = String, Path, description = "Apex (Group) ID")),
    responses(
        (status = 200, description = "Cascade delete preview", body = DeletePreviewResponse),
        (status = 403, description = "Forbidden", body = ErrorResponse)
    ),
    tag = "Federation"
)]
pub async fn delete_apex_preview(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_federation() {
        return Err(AppError::Forbidden(
            "Access denied. Federation role required".into(),
        ));
    }

    let mut coop_count = 0u64;
    let mut member_count = 0u64;

    if let Ok(members) = state.keycloak.get_group_members(&id).await {
        member_count += members.len() as u64;
    }

    if let Ok(subgroups) = state.keycloak.get_group_children(&id).await {
        coop_count = subgroups.len() as u64;
        for sub in &subgroups {
            if let Ok(sub_members) = state.keycloak.get_group_members(&sub.id).await {
                member_count += sub_members.len() as u64;
            }
        }
    }

    Ok((
        StatusCode::OK,
        Json(DeletePreviewResponse {
            apexes: 0,
            cooperatives: coop_count,
            members: member_count,
        }),
    ))
}

#[utoipa::path(
    delete,
    path = "/api/v1/federation/apexes/{id}",
    params(("id" = String, Path, description = "Apex (Group) ID")),
    responses(
        (status = 204, description = "Apex deleted"),
        (status = 403, description = "Forbidden", body = ErrorResponse),
        (status = 404, description = "Apex not found", body = ErrorResponse),
        (status = 428, description = "Identity verification required", body = ErrorResponse)
    ),
    tag = "Federation"
)]
pub async fn delete_apex(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_federation() && !claims.is_service_account() {
        return Err(crate::error::AppError::Forbidden(
            "Access denied. Federation role required".into(),
        ));
    }

    let token = headers
        .get("x-verification-token")
        .and_then(|v| v.to_str().ok())
        .ok_or_else(|| {
            AppError::PreconditionRequired(
            "Identity verification is required for destructive actions. Please verify your identity and try again.".to_string(),
        )
        })?;

    VerificationTokenService::validate_and_consume(&state.cache, &claims.sub, token).await?;

    // Audit BEFORE cascade so we have a record even if cascade partially fails
    if let Err(e) = state
        .audit
        .log(
            &claims,
            "DELETE",
            "apex",
            Some(&id),
            None,
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    // Cascade: delete all apex members from Keycloak + PG
    if let Ok(members) = state.keycloak.get_group_members(&id).await {
        for member in &members {
            if let Err(e) = state.keycloak.delete_user(&member.id).await {
                tracing::warn!(user_id = %member.id, error = %e, "Failed to delete apex member from Keycloak");
            }
            if let Err(e) = state.user_repo.delete_by_keycloak_id(&member.id).await {
                tracing::warn!(user_id = %member.id, error = %e, "Failed to delete apex member from PG");
            }
        }
    }

    // Cascade: delete all subgroups (cooperatives) + their members
    if let Ok(subgroups) = state.keycloak.get_group_children(&id).await {
        for sub in &subgroups {
            if let Ok(sub_members) = state.keycloak.get_group_members(&sub.id).await {
                for member in &sub_members {
                    if let Err(e) = state.keycloak.delete_user(&member.id).await {
                        tracing::warn!(user_id = %member.id, error = %e, "Failed to delete coop member from Keycloak");
                    }
                    if let Err(e) = state.user_repo.delete_by_keycloak_id(&member.id).await {
                        tracing::warn!(user_id = %member.id, error = %e, "Failed to delete coop member from PG");
                    }
                }
            }
            if let Err(e) = state.keycloak.delete_group(&sub.id).await {
                tracing::warn!(group_id = %sub.id, error = %e, "Failed to delete cooperative group from Keycloak");
            }
        }
    }

    state
        .keycloak
        .delete_group(&id)
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    // Delete PG record
    if let Ok(Some(a)) = state.apex_repo.find_by_keycloak_id(&id).await {
        if let Err(e) = state.apex_repo.delete(a.id).await {
            tracing::warn!(apex_id = %a.id, error = %e, "Failed to delete apex PG record");
        }
    }

    tracing::info!(group_id = %id, "Apex cascade-deleted");
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
    if !claims.is_federation() && !claims.is_service_account() {
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
    let status = derive_status_from_user(user.email_verified, &user.required_actions).to_string();
    Ok((
        StatusCode::CREATED,
        Json(MemberResponse {
            id: user_id,
            username: user.username.into(),
            email,
            first_name: Some(first_name).filter(|s| !s.is_empty()),
            last_name: Some(last_name).filter(|s| !s.is_empty()),
            status,
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
    Extension(audit_ctx): Extension<AuditContext>,
    Path((group_id, user_id)): Path<(String, String)>,
    Json(body): Json<UpdateMemberRequest>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_federation() && !claims.is_service_account() {
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

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "UPDATE_MEMBER",
            "apex_member",
            Some(&user_id),
            Some(serde_json::json!({"group_id": &group_id, "first_name": body.first_name, "last_name": body.last_name})),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    tracing::info!(group_id = %group_id, user_id = %user_id, "Apex member updated");
    let status =
        derive_status_from_user(updated.email_verified, &updated.required_actions).to_string();
    Ok((
        StatusCode::OK,
        Json(MemberResponse {
            id: updated.id,
            username: Some(updated.username),
            email: updated.email,
            first_name: updated.first_name,
            last_name: updated.last_name,
            status,
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
    if !claims.is_federation() && !claims.is_service_account() {
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
    Extension(audit_ctx): Extension<AuditContext>,
    Path((group_id, user_id)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_federation() && !claims.is_service_account() {
        return Err(crate::error::AppError::Forbidden(
            "Access denied. Federation role required".into(),
        ));
    }

    state
        .keycloak
        .remove_user_from_group(&user_id, &group_id)
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "DELETE",
            "member",
            Some(&user_id),
            Some(serde_json::json!({"group_id": &group_id})),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

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
    Extension(audit_ctx): Extension<AuditContext>,
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

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "RESEND_VERIFICATION",
            "apex_member",
            Some(&user_id),
            Some(serde_json::json!({"group_id": &group_id})),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    tracing::info!(group_id = %group_id, user_id = %user_id, "Verification email resent");
    Ok((
        StatusCode::OK,
        Json(SuccessResponse {
            message: "Verification email resent".to_string(),
            id: None,
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/apexes",
    params(
        ("federation_id" = Option<String>, Query, description = "Keycloak Federation ID to filter by")
    ),
    responses(
        (status = 200, description = "List of apexes", body = Vec<ApexResponse>),
        (status = 403, description = "Forbidden - ministry role required", body = ErrorResponse)
    ),
    tag = "Ministry"
)]
pub async fn ministry_list_apexes(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<HashMap<String, String>>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_ministry() {
        return Err(crate::error::AppError::Forbidden(
            "Access denied. Ministry role required".into(),
        ));
    }

    let federation_id = params.get("federation_id").cloned();

    let all_groups = state
        .keycloak
        .get_groups(None)
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    let apexes: Vec<ApexResponse> = all_groups
        .into_iter()
        .filter(|g| {
            // Check if organization_id attribute is present (indicates this is an apex)
            let org_id_opt = g
                .attributes
                .as_ref()
                .and_then(|attrs| attrs.get("organization_id"))
                .and_then(|vals| vals.first())
                .map(|v| v.as_str());

            if org_id_opt.is_none() {
                return false;
            }

            if let Some(ref fed_id) = federation_id {
                org_id_opt == Some(fed_id.as_str())
            } else {
                true
            }
        })
        .map(ApexResponse::from)
        .collect();

    Ok((StatusCode::OK, Json(apexes)))
}
