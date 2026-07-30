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
use crate::AppState;

#[derive(Debug, serde::Deserialize)]
pub struct ExportQuery {
    pub federation_id: Option<Uuid>,
    pub apex_id: Option<Uuid>,
    pub reporting_year: Option<i32>,
}

/// GET /api/v1/cooperative/submissions/{id}/export
/// Exports a single cooperative submission in PDF.
#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions/{id}/export",
    params(
        ("id" = Uuid, Path, description = "Submission ID")
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

    let filename = format!("submission_{}.pdf", id);
    let storage_key = format!("exports/individual/{}/{}", id, filename);

    let bytes = match state.storage.get_object(&storage_key).await {
        Ok(b) => b,
        Err(_) => {
            let generated_bytes =
                crate::services::export_generator::ExportGenerator::generate_cooperative_pdf(
                    &state, id,
                )
                .await?;
            state
                .storage
                .store(&storage_key, &generated_bytes, "application/pdf")
                .await?;
            generated_bytes
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

    // Bucket checks
    if let (Some(apex_id), Some(year)) = (query.apex_id, query.reporting_year) {
        let filename = format!("apex_{}_{}.pdf", apex_id, year);
        let storage_key = format!("exports/apex/{}/{}", apex_id, filename);
        if let Ok(bytes) = state.storage.get_object(&storage_key).await {
            tracing::info!(apex_id = %apex_id, reporting_year = year, "Bucket HIT for Apex export");
            let res = Response::builder()
                .header("Content-Type", "application/pdf")
                .header(
                    "Content-Disposition",
                    format!("attachment; filename=\"{}\"", filename),
                )
                .body(Body::from(bytes))
                .unwrap();
            return Ok(res);
        }
    } else if let (Some(fed_id), Some(year)) = (query.federation_id, query.reporting_year) {
        let filename = format!("federation_{}_{}.pdf", fed_id, year);
        let storage_key = format!("exports/federation/{}/{}", fed_id, filename);
        if let Ok(bytes) = state.storage.get_object(&storage_key).await {
            tracing::info!(federation_id = %fed_id, reporting_year = year, "Bucket HIT for Federation export");
            let res = Response::builder()
                .header("Content-Type", "application/pdf")
                .header(
                    "Content-Disposition",
                    format!("attachment; filename=\"{}\"", filename),
                )
                .body(Body::from(bytes))
                .unwrap();
            return Ok(res);
        }
    } else if query.apex_id.is_none() && query.federation_id.is_none() {
        if let Some(year) = query.reporting_year {
            let filename = format!("ministry_{}.pdf", year);
            let storage_key = format!("exports/ministry/{}", filename);
            if let Ok(bytes) = state.storage.get_object(&storage_key).await {
                tracing::info!(reporting_year = year, "Bucket HIT for Ministry export");
                let res = Response::builder()
                    .header("Content-Type", "application/pdf")
                    .header(
                        "Content-Disposition",
                        format!("attachment; filename=\"{}\"", filename),
                    )
                    .body(Body::from(bytes))
                    .unwrap();
                return Ok(res);
            }
        }
    }

    // Determine storage_key and display filename
    let (storage_key, display_filename) = if let Some(year) = query.reporting_year {
        match (query.apex_id, query.federation_id) {
            (Some(aid), _) => {
                let fn_ = format!("apex_{}_{}.pdf", aid, year);
                (format!("exports/apex/{}/{}", aid, fn_), fn_)
            }
            (_, Some(fid)) => {
                let fn_ = format!("federation_{}_{}.pdf", fid, year);
                (format!("exports/federation/{}/{}", fid, fn_), fn_)
            }
            (None, None) => {
                let fn_ = format!("ministry_{}.pdf", year);
                (format!("exports/ministry/{}", fn_), fn_)
            }
        }
    } else {
        return Err(AppError::BadRequest(
            "reporting_year is required for consolidated exports".into(),
        ));
    };

    let token = state.keycloak.get_admin_token().await?;
    let print_url = if let Some(apex_id) = query.apex_id {
        format!(
            "{}/print/apex/{}?token={}",
            state.config.gotenberg_frontend_url, apex_id, token
        )
    } else if let Some(fed_id) = query.federation_id {
        format!(
            "{}/print/federation/{}?token={}",
            state.config.gotenberg_frontend_url, fed_id, token
        )
    } else {
        format!(
            "{}/print/ministry?token={}",
            state.config.gotenberg_frontend_url, token
        )
    };

    let bytes = crate::services::export_generator::ExportGenerator::generate_pdf_via_gotenberg(
        &state, &print_url,
    )
    .await?;

    if let Err(e) = state
        .storage
        .store(&storage_key, &bytes, "application/pdf")
        .await
    {
        tracing::warn!(error = %e, key = %storage_key, "Failed to cache live-generated export");
    }

    let res = Response::builder()
        .header("Content-Type", "application/pdf")
        .header(
            "Content-Disposition",
            format!("attachment; filename=\"{}\"", display_filename),
        )
        .body(Body::from(bytes))
        .unwrap();
    Ok(res)
}

/// GET /api/v1/{tier}/submissions/{id}/narratives
/// Returns AI-generated narratives for a submission from metadata cache.
#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions/{id}/narratives",
    params(
        ("id" = Uuid, Path, description = "Submission ID")
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

    let narratives = submission
        .metadata
        .get("ai_narratives")
        .cloned();

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

    let coop = state
        .cooperative_repo
        .find_by_id(submission.cooperative_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Cooperative not found".into()))?;

    let kpi_records = state.kpi_record_repo.find_by_submission(id).await?;

    let prior_kpi_records = if submission.reporting_year > 2020 {
        if let Some(prior_sub) = state
            .submission_repo
            .find_by_cooperative_and_year(submission.cooperative_id, submission.reporting_year - 1)
            .await?
        {
            state.kpi_record_repo.find_by_submission(prior_sub.id).await?
        } else {
            Vec::new()
        }
    } else {
        Vec::new()
    };

    // Fetch line items from financial statement
    let line_items = match state.financial_statement_repo.find_by_submission(id).await? {
        Some(fs) => {
            let raw_items = state.line_item_repo.find_by_financial_statement(fs.id).await?;
            if raw_items.is_empty() {
                None
            } else {
                let prior_line_items = if submission.reporting_year > 2020 {
                    if let Some(prior_sub) = state
                        .submission_repo
                        .find_by_cooperative_and_year(submission.cooperative_id, submission.reporting_year - 1)
                        .await?
                    {
                        if let Some(pfs) = state.financial_statement_repo.find_by_submission(prior_sub.id).await? {
                            state.line_item_repo.find_by_financial_statement(pfs.id).await.unwrap_or_default()
                        } else {
                            Vec::new()
                        }
                    } else {
                        Vec::new()
                    }
                } else {
                    Vec::new()
                };

                let mut items: Vec<crate::services::report_narrative::BalanceSheetLineItemData> = Vec::new();
                let mut by_code: std::collections::HashMap<i32, &crate::entities::balance_sheet_line_item::Model> = std::collections::HashMap::new();
                for item in &raw_items {
                    if let Some(code) = item.account_code {
                        by_code.insert(code, item);
                    }
                }
                let mut prior_map: std::collections::HashMap<i32, f64> = std::collections::HashMap::new();
                for item in &prior_line_items {
                    if let (Some(code), Some(val)) = (item.account_code, item.value) {
                        prior_map.insert(code, val.to_f64().unwrap_or(0.0));
                    }
                }
                for (code, item) in &by_code {
                    let current = item.value.map(|v| v.to_f64().unwrap_or(0.0)).unwrap_or(0.0);
                    let prior = prior_map.get(code).copied();
                    items.push(crate::services::report_narrative::BalanceSheetLineItemData {
                        account_code: Some(*code),
                        account_name: item.account_name.clone().unwrap_or_default(),
                        current_value: current,
                        prior_value: prior,
                    });
                }
                items.sort_by_key(|i| i.account_code.unwrap_or(0));
                Some(items)
            }
        }
        None => None,
    };

    // Compute NF stats
    let nf_response = crate::services::nf_indicator_engine::NfIndicatorEngine::compute_for_submission(
        &state.db,
        submission.cooperative_id,
        Some(id),
    ).await.ok();

    let membership_stats = nf_response.as_ref().map(|nf| {
        crate::services::report_narrative::MembershipStats {
            total_members: nf.membership.total,
            active_members: nf.membership.active,
            dormant_members: nf.membership.dormant,
            women_members: nf.membership.female,
            youth_members: nf.membership.age_18_35 + nf.membership.under_18,
            rural_members: nf.membership.rural,
            agm_participation_pct: nf.membership.agm_participation_pct,
            leadership_count: nf.membership.leadership_count,
            voting_participation_pct: if nf.membership.total > 0 {
                nf.membership.voting_count as f64 / nf.membership.total as f64 * 100.0
            } else {
                0.0
            },
        }
    });

    let savings_stats = nf_response.as_ref().map(|nf| {
        crate::services::report_narrative::SavingsStats {
            total_savings_accounts: nf.savings.total_accounts,
            active_savers: nf.savings.active_accounts,
            savings_penetration_pct: nf.savings.savings_penetration_pct,
            avg_savings_balance: nf.savings.average_balance,
        }
    });

    let loan_stats = nf_response.as_ref().map(|nf| {
        crate::services::report_narrative::LoanStats {
            active_borrowers: nf.loans.members_with_loans,
            women_borrowers: nf.loans.women_borrowers,
            youth_borrowers: nf.loans.youth_borrowers,
            rural_borrowers: nf.loans.rural_borrowers,
            on_time_repayment_pct: nf.loans.on_time_repayment_pct,
        }
    });

    let ctx = crate::services::report_narrative::build_cooperative_context(
        &coop,
        &submission,
        &kpi_records,
        &prior_kpi_records,
        line_items,
        membership_stats,
        savings_stats,
        loan_stats,
        None,
        None,
        None,
    );

    let _permit = state.ai_semaphore.acquire().await.map_err(|_| {
        AppError::InternalServerError("AI semaphore closed".into())
    })?;

    let narratives = state
        .narrative_generator
        .generate_cooperative_narratives(&ctx)
        .await?;

    state
        .submission_repo
        .update_metadata(
            id,
            serde_json::json!({ "ai_narratives": narratives }),
        )
        .await?;

    Ok(axum::Json(serde_json::json!(narratives)))
}
