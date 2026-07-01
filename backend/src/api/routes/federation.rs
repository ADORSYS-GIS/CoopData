//! Federation-level routes (Level 2 in the 4-level IAM hierarchy).
//!
//! Federation users are organization administrators who can:
//! - Create, read, update, delete apexes within their federation
//! - Manage members in their apexes
//! - View and update their federation's profile
//!
//! All routes require the `federation` role.
//! Scope enforcement ensures users can only access their own federation's data.

use axum::{
    extract::{Extension, Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{error, info, instrument};

use crate::api::dto::apex::{ApexResponse, CreateApexRequest, UpdateApexRequest};
use crate::api::dto::common::{PaginatedResponse, PaginationParams, SuccessResponse};
use crate::api::dto::member::{AddMemberRequest, MemberResponse};
use crate::api::handlers;
use crate::auth::claims::Claims;
use crate::auth::rbac::ScopeEnforcement;
use crate::error::AppResult;
use crate::AppState;

/// Creates the Federation routes router.
/// All routes are prefixed with `/api/v1/federation`.
///
/// # Required Role
/// `federation`
///
/// # Scope Enforcement
/// Federation users can only access apexes within their own organization.
/// The `organization_keycloak_id` from JWT claims must match the requested data.
///
/// # Routes
/// - `POST /apexes` - Create a new apex
/// - `GET /apexes` - List apexes (scoped to user's federation)
/// - `GET /apexes/:id` - Get an apex by ID
/// - `PATCH /apexes/:id` - Update an apex
/// - `DELETE /apexes/:id` - Delete an apex
/// - `POST /apexes/:id/members` - Add member to apex
/// - `GET /apexes/:id/members` - List apex members
/// - `DELETE /apexes/:group_id/members/:user_id` - Remove member from apex
/// - `GET /profile` - Get federation profile
/// - `PATCH /profile` - Update federation profile
pub fn federation_routes() -> Router<AppState> {
    Router::new()
        // Apex CRUD
        .route("/apexes", post(create_apex).get(list_apexes))
        .route(
            "/apexes/:id",
            get(get_apex).patch(update_apex).delete(delete_apex),
        )
        // Apex Members
        .route(
            "/apexes/:id/members",
            post(add_apex_member).get(list_apex_members),
        )
        .route(
            "/apexes/:group_id/members/:user_id",
            delete(remove_apex_member).patch(handlers::apex::update_apex_member),
        )
        .route(
            "/apexes/:group_id/members/:user_id/resend-verification",
            post(handlers::apex::resend_apex_member_verification),
        )
        // Federation Profile
        .route(
            "/profile",
            get(handlers::federation::get_federation_profile)
                .patch(handlers::federation::update_federation_profile),
        )
        // Federation Stats
        .route("/stats", get(handlers::federation::get_federation_stats))
}

// ============================================================================
// Apex Handlers
// ============================================================================

/// Create a new apex within the federation.
///
/// Creates a Keycloak group under the federation's organization scope.
/// The apex name must be unique within the federation.
#[instrument(skip(state, claims))]
async fn create_apex(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
    Json(body): Json<CreateApexRequest>,
) -> AppResult<(StatusCode, Json<ApexResponse>)> {
    let org_id = ScopeEnforcement::get_federation_org_id(&claims)?;

    if body.name.trim().is_empty() {
        return Err(crate::error::AppError::BadRequest(
            "Apex name is required".to_string(),
        ));
    }

    let mut attributes = HashMap::new();
    if let Some(ref desc) = body.description {
        attributes.insert("description".to_string(), vec![desc.clone()]);
    }
    attributes.insert("organization_id".to_string(), vec![org_id.clone()]);

    let group = state
        .keycloak
        .create_group(&body.name, Some(attributes))
        .await
        .map_err(|e| {
            error!(error = %e, "Failed to create apex group");
            e
        })?;

    info!(
        apex_id = %group.id,
        apex_name = %group.name,
        org_id = %org_id,
        "Apex created"
    );

    let response = ApexResponse::from(group);
    Ok((StatusCode::CREATED, Json(response)))
}

/// List apexes within the federation.
///
/// Returns all groups that belong to the federation's organization scope.
/// Groups are filtered by the `organization_id` attribute matching the
/// federation's Keycloak organization ID.
#[instrument(skip(state, claims))]
async fn list_apexes(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> AppResult<Json<PaginatedResponse<ApexResponse>>> {
    let org_id = ScopeEnforcement::get_federation_org_id(&claims)?;

    let all_groups = state.keycloak.get_groups(None).await.map_err(|e| {
        error!(error = %e, "Failed to list groups");
        e
    })?;

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

    let total = apexes.len() as u64;
    let offset = params.offset() as usize;
    let limit = params.limit() as usize;

    let data: Vec<ApexResponse> = apexes.into_iter().skip(offset).take(limit).collect();

    Ok(Json(PaginatedResponse::new(
        data,
        total,
        params.page,
        params.per_page,
    )))
}

/// Get an apex by ID.
///
/// Returns the apex details if it belongs to the federation's organization scope.
#[instrument(skip(state, claims))]
async fn get_apex(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<ApexResponse>> {
    let org_id = ScopeEnforcement::get_federation_org_id(&claims)?;

    let group = state.keycloak.get_group_by_id(&id).await.map_err(|e| {
        error!(apex_id = %id, error = %e, "Failed to get apex");
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
            "Access denied: apex does not belong to your federation".to_string(),
        ));
    }

    Ok(Json(ApexResponse::from(group)))
}

/// Update an apex.
///
/// Updates the apex name and/or description. Only fields provided in the
/// request body will be updated.
#[instrument(skip(state, claims))]
async fn update_apex(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<UpdateApexRequest>,
) -> AppResult<Json<ApexResponse>> {
    let org_id = ScopeEnforcement::get_federation_org_id(&claims)?;

    let existing = state.keycloak.get_group_by_id(&id).await.map_err(|e| {
        error!(apex_id = %id, error = %e, "Failed to get apex for update");
        e
    })?;

    let group_org_id = existing
        .attributes
        .as_ref()
        .and_then(|attrs| attrs.get("organization_id"))
        .and_then(|vals| vals.first())
        .cloned()
        .unwrap_or_default();

    if group_org_id != org_id {
        return Err(crate::error::AppError::Forbidden(
            "Access denied: apex does not belong to your federation".to_string(),
        ));
    }

    let mut attributes = existing.attributes.unwrap_or_default();
    if let Some(ref desc) = body.description {
        attributes.insert("description".to_string(), vec![desc.clone()]);
    }
    attributes.insert("organization_id".to_string(), vec![org_id]);

    let updated = state
        .keycloak
        .update_group(&id, body.name.as_deref(), Some(attributes))
        .await
        .map_err(|e| {
            error!(apex_id = %id, error = %e, "Failed to update apex");
            e
        })?;

    info!(apex_id = %id, "Apex updated");
    Ok(Json(ApexResponse::from(updated)))
}

/// Delete an apex.
///
/// Deletes the apex group from Keycloak. This also removes all sub-groups
/// (cooperatives) and member associations.
#[instrument(skip(state, claims))]
async fn delete_apex(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<(StatusCode, Json<SuccessResponse>)> {
    let org_id = ScopeEnforcement::get_federation_org_id(&claims)?;

    let group = state.keycloak.get_group_by_id(&id).await.map_err(|e| {
        error!(apex_id = %id, error = %e, "Failed to get apex for deletion");
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
            "Access denied: apex does not belong to your federation".to_string(),
        ));
    }

    state.keycloak.delete_group(&id).await.map_err(|e| {
        error!(apex_id = %id, error = %e, "Failed to delete apex");
        e
    })?;

    info!(apex_id = %id, "Apex deleted");
    Ok((
        StatusCode::OK,
        Json(SuccessResponse {
            message: "Apex deleted successfully".to_string(),
            id: None,
        }),
    ))
}

// ============================================================================
// Apex Member Handlers
// ============================================================================

/// Add a member to an apex.
///
/// Creates a new user or adds an existing user to the apex group.
/// The user will be assigned the `apex` role and added to the group.
#[instrument(skip(state, claims))]
async fn add_apex_member(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<AddMemberRequest>,
) -> AppResult<(StatusCode, Json<MemberResponse>)> {
    let org_id = ScopeEnforcement::get_federation_org_id(&claims)?;

    let group = state.keycloak.get_group_by_id(&id).await.map_err(|e| {
        error!(apex_id = %id, error = %e, "Failed to get apex for member addition");
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
            "Access denied: apex does not belong to your federation".to_string(),
        ));
    }

    if body.email.trim().is_empty() {
        return Err(crate::error::AppError::BadRequest(
            "Member email is required".to_string(),
        ));
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
        .await
        .map_err(|e| {
            error!(apex_id = %id, email = %body.email, error = %e, "Failed to add member to apex");
            e
        })?;

    info!(
        apex_id = %id,
        user_id = %user.id,
        email = %body.email,
        "Member added to apex"
    );

    let response = MemberResponse::from(crate::models::keycloak::KeycloakMember {
        id: user.id,
        username: Some(user.username),
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
    });

    Ok((StatusCode::CREATED, Json(response)))
}

/// List members of an apex.
///
/// Returns all members of the specified apex group.
#[instrument(skip(state, claims))]
async fn list_apex_members(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> AppResult<Json<Vec<MemberResponse>>> {
    let org_id = ScopeEnforcement::get_federation_org_id(&claims)?;

    let group = state.keycloak.get_group_by_id(&id).await.map_err(|e| {
        error!(apex_id = %id, error = %e, "Failed to get apex for member listing");
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
            "Access denied: apex does not belong to your federation".to_string(),
        ));
    }

    let members = state.keycloak.get_group_members(&id).await.map_err(|e| {
        error!(apex_id = %id, error = %e, "Failed to list apex members");
        e
    })?;

    let response: Vec<MemberResponse> = members.into_iter().map(MemberResponse::from).collect();

    Ok(Json(response))
}

/// Remove a member from an apex.
///
/// Removes the user from the apex group in Keycloak.
#[instrument(skip(state, claims))]
async fn remove_apex_member(
    Extension(claims): Extension<Arc<Claims>>,
    State(state): State<AppState>,
    Path((group_id, user_id)): Path<(String, String)>,
) -> AppResult<(StatusCode, Json<SuccessResponse>)> {
    let org_id = ScopeEnforcement::get_federation_org_id(&claims)?;

    let group = state
        .keycloak
        .get_group_by_id(&group_id)
        .await
        .map_err(|e| {
            error!(group_id = %group_id, error = %e, "Failed to get apex for member removal");
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
            "Access denied: apex does not belong to your federation".to_string(),
        ));
    }

    state
        .keycloak
        .remove_user_from_group(&user_id, &group_id)
        .await
        .map_err(|e| {
            error!(group_id = %group_id, user_id = %user_id, error = %e, "Failed to remove member from apex");
            e
        })?;

    info!(group_id = %group_id, user_id = %user_id, "Member removed from apex");
    Ok((
        StatusCode::OK,
        Json(SuccessResponse {
            message: "Member removed from apex successfully".to_string(),
            id: None,
        }),
    ))
}
