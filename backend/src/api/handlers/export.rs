use axum::body::Body;
use axum::response::Response;
use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Extension,
};
use std::sync::Arc;
use uuid::Uuid;

use crate::auth::claims::Claims;
use crate::error::{AppError, AppResult};
use crate::services::export_generator::{
    ExportGenerator, EXPORT_LOCALES, EXPORT_PREFIX, QUESTIONNAIRE_LOCALE,
};
use crate::services::narrative_translation;
use crate::AppState;

#[derive(Debug, serde::Deserialize)]
pub struct ExportQuery {
    pub federation_id: Option<Uuid>,
    pub apex_id: Option<Uuid>,
    #[serde(alias = "year")]
    pub reporting_year: Option<i32>,
    /// `questionnaire` exports the report built from questionnaire answers;
    /// anything else (or nothing) exports the statement-based report.
    pub method: Option<String>,
    /// Report locale (`en`, `fr`, `pt`, `ss`). Accepts `lng` as an alias. Defaults to `en`.
    #[serde(alias = "lng")]
    pub lang: Option<String>,
}

#[derive(Debug, serde::Deserialize, Default)]
pub struct SingleExportQuery {
    /// Pass `regenerate=true` to bypass the cached PDF and force a fresh generation.
    #[serde(default)]
    pub regenerate: bool,
    /// Report locale (`en`, `fr`, `pt`, `ss`). Accepts `lng` as an alias. Defaults to `en`.
    #[serde(alias = "lng")]
    pub lang: Option<String>,
}

/// Normalises a requested report locale, defaulting to English.
fn requested_locale(lang: Option<&str>) -> String {
    crate::services::localization::normalize_lang(lang)
        .unwrap_or_else(|| crate::services::localization::FALLBACK_LOCALE.to_string())
}

/// GET /api/v1/cooperative/submissions/{id}/export
/// Exports a single cooperative submission in PDF.
#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions/{id}/export",
    params(
        ("id" = Uuid, Path, description = "Submission ID"),
        ("regenerate" = Option<bool>, Query, description = "Force PDF re-generation"),
        ("lang" = Option<String>, Query, description = "Report locale: en | fr | pt | ss (default en)")
    ),
    responses(
        (status = 200, description = "Export file stream"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Export"
)]
pub async fn export_single_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Query(query): Query<SingleExportQuery>,
) -> AppResult<impl IntoResponse> {
    let allowed_coops =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if !allowed_coops.contains(&submission.cooperative_id) {
        return Err(AppError::Forbidden(
            "Access denied to this cooperative's submission".into(),
        ));
    }

    let questionnaire = crate::services::questionnaire_report::is_questionnaire_method(
        &submission.submission_method,
    );
    // Questionnaire reports are English-only.
    let lang = if questionnaire {
        QUESTIONNAIRE_LOCALE.to_string()
    } else {
        requested_locale(query.lang.as_deref())
    };
    let filename = format!("submission_{id}_{lang}.pdf");
    let storage_key = ExportGenerator::submission_pdf_key(id, &lang);
    // PDFs exported before multilingual reports existed are English-only.
    let legacy_key = format!("{EXPORT_PREFIX}/individual/{id}/submission_{id}.pdf");

    let cached = if query.regenerate {
        None
    } else {
        match state.storage.get_object(&storage_key).await {
            Ok(b) => Some(b),
            Err(_) if lang == "en" => state.storage.get_object(&legacy_key).await.ok(),
            Err(_) => None,
        }
    };

    let bytes = match cached {
        Some(b) => {
            tracing::info!(submission_id = %id, lang = %lang, "Serving cached PDF from storage");
            b
        }
        None => {
            tracing::info!(
                submission_id = %id,
                lang = %lang,
                regenerate = query.regenerate,
                "Generating PDF"
            );
            let (generated, untranslated) =
                ExportGenerator::generate_submission_pdf(&state, id, &lang, query.regenerate)
                    .await?;
            let cacheable = ExportGenerator::report_locales(questionnaire, untranslated.as_ref());
            if cacheable.contains(&lang.as_str()) {
                state
                    .storage
                    .store(&storage_key, &generated, "application/pdf")
                    .await?;
            } else {
                tracing::warn!(
                    submission_id = %id,
                    lang = %lang,
                    "Narratives missing or untranslated — PDF served but not cached"
                );
            }
            if query.regenerate {
                // Fresh narratives make every other locale's cached PDF stale.
                let state = state.clone();
                let others: Vec<&'static str> =
                    cacheable.into_iter().filter(|l| *l != lang).collect();
                let stale: Vec<&'static str> =
                    EXPORT_LOCALES.into_iter().filter(|l| *l != lang).collect();
                tokio::spawn(async move {
                    for locale in stale {
                        let _ = state
                            .storage
                            .delete(&ExportGenerator::submission_pdf_key(id, locale))
                            .await;
                    }
                    ExportGenerator::store_submission_locales(&state, id, questionnaire, &others)
                        .await;
                });
            }
            generated
        }
    };

    let res = Response::builder()
        .header("Content-Type", "application/pdf")
        .header(
            "Content-Disposition",
            format!("attachment; filename=\"{}\"", filename),
        )
        .body(Body::from(bytes))
        .unwrap();
    Ok(res)
}

