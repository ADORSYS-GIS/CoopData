use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde_json::json;

use crate::api::dto::federation::{
    CreateFederationRequest, FederationResponse, UpdateFederationRequest,
};
use crate::api::dto::invitation::{CreateInvitationRequest, InvitationResponse};
use crate::api::dto::member::MemberResponse;
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
    Json(body): Json<CreateFederationRequest>,
) -> AppResult<impl IntoResponse> {
    if body.name.trim().is_empty() {
        return Err(crate::error::AppError::BadRequest(
            "Federation name is required".into(),
        ));
    }

    // Require at least one domain — the caller must supply it
    if body.domains.is_empty() {
        return Err(crate::error::AppError::BadRequest(
            "At least one domain is required (e.g. \"myfederation.org\")".into(),
        ));
    }

    // Validate each domain is non-empty
    for d in &body.domains {
        if d.name.trim().is_empty() {
            return Err(crate::error::AppError::BadRequest(
                "Domain name cannot be empty".into(),
            ));
        }
    }

    // Keycloak uses the org name as an alias — spaces and special chars are not allowed.
    // We store the display name in attributes and use a slugified version as the name.
    let display_name = body.name.trim().to_string();
    let slug = display_name
        .to_lowercase()
        .chars()
        .map(|c| if c.is_alphanumeric() { c } else { '-' })
        .collect::<String>()
        .split('-')
        .filter(|s| !s.is_empty())
        .collect::<Vec<_>>()
        .join("-");

    let domains: Vec<crate::models::keycloak::KeycloakOrganizationDomain> = body
        .domains
        .iter()
        .map(|d| crate::models::keycloak::KeycloakOrganizationDomain {
            name: d.name.trim().to_lowercase(),
            verified: false,
        })
        .collect();

    let mut attrs = body.attributes.clone().unwrap_or_default();
    // Store the original display name so we can show it in the UI
    attrs.insert("display_name".to_string(), vec![display_name.clone()]);
    if let Some(ref desc) = body.description {
        attrs.insert("description".to_string(), vec![desc.clone()]);
    }
    if let Some(ref email) = body.contact_email {
        attrs.insert("contact_email".to_string(), vec![email.clone()]);
    }
    let created_at = chrono::Utc::now().to_rfc3339();
    attrs.insert("created_at".to_string(), vec![created_at]);

    let org = state
        .keycloak
        .create_organization(
            &slug,
            domains,
            Some(state.config.frontend_url.clone()),
            Some(attrs),
        )
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    tracing::info!(org_id = %org.id, name = %display_name, slug = %slug, "Federation created");
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
) -> AppResult<impl IntoResponse> {
    let orgs = state
        .keycloak
        .get_organizations()
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    let federations: Vec<FederationResponse> =
        orgs.into_iter().map(FederationResponse::from).collect();
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
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    let org = state
        .keycloak
        .get_organization_by_id(&id)
        .await
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
    Path(id): Path<String>,
    Json(body): Json<UpdateFederationRequest>,
) -> AppResult<impl IntoResponse> {
    // Fetch current org so we can preserve existing attributes (created_at, display_name, etc.)
    let current = state
        .keycloak
        .get_organization_by_id(&id)
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    let mut attrs = current.attributes.clone().unwrap_or_default();

    // Merge any caller-supplied extra attributes on top
    if let Some(extra) = body.attributes.clone() {
        attrs.extend(extra);
    }

    // Update display_name in attributes (Keycloak alias/name is immutable after creation)
    if let Some(ref new_name) = body.name {
        attrs.insert("display_name".to_string(), vec![new_name.trim().to_string()]);
    }

    // Update description attribute
    if let Some(ref desc) = body.description {
        attrs.insert("description".to_string(), vec![desc.clone()]);
    }

    // Update contact_email attribute
    if let Some(ref email) = body.contact_email {
        attrs.insert("contact_email".to_string(), vec![email.clone()]);
    }

    let domains = body.domains.map(|d| {
        d.into_iter()
            .map(|d| crate::models::keycloak::KeycloakOrganizationDomain {
                name: d.name.trim().to_lowercase(),
                verified: false,
            })
            .collect::<Vec<_>>()
    });

    let org = state
        .keycloak
        .update_organization(
            &id,
            body.description.as_deref(),
            domains,
            Some(attrs),
        )
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

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
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    state
        .keycloak
        .delete_organization(&id)
        .await
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
    Path(id): Path<String>,
    Json(body): Json<CreateInvitationRequest>,
) -> AppResult<impl IntoResponse> {
    let email = body.email.trim().to_lowercase();

    if email.is_empty() {
        return Err(crate::error::AppError::BadRequest(
            "Email is required".into(),
        ));
    }

    // This endpoint is exclusively for inviting Federation Officers.
    // The Ministry does not choose the role — it is always "federation".
    // Reject any caller trying to inject a different role via the body.
    if !body.role.is_empty() && body.role != "federation" {
        return Err(crate::error::AppError::BadRequest(
            "This endpoint only creates federation officer invitations. Role must be 'federation'.".into(),
        ));
    }
    let role = "federation";

    // ── Duplicate check ──────────────────────────────────────────────────────
    // Check whether this email is already a member of THIS specific federation.
    // Clean 409 at the handler level before touching role assignment.
    let existing_members = state
        .keycloak
        .get_organization_members(&id)
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    let already_member = existing_members
        .iter()
        .any(|m| m.email.as_deref().map(|e| e.to_lowercase()).as_deref() == Some(&email));

    if already_member {
        return Err(crate::error::AppError::Conflict(format!(
            "User '{}' is already a member of this federation.",
            email
        )));
    }
    // ─────────────────────────────────────────────────────────────────────────

    let redirect_url = body
        .redirect_url
        .clone()
        .unwrap_or_else(|| state.config.frontend_url.clone());

    let invitation = state
        .keycloak
        .invite_user_to_organization(
            &id,
            &email,
            &body.first_name,
            &body.last_name,
            role,
            &redirect_url,
        )
        .await
        .map_err(|e| {
            // Preserve Conflict errors as-is; wrap everything else
            match &e {
                crate::error::AppError::Conflict(_) => e,
                _ => crate::error::AppError::ExternalServiceError(e.to_string()),
            }
        })?;

    tracing::info!(org_id = %id, email = %email, role = %role, "User invited to federation");
    Ok((
        StatusCode::CREATED,
        Json(InvitationResponse::from(invitation)),
    ))
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
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    let invitations = state
        .keycloak
        .get_organization_invitations(&id)
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    let responses: Vec<InvitationResponse> = invitations
        .into_iter()
        .map(InvitationResponse::from)
        .collect();
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
    Path((id, invitation_id)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
    state
        .keycloak
        .delete_organization_invitation(&id, &invitation_id)
        .await
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
    Path((id, invitation_id)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
    state
        .keycloak
        .resend_organization_invitation(&id, &invitation_id)
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    Ok((
        StatusCode::OK,
        Json(serde_json::json!({ "message": "Invitation resent" })),
    ))
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
    Path(id): Path<String>,
) -> AppResult<impl IntoResponse> {
    let members = state
        .keycloak
        .get_organization_members(&id)
        .await
        .map_err(|e| crate::error::AppError::ExternalServiceError(e.to_string()))?;

    let responses: Vec<MemberResponse> = members.into_iter().map(MemberResponse::from).collect();
    Ok((StatusCode::OK, Json(responses)))
}

#[utoipa::path(
    delete,
    path = "/api/v1/ministry/federations/{id}/members/{user_id}",
    params(
        ("id" = String, Path, description = "Federation (Organization) ID"),
        ("user_id" = String, Path, description = "User (Member) ID")
    ),
    responses(
        (status = 200, description = "Member removed from federation"),
        (status = 403, description = "Forbidden - ministry role required", body = ErrorResponse),
        (status = 404, description = "Member or federation not found", body = ErrorResponse)
    ),
    tag = "Ministry"
)]
pub async fn remove_federation_member(
    State(state): State<AppState>,
    Path((id, user_id)): Path<(String, String)>,
) -> AppResult<impl IntoResponse> {
    tracing::info!(federation_id = %id, user_id = %user_id, "Removing member from federation");

    state
        .keycloak
        .remove_user_from_organization(&user_id, &id)
        .await?;

    Ok((
        StatusCode::OK,
        Json(json!({ "message": "Member removed from federation" })),
    ))
}
