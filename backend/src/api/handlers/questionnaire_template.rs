use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::{
    auth::Claims,
    error::{AppError, AppResult},
    services::localization::{normalize_lang, resolve_label, resolve_sections},
    AppState,
};

// ─── DTOs ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, ToSchema)]
pub struct QuestionnaireTemplateDto {
    pub id: Uuid,
    pub questionnaire_type: String,
    pub version: i32,
    pub label: String,
    pub sections: serde_json::Value,
    pub translations: serde_json::Value,
    pub is_active: bool,
    pub created_by: Option<Uuid>,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateTemplateRequest {
    pub questionnaire_type: String,
    pub label: String,
    pub sections: serde_json::Value,
    #[serde(default)]
    pub translations: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateTemplateRequest {
    pub label: Option<String>,
    pub sections: Option<serde_json::Value>,
    pub translations: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct ActiveTemplateQuery {
    pub questionnaire_type: String,
    #[serde(default)]
    pub lang: Option<String>,
}

impl QuestionnaireTemplateDto {
    fn from_model(m: crate::entities::questionnaire_template::Model, lang: Option<String>) -> Self {
        let translations = if m.translations.is_null() {
            serde_json::json!({})
        } else {
            m.translations.clone()
        };
        let sections = resolve_sections(&m.sections, &translations, &lang);
        let label = resolve_label(&m.label, &translations, "label", &lang);
        Self {
            id: m.id,
            questionnaire_type: m.questionnaire_type,
            version: m.version,
            label,
            sections,
            translations,
            is_active: m.is_active,
            created_by: m.created_by,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

// ─── Ministry: List all templates ─────────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/v1/ministry/questionnaire-templates",
    responses(
        (status = 200, description = "All questionnaire templates", body = Vec<QuestionnaireTemplateDto>),
    ),
    tag = "Ministry"
)]
pub async fn list_templates(
    State(state): State<AppState>,
    Extension(_claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    let templates = state.questionnaire_template_repo.find_all().await?;
    let dtos: Vec<QuestionnaireTemplateDto> = templates
        .into_iter()
        .map(|t| QuestionnaireTemplateDto::from_model(t, None))
        .collect();
    Ok(Json(dtos))
}

// ─── Ministry: Get one template ───────────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/v1/ministry/questionnaire-templates/{id}",
    responses(
        (status = 200, description = "Questionnaire template", body = QuestionnaireTemplateDto),
        (status = 404, description = "Not found"),
    ),
    tag = "Ministry"
)]
pub async fn get_template(
    State(state): State<AppState>,
    Extension(_claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let template = state
        .questionnaire_template_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Questionnaire template not found".into()))?;
    Ok(Json(QuestionnaireTemplateDto::from_model(template, None)))
}

// ─── Ministry: Create template ────────────────────────────────────────────────

#[utoipa::path(
    post,
    path = "/api/v1/ministry/questionnaire-templates",
    request_body = CreateTemplateRequest,
    responses(
        (status = 201, description = "Template created", body = QuestionnaireTemplateDto),
    ),
    tag = "Ministry"
)]
pub async fn create_template(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Json(body): Json<CreateTemplateRequest>,
) -> AppResult<impl IntoResponse> {
    if body.questionnaire_type != "financial" && body.questionnaire_type != "non_financial" {
        return Err(AppError::BadRequest(
            "questionnaire_type must be 'financial' or 'non_financial'".into(),
        ));
    }
    let created_by = claims.sub.parse::<Uuid>().ok();
    let translations = body.translations.unwrap_or_else(|| serde_json::json!({}));
    let template = state
        .questionnaire_template_repo
        .create(
            body.questionnaire_type,
            body.label,
            body.sections,
            created_by,
            translations,
        )
        .await?;
    Ok((
        StatusCode::CREATED,
        Json(QuestionnaireTemplateDto::from_model(template, None)),
    ))
}

// ─── Ministry: Update template ────────────────────────────────────────────────

#[utoipa::path(
    put,
    path = "/api/v1/ministry/questionnaire-templates/{id}",
    request_body = UpdateTemplateRequest,
    responses(
        (status = 200, description = "Template updated", body = QuestionnaireTemplateDto),
        (status = 400, description = "Cannot edit active template"),
        (status = 404, description = "Not found"),
    ),
    tag = "Ministry"
)]
pub async fn update_template(
    State(state): State<AppState>,
    Extension(_claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateTemplateRequest>,
) -> AppResult<impl IntoResponse> {
    let template = state
        .questionnaire_template_repo
        .update(id, body.label, body.sections, body.translations)
        .await?;
    Ok(Json(QuestionnaireTemplateDto::from_model(template, None)))
}

// ─── Ministry: Activate template ──────────────────────────────────────────────

#[utoipa::path(
    post,
    path = "/api/v1/ministry/questionnaire-templates/{id}/activate",
    responses(
        (status = 200, description = "Template activated", body = QuestionnaireTemplateDto),
        (status = 404, description = "Not found"),
    ),
    tag = "Ministry"
)]
pub async fn activate_template(
    State(state): State<AppState>,
    Extension(_claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let template = state.questionnaire_template_repo.activate(id).await?;
    Ok(Json(QuestionnaireTemplateDto::from_model(template, None)))
}

// ─── Ministry: Delete template ────────────────────────────────────────────────

#[utoipa::path(
    delete,
    path = "/api/v1/ministry/questionnaire-templates/{id}",
    responses(
        (status = 204, description = "Template deleted"),
        (status = 400, description = "Cannot delete active template"),
        (status = 404, description = "Not found"),
    ),
    tag = "Ministry"
)]
pub async fn delete_template(
    State(state): State<AppState>,
    Extension(_claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    state.questionnaire_template_repo.delete(id).await?;
    Ok(StatusCode::NO_CONTENT)
}

async fn get_active_template_helper(
    state: &AppState,
    q_type: &str,
    lang: Option<String>,
) -> AppResult<QuestionnaireTemplateDto> {
    let template = state
        .questionnaire_template_repo
        .find_active(q_type)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("No active {} template found", q_type)))?;
    Ok(QuestionnaireTemplateDto::from_model(template, lang))
}

