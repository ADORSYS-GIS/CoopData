use axum::extract::Extension;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::api::dto::apex::ApexResponse;
use crate::api::dto::common::SuccessResponse;
use crate::api::dto::cooperative::{
    CooperativeProfileResponse, CooperativeResponse, CreateCooperativeProfileRequest,
    CreateCooperativeRequest, UpdateCooperativeProfileRequest, UpdateCooperativeRequest,
};
use crate::api::dto::member::{
    derive_status_from_user, AddMemberRequest, MemberResponse, UpdateMemberRequest,
};
use crate::api::dto::verification::DeletePreviewResponse;
use crate::api::middleware::AuditContext;
use crate::auth::claims::Claims;
use crate::auth::rbac::ScopeEnforcement;
use crate::entities::cooperative;
use crate::entities::enums::{
    AccountingYear, CoopStatus, CooperativeType, EswatiniRegion, UrbanRural,
};
use crate::error::{AppError, AppResult};
use crate::services::VerificationTokenService;
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
        (status = 201, description = "Cooperative created", body = CooperativeProfileResponse),
        (status = 400, description = "Invalid input"),
        (status = 403, description = "Forbidden - apex role required"),
        (status = 409, description = "Registration number already in use")
    ),
    tag = "Apex"
)]
pub async fn create_cooperative(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<CreateCooperativeRequest>,
) -> AppResult<impl IntoResponse> {
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("Cooperative name is required".into()));
    }
    if body.reg_no.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Registration number is required".into(),
        ));
    }
    if !VALID_COOP_TYPES.contains(&body.institution_type.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid institution_type '{}'. Must be one of: {:?}",
            body.institution_type, VALID_COOP_TYPES
        )));
    }
    if !VALID_GEO_CLASSIF.contains(&body.geographic_classif.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid geographic_classif '{}'. Must be one of: {:?}",
            body.geographic_classif, VALID_GEO_CLASSIF
        )));
    }
    if !VALID_COOP_STATUS.contains(&body.status.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid status '{}'. Must be one of: {:?}",
            body.status, VALID_COOP_STATUS
        )));
    }
    if !VALID_ACCOUNTING_YEAR.contains(&body.accounting_year.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid accounting_year '{}'. Must be one of: {:?}",
            body.accounting_year, VALID_ACCOUNTING_YEAR
        )));
    }
    if !VALID_REGIONS.contains(&body.region.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid region '{}'. Must be one of: {:?}",
            body.region, VALID_REGIONS
        )));
    }

    if let Some(existing) = state
        .cooperative_repo
        .find_by_reg_no(&body.reg_no)
        .await
        .ok()
        .flatten()
    {
        tracing::warn!(reg_no = %body.reg_no, existing_id = %existing.id, "Duplicate reg_no");
        return Err(AppError::Conflict(format!(
            "Registration number '{}' is already in use",
            body.reg_no
        )));
    }

    let apex_id_or_path = claims
        .get_apex_group_id()
        .ok_or_else(|| AppError::Forbidden("User is not associated with an apex group".into()))?;

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
    attrs.insert(
        "institution_type".to_string(),
        vec![body.institution_type.clone()],
    );
    attrs.insert("reg_no".to_string(), vec![body.reg_no.clone()]);
    if let Some(ref tin) = body.tin {
        attrs.insert("tin".to_string(), vec![tin.clone()]);
    }
    if let Some(ref phone) = body.phone {
        attrs.insert("phone".to_string(), vec![phone.clone()]);
    }
    attrs.insert("region".to_string(), vec![body.region.clone()]);
    attrs.insert("sector".to_string(), vec![body.sector.clone()]);
    attrs.insert(
        "geographic_classif".to_string(),
        vec![body.geographic_classif.clone()],
    );
    attrs.insert("status".to_string(), vec![body.status.clone()]);
    attrs.insert(
        "registered_on".to_string(),
        vec![body.registered_on.to_string()],
    );
    attrs.insert(
        "accounting_year".to_string(),
        vec![body.accounting_year.clone()],
    );

    let group = state
        .keycloak
        .create_subgroup(&apex_group_id, &body.name, Some(attrs))
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    let apex_pg = state
        .apex_repo
        .find_by_keycloak_id(&apex_group_id)
        .await
        .ok()
        .flatten();

    let apex_pg_id = match apex_pg {
        Some(a) => a.id,
        None => {
            tracing::warn!(apex_kc_id = %apex_group_id, "Apex PG record not found, auto-backfilling");

            let org_id = apex_resolved
                .attributes
                .as_ref()
                .and_then(|attrs| attrs.get("organization_id"))
                .and_then(|vals| vals.first())
                .cloned()
                .ok_or_else(|| {
                    AppError::InternalServerError(
                        "Apex group has no organization_id attribute".into(),
                    )
                })?;

            let federation_pg = state
                .federation_repo
                .find_by_keycloak_id(&org_id)
                .await
                .ok()
                .flatten()
                .ok_or_else(|| {
                    AppError::InternalServerError(format!(
                        "Federation PG record not found for org_id {}",
                        org_id
                    ))
                })?;

            let backfill_model = crate::entities::apex::ActiveModel {
                id: sea_orm::Set(Uuid::new_v4()),
                keycloak_id: sea_orm::Set(apex_group_id.clone()),
                federation_id: sea_orm::Set(federation_pg.id),
                organization_keycloak_id: sea_orm::Set(org_id.clone()),
                display_name: sea_orm::Set(apex_resolved.name.clone()),
                created_at: sea_orm::Set(chrono::Utc::now()),
                updated_at: sea_orm::Set(chrono::Utc::now()),
            };

            match state.apex_repo.create(backfill_model).await {
                Ok(apex_row) => apex_row.id,
                Err(e) => {
                    tracing::error!(error = %e, "Failed to backfill apex PG record");
                    return Err(AppError::InternalServerError(
                        "Failed to create apex tracking record".into(),
                    ));
                }
            }
        }
    };

    let coop_id = Uuid::new_v4();
    let coop_model = cooperative::ActiveModel {
        id: sea_orm::Set(coop_id),
        keycloak_id: sea_orm::Set(group.id.clone()),
        apex_id: sea_orm::Set(apex_pg_id),
        display_name: sea_orm::Set(body.name.clone()),
        keycloak_group_id: sea_orm::Set(Some(Uuid::parse_str(&group.id).unwrap_or(coop_id))),
        apex_group_id: sea_orm::Set(Some(Uuid::parse_str(&apex_group_id).unwrap_or(coop_id))),
        federation_org_id: sea_orm::Set(None),
        name: sea_orm::Set(body.name.clone()),
        institution_type: sea_orm::Set(CooperativeType::parse(&body.institution_type)),
        reg_no: sea_orm::Set(Some(body.reg_no.clone())),
        tin: sea_orm::Set(body.tin.clone()),
        address: sea_orm::Set(body.address.clone()),
        georeference: sea_orm::Set(body.georeference.clone()),
        region: sea_orm::Set(EswatiniRegion::parse(&body.region)),
        geographic_classif: sea_orm::Set(UrbanRural::parse(&body.geographic_classif)),
        phone: sea_orm::Set(body.phone.clone()),
        sector: sea_orm::Set(Some(body.sector.clone())),
        responsible_financial: sea_orm::Set(body.responsible_financial),
        responsible_non_financial: sea_orm::Set(body.responsible_non_financial),
        status: sea_orm::Set(CoopStatus::parse(&body.status).unwrap_or(CoopStatus::Active)),
        registered_on: sea_orm::Set(Some(body.registered_on)),
        accounting_year: sea_orm::Set(
            AccountingYear::parse(&body.accounting_year).unwrap_or(AccountingYear::Calendar),
        ),
        created_at: sea_orm::Set(chrono::Utc::now()),
        updated_at: sea_orm::Set(chrono::Utc::now()),
    };

    let created_coop = match state.cooperative_repo.create(coop_model).await {
        Ok(model) => model,
        Err(e) => {
            tracing::error!(error = %e, "Failed to track cooperative in PG");
            return Err(AppError::InternalServerError(
                "Failed to create cooperative record".into(),
            ));
        }
    };

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "CREATE",
            "cooperative",
            Some(&group.id),
            Some(serde_json::json!({
                "name": &body.name,
                "reg_no": &body.reg_no,
                "institution_type": &body.institution_type,
                "parent_id": &apex_group_id
            })),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    tracing::info!(
        group_id = %group.id,
        parent_id = %apex_group_id,
        name = %body.name,
        reg_no = %body.reg_no,
        "Cooperative created with full profile"
    );
    Ok((
        StatusCode::CREATED,
        Json(CooperativeProfileResponse::from(created_coop)),
    ))
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
        let coop = resolve_caller_cooperative(&state, &claims).await?;
        if coop.keycloak_id != id {
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
    Extension(audit_ctx): Extension<AuditContext>,
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

    let existing = state
        .keycloak
        .get_group_by_id(&id)
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

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
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "UPDATE",
            "cooperative",
            Some(&id),
            Some(serde_json::json!({"name": body.name, "description": body.description})),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    tracing::info!(group_id = %id, "Cooperative updated");
    Ok((StatusCode::OK, Json(CooperativeResponse::from(group))))
}