/// GET /api/v1/apex/export
/// GET /api/v1/federation/export
/// GET /api/v1/ministry/export
/// Exports a consolidated PDF report of all cooperatives within the user's scope.
#[utoipa::path(
    get,
    path = "/api/v1/apex/export",
    responses(
        (status = 200, description = "Consolidated PDF file stream"),
        (status = 403, description = "Forbidden")
    ),
    tag = "Export"
)]
pub async fn export_bulk_consolidated(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(mut query): Query<ExportQuery>,
) -> AppResult<impl IntoResponse> {
    if let Some(year) = query.reporting_year {
        query.reporting_year = Some(year.clamp(1900, 2100));
    }
    if query.apex_id.is_none() && claims.is_apex() {
        if let Ok(id) =
            crate::api::handlers::cooperative::resolve_caller_apex_db_id_pub(&state, &claims).await
        {
            query.apex_id = Some(id);
        }
    }
    if query.federation_id.is_none() && claims.is_federation() {
        if let Some(org_id) = claims.get_organization_id() {
            if let Ok(Some(fed)) = state.federation_repo.find_by_keycloak_id(&org_id).await {
                query.federation_id = Some(fed.id);
            }
        }
    }

    let mut allowed_coops =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    if allowed_coops.is_empty() {
        return Err(AppError::Forbidden(
            "No cooperatives in your scope to export".into(),
        ));
    }

    if let Some(apex_id) = query.apex_id {
        let coops = state.cooperative_repo.find_by_apex_id(apex_id).await?;
        let coop_ids: Vec<Uuid> = coops.into_iter().map(|c| c.id).collect();
        allowed_coops.retain(|id| coop_ids.contains(id));
    } else if let Some(fed_id) = query.federation_id {
        let apexes = state.apex_repo.find_by_federation_id(fed_id).await?;
        let mut coop_ids = vec![];
        for apex in apexes {
            let coops = state.cooperative_repo.find_by_apex_id(apex.id).await?;
            coop_ids.extend(coops.into_iter().map(|c| c.id));
        }
        allowed_coops.retain(|id| coop_ids.contains(id));
    }

    if allowed_coops.is_empty() {
        return Err(AppError::Forbidden(
            "No cooperatives matching the selected hierarchical filter".into(),
        ));
    }

    let questionnaire = query
        .method
        .as_deref()
        .is_some_and(|m| m.eq_ignore_ascii_case("questionnaire"));
    let tag = if questionnaire { "_questionnaire" } else { "" };

    // Questionnaire reports are English-only.
    let lang = if questionnaire {
        QUESTIONNAIRE_LOCALE.to_string()
    } else {
        requested_locale(query.lang.as_deref())
    };
    let year = query.reporting_year.ok_or_else(|| {
        AppError::BadRequest("reporting_year is required for consolidated exports".into())
    })?;

    let (storage_key, legacy_key) = match (query.apex_id, query.federation_id) {
        (Some(aid), _) => (
            ExportGenerator::apex_pdf_key(aid, year, tag, &lang),
            format!("{EXPORT_PREFIX}/apex/{aid}/apex_{aid}_{year}{tag}.pdf"),
        ),
        (None, Some(fid)) => (
            ExportGenerator::federation_pdf_key(fid, year, tag, &lang),
            format!("{EXPORT_PREFIX}/federation/{fid}/federation_{fid}_{year}{tag}.pdf"),
        ),
        (None, None) => (
            ExportGenerator::ministry_pdf_key(year, tag, &lang),
            format!("{EXPORT_PREFIX}/ministry/ministry_{year}{tag}.pdf"),
        ),
    };
    let display_filename = storage_key
        .rsplit('/')
        .next()
        .unwrap_or("report.pdf")
        .to_string();

    // PDFs exported before multilingual reports existed are English-only.
    let cached = match state.storage.get_object(&storage_key).await {
        Ok(b) => Some(b),
        Err(_) if lang == "en" => state.storage.get_object(&legacy_key).await.ok(),
        Err(_) => None,
    };
    if let Some(bytes) = cached {
        tracing::info!(key = %storage_key, lang = %lang, "Bucket HIT for consolidated export");
        return Ok(pdf_response(bytes, &display_filename));
    }

    // Upgrade legacy English-only narratives and retry failed translations before
    // rendering. Questionnaire consolidated reports carry no AI narratives.
    let untranslated = if questionnaire {
        None
    } else {
        match (query.apex_id, query.federation_id) {
            (Some(aid), _) => {
                ExportGenerator::ensure_apex_narratives(&state, aid, year, None).await
            }
            (None, Some(fid)) => {
                ExportGenerator::ensure_federation_narratives(&state, fid, year, None).await
            }
            (None, None) => ExportGenerator::ensure_ministry_narratives(&state, year, None).await,
        }
    };
    // Without stored narratives the report renders its factual sections only, which
    // stays valid until the next background export replaces it.
    let cacheable = match untranslated {
        Some(untranslated) => !untranslated.contains(&lang),
        None => true,
    };

    let token = state.keycloak.get_admin_token().await?;
    let base = &state.config.gotenberg_frontend_url;
    let print_url = match (query.apex_id, query.federation_id) {
        (Some(aid), _) => {
            let apex = state
                .apex_repo
                .find_by_id(aid)
                .await?
                .ok_or_else(|| AppError::NotFound("Apex not found".into()))?;
            let name = urlencoding::encode(&apex.display_name);
            if questionnaire {
                format!("{base}/print/questionnaire-consolidated?token={token}&year={year}&scope=apex&id={aid}&name={name}&lng={lang}")
            } else {
                // The apex print page and its APIs address the apex by Keycloak ID.
                format!(
                    "{base}/print/apex/{}?token={token}&year={year}&name={name}&lng={lang}",
                    apex.keycloak_id
                )
            }
        }
        (None, Some(fid)) => {
            let federation = state
                .federation_repo
                .find_by_id(fid)
                .await?
                .ok_or_else(|| AppError::NotFound("Federation not found".into()))?;
            let name = urlencoding::encode(&federation.display_name);
            if questionnaire {
                format!("{base}/print/questionnaire-consolidated?token={token}&year={year}&scope=federation&id={fid}&name={name}&lng={lang}")
            } else {
                format!(
                    "{base}/print/federation/{}?token={token}&year={year}&name={name}&lng={lang}",
                    federation.keycloak_id
                )
            }
        }
        (None, None) if questionnaire => format!(
            "{base}/print/questionnaire-consolidated?token={token}&year={year}&scope=ministry&lng={lang}"
        ),
        (None, None) => format!("{base}/print/ministry?token={token}&year={year}&lng={lang}"),
    };

    let bytes = ExportGenerator::generate_pdf_via_gotenberg(&state, &print_url).await?;

    if cacheable {
        if let Err(e) = state
            .storage
            .store(&storage_key, &bytes, "application/pdf")
            .await
        {
            tracing::warn!(error = %e, key = %storage_key, "Failed to cache live-generated export");
        }
    } else {
        tracing::warn!(key = %storage_key, lang = %lang, "Narratives untranslated — PDF served but not cached");
    }

    Ok(pdf_response(bytes, &display_filename))
}