// ─── Shared: Get active template (coop fills form, reviewers show labels) ─────

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/questionnaire-templates/active",
    params(
        ("questionnaire_type" = String, Query, description = "financial or non_financial"),
        ("lang" = Option<String>, Query, description = "Locale to resolve content into (e.g. ss, pt, fr). Falls back to en."),
    ),
    responses(
        (status = 200, description = "Active questionnaire template", body = QuestionnaireTemplateDto),
        (status = 404, description = "No active template for this type"),
    ),
    tag = "Cooperative"
)]
pub async fn get_active_template_coop(
    State(state): State<AppState>,
    Extension(_claims): Extension<Arc<Claims>>,
    Query(q): Query<ActiveTemplateQuery>,
) -> AppResult<impl IntoResponse> {
    let lang = normalize_lang(q.lang.as_deref());
    let dto = get_active_template_helper(&state, &q.questionnaire_type, lang).await?;
    Ok(Json(dto))
}

/// Same as above but for apex reviewers
pub async fn get_active_template_apex(
    State(state): State<AppState>,
    Extension(_claims): Extension<Arc<Claims>>,
    Query(q): Query<ActiveTemplateQuery>,
) -> AppResult<impl IntoResponse> {
    let lang = normalize_lang(q.lang.as_deref());
    let dto = get_active_template_helper(&state, &q.questionnaire_type, lang).await?;
    Ok(Json(dto))
}

/// Same as above but for federation reviewers
pub async fn get_active_template_federation(
    State(state): State<AppState>,
    Extension(_claims): Extension<Arc<Claims>>,
    Query(q): Query<ActiveTemplateQuery>,
) -> AppResult<impl IntoResponse> {
    let lang = normalize_lang(q.lang.as_deref());
    let dto = get_active_template_helper(&state, &q.questionnaire_type, lang).await?;
    Ok(Json(dto))
}

/// Same as above but for ministry reviewers
pub async fn get_active_template_ministry(
    State(state): State<AppState>,
    Extension(_claims): Extension<Arc<Claims>>,
    Query(q): Query<ActiveTemplateQuery>,
) -> AppResult<impl IntoResponse> {
    let lang = normalize_lang(q.lang.as_deref());
    let dto = get_active_template_helper(&state, &q.questionnaire_type, lang).await?;
    Ok(Json(dto))
}
