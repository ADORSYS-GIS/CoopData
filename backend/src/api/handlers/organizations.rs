use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use uuid::Uuid;

use crate::api::dto::{
    CreateOrganizationRequest, OrganizationResponse, PaginatedOrganizationResponse,
    PaginatedResponse, PaginationParams, UpdateOrganizationRequest,
};
use crate::entities::organization;
use crate::error::{AppError, AppResult};
use crate::repositories::OrganizationRepository;
use crate::AppState;
use sea_orm::Set;

#[utoipa::path(
    get,
    path = "/api/v1/organizations",
    responses(
        (status = 200, description = "List of organizations", body = PaginatedOrganizationResponse),
        (status = 500, description = "Internal server error", body = ErrorResponse)
    ),
    tag = "Organizations"
)]
pub async fn list_organizations(
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> AppResult<impl IntoResponse> {
    let repo = OrganizationRepository::new(state.db.clone());
    let organizations = repo.find_all().await?;

    let responses: Vec<OrganizationResponse> = organizations.into_iter().map(Into::into).collect();
    let total = responses.len() as u64;

    Ok((
        StatusCode::OK,
        Json(PaginatedOrganizationResponse::from(PaginatedResponse::new(
            responses,
            total,
            params.page,
            params.per_page,
        ))),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/organizations/{id}",
    params(
        ("id" = Uuid, Path, description = "Organization ID")
    ),
    responses(
        (status = 200, description = "Organization found", body = OrganizationResponse),
        (status = 404, description = "Organization not found", body = ErrorResponse)
    ),
    tag = "Organizations"
)]
pub async fn get_organization(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let repo = OrganizationRepository::new(state.db.clone());
    let org = repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("Organization {} not found", id)))?;

    Ok((StatusCode::OK, Json(OrganizationResponse::from(org))))
}

#[utoipa::path(
    post,
    path = "/api/v1/organizations",
    request_body = CreateOrganizationRequest,
    responses(
        (status = 201, description = "Organization created", body = OrganizationResponse),
        (status = 400, description = "Invalid input", body = ErrorResponse),
        (status = 409, description = "Organization already exists", body = ErrorResponse)
    ),
    tag = "Organizations"
)]
pub async fn create_organization(
    State(state): State<AppState>,
    Json(body): Json<CreateOrganizationRequest>,
) -> AppResult<impl IntoResponse> {
    if body.name.trim().is_empty() {
        return Err(AppError::BadRequest("Organization name is required".into()));
    }

    let repo = OrganizationRepository::new(state.db.clone());
    let now = chrono::Utc::now();

    let active_model = organization::ActiveModel {
        id: Set(Uuid::new_v4()),
        name: Set(body.name),
        organization_type: Set(body.organization_type),
        registration_number: Set(body.registration_number),
        sector: Set(body.sector),
        region: Set(body.region),
        contact_email: Set(body.contact_email),
        contact_phone: Set(body.contact_phone),
        address: Set(body.address),
        federation_id: Set(body.federation_id),
        is_active: Set(true),
        created_at: Set(now),
        updated_at: Set(now),
    };

    let org = repo.create(active_model).await?;
    tracing::info!(organization_id = %org.id, "Organization created");

    if let Err(e) = state.cache.delete("organizations:all").await {
        tracing::warn!("Failed to invalidate organization cache: {}", e);
    }

    Ok((StatusCode::CREATED, Json(OrganizationResponse::from(org))))
}

#[utoipa::path(
    patch,
    path = "/api/v1/organizations/{id}",
    params(
        ("id" = Uuid, Path, description = "Organization ID")
    ),
    request_body = UpdateOrganizationRequest,
    responses(
        (status = 200, description = "Organization updated", body = OrganizationResponse),
        (status = 404, description = "Organization not found", body = ErrorResponse)
    ),
    tag = "Organizations"
)]
pub async fn update_organization(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateOrganizationRequest>,
) -> AppResult<impl IntoResponse> {
    let repo = OrganizationRepository::new(state.db.clone());
    let org = repo.update(id, body).await?;
    tracing::info!(organization_id = %id, "Organization updated");

    if let Err(e) = state.cache.delete("organizations:all").await {
        tracing::warn!("Failed to invalidate organization cache: {}", e);
    }

    Ok((StatusCode::OK, Json(OrganizationResponse::from(org))))
}

#[utoipa::path(
    delete,
    path = "/api/v1/organizations/{id}",
    params(
        ("id" = Uuid, Path, description = "Organization ID")
    ),
    responses(
        (status = 204, description = "Organization deleted"),
        (status = 404, description = "Organization not found", body = ErrorResponse)
    ),
    tag = "Organizations"
)]
pub async fn delete_organization(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let repo = OrganizationRepository::new(state.db.clone());
    repo.delete(id).await?;
    tracing::info!(organization_id = %id, "Organization deleted");

    if let Err(e) = state.cache.delete("organizations:all").await {
        tracing::warn!("Failed to invalidate organization cache: {}", e);
    }

    Ok((StatusCode::NO_CONTENT, ()))
}
