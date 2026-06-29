use std::sync::Arc;
use axum::{extract::{Path, State}, http::StatusCode, response::IntoResponse, Json};
use axum::extract::Extension;

use crate::api::dto::federation::{CreateFederationRequest, FederationResponse, UpdateFederationRequest};
use crate::api::dto::invitation::{CreateInvitationRequest, InvitationResponse};
use crate::api::dto::member::MemberResponse;
use crate::auth::claims::Claims;
use crate::error::AppResult;
use crate::AppState;

#[utoipa::path(
    post,
    path = "/api/v1/ministry/federations",
    request_body = CreateFederationRequest,
    responses(
        (status = 201, description = "Federation created", body = FederationResponse),
        (status = 400, description = "Invalid input", body = ErrorResponse),
        (status = 403, description = "Forbidden - ministry role required", body = ErrorResponse)
    ),
    tag = "Ministry"
)]
pub async fn create_federation(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(body): Json<CreateFederationRequest>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_ministry() {
        return Err(crate::error::AppError::Forbidden("Access denied. Ministry role required".into()));
    }

    if body.name.trim().is_empty() {
        return Err(crate::error::AppError::BadRequest("Federation name is required".into()));
    }

    let domains: Vec<crate::models::keycloak::KeycloakOrganizationDomain> = body.domains.iter()
        .map(|d| crate::models::keycloak::KeycloakOrganizationDomain { name: d.name.clone(), verified: false })
        .collect();

    let mut attrs = body.attributes.clone().unwrap_or_default();
    if let Some(ref desc) = body.description {
        attrs.insert("description".to_string(), vec![desc.clone()]);
    }

    let org = state.keycloak.create_organization(
        &body.name,
        domains,
        Some(state.config.frontend_url.clone()),
        if attrs.is_empty() { None } else { Some(attrs) },
    ).await.map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    tracing::info!(org_id = %org.id, name = %org.name, "Federation created");
    Ok((StatusCode::CREATED, Json(FederationResponse::from(org))))
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/federations",
    responses(
        (status = 200, description = "List of federations", body = Vec<FederationResponse>),
        (status = 403, description = "Forbidden - ministry role required", body = ErrorResponse)
    ),
    tag = "Ministry"
)]
pub async fn list_federations(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_ministry() {
        return Err(crate::error::AppError::Forbidden("Access denied. Ministry role required".into()));
    }

    let orgs = state.keycloak.get_organizations().await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    let federations: Vec<FederationResponse> = orgs.into_iter().map(FederationResponse::from).collect();
    Ok((StatusCode::OK, Json(federations)))
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/federations/{id}",
    params(("id" = String, Path, description = "Federation (Organization) ID")),
    responses(
        (status = 200, description = "Federation found", body = FederationResponse),
        (status = 404, description = "Federation not found", body = ErrorResponse)
    ),
    tag = "Ministry"
)]
pub async fn get_federation(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_ministry() {
        return Err(crate::error::AppError::Forbidden("Access denied. Ministry role required".into()));
    }

    let org = state.keycloak.get_organization_by_id(&id).await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    Ok((StatusCode::OK, Json(FederationResponse::from(org))))
}

#[utoipa::path(
    patch,
    path = "/api/v1/ministry/federations/{id}",
    params(("id" = String, Path, description = "Federation (Organization) ID")),
    request_body = UpdateFederationRequest,
    responses(
        (status = 200, description = "Federation updated", body = FederationResponse),
        (status = 403, description = "Forbidden", body = ErrorResponse),
        (status = 404, description = "Federation not found", body = ErrorResponse)
    ),
    tag = "Ministry"
)]
pub async fn update_federation(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateFederationRequest>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_ministry() {
        return Err(crate::error::AppError::Forbidden("Access denied. Ministry role required".into()));
    }

    let domains = body.domains.map(|d| {
        d.into_iter().map(|d| crate::models::keycloak::KeycloakOrganizationDomain { name: d.name, verified: false }).collect::<Vec<_>>()
    });

    let mut attrs = body.attributes.clone().unwrap_or_default();
    if let Some(ref desc) = body.description {
        attrs.insert("description".to_string(), vec![desc.clone()]);
    }

    let org = state.keycloak.update_organization(
        &id,
        body.name.as_deref(),
        body.description.as_deref(),
        domains,
        if attrs.is_empty() { None } else { Some(attrs) },
    ).await.map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    tracing::info!(org_id = %id, "Federation updated");
    Ok((StatusCode::OK, Json(FederationResponse::from(org))))
}