fn pdf_response(bytes: Vec<u8>, filename: &str) -> Response {
    let mut res = Response::new(Body::from(bytes));
    let headers = res.headers_mut();
    headers.insert(
        axum::http::header::CONTENT_TYPE,
        axum::http::HeaderValue::from_static("application/pdf"),
    );
    if let Ok(value) =
        axum::http::HeaderValue::from_str(&format!("attachment; filename=\"{filename}\""))
    {
        headers.insert(axum::http::header::CONTENT_DISPOSITION, value);
    }
    res
}

/// GET /api/v1/{tier}/submissions/{id}/narratives
/// Returns AI-generated narratives for a submission from metadata cache.
/// Accepts an optional `?lng=` query param (en | fr | pt | ss). Defaults to "en".
#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions/{id}/narratives",
    params(
        ("id" = Uuid, Path, description = "Submission ID"),
        ("lng" = Option<String>, Query, description = "Locale code (en|fr|pt|ss)")
    ),
    responses(
        (status = 200, description = "AI narratives or null"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Export"
)]
pub async fn get_submission_narratives(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Query(params): Query<SingleExportQuery>,
) -> AppResult<impl IntoResponse> {
    let allowed_coops =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if !allowed_coops.contains(&submission.cooperative_id) {
        return Err(AppError::Forbidden(
            "Access denied to this cooperative's submission".into(),
        ));
    }

    let lang = requested_locale(params.lang.as_deref());
    let narratives = submission
        .metadata
        .get("ai_narratives")
        .cloned()
        .map(|v| narrative_translation::select_locale(v, &lang));

    Ok(axum::Json(narratives))
}