#[utoipa::path(
    get,
    path = "/api/v1/apex/cooperatives/{id}/delete-preview",
    params(("id" = String, Path, description = "Cooperative (Subgroup) ID")),
    responses(
        (status = 200, description = "Cascade delete preview", body = DeletePreviewResponse),
        (status = 403, description = "Forbidden - apex role required", body = ErrorResponse)
    ),
    tag = "Apex"
)]
pub async fn delete_cooperative_preview(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    assert_cooperative_belongs_to_apex(&state, &claims, &id).await?;

    let mut member_count = 0u64;

    if let Ok(members) = state.keycloak.get_group_members(&id).await {
        member_count += members.len() as u64;
    }

    Ok((
        StatusCode::OK,
        Json(DeletePreviewResponse {
            apexes: 0,
            cooperatives: 0,
            members: member_count,
        }),
    ))
}

#[utoipa::path(
    delete,
    path = "/api/v1/apex/cooperatives/{id}",
    params(("id" = String, Path, description = "Cooperative (Subgroup) ID")),
    responses(
        (status = 204, description = "Cooperative deleted"),
        (status = 403, description = "Forbidden - apex role required", body = ErrorResponse),
        (status = 404, description = "Cooperative not found", body = ErrorResponse),
        (status = 428, description = "Identity verification required", body = ErrorResponse)
    ),
    tag = "Apex"
)]
pub async fn delete_cooperative(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    // Scope: cooperative must belong to this apex
    assert_cooperative_belongs_to_apex(&state, &claims, &id).await?;

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
            "cooperative",
            Some(&id),
            None,
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    // Cascade: delete all cooperative members from Keycloak + PG
    if let Ok(members) = state.keycloak.get_group_members(&id).await {
        for member in &members {
            if let Err(e) = state.keycloak.delete_user(&member.id).await {
                tracing::warn!(user_id = %member.id, error = %e, "Failed to delete coop member");
            }
            if let Err(e) = state.user_repo.delete_by_keycloak_id(&member.id).await {
                tracing::warn!(user_id = %member.id, error = %e, "Failed to delete coop member from PG");
            }
        }
    }

    state
        .keycloak
        .delete_group(&id)
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    // Delete PG record
    if let Ok(Some(c)) = state.cooperative_repo.find_by_keycloak_id(&id).await {
        if let Err(e) = state.cooperative_repo.delete(c.id).await {
            tracing::warn!(error = %e, "Failed to delete cooperative PG record");
        }
    }

    tracing::info!(group_id = %id, "Cooperative cascade-deleted");
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

    let status = derive_status_from_user(user.email_verified, &user.required_actions).to_string();
    Ok((
        StatusCode::CREATED,
        Json(MemberResponse {
            id: user.id,
            username: user.username.into(),
            email: user.email,
            first_name: Some(first_name).filter(|s| !s.is_empty()),
            last_name: Some(last_name).filter(|s| !s.is_empty()),
            status,
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
        let coop = resolve_caller_cooperative(&state, &claims).await?;
        if coop.keycloak_id != id {
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
    Extension(audit_ctx): Extension<AuditContext>,
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

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "UPDATE_MEMBER",
            "cooperative_member",
            Some(&user_id),
            Some(serde_json::json!({"group_id": &group_id, "first_name": body.first_name, "last_name": body.last_name})),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    tracing::info!(group_id = %group_id, user_id = %user_id, "Cooperative member updated");
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
    Extension(audit_ctx): Extension<AuditContext>,
    Path((group_id, user_id)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
    // Scope: cooperative must belong to this apex
    assert_cooperative_belongs_to_apex(&state, &claims, &group_id).await?;

    state
        .keycloak
        .remove_user_from_group(&user_id, &group_id)
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

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
    Extension(audit_ctx): Extension<AuditContext>,
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

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "RESEND_VERIFICATION",
            "cooperative_member",
            Some(&user_id),
            Some(serde_json::json!({"group_id": &group_id})),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

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

// ─── Cooperative Profile CRUD (US2.1) ─────────────────────────────────────────

const VALID_COOP_TYPES: &[&str] = &[
    "sacco",
    "multipurpose",
    "farm",
    "housing",
    "transport",
    "finance",
    "other",
];
const VALID_GEO_CLASSIF: &[&str] = &["Urban", "Rural"];
const VALID_COOP_STATUS: &[&str] = &["Active", "Inactive", "Suspended"];
const VALID_ACCOUNTING_YEAR: &[&str] = &["calendar", "fiscal"];
const VALID_REGIONS: &[&str] = &["Hhohho", "Lubombo", "Manzini", "Shiselweni"];

/// Resolves the calling apex user's apex group to a database UUID.
/// Used for scope enforcement in cooperative profile endpoints.
/// Returns `AppError::Forbidden` if the user has no apex group or the
/// apex group is not registered in the database.
pub async fn resolve_caller_apex_db_id_pub(state: &AppState, claims: &Claims) -> AppResult<Uuid> {
    resolve_caller_apex_db_id(state, claims).await
}

async fn resolve_caller_apex_db_id(state: &AppState, claims: &Claims) -> AppResult<Uuid> {
    let apex_id_or_path = claims
        .get_apex_group_id()
        .ok_or_else(|| AppError::Forbidden("User is not associated with an apex group".into()))?;

    let apex = state
        .keycloak
        .resolve_group(&apex_id_or_path)
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    let apex_pg = state
        .apex_repo
        .find_by_keycloak_id(&apex.id)
        .await
        .ok()
        .flatten()
        .ok_or_else(|| AppError::Forbidden("Apex group not found in database".into()))?;

    Ok(apex_pg.id)
}

/// Resolves the calling cooperative user's DB record from JWT claims.
/// The JWT `cooperation` claim contains Keycloak group paths using names
/// (e.g. "/apex-name/coop-name"), but the DB stores the Keycloak group UUID.
/// This function resolves the full path via the Keycloak API to get the UUID,
/// then looks up the cooperative in the database.
pub(crate) async fn resolve_caller_cooperative(
    state: &AppState,
    claims: &Claims,
) -> AppResult<cooperative::Model> {
    let paths = claims.get_cooperation_paths();
    let path = paths.first().ok_or_else(|| {
        AppError::Forbidden("Cooperative user has no cooperation group associated".into())
    })?;

    let group = state
        .keycloak
        .resolve_group(path)
        .await
        .map_err(|e| AppError::ExternalServiceError(e.to_string()))?;

    let coop = state
        .cooperative_repo
        .find_by_keycloak_id(&group.id)
        .await
        .ok()
        .flatten()
        .ok_or_else(|| {
            AppError::NotFound(
                "Cooperative profile not found. Contact your Apex to set up your profile.".into(),
            )
        })?;

    Ok(coop)
}

/// Resolves the cooperative IDs the caller is allowed to access.
/// For cooperative users: returns their own cooperative ID.
/// For apex users: returns all cooperative IDs under their apex.
/// For federation users: returns all cooperative IDs under all apexes in their federation.
/// For ministry users: returns all cooperative IDs (ministry sees everything).
pub async fn resolve_caller_cooperative_ids(
    state: &AppState,
    claims: &Claims,
) -> AppResult<Vec<Uuid>> {
    if claims.has_role("ministry") {
        let all = state.cooperative_repo.list_all().await?;
        Ok(all.iter().map(|c| c.id).collect())
    } else if claims.has_role("federation") {
        let org_id = claims
            .get_organization_id()
            .ok_or_else(|| AppError::Forbidden("Federation user has no organization associated".into()))?;
        let federation = state
            .federation_repo
            .find_by_keycloak_id(&org_id)
            .await?
            .ok_or_else(|| AppError::Forbidden("Federation not found in database".into()))?;
        let apexes = state.apex_repo.find_by_federation_id(federation.id).await?;
        let mut coop_ids: Vec<Uuid> = vec![];
        for apex in &apexes {
            let coops = state.cooperative_repo.find_by_apex_id(apex.id).await?;
            coop_ids.extend(coops.iter().map(|c| c.id));
        }
        Ok(coop_ids)
    } else if claims.has_role("apex") {
        let apex_db_id = resolve_caller_apex_db_id(state, claims).await?;
        let cooperatives = state.cooperative_repo.find_by_apex_id(apex_db_id).await?;
        Ok(cooperatives.iter().map(|c| c.id).collect())
    } else {
        let coop = resolve_caller_cooperative(state, claims).await?;
        Ok(vec![coop.id])
    }
}

/// Resolves a single cooperative ID for NF list handlers.
/// For cooperative users: returns their own cooperative ID.
/// For apex/federation/ministry users: looks up the submission by submission_id,
/// verifies it belongs to one of the caller's cooperatives, and returns the submission's cooperative_id.
pub async fn resolve_cooperative_id_for_nf(
    state: &AppState,
    claims: &Claims,
    submission_id: Option<Uuid>,
) -> AppResult<Uuid> {
    if claims.has_role("apex") || claims.has_role("federation") || claims.has_role("ministry") {
        let sub_id = submission_id.ok_or_else(|| {
            AppError::BadRequest("submission_id is required for apex/federation/ministry users".into())
        })?;
        let submission = state
            .submission_repo
            .find_by_id(sub_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;
        let coop_ids = resolve_caller_cooperative_ids(state, claims).await?;
        if !coop_ids.contains(&submission.cooperative_id) {
            return Err(AppError::Forbidden(
                "Submission does not belong to your cooperatives".into(),
            ));
        }
        Ok(submission.cooperative_id)
    } else {
        state.cooperative_id_from_claims(claims).await
    }
}

/// Verifies that a cooperative profile belongs to the calling apex user's group.
/// Compares the cooperative's `apex_id` against the caller's resolved apex DB ID.
async fn assert_profile_belongs_to_apex(
    state: &AppState,
    claims: &Claims,
    coop: &cooperative::Model,
) -> AppResult<()> {
    let caller_apex_id = resolve_caller_apex_db_id(state, claims).await?;
    if coop.apex_id != caller_apex_id {
        tracing::warn!(
            coop_id = %coop.id,
            coop_apex_id = %coop.apex_id,
            caller_apex_id = %caller_apex_id,
            user_id = %claims.sub,
            "Scope violation: attempted to access cooperative profile from another apex"
        );
        return Err(AppError::Forbidden(
            "Access denied: this cooperative does not belong to your apex".into(),
        ));
    }
    Ok(())
}

#[utoipa::path(
    post,
    path = "/api/v1/apex/coop-profiles",
    request_body = CreateCooperativeProfileRequest,
    responses(
        (status = 201, description = "Cooperative profile created", body = CooperativeProfileResponse),
        (status = 400, description = "Invalid input"),
        (status = 403, description = "Forbidden"),
        (status = 409, description = "Cooperative with this reg_no already exists")
    ),
    tag = "Cooperatives"
)]
pub async fn create_cooperative_profile(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Json(body): Json<CreateCooperativeProfileRequest>,
) -> AppResult<impl IntoResponse> {
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("Cooperative name is required".into()));
    }
    if body.reg_no.trim().is_empty() {
        return Err(AppError::BadRequest(
            "Registration number (reg_no) is required".into(),
        ));
    }
    if !VALID_COOP_TYPES.contains(&body.institution_type.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid institution_type. Must be one of: {}",
            VALID_COOP_TYPES.join(", ")
        )));
    }
    if !VALID_GEO_CLASSIF.contains(&body.geographic_classif.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid geographic_classif. Must be one of: {}",
            VALID_GEO_CLASSIF.join(", ")
        )));
    }
    if !VALID_COOP_STATUS.contains(&body.status.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid status. Must be one of: {}",
            VALID_COOP_STATUS.join(", ")
        )));
    }
    if !VALID_ACCOUNTING_YEAR.contains(&body.accounting_year.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid accounting_year. Must be one of: {}",
            VALID_ACCOUNTING_YEAR.join(", ")
        )));
    }
    if !VALID_REGIONS.contains(&body.region.as_str()) {
        return Err(AppError::BadRequest(format!(
            "Invalid region. Must be one of: {}",
            VALID_REGIONS.join(", ")
        )));
    }

    if state
        .cooperative_repo
        .find_by_reg_no(&body.reg_no)
        .await?
        .is_some()
    {
        return Err(AppError::Conflict(format!(
            "Cooperative with reg_no '{}' already exists",
            body.reg_no
        )));
    }

    let apex_id = resolve_caller_apex_db_id(&state, &claims).await?;

    let now = chrono::Utc::now();
    let model = cooperative::ActiveModel {
        id: sea_orm::Set(Uuid::new_v4()),
        keycloak_id: sea_orm::Set(String::new()),
        apex_id: sea_orm::Set(apex_id),
        display_name: sea_orm::Set(body.name.clone()),
        keycloak_group_id: sea_orm::Set(None),
        apex_group_id: sea_orm::Set(body.apex_group_id),
        federation_org_id: sea_orm::Set(body.federation_org_id),
        name: sea_orm::Set(body.name.clone()),
        institution_type: sea_orm::Set(CooperativeType::parse(&body.institution_type)),
        reg_no: sea_orm::Set(Some(body.reg_no.clone())),
        tin: sea_orm::Set(body.tin.clone()),
        address: sea_orm::Set(body.address.clone()),
        georeference: sea_orm::Set(body.georeference.clone()),
        region: sea_orm::Set(EswatiniRegion::parse(&body.region)),
        geographic_classif: sea_orm::Set(UrbanRural::parse(&body.geographic_classif)),
        phone: sea_orm::Set(body.phone.clone()),
        sector: sea_orm::Set(Some(body.sector.clone())),
        responsible_financial: sea_orm::Set(body.responsible_financial),
        responsible_non_financial: sea_orm::Set(body.responsible_non_financial),
        status: sea_orm::Set(CoopStatus::parse(&body.status).unwrap_or(CoopStatus::Active)),
        registered_on: sea_orm::Set(Some(body.registered_on)),
        accounting_year: sea_orm::Set(
            AccountingYear::parse(&body.accounting_year).unwrap_or(AccountingYear::Calendar),
        ),
        created_at: sea_orm::Set(now),
        updated_at: sea_orm::Set(now),
    };

    let created = state.cooperative_repo.create(model).await?;

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "CREATE",
            "cooperative_profile",
            Some(&created.id.to_string()),
            Some(serde_json::json!({
                "name": &body.name,
                "reg_no": &body.reg_no,
                "institution_type": &body.institution_type
            })),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    tracing::info!(
        coop_id = %created.id,
        reg_no = %body.reg_no,
        "Cooperative profile created"
    );
    Ok((
        StatusCode::CREATED,
        Json(CooperativeProfileResponse::from(created)),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/apex/coop-profiles",
    responses(
        (status = 200, description = "List of cooperatives", body = Vec<CooperativeProfileResponse>),
        (status = 403, description = "Forbidden")
    ),
    tag = "Cooperatives"
)]
pub async fn list_cooperative_profiles(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    let apex_id = resolve_caller_apex_db_id(&state, &claims).await?;
    let coops = state.cooperative_repo.find_by_apex_id(apex_id).await?;

    let responses: Vec<CooperativeProfileResponse> = coops.into_iter().map(Into::into).collect();
    Ok((StatusCode::OK, Json(responses)))
}