#[utoipa::path(
    delete,
    path = "/api/v1/ministry/federations/{id}",
    params(("id" = String, Path, description = "Federation (Organization) ID")),
    responses(
        (status = 204, description = "Federation deleted"),
        (status = 403, description = "Forbidden", body = ErrorResponse),
        (status = 404, description = "Federation not found", body = ErrorResponse)
    ),
    tag = "Ministry"
)]
pub async fn delete_federation(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_ministry() {
        return Err(crate::error::AppError::Forbidden("Access denied. Ministry role required".into()));
    }

    state.keycloak.delete_organization(&id).await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    tracing::info!(org_id = %id, "Federation deleted");
    Ok((StatusCode::NO_CONTENT, ()))
}

#[utoipa::path(
    post,
    path = "/api/v1/ministry/federations/{id}/invitations",
    params(("id" = String, Path, description = "Federation (Organization) ID")),
    request_body = CreateInvitationRequest,
    responses(
        (status = 201, description = "User invited to federation", body = InvitationResponse),
        (status = 403, description = "Forbidden", body = ErrorResponse),
        (status = 409, description = "User already in organization", body = ErrorResponse)
    ),
    tag = "Ministry"
)]
pub async fn invite_user_to_federation(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
    Json(body): Json<CreateInvitationRequest>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_ministry() {
        return Err(crate::error::AppError::Forbidden("Access denied. Ministry role required".into()));
    }

    if body.email.trim().is_empty() {
        return Err(crate::error::AppError::BadRequest("Email is required".into()));
    }

    let valid_roles = ["federation", "apex", "cooperative"];
    if !valid_roles.contains(&body.role.as_str()) {
        return Err(crate::error::AppError::BadRequest(
            format!("Invalid role '{}'. Valid roles: {}", body.role, valid_roles.join(", "))
        ));
    }

    let redirect_url = body.redirect_url.clone().unwrap_or_else(|| state.config.frontend_url.clone());

    let invitation = state.keycloak.invite_user_to_organization(
        &id,
        &body.email,
        &body.first_name,
        &body.last_name,
        &body.role,
        &redirect_url,
    ).await.map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    tracing::info!(org_id = %id, email = %body.email, role = %body.role, "User invited to federation");
    Ok((StatusCode::CREATED, Json(InvitationResponse::from(invitation))))
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/federations/{id}/invitations",
    params(("id" = String, Path, description = "Federation (Organization) ID")),
    responses(
        (status = 200, description = "List of invitations", body = Vec<InvitationResponse>)
    ),
    tag = "Ministry"
)]
pub async fn list_federation_invitations(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_ministry() {
        return Err(crate::error::AppError::Forbidden("Access denied. Ministry role required".into()));
    }

    let invitations = state.keycloak.get_organization_invitations(&id).await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    let responses: Vec<InvitationResponse> = invitations.into_iter().map(InvitationResponse::from).collect();
    Ok((StatusCode::OK, Json(responses)))
}

#[utoipa::path(
    delete,
    path = "/api/v1/ministry/federations/{id}/invitations/{invitation_id}",
    params(
        ("id" = String, Path, description = "Federation (Organization) ID"),
        ("invitation_id" = String, Path, description = "Invitation ID")
    ),
    responses(
        (status = 204, description = "Invitation cancelled")
    ),
    tag = "Ministry"
)]
pub async fn delete_federation_invitation(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path((id, invitation_id)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_ministry() {
        return Err(crate::error::AppError::Forbidden("Access denied. Ministry role required".into()));
    }

    state.keycloak.delete_organization_invitation(&id, &invitation_id).await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    Ok((StatusCode::NO_CONTENT, ()))
}

#[utoipa::path(
    post,
    path = "/api/v1/ministry/federations/{id}/invitations/{invitation_id}/resend",
    params(
        ("id" = String, Path, description = "Federation (Organization) ID"),
        ("invitation_id" = String, Path, description = "Invitation ID")
    ),
    responses(
        (status = 200, description = "Invitation resent")
    ),
    tag = "Ministry"
)]
pub async fn resend_federation_invitation(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path((id, invitation_id)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_ministry() {
        return Err(crate::error::AppError::Forbidden("Access denied. Ministry role required".into()));
    }

    state.keycloak.resend_organization_invitation(&id, &invitation_id).await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    Ok((StatusCode::OK, Json(serde_json::json!({ "message": "Invitation resent" }))))
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/federations/{id}/members",
    params(("id" = String, Path, description = "Federation (Organization) ID")),
    responses(
        (status = 200, description = "List of federation members", body = Vec<MemberResponse>)
    ),
    tag = "Ministry"
)]
pub async fn list_federation_members(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_ministry() {
        return Err(crate::error::AppError::Forbidden("Access denied. Ministry role required".into()));
    }

    let members = state.keycloak.get_organization_members(&id).await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    let responses: Vec<MemberResponse> = members.into_iter().map(MemberResponse::from).collect();
    Ok((StatusCode::OK, Json(responses)))
}