/// POST /api/v1/{tier}/submissions/{id}/narratives/generate
/// Triggers manual AI narrative regeneration. Ministry admin role protected.
#[utoipa::path(
    post,
    path = "/api/v1/cooperative/submissions/{id}/narratives/generate",
    params(
        ("id" = Uuid, Path, description = "Submission ID")
    ),
    responses(
        (status = 200, description = "Regenerated AI narratives"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Export"
)]
pub async fn generate_submission_narratives(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    if !claims.is_ministry() {
        return Err(AppError::Forbidden(
            "Only Ministry admin users can trigger manual narrative generation".into(),
        ));
    }

    let allowed_coops =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if !allowed_coops.contains(&submission.cooperative_id) {
        return Err(AppError::Forbidden(
            "Access denied to this cooperative's submission".into(),
        ));
    }

    let questionnaire = crate::services::questionnaire_report::is_questionnaire_method(
        &submission.submission_method,
    );
    let untranslated =
        ExportGenerator::ensure_submission_narratives(&state, id, questionnaire, true)
            .await
            .ok_or_else(|| {
                AppError::ExternalServiceError("Failed to generate narratives".into())
            })?;

    // Cached PDFs embed the previous narratives; rebuild them in the background.
    let refreshed = state.clone();
    tokio::spawn(async move {
        for locale in EXPORT_LOCALES {
            let _ = refreshed
                .storage
                .delete(&ExportGenerator::submission_pdf_key(id, locale))
                .await;
        }
        let locales = ExportGenerator::report_locales(questionnaire, Some(&untranslated));
        ExportGenerator::store_submission_locales(&refreshed, id, questionnaire, &locales).await;
    });

    let stored = state
        .submission_repo
        .find_by_id(id)
        .await?
        .and_then(|s| s.metadata.get("ai_narratives").cloned())
        .map(|v| narrative_translation::select_locale(v, "en"));
    Ok(axum::Json(stored.unwrap_or(serde_json::Value::Null)))
}