#[utoipa::path(
    get,
    path = "/api/v1/apex/coop-profiles/{id}",
    params(("id" = Uuid, Path, description = "Cooperative ID")),
    responses(
        (status = 200, description = "Cooperative profile", body = CooperativeProfileResponse),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Cooperative not found")
    ),
    tag = "Cooperatives"
)]
pub async fn get_cooperative_profile(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop = state
        .cooperative_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Cooperative not found".into()))?;

    assert_profile_belongs_to_apex(&state, &claims, &coop).await?;

    Ok((StatusCode::OK, Json(CooperativeProfileResponse::from(coop))))
}

#[utoipa::path(
    patch,
    path = "/api/v1/apex/coop-profiles/{id}",
    params(("id" = Uuid, Path, description = "Cooperative ID")),
    request_body = UpdateCooperativeProfileRequest,
    responses(
        (status = 200, description = "Cooperative updated", body = CooperativeProfileResponse),
        (status = 400, description = "Invalid input"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Cooperative not found"),
        (status = 409, description = "reg_no conflict")
    ),
    tag = "Cooperatives"
)]
pub async fn update_cooperative_profile(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateCooperativeProfileRequest>,
) -> AppResult<impl IntoResponse> {
    let existing = state
        .cooperative_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Cooperative not found".into()))?;

    assert_profile_belongs_to_apex(&state, &claims, &existing).await?;

    if let Some(ref reg_no) = body.reg_no {
        if reg_no.trim().is_empty() {
            return Err(AppError::BadRequest("reg_no cannot be empty".into()));
        }
        if let Some(conflict) = state.cooperative_repo.find_by_reg_no(reg_no).await? {
            if conflict.id != id {
                return Err(AppError::Conflict(format!(
                    "Cooperative with reg_no '{}' already exists",
                    reg_no
                )));
            }
        }
    }

    if let Some(ref status) = body.status {
        if !VALID_COOP_STATUS.contains(&status.as_str()) {
            return Err(AppError::BadRequest(format!(
                "Invalid status. Must be one of: {}",
                VALID_COOP_STATUS.join(", ")
            )));
        }
    }
    if let Some(ref accounting_year) = body.accounting_year {
        if !VALID_ACCOUNTING_YEAR.contains(&accounting_year.as_str()) {
            return Err(AppError::BadRequest(format!(
                "Invalid accounting_year. Must be one of: {}",
                VALID_ACCOUNTING_YEAR.join(", ")
            )));
        }
    }
    if let Some(ref geo) = body.geographic_classif {
        if !VALID_GEO_CLASSIF.contains(&geo.as_str()) {
            return Err(AppError::BadRequest(format!(
                "Invalid geographic_classif. Must be one of: {}",
                VALID_GEO_CLASSIF.join(", ")
            )));
        }
    }
    if let Some(ref ct) = body.institution_type {
        if !VALID_COOP_TYPES.contains(&ct.as_str()) {
            return Err(AppError::BadRequest(format!(
                "Invalid institution_type. Must be one of: {}",
                VALID_COOP_TYPES.join(", ")
            )));
        }
    }
    if let Some(ref region) = body.region {
        if !VALID_REGIONS.contains(&region.as_str()) {
            return Err(AppError::BadRequest(format!(
                "Invalid region. Must be one of: {}",
                VALID_REGIONS.join(", ")
            )));
        }
    }

    let mut model: cooperative::ActiveModel = existing.into();
    if let Some(ref v) = body.name {
        model.name = sea_orm::Set(v.clone());
    }
    if let Some(ref v) = body.institution_type {
        model.institution_type = sea_orm::Set(CooperativeType::parse(v));
    }
    if let Some(ref v) = body.reg_no {
        model.reg_no = sea_orm::Set(Some(v.clone()));
    }
    if let Some(ref v) = body.tin {
        model.tin = sea_orm::Set(Some(v.clone()));
    }
    if let Some(ref v) = body.address {
        model.address = sea_orm::Set(Some(v.clone()));
    }
    if let Some(ref v) = body.georeference {
        model.georeference = sea_orm::Set(Some(v.clone()));
    }
    if let Some(ref v) = body.region {
        model.region = sea_orm::Set(EswatiniRegion::parse(v));
    }
    if let Some(ref v) = body.geographic_classif {
        model.geographic_classif = sea_orm::Set(UrbanRural::parse(v));
    }
    if let Some(ref v) = body.phone {
        model.phone = sea_orm::Set(Some(v.clone()));
    }
    if let Some(ref v) = body.sector {
        model.sector = sea_orm::Set(Some(v.clone()));
    }
    if let Some(ref v) = body.responsible_financial {
        model.responsible_financial = sea_orm::Set(Some(*v));
    }
    if let Some(ref v) = body.responsible_non_financial {
        model.responsible_non_financial = sea_orm::Set(Some(*v));
    }
    if let Some(ref v) = body.status {
        model.status = sea_orm::Set(CoopStatus::parse(v).unwrap_or(CoopStatus::Active));
    }
    if let Some(ref v) = body.registered_on {
        model.registered_on = sea_orm::Set(Some(*v));
    }
    if let Some(ref v) = body.accounting_year {
        model.accounting_year =
            sea_orm::Set(AccountingYear::parse(v).unwrap_or(AccountingYear::Calendar));
    }
    model.updated_at = sea_orm::Set(chrono::Utc::now());

    let updated = state.cooperative_repo.update(model).await?;

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "UPDATE",
            "cooperative_profile",
            Some(&id.to_string()),
            Some(serde_json::json!({
                "name": body.name,
                "reg_no": body.reg_no,
                "status": body.status
            })),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    tracing::info!(coop_id = %id, "Cooperative profile updated");
    Ok((
        StatusCode::OK,
        Json(CooperativeProfileResponse::from(updated)),
    ))
}

#[utoipa::path(
    delete,
    path = "/api/v1/apex/coop-profiles/{id}",
    params(("id" = Uuid, Path, description = "Cooperative ID")),
    responses(
        (status = 204, description = "Cooperative deleted"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Cooperative not found")
    ),
    tag = "Cooperatives"
)]
pub async fn delete_cooperative_profile(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Extension(audit_ctx): Extension<AuditContext>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let existing = state
        .cooperative_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Cooperative not found".into()))?;

    assert_profile_belongs_to_apex(&state, &claims, &existing).await?;

    if let Err(e) = state
        .audit
        .log(
            &claims,
            "DELETE",
            "cooperative_profile",
            Some(&id.to_string()),
            Some(serde_json::json!({"name": existing.name, "reg_no": existing.reg_no})),
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    {
        tracing::error!("Failed to log audit: {}", e);
    }

    state.cooperative_repo.delete(id).await?;
    tracing::info!(coop_id = %id, "Cooperative profile deleted");
    Ok((StatusCode::NO_CONTENT, ()))
}