/// GET /api/v1/apex/{id}/narratives?year=2025
/// Returns cached AI narratives for an apex report.
#[utoipa::path(
    get,
    path = "/api/v1/apex/{id}/narratives",
    params(
        ("id" = String, Path, description = "Apex Keycloak ID"),
        ("year" = i32, Query, description = "Reporting year"),
        ("lng" = Option<String>, Query, description = "Locale code (en|fr|pt|ss)")
    ),
    responses(
        (status = 200, description = "AI narratives or null"),
        (status = 404, description = "Not found")
    ),
    tag = "Export"
)]
pub async fn get_apex_narratives(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(params): Query<ExportQuery>,
) -> AppResult<impl IntoResponse> {
    let year = params.reporting_year.unwrap_or(2025).clamp(1900, 2100);
    let apex = state
        .apex_repo
        .find_by_keycloak_id(&id)
        .await?
        .ok_or_else(|| AppError::NotFound("Apex not found".into()))?;

    let year_key = format!("ai_narratives_{}", year);
    let raw = apex.metadata.and_then(|m| m.get(&year_key).cloned());

    let lang = requested_locale(params.lang.as_deref());
    let narratives = raw.map(|v| narrative_translation::select_locale(v, &lang));

    Ok(axum::Json(narratives))
}

/// GET /api/v1/federation/{id}/narratives?year=2025
/// Returns cached AI narratives for a federation report.
#[utoipa::path(
    get,
    path = "/api/v1/federation/{id}/narratives",
    params(
        ("id" = String, Path, description = "Federation Keycloak ID"),
        ("year" = i32, Query, description = "Reporting year"),
        ("lng" = Option<String>, Query, description = "Locale code (en|fr|pt|ss)")
    ),
    responses(
        (status = 200, description = "AI narratives or null"),
        (status = 404, description = "Not found")
    ),
    tag = "Export"
)]
pub async fn get_federation_narratives(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Query(params): Query<ExportQuery>,
) -> AppResult<impl IntoResponse> {
    let year = params.reporting_year.unwrap_or(2025).clamp(1900, 2100);
    let federation = state
        .federation_repo
        .find_by_keycloak_id(&id)
        .await?
        .ok_or_else(|| AppError::NotFound("Federation not found".into()))?;

    let year_key = format!("ai_narratives_{}", year);
    let raw = federation.metadata.and_then(|m| m.get(&year_key).cloned());

    let lang = requested_locale(params.lang.as_deref());
    let narratives = raw.map(|v| narrative_translation::select_locale(v, &lang));

    Ok(axum::Json(narratives))
}

/// GET /api/v1/ministry/submissions/narratives?year=2025
/// Returns cached AI narratives for the ministry national report.
#[utoipa::path(
    get,
    path = "/api/v1/ministry/submissions/narratives",
    params(
        ("year" = i32, Query, description = "Reporting year"),
        ("lng" = Option<String>, Query, description = "Locale code (en|fr|pt|ss)")
    ),
    responses(
        (status = 200, description = "AI narratives or null"),
        (status = 404, description = "Not found")
    ),
    tag = "Export"
)]
pub async fn get_ministry_narratives(
    State(state): State<AppState>,
    Query(params): Query<ExportQuery>,
) -> AppResult<impl IntoResponse> {
    let year = params.reporting_year.unwrap_or(2025).clamp(1900, 2100);
    let cached = state.ministry_narratives_repo.find_by_year(year).await?;

    let raw = cached.map(|c| c.narratives_json);
    let lang = requested_locale(params.lang.as_deref());
    let narratives = raw.map(|v| narrative_translation::select_locale(v, &lang));

    Ok(axum::Json(narratives))
}
