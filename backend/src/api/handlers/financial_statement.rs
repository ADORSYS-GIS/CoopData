use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use chrono::Datelike;
use std::sync::Arc;
use utoipa::IntoParams;
use uuid::Uuid;

use crate::api::dto::financial::{
    BenchmarkQueryParams, BenchmarkResponse, ChartOfAccountResponse, ExportParams,
    FinancialStatementResponse, KpiItemResponse, LineItemBulkUpdateRequest, LineItemResponse,
    MinistryStatsResponse, MonthlyTrendPoint, MonthlyTrendResponse, RegionCompliancePoint,
    RegionComplianceResponse, SectorBreakdownPoint, SectorBreakdownResponse,
    SubmissionActivityPoint, SubmissionActivityResponse, SubmissionKpisResponse,
    SubmissionLineItemsResponse,
};
use crate::auth::claims::Claims;

use crate::error::{AppError, AppResult};
use crate::AppState;
use rust_decimal::prelude::ToPrimitive;
use serde::Deserialize;

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/financial-statements/{id}",
    params(("id" = Uuid, Path, description = "Financial statement ID")),
    responses(
        (status = 200, description = "Financial statement", body = FinancialStatementResponse),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Cooperative"
)]
pub(crate) async fn filter_cooperatives(
    state: &AppState,
    caller_coop_ids: Vec<Uuid>,
    cooperative_id: Option<Uuid>,
    region: Option<String>,
    sector: Option<String>,
    federation_id: Option<Uuid>,
    apex_id: Option<Uuid>,
) -> AppResult<Vec<Uuid>> {
    let coops = state.cooperative_repo.find_by_ids(caller_coop_ids).await?;

    if let Some(target_id) = cooperative_id {
        // The frontend sends Keycloak Group IDs from the dropdown, but caller_coop_ids are Postgres IDs.
        // We must check if target_id matches either the internal Postgres ID or the Keycloak Group ID.
        if let Some(coop) = coops
            .iter()
            .find(|c| c.id == target_id || c.keycloak_group_id == Some(target_id))
        {
            return Ok(vec![coop.id]);
        }
        return Err(AppError::Forbidden(
            "Access denied to this cooperative".into(),
        ));
    }

    let mut allowed_apex_ids = None;
    if let Some(fid) = federation_id {
        let fed = if let Ok(Some(f)) = state.federation_repo.find_by_id(fid).await {
            Some(f)
        } else if let Ok(Some(f)) = state
            .federation_repo
            .find_by_keycloak_id(&fid.to_string())
            .await
        {
            Some(f)
        } else {
            None
        };

        if let Some(f) = fed {
            let apexes = state
                .apex_repo
                .find_by_federation_id(f.id)
                .await
                .unwrap_or_default();
            allowed_apex_ids = Some(apexes.into_iter().map(|a| a.id).collect::<Vec<_>>());
        } else {
            allowed_apex_ids = Some(vec![]);
        }
    }

    let mut target_apex_id = None;
    if let Some(aid) = apex_id {
        let apex = if let Ok(Some(a)) = state.apex_repo.find_by_id(aid).await {
            Some(a)
        } else if let Ok(Some(a)) = state.apex_repo.find_by_keycloak_id(&aid.to_string()).await {
            Some(a)
        } else {
            None
        };

        if let Some(a) = apex {
            target_apex_id = Some(a.id);
        } else {
            target_apex_id = Some(Uuid::new_v4());
        }
    }

    let filtered = coops
        .into_iter()
        .filter(|c| {
            if let Some(ref r) = region {
                if r != "all" && c.region.as_ref().map(|x| x.as_str()) != Some(r.as_str()) {
                    return false;
                }
            }
            if let Some(ref s) = sector {
                if s != "all" && c.sector.as_deref() != Some(s.as_str()) {
                    return false;
                }
            }
            if let Some(ref allowed) = allowed_apex_ids {
                if !allowed.contains(&c.apex_id) {
                    return false;
                }
            }
            if let Some(aid) = target_apex_id {
                if c.apex_id != aid {
                    return false;
                }
            }
            true
        })
        .map(|c| c.id)
        .collect();

    Ok(filtered)
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/financial-statements/{id}",
    params(("id" = Uuid, Path, description = "Financial statement ID")),
    responses(
        (status = 200, description = "Financial statement", body = FinancialStatementResponse),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Cooperative"
)]
pub async fn get_financial_statement(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let fs = state
        .financial_statement_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Financial statement not found".into()))?;

    if !coop_ids.contains(&fs.cooperative_id) {
        return Err(AppError::Forbidden("Access denied".into()));
    }

    Ok((StatusCode::OK, Json(FinancialStatementResponse::from(fs))))
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/financial-statements/{id}/line-items",
    params(("id" = Uuid, Path, description = "Financial statement ID")),
    responses(
        (status = 200, description = "Line items", body = Vec<LineItemResponse>),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Not found")
    ),
    tag = "Cooperative"
)]
pub async fn list_line_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
) -> AppResult<impl IntoResponse> {
    let coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let fs = state
        .financial_statement_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Financial statement not found".into()))?;

    if !coop_ids.contains(&fs.cooperative_id) {
        return Err(AppError::Forbidden("Access denied".into()));
    }

    let items = state
        .line_item_repo
        .find_by_financial_statement(id)
        .await?
        .into_iter()
        .map(LineItemResponse::from)
        .collect::<Vec<_>>();

    Ok((StatusCode::OK, Json(items)))
}

#[utoipa::path(
    patch,
    path = "/api/v1/cooperative/financial-statements/{id}/line-items",
    params(("id" = Uuid, Path, description = "Financial statement ID")),
    request_body = LineItemBulkUpdateRequest,
    responses(
        (status = 200, description = "Line items updated", body = Vec<LineItemResponse>),
        (status = 400, description = "Invalid input"),
        (status = 403, description = "Forbidden")
    ),
    tag = "Cooperative"
)]
pub async fn update_line_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Json(body): Json<LineItemBulkUpdateRequest>,
) -> AppResult<impl IntoResponse> {
    let coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let fs = state
        .financial_statement_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Financial statement not found".into()))?;

    if !coop_ids.contains(&fs.cooperative_id) {
        return Err(AppError::Forbidden("Access denied".into()));
    }

    let mut updated = vec![];
    for update in body.updates {
        if let Some(value) = update.value {
            use rust_decimal::prelude::FromPrimitive;
            let decimal =
                rust_decimal::Decimal::from_f64(value).unwrap_or(rust_decimal::Decimal::ZERO);
            let item = state
                .line_item_repo
                .update_value(update.id, decimal, update.account_code)
                .await?;
            updated.push(LineItemResponse::from(item));
        }
    }

    Ok((StatusCode::OK, Json(updated)))
}

#[utoipa::path(
    post,
    path = "/api/v1/cooperative/submissions/{id}/manual-financial-statement",
    params(("id" = Uuid, Path, description = "Submission ID")),
    request_body = ManualFinancialStatementRequest,
    responses(
        (status = 201, description = "Financial statement manually created", body = FinancialStatementResponse),
        (status = 400, description = "Invalid input"),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Submission not found")
    ),
    tag = "Cooperative"
)]
pub async fn create_manual_financial_statement(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(submission_id): Path<Uuid>,
    Json(body): Json<crate::api::dto::financial::ManualFinancialStatementRequest>,
) -> AppResult<impl IntoResponse> {
    use crate::entities::balance_sheet_line_item::ActiveModel as LineItemModel;
    use crate::entities::enums::{AccountCategory, AccountingYear, Currency, SubmissionStatus};
    use crate::entities::financial_statement::ActiveModel as FsModel;
    use crate::services::abnormality_detector::AbnormalityDetector;
    use sea_orm::Set;

    let coop =
        crate::api::handlers::cooperative::resolve_caller_cooperative(&state, &claims).await?;

    let submission = state
        .submission_repo
        .find_by_id(submission_id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if submission.cooperative_id != coop.id {
        return Err(AppError::Forbidden(
            "Submission does not belong to your cooperative".into(),
        ));
    }

    if submission.status != SubmissionStatus::Draft {
        return Err(AppError::Conflict(
            "Can only add financial statement to a draft submission".into(),
        ));
    }

    // Check for existing financial statement — replace if found (same as upload)
    if let Some(existing_fs) = state
        .financial_statement_repo
        .find_by_submission(submission_id)
        .await?
    {
        tracing::info!(
            fs_id = %existing_fs.id,
            "Replacing existing financial statement with manual entry"
        );
        state
            .financial_statement_repo
            .delete(existing_fs.id)
            .await?;
    }

    let fs_id = Uuid::new_v4();
    let accounting_year =
        AccountingYear::parse(&body.accounting_year).unwrap_or(AccountingYear::Calendar);
    let currency = if body.currency == "USD" {
        Currency::Usd
    } else {
        Currency::Szl
    };

    // Create financial statement record
    let fs_model = FsModel {
        id: Set(fs_id),
        submission_id: Set(submission_id),
        cooperative_id: Set(coop.id),
        reporting_year: Set(submission.reporting_year),
        accounting_year: Set(accounting_year),
        currency: Set(currency),
        is_validated: Set(false),
        validation_errors: Set(None),
        created_at: Set(chrono::Utc::now()),
        updated_at: Set(chrono::Utc::now()),
    };
    let created_fs = state.financial_statement_repo.create(fs_model).await?;

    // Create line items
    for item in body.line_items {
        use rust_decimal::prelude::FromPrimitive;
        let value = rust_decimal::Decimal::from_f64(item.value.unwrap_or(0.0))
            .unwrap_or(rust_decimal::Decimal::ZERO);
        let category =
            AccountCategory::parse(&item.account_category).unwrap_or(AccountCategory::Assets);

        let model = LineItemModel {
            id: Set(Uuid::new_v4()),
            financial_statement_id: Set(fs_id),
            account_code: Set(item.account_code),
            account_name: Set(item.account_name),
            account_category: Set(category),
            account_subcategory: Set(item.account_subcategory),
            month: Set(item.month),
            value: Set(Some(value)),
            ai_confidence: Set(None),
            ai_flagged: Set(item.account_code.is_none()),
            manually_edited: Set(true),
            raw_label: Set(None),
            created_at: Set(chrono::Utc::now()),
            updated_at: Set(chrono::Utc::now()),
        };
        state.line_item_repo.create(model).await?;
    }

    // Run abnormality detector / validation
    let coa = state.coa_repo.find_all().await?;
    let coop_type = coop
        .institution_type
        .as_ref()
        .map(|t| t.as_str().to_string())
        .unwrap_or_else(|| "sacco".to_string());

    let detector = AbnormalityDetector::new(
        state.line_item_repo.clone(),
        state.flag_repo.clone(),
        state.coa_repo.clone(),
    );
    let (errors, warnings) = detector
        .run(submission_id, coop.id, fs_id, &coa, &coop_type)
        .await?;

    let validation_json = serde_json::json!({"errors": errors, "warnings": warnings});
    state
        .financial_statement_repo
        .set_validation_errors(fs_id, validation_json)
        .await?;

    // Set financial section status to ready or in_progress (following upload pipeline, we set it to in_progress)
    if let Some(sec) = state
        .section_repo
        .find_by_submission_and_section(submission_id, "financial")
        .await?
    {
        state
            .section_repo
            .update_status(sec.id, "in_progress")
            .await?;
    }

    Ok((
        StatusCode::CREATED,
        Json(FinancialStatementResponse::from(created_fs)),
    ))
}

// ── S4-T1: KPI computation endpoint ──────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions/{id}/kpis",
    params(
        ("id" = Uuid, Path, description = "Submission ID"),
        KpisQueryParams
    ),
    responses(
        (status = 200, description = "Computed KPIs for submission", body = SubmissionKpisResponse),
        (status = 403, description = "Access denied"),
        (status = 404, description = "Submission or financial statement not found")
    ),
    tag = "Cooperative"
)]
pub async fn get_submission_kpis(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Query(query): Query<KpisQueryParams>,
) -> AppResult<impl IntoResponse> {
    let coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if !coop_ids.contains(&submission.cooperative_id) {
        return Err(AppError::Forbidden("Access denied".into()));
    }

    let mut db_kpis = state.kpi_record_repo.find_by_submission(id).await?;
    if db_kpis.is_empty() {
        tracing::warn!(
            submission_id = %id,
            "KPI records missing from DB, auto-computing and saving on-the-fly"
        );
        let workflow = crate::services::submission_workflow::SubmissionWorkflow::new(
            state.submission_repo.clone(),
            state.review_repo.clone(),
            state.flag_repo.clone(),
            state.section_repo.clone(),
            state.financial_statement_repo.clone(),
            state.line_item_repo.clone(),
            state.kpi_record_repo.clone(),
            state.db.clone(),
        );
        if let Err(e) = workflow
            .compute_and_save_kpis(id, submission.cooperative_id, submission.reporting_year)
            .await
        {
            tracing::error!("Failed to auto-compute KPIs: {}", e);
        }
        db_kpis = state.kpi_record_repo.find_by_submission(id).await?;
    }

    let kpis: Vec<KpiItemResponse> = db_kpis
        .into_iter()
        .map(|r| {
            let benchmark = crate::services::KpiEngine::get_benchmark(&r.kpi_name);
            KpiItemResponse {
                name: r.kpi_name,
                value: r.value,
                formatted: r.formatted,
                unit: r.unit,
                status: r.status,
                benchmark,
                description: r.description,
            }
        })
        .collect();

    tracing::info!(
        submission_id = %id,
        kpi_count = kpis.len(),
        submission_status = %submission.status.as_str(),
        "KPIs retrieved for submission"
    );

    let prior_year_kpis = if query.include_prior_year.unwrap_or(false) {
        if let Some(prior_sub) = state
            .submission_repo
            .find_by_cooperative_and_year(submission.cooperative_id, submission.reporting_year - 1)
            .await?
        {
            let db_prior_kpis = state
                .kpi_record_repo
                .find_by_submission(prior_sub.id)
                .await?;
            Some(
                db_prior_kpis
                    .into_iter()
                    .map(|r| {
                        let benchmark = crate::services::KpiEngine::get_benchmark(&r.kpi_name);
                        KpiItemResponse {
                            name: r.kpi_name,
                            value: r.value,
                            formatted: r.formatted,
                            unit: r.unit,
                            status: r.status,
                            benchmark,
                            description: r.description,
                        }
                    })
                    .collect(),
            )
        } else {
            None
        }
    } else {
        None
    };

    Ok((
        StatusCode::OK,
        Json(SubmissionKpisResponse {
            submission_id: id,
            reporting_year: submission.reporting_year,
            computed_at: chrono::Utc::now(),
            submission_status: submission.status.as_str().to_string(),
            kpis,
            prior_year_kpis,
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions/{id}/financial-statement/line-items",
    params(
        ("id" = Uuid, Path, description = "Submission ID"),
        KpisQueryParams
    ),
    responses(
        (status = 200, description = "Line items for submission", body = SubmissionLineItemsResponse),
        (status = 403, description = "Access denied"),
        (status = 404, description = "Submission not found")
    ),
    tag = "Cooperative"
)]
pub async fn get_submission_line_items(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Query(query): Query<KpisQueryParams>,
) -> AppResult<impl IntoResponse> {
    let coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if !coop_ids.contains(&submission.cooperative_id) {
        return Err(AppError::Forbidden("Access denied".into()));
    }

    let current_fs = state
        .financial_statement_repo
        .find_by_submission_id(id)
        .await?;

    let mut current_year_items = vec![];
    if let Some(fs) = current_fs {
        current_year_items = state
            .line_item_repo
            .find_by_financial_statement(fs.id)
            .await?
            .into_iter()
            .map(LineItemResponse::from)
            .collect();
    }

    let mut prior_year_items = None;
    if query.include_prior_year.unwrap_or(false) {
        if let Some(prior_sub) = state
            .submission_repo
            .find_by_cooperative_and_year(submission.cooperative_id, submission.reporting_year - 1)
            .await?
        {
            if let Some(prior_fs) = state
                .financial_statement_repo
                .find_by_submission_id(prior_sub.id)
                .await?
            {
                let items = state
                    .line_item_repo
                    .find_by_financial_statement(prior_fs.id)
                    .await?
                    .into_iter()
                    .map(LineItemResponse::from)
                    .collect();
                prior_year_items = Some(items);
            }
        }
    }

    Ok((
        StatusCode::OK,
        Json(SubmissionLineItemsResponse {
            submission_id: id,
            current_year: current_year_items,
            prior_year: prior_year_items,
        }),
    ))
}

// ── S4-T2: Benchmark aggregation endpoint ────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/v1/benchmarks",
    params(
        ("kpi_name" = String, Query, description = "KPI identifier e.g. par30, roa, capital_adequacy_ratio"),
        ("cooperative_type" = Option<String>, Query, description = "Filter by cooperative type e.g. sacco"),
        ("reporting_year" = Option<i32>, Query, description = "Reporting year, defaults to current year"),
    ),
    responses(
        (status = 200, description = "Benchmark statistics for the requested KPI", body = BenchmarkResponse),
        (status = 400, description = "Invalid KPI name"),
        (status = 403, description = "Forbidden")
    ),
    tag = "Analytics"
)]
pub async fn get_benchmarks(
    State(state): State<AppState>,
    Query(params): Query<BenchmarkQueryParams>,
) -> AppResult<impl IntoResponse> {
    let year = params
        .reporting_year
        .unwrap_or_else(|| chrono::Utc::now().year());

    let cache_key = format!(
        "benchmark:{}:{}:{}",
        params.kpi_name,
        params.cooperative_type.as_deref().unwrap_or("all"),
        year
    );

    // ── Cache hit ────────────────────────────────────────────────────────────
    if let Ok(Some(cached)) = state.cache.get::<BenchmarkResponse>(&cache_key).await {
        tracing::debug!(cache_key = %cache_key, "Benchmark cache hit");
        return Ok((StatusCode::OK, Json(cached)));
    }

    // ── Compute from approved submissions ────────────────────────────────────
    use crate::entities::enums::SubmissionStatus;
    let all_approved = state
        .submission_repo
        .find_by_status(SubmissionStatus::Approved)
        .await?;

    // Filter by year first
    let year_filtered: Vec<_> = all_approved
        .iter()
        .filter(|s| s.reporting_year == year)
        .collect();

    // Filter by cooperative_type if provided
    let type_filtered: Vec<_> = if let Some(coop_type) = &params.cooperative_type {
        let coop_type_lower = coop_type.to_lowercase();
        let mut result = Vec::new();
        for sub in &year_filtered {
            if let Ok(Some(coop)) = state.cooperative_repo.find_by_id(sub.cooperative_id).await {
                let institution_type = coop
                    .institution_type
                    .as_ref()
                    .map(|t| t.as_str().to_lowercase())
                    .unwrap_or_default();
                if institution_type == coop_type_lower {
                    result.push(*sub);
                }
            }
        }
        result
    } else {
        year_filtered.to_vec()
    };

    if type_filtered.is_empty() {
        return Ok((
            StatusCode::OK,
            Json(BenchmarkResponse {
                kpi_name: params.kpi_name.clone(),
                cooperative_type: params.cooperative_type.clone(),
                reporting_year: year,
                sector_average: 0.0,
                national_average: 0.0,
                percentile_25: 0.0,
                percentile_50: 0.0,
                percentile_75: 0.0,
                sample_count: 0,
            }),
        ));
    }

    // Collect all submission IDs and batch-load financial statements
    let submission_ids: Vec<_> = type_filtered.iter().map(|s| s.id).collect();
    let all_fs = state
        .financial_statement_repo
        .find_by_submission_ids(submission_ids)
        .await?;

    // Compute KPI value for each submission
    let mut kpi_values: Vec<f64> = Vec::with_capacity(all_fs.len());

    for fs in &all_fs {
        let line_items = state
            .line_item_repo
            .find_by_financial_statement(fs.id)
            .await?;

        if line_items.is_empty() {
            continue;
        }

        let kpi_set = crate::services::KpiEngine::compute(&line_items);

        if let Some(kpi) = kpi_set.get_by_name(&params.kpi_name) {
            kpi_values.push(kpi.value);
        } else {
            return Err(AppError::BadRequest(format!(
                "Unknown KPI name '{}'. Valid names: par30, par90, npl_ratio, loan_loss_coverage, \
                 roa, roe, operating_expense_ratio, capital_adequacy_ratio, liquid_funds_ratio, \
                 operational_self_sufficiency, net_interest_margin, deposits_to_loans, \
                 total_assets, gross_loan_portfolio, net_loan_portfolio, total_member_deposits, \
                 total_equity, net_surplus",
                params.kpi_name
            )));
        }
    }

    let sample_count = kpi_values.len();

    // Compute statistics
    let (sector_avg, national_avg, p25, p50, p75) = if sample_count == 0 {
        (0.0, 0.0, 0.0, 0.0, 0.0)
    } else {
        let mut sorted = kpi_values.clone();
        sorted.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));

        let mean = sorted.iter().sum::<f64>() / sorted.len() as f64;
        let p25 = sorted[sorted.len() * 25 / 100];
        let p50 = sorted[sorted.len() * 50 / 100];
        let p75 = sorted[(sorted.len() * 75 / 100).min(sorted.len() - 1)];

        (mean, mean, p25, p50, p75)
    };

    let result = BenchmarkResponse {
        kpi_name: params.kpi_name.clone(),
        cooperative_type: params.cooperative_type.clone(),
        reporting_year: year,
        sector_average: sector_avg,
        national_average: national_avg,
        percentile_25: p25,
        percentile_50: p50,
        percentile_75: p75,
        sample_count,
    };

    // Cache for 1 hour — fire-and-forget
    let cache_clone = state.cache.clone();
    let result_clone = result.clone();
    let key_clone = cache_key.clone();
    tokio::spawn(async move {
        if let Err(e) = cache_clone
            .set(
                &key_clone,
                &result_clone,
                std::time::Duration::from_secs(3600),
            )
            .await
        {
            tracing::warn!(error = %e, "Failed to cache benchmark result");
        }
    });

    tracing::info!(
        kpi_name = %params.kpi_name,
        sample_count,
        sector_average = sector_avg,
        "Benchmarks computed"
    );

    Ok((StatusCode::OK, Json(result)))
}

// ── S4-T5: Multi-format export endpoint ──────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/submissions/{id}/export",
    params(
        ("id" = Uuid, Path, description = "Submission ID"),
        ("format" = String, Query, description = "Export format: xlsx or csv"),
    ),
    responses(
        (status = 200, description = "File download (xlsx or csv)"),
        (status = 400, description = "Invalid format parameter"),
        (status = 403, description = "Access denied"),
        (status = 404, description = "Submission or financial statement not found")
    ),
    tag = "Cooperative"
)]
pub async fn export_submission(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Path(id): Path<Uuid>,
    Query(params): Query<ExportParams>,
) -> AppResult<impl IntoResponse> {
    let format = params.format.to_lowercase();
    if format != "xlsx" && format != "csv" && format != "pdf" {
        return Err(AppError::BadRequest(
            "format must be 'xlsx', 'csv', or 'pdf'".into(),
        ));
    }

    let coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let submission = state
        .submission_repo
        .find_by_id(id)
        .await?
        .ok_or_else(|| AppError::NotFound("Submission not found".into()))?;

    if !coop_ids.contains(&submission.cooperative_id) {
        return Err(AppError::Forbidden("Access denied".into()));
    }

    let fs = state
        .financial_statement_repo
        .find_by_submission(id)
        .await?
        .ok_or_else(|| AppError::NotFound("No financial statement for this submission".into()))?;

    let line_items = state
        .line_item_repo
        .find_by_financial_statement(fs.id)
        .await?;

    let kpi_set = crate::services::KpiEngine::compute(&line_items);
    let kpis = kpi_set.to_vec();

    let analytics =
        crate::services::nf_indicator_engine::NfIndicatorEngine::compute_for_submission(
            &state.db,
            submission.cooperative_id,
            Some(submission.id),
        )
        .await?;

    let reference = submission
        .reference
        .clone()
        .unwrap_or_else(|| id.to_string());

    tracing::info!(
        submission_id = %id,
        format = %format,
        line_item_count = line_items.len(),
        "Exporting submission"
    );

    use axum::response::Response;
    let response: Response = match format.as_str() {
        "xlsx" => build_xlsx_response(&line_items, &kpis, &analytics, &reference)?.into_response(),
        "csv" => build_csv_response(&line_items, &analytics, &reference)?.into_response(),
        "pdf" => build_pdf_response(&line_items, &kpis, &analytics, &reference)?.into_response(),
        _ => unreachable!(),
    };
    Ok(response)
}

fn build_xlsx_response(
    line_items: &[crate::entities::balance_sheet_line_item::Model],
    kpis: &[crate::services::kpi_engine::KpiValue],
    analytics: &crate::services::nf_indicator_engine::NfStatisticsResponse,
    reference: &str,
) -> AppResult<impl IntoResponse> {
    use axum::http::header;
    use rust_xlsxwriter::Workbook;

    let mut workbook = Workbook::new();

    // ── Sheet 1: Balance Sheet ────────────────────────────────────────────────
    let ws = workbook
        .add_worksheet()
        .set_name("Balance Sheet")
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    let headers = [
        "Account Code",
        "Account Name",
        "Category",
        "Subcategory",
        "Month",
        "Value",
        "AI Confidence",
        "AI Flagged",
        "Manually Edited",
    ];
    for (col, h) in headers.iter().enumerate() {
        ws.write_string(0, col as u16, *h)
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    }

    for (row, item) in line_items.iter().enumerate() {
        let r = (row + 1) as u32;
        if let Some(code) = item.account_code {
            ws.write_number(r, 0, code as f64)
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;
        }
        ws.write_string(r, 1, item.account_name.as_str())
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;
        ws.write_string(r, 2, item.account_category.as_str())
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;
        ws.write_string(r, 3, item.account_subcategory.as_str())
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;
        ws.write_number(r, 4, item.month as f64)
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;
        if let Some(val) = item.value.as_ref().and_then(|d| d.to_f64()) {
            ws.write_number(r, 5, val)
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;
        }
        if let Some(conf) = item.ai_confidence.as_ref().and_then(|d| d.to_f64()) {
            ws.write_number(r, 6, conf)
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;
        }
        ws.write_boolean(r, 7, item.ai_flagged)
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;
        ws.write_boolean(r, 8, item.manually_edited)
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    }

    // ── Sheet 2: KPIs ─────────────────────────────────────────────────────────
    let ws2 = workbook
        .add_worksheet()
        .set_name("KPIs")
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    let kpi_headers = [
        "KPI Name",
        "Value",
        "Formatted",
        "Unit",
        "Status",
        "Benchmark",
        "Description",
    ];
    for (col, h) in kpi_headers.iter().enumerate() {
        ws2.write_string(0, col as u16, *h)
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    }
    for (row, kpi) in kpis.iter().enumerate() {
        let r = (row + 1) as u32;
        ws2.write_string(r, 0, kpi.name.as_str())
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;
        ws2.write_number(r, 1, kpi.value)
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;
        ws2.write_string(r, 2, kpi.formatted.as_str())
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;
        ws2.write_string(r, 3, kpi.unit.as_str())
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;
        ws2.write_string(r, 4, kpi.status.as_deref().unwrap_or("—"))
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;
        if let Some(b) = kpi.benchmark {
            ws2.write_number(r, 5, b)
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;
        }
        ws2.write_string(r, 6, kpi.description.as_str())
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    }

    // ── Sheet 3: Analytics & Demographics ─────────────────────────────────────
    let ws3 = workbook
        .add_worksheet()
        .set_name("Analytics")
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    let analytics_headers = ["Category", "Metric", "Value", "Percentage"];
    for (col, h) in analytics_headers.iter().enumerate() {
        ws3.write_string(0, col as u16, *h)
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    }

    let mut row = 1;
    let mut write_metric =
        |category: &str, metric: &str, val: u64, pct: Option<f64>| -> AppResult<()> {
            ws3.write_string(row, 0, category)
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;
            ws3.write_string(row, 1, metric)
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;
            ws3.write_number(row, 2, val as f64)
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;
            if let Some(p) = pct {
                ws3.write_string(row, 3, format!("{p:.1}%").as_str())
                    .map_err(|e| AppError::InternalServerError(e.to_string()))?;
            }
            row += 1;
            Ok(())
        };

    write_metric(
        "Membership",
        "Total Members",
        analytics.membership.total,
        None,
    )?;
    write_metric(
        "Membership",
        "Active Members",
        analytics.membership.active,
        Some(analytics.membership.active_pct),
    )?;
    write_metric(
        "Membership",
        "Male",
        analytics.membership.male,
        Some(analytics.membership.male_pct),
    )?;
    write_metric(
        "Membership",
        "Female",
        analytics.membership.female,
        Some(analytics.membership.female_pct),
    )?;
    write_metric("Loans", "Total Loans", analytics.loans.total_loans, None)?;
    write_metric(
        "Loans",
        "Performing",
        analytics.loans.performing,
        Some(analytics.loans.on_time_repayment_pct),
    )?;
    write_metric(
        "Loans",
        "Arrears",
        analytics.loans.arrears,
        Some(analytics.loans.arrears_rate_pct),
    )?;
    write_metric(
        "Savings",
        "Total Accounts",
        analytics.savings.total_accounts,
        None,
    )?;
    write_metric(
        "Savings",
        "Active Accounts",
        analytics.savings.active_accounts,
        Some(analytics.savings.active_savers_pct),
    )?;

    let bytes = workbook
        .save_to_buffer()
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    let filename = format!("{reference}.xlsx");
    use axum::body::Body;
    use axum::response::Response;
    let response = Response::builder()
        .status(StatusCode::OK)
        .header(
            header::CONTENT_TYPE,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{filename}\""),
        )
        .body(Body::from(bytes))
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    Ok(response)
}

fn build_csv_response(
    line_items: &[crate::entities::balance_sheet_line_item::Model],
    analytics: &crate::services::nf_indicator_engine::NfStatisticsResponse,
    reference: &str,
) -> AppResult<impl IntoResponse> {
    use axum::http::header;
    use rust_decimal::prelude::ToPrimitive;

    let mut writer = csv::Writer::from_writer(vec![]);

    writer
        .write_record([
            "account_code",
            "account_name",
            "category",
            "subcategory",
            "month",
            "value",
            "ai_confidence",
            "ai_flagged",
            "manually_edited",
        ])
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    for item in line_items {
        writer
            .write_record([
                item.account_code.map(|c| c.to_string()).unwrap_or_default(),
                item.account_name.clone(),
                item.account_category.as_str().to_string(),
                item.account_subcategory.clone(),
                item.month.to_string(),
                item.value
                    .as_ref()
                    .and_then(|d| d.to_f64())
                    .map(|v| format!("{v:.2}"))
                    .unwrap_or_default(),
                item.ai_confidence
                    .as_ref()
                    .and_then(|d| d.to_f64())
                    .map(|v| format!("{v:.4}"))
                    .unwrap_or_default(),
                item.ai_flagged.to_string(),
                item.manually_edited.to_string(),
            ])
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    }

    // Append Analytics Data as rows
    writer
        .write_record(["", "", "", "", "", "", "", "", ""])
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    writer
        .write_record([
            "ANALYTICS",
            "Category",
            "Metric",
            "Value",
            "Percentage",
            "",
            "",
            "",
            "",
        ])
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    let mut write_csv_metric =
        |cat: &str, met: &str, val: u64, pct: Option<f64>| -> AppResult<()> {
            let pct_str = pct.map(|p| format!("{p:.1}%")).unwrap_or_default();
            writer
                .write_record(["", cat, met, &val.to_string(), &pct_str, "", "", "", ""])
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;
            Ok(())
        };

    write_csv_metric(
        "Membership",
        "Total Members",
        analytics.membership.total,
        None,
    )?;
    write_csv_metric(
        "Membership",
        "Active Members",
        analytics.membership.active,
        Some(analytics.membership.active_pct),
    )?;
    write_csv_metric(
        "Membership",
        "Male",
        analytics.membership.male,
        Some(analytics.membership.male_pct),
    )?;
    write_csv_metric(
        "Membership",
        "Female",
        analytics.membership.female,
        Some(analytics.membership.female_pct),
    )?;
    write_csv_metric("Loans", "Total Loans", analytics.loans.total_loans, None)?;
    write_csv_metric(
        "Loans",
        "Performing",
        analytics.loans.performing,
        Some(analytics.loans.on_time_repayment_pct),
    )?;
    write_csv_metric(
        "Loans",
        "Arrears",
        analytics.loans.arrears,
        Some(analytics.loans.arrears_rate_pct),
    )?;
    write_csv_metric(
        "Savings",
        "Total Accounts",
        analytics.savings.total_accounts,
        None,
    )?;
    write_csv_metric(
        "Savings",
        "Active Accounts",
        analytics.savings.active_accounts,
        Some(analytics.savings.active_savers_pct),
    )?;

    let data = writer
        .into_inner()
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    let filename = format!("{reference}.csv");
    use axum::body::Body;
    use axum::response::Response;
    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/csv")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{filename}\""),
        )
        .body(Body::from(data))
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    Ok(response)
}

fn build_pdf_response(
    line_items: &[crate::entities::balance_sheet_line_item::Model],
    kpis: &[crate::services::kpi_engine::KpiValue],
    analytics: &crate::services::nf_indicator_engine::NfStatisticsResponse,
    reference: &str,
) -> AppResult<impl IntoResponse> {
    use axum::http::header;
    use printpdf::*;

    let (doc, mut page1, mut layer1) = PdfDocument::new(
        "Financial Statement Report",
        Mm(210.0),
        Mm(297.0),
        "Layer 1",
    );
    let mut current_layer = doc.get_page(page1).get_layer(layer1);

    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;
    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    current_layer.use_text(
        format!("Financial Statement Report: {}", reference),
        16.0,
        Mm(20.0),
        Mm(275.0),
        &font_bold,
    );

    let mut y: f32 = 260.0;

    let mut check_page =
        |doc: &PdfDocumentReference, y: &mut f32, current_layer: &mut PdfLayerReference| {
            if *y < 25.0 {
                let (new_page, new_layer) = doc.add_page(Mm(210.0), Mm(297.0), "Layer 1");
                page1 = new_page;
                layer1 = new_layer;
                *current_layer = doc.get_page(page1).get_layer(layer1);
                *y = 275.0;
            }
        };

    current_layer.use_text(
        "Key Performance Indicators (KPIs)",
        14.0,
        Mm(20.0),
        Mm(y),
        &font_bold,
    );
    y -= 8.0;

    for kpi in kpis {
        check_page(&doc, &mut y, &mut current_layer);
        let text = format!(
            "{}: {} (Status: {})",
            kpi.name,
            kpi.formatted,
            kpi.status.as_deref().unwrap_or("—")
        );
        current_layer.use_text(text, 10.0, Mm(20.0), Mm(y), &font);
        y -= 6.0;
    }

    y -= 10.0;
    check_page(&doc, &mut y, &mut current_layer);
    current_layer.use_text("Line Items Summary", 14.0, Mm(20.0), Mm(y), &font_bold);
    y -= 8.0;

    for item in line_items {
        check_page(&doc, &mut y, &mut current_layer);
        use rust_decimal::prelude::ToPrimitive;
        let val_str = item
            .value
            .as_ref()
            .and_then(|d| d.to_f64())
            .map(|v| format!("{v:.2}"))
            .unwrap_or_default();
        let text = format!(
            "{} - {}: {}",
            item.account_code.unwrap_or_default(),
            item.account_name,
            val_str
        );
        current_layer.use_text(text, 9.0, Mm(20.0), Mm(y), &font);
        y -= 5.0;
    }

    y -= 10.0;
    check_page(&doc, &mut y, &mut current_layer);
    current_layer.use_text(
        "Non-Financial Analytics & Demographics",
        14.0,
        Mm(20.0),
        Mm(y),
        &font_bold,
    );
    y -= 8.0;

    let mut write_pdf_metric =
        |doc: &PdfDocumentReference, y: &mut f32, layer: &mut PdfLayerReference, text: String| {
            check_page(doc, y, layer);
            layer.use_text(text, 10.0, Mm(20.0), Mm(*y), &font);
            *y -= 6.0;
        };

    write_pdf_metric(
        &doc,
        &mut y,
        &mut current_layer,
        format!("Total Members: {}", analytics.membership.total),
    );
    write_pdf_metric(
        &doc,
        &mut y,
        &mut current_layer,
        format!(
            "Active Members: {} ({:.1}%)",
            analytics.membership.active, analytics.membership.active_pct
        ),
    );
    write_pdf_metric(
        &doc,
        &mut y,
        &mut current_layer,
        format!(
            "Female Members: {} ({:.1}%)",
            analytics.membership.female, analytics.membership.female_pct
        ),
    );
    write_pdf_metric(
        &doc,
        &mut y,
        &mut current_layer,
        format!("Total Loans: {}", analytics.loans.total_loans),
    );
    write_pdf_metric(
        &doc,
        &mut y,
        &mut current_layer,
        format!(
            "Performing Loans: {} ({:.1}%)",
            analytics.loans.performing, analytics.loans.on_time_repayment_pct
        ),
    );
    write_pdf_metric(
        &doc,
        &mut y,
        &mut current_layer,
        format!(
            "Total Savings Accounts: {}",
            analytics.savings.total_accounts
        ),
    );

    let bytes = doc
        .save_to_bytes()
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    let filename = format!("{reference}.pdf");
    use axum::body::Body;
    use axum::response::Response;
    let response = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/pdf")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{filename}\""),
        )
        .body(Body::from(bytes))
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    Ok(response)
}

// ── S4-T6: Ministry stats endpoint ───────────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/v1/ministry/stats",
    responses(
        (status = 200, description = "Ministry-level dashboard statistics", body = MinistryStatsResponse),
        (status = 403, description = "Forbidden")
    ),
    tag = "Ministry"
)]
pub async fn get_ministry_stats(
    State(state): State<AppState>,
    Extension(_claims): Extension<Arc<Claims>>,
) -> AppResult<impl IntoResponse> {
    use crate::entities::enums::SubmissionStatus;

    // Count all cooperatives via cooperative_repo
    let all_coops = state.cooperative_repo.list_all().await.unwrap_or_default();
    let total_cooperatives = all_coops.len() as i64;

    let all_coop_ids: Vec<Uuid> = all_coops.iter().map(|c| c.id).collect();
    let all_submissions = state
        .submission_repo
        .find_by_cooperative_ids(all_coop_ids)
        .await?;

    let total_submissions = all_submissions.len() as i64;
    let pending_review_count = all_submissions
        .iter()
        .filter(|s| {
            s.status != SubmissionStatus::Draft
                && s.status != SubmissionStatus::Approved
                && s.status != SubmissionStatus::Rejected
        })
        .count() as i64;
    let approved_count = all_submissions
        .iter()
        .filter(|s| {
            s.status == SubmissionStatus::Approved || s.status == SubmissionStatus::Submitted
        })
        .count() as i64;
    let rejected_count = all_submissions
        .iter()
        .filter(|s| s.status == SubmissionStatus::Rejected)
        .count() as i64;

    tracing::info!(
        total_cooperatives,
        total_submissions,
        pending_review_count,
        "Ministry stats computed"
    );

    // Compute average PAR30 and CAR from approved submissions
    let approved_sub_ids: Vec<Uuid> = all_submissions
        .iter()
        .filter(|s| {
            s.status == SubmissionStatus::Approved || s.status == SubmissionStatus::Submitted
        })
        .map(|s| s.id)
        .collect();

    let (average_par30, average_car) =
        crate::api::handlers::submission::compute_average_kpis(&state, approved_sub_ids).await;

    tracing::info!(
        total_cooperatives,
        total_submissions,
        pending_review_count,
        average_par30 = ?average_par30,
        average_car = ?average_car,
        "Ministry stats computed"
    );

    Ok((
        StatusCode::OK,
        Json(MinistryStatsResponse {
            total_cooperatives,
            total_submissions,
            pending_review_count,
            approved_count,
            rejected_count,
            average_par30,
            average_car,
        }),
    ))
}

#[utoipa::path(
    get,
    path = "/api/v1/ministry/submissions/export",
    params(("format" = String, Query, description = "Export format: xlsx or csv")),
    responses(
        (status = 200, description = "Bulk export file"),
        (status = 400, description = "Invalid format"),
        (status = 403, description = "Forbidden")
    ),
    tag = "Ministry"
)]
pub async fn export_ministry_submissions(
    State(state): State<AppState>,
    Extension(_claims): Extension<Arc<Claims>>,
    Query(params): Query<ExportParams>,
) -> AppResult<impl IntoResponse> {
    let format = params.format.to_lowercase();
    if format != "xlsx" && format != "csv" && format != "pdf" {
        return Err(AppError::BadRequest(
            "format must be 'xlsx', 'csv', or 'pdf'".into(),
        ));
    }

    let all_coops = state.cooperative_repo.list_all().await?;
    let coop_ids: Vec<Uuid> = all_coops.iter().map(|c| c.id).collect();
    let coop_names: std::collections::HashMap<Uuid, String> =
        all_coops.iter().map(|c| (c.id, c.name.clone())).collect();

    build_bulk_export(&state, &coop_ids, &coop_names, "ministry", &format).await
}

#[utoipa::path(
    get,
    path = "/api/v1/federation/submissions/export",
    params(("format" = String, Query, description = "Export format: xlsx or csv")),
    responses(
        (status = 200, description = "Bulk export file"),
        (status = 400, description = "Invalid format"),
        (status = 403, description = "Forbidden")
    ),
    tag = "Federation"
)]
pub async fn export_federation_submissions(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<ExportParams>,
) -> AppResult<impl IntoResponse> {
    let format = params.format.to_lowercase();
    if format != "xlsx" && format != "csv" && format != "pdf" {
        return Err(AppError::BadRequest(
            "format must be 'xlsx', 'csv', or 'pdf'".into(),
        ));
    }

    let org_id = claims
        .get_organization_id()
        .ok_or_else(|| AppError::Forbidden("Federation user has no organization".into()))?;
    let federation = state
        .federation_repo
        .find_by_keycloak_id(&org_id)
        .await?
        .ok_or_else(|| AppError::Forbidden("Federation not found".into()))?;
    let apexes = state.apex_repo.find_by_federation_id(federation.id).await?;
    let mut coop_ids = Vec::new();
    let mut coop_names = std::collections::HashMap::new();
    for apex in &apexes {
        let coops = state.cooperative_repo.find_by_apex_id(apex.id).await?;
        for c in &coops {
            coop_names.insert(c.id, c.name.clone());
            coop_ids.push(c.id);
        }
    }

    build_bulk_export(&state, &coop_ids, &coop_names, "federation", &format).await
}

#[utoipa::path(
    get,
    path = "/api/v1/apex/submissions/export",
    params(("format" = String, Query, description = "Export format: xlsx or csv")),
    responses(
        (status = 200, description = "Bulk export file"),
        (status = 400, description = "Invalid format"),
        (status = 403, description = "Forbidden")
    ),
    tag = "Apex"
)]
pub async fn export_apex_submissions(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<ExportParams>,
) -> AppResult<impl IntoResponse> {
    let format = params.format.to_lowercase();
    if format != "xlsx" && format != "csv" && format != "pdf" {
        return Err(AppError::BadRequest(
            "format must be 'xlsx', 'csv', or 'pdf'".into(),
        ));
    }

    let apex_db_id =
        crate::api::handlers::cooperative::resolve_caller_apex_db_id_pub(&state, &claims).await?;
    let coops = state.cooperative_repo.find_by_apex_id(apex_db_id).await?;
    let coop_ids: Vec<Uuid> = coops.iter().map(|c| c.id).collect();
    let coop_names: std::collections::HashMap<Uuid, String> =
        coops.iter().map(|c| (c.id, c.name.clone())).collect();

    build_bulk_export(&state, &coop_ids, &coop_names, "apex", &format).await
}

async fn build_bulk_export(
    state: &AppState,
    coop_ids: &[Uuid],
    coop_names: &std::collections::HashMap<Uuid, String>,
    tier: &str,
    format: &str,
) -> AppResult<impl IntoResponse> {
    use crate::services::KpiEngine;
    use axum::body::Body;
    use axum::http::header;
    use axum::response::Response;
    use rust_xlsxwriter::Workbook;

    let submissions = state
        .submission_repo
        .find_by_cooperative_ids(coop_ids.to_vec())
        .await?;

    let sub_ids: Vec<Uuid> = submissions.iter().map(|s| s.id).collect();
    let fs_list = state
        .financial_statement_repo
        .find_by_submission_ids(sub_ids.clone())
        .await
        .unwrap_or_default();
    let fs_map: std::collections::HashMap<Uuid, Uuid> =
        fs_list.iter().map(|fs| (fs.submission_id, fs.id)).collect();

    type KpiRow = (String, String, i32, String, f64, f64, f64, f64, f64, f64);
    let mut rows: Vec<KpiRow> = Vec::new();

    for sub in &submissions {
        let coop_name = coop_names
            .get(&sub.cooperative_id)
            .cloned()
            .unwrap_or_default();
        let ref_str = sub.reference.clone().unwrap_or_else(|| sub.id.to_string());
        let status = format!("{:?}", sub.status);

        if let Some(&fs_id) = fs_map.get(&sub.id) {
            let line_items = state
                .line_item_repo
                .find_by_financial_statement(fs_id)
                .await
                .unwrap_or_default();
            let kpi_set = KpiEngine::compute(&line_items);
            let find_kpi =
                |name: &str| -> f64 { kpi_set.get_by_name(name).map(|k| k.value).unwrap_or(0.0) };
            rows.push((
                coop_name,
                ref_str,
                sub.reporting_year,
                status,
                find_kpi("total_assets"),
                find_kpi("gross_loan_portfolio"),
                find_kpi("par30"),
                find_kpi("roa"),
                find_kpi("capital_adequacy_ratio"),
                find_kpi("total_equity"),
            ));
        } else {
            rows.push((
                coop_name,
                ref_str,
                sub.reporting_year,
                status,
                0.0,
                0.0,
                0.0,
                0.0,
                0.0,
                0.0,
            ));
        }
    }

    rows.sort_by(|a, b| a.1.cmp(&b.1));

    let response: Response = match format {
        "xlsx" => {
            let mut workbook = Workbook::new();
            let ws = workbook
                .add_worksheet()
                .set_name("Submissions Summary")
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;

            let headers = [
                "Cooperative",
                "Reference",
                "Year",
                "Status",
                "Total Assets",
                "Gross Loans",
                "PAR30 %",
                "ROA %",
                "CAR %",
                "Total Equity",
            ];
            for (col, h) in headers.iter().enumerate() {
                ws.write_string(0, col as u16, *h)
                    .map_err(|e| AppError::InternalServerError(e.to_string()))?;
            }
            for (row, r) in rows.iter().enumerate() {
                let rn = (row + 1) as u32;
                ws.write_string(rn, 0, &r.0)
                    .map_err(|e| AppError::InternalServerError(e.to_string()))?;
                ws.write_string(rn, 1, &r.1)
                    .map_err(|e| AppError::InternalServerError(e.to_string()))?;
                ws.write_number(rn, 2, r.2 as f64)
                    .map_err(|e| AppError::InternalServerError(e.to_string()))?;
                ws.write_string(rn, 3, &r.3)
                    .map_err(|e| AppError::InternalServerError(e.to_string()))?;
                let vals = [r.4, r.5, r.6, r.7, r.8, r.9];
                for (col, val) in vals.iter().enumerate() {
                    ws.write_number(rn, (col + 4) as u16, *val)
                        .map_err(|e| AppError::InternalServerError(e.to_string()))?;
                }
            }

            let bytes = workbook
                .save_to_buffer()
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;
            let filename = format!("{tier}-submissions.xlsx");
            Response::builder()
                .status(StatusCode::OK)
                .header(
                    header::CONTENT_TYPE,
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                )
                .header(
                    header::CONTENT_DISPOSITION,
                    format!("attachment; filename=\"{filename}\""),
                )
                .body(Body::from(bytes))
                .map_err(|e| AppError::InternalServerError(e.to_string()))?
        }
        "csv" => {
            let mut wtr = csv::Writer::from_writer(vec![]);
            wtr.write_record([
                "Cooperative",
                "Reference",
                "Year",
                "Status",
                "Total Assets",
                "Gross Loans",
                "PAR30 %",
                "ROA %",
                "CAR %",
                "Total Equity",
            ])
            .map_err(|e| AppError::InternalServerError(e.to_string()))?;
            for r in &rows {
                wtr.write_record([
                    &r.0,
                    &r.1,
                    &r.2.to_string(),
                    &r.3,
                    &format_f64(r.4),
                    &format_f64(r.5),
                    &format_f64(r.6),
                    &format_f64(r.7),
                    &format_f64(r.8),
                    &format_f64(r.9),
                ])
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;
            }
            let bytes = wtr
                .into_inner()
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;
            let filename = format!("{tier}-submissions.csv");
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "text/csv")
                .header(
                    header::CONTENT_DISPOSITION,
                    format!("attachment; filename=\"{filename}\""),
                )
                .body(Body::from(bytes))
                .map_err(|e| AppError::InternalServerError(e.to_string()))?
        }
        "pdf" => {
            use printpdf::*;
            let (doc, mut page1, mut layer1) = PdfDocument::new(
                format!("{} Report", tier.to_uppercase()),
                Mm(297.0),
                Mm(210.0),
                "Layer 1",
            );
            let mut current_layer = doc.get_page(page1).get_layer(layer1);
            let font = doc
                .add_builtin_font(BuiltinFont::Helvetica)
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;
            let font_bold = doc
                .add_builtin_font(BuiltinFont::HelveticaBold)
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;

            current_layer.use_text(
                format!("{} Consolidated Report", tier.to_uppercase()),
                16.0,
                Mm(20.0),
                Mm(190.0),
                &font_bold,
            );

            let mut y: f32 = 175.0;
            let headers = [
                "Cooperative",
                "Year",
                "Status",
                "Assets",
                "GLP",
                "PAR30",
                "ROA",
                "CAR",
            ];
            let x_positions = [20.0, 90.0, 110.0, 140.0, 170.0, 200.0, 230.0, 260.0];

            for (i, h) in headers.iter().enumerate() {
                current_layer.use_text(*h, 10.0, Mm(x_positions[i]), Mm(y), &font_bold);
            }
            y -= 6.0;

            let mut check_page =
                |doc: &PdfDocumentReference, y: &mut f32, current_layer: &mut PdfLayerReference| {
                    if *y < 20.0 {
                        let (new_page, new_layer) = doc.add_page(Mm(297.0), Mm(210.0), "Layer 1");
                        page1 = new_page;
                        layer1 = new_layer;
                        *current_layer = doc.get_page(page1).get_layer(layer1);
                        *y = 190.0;
                    }
                };

            for row in &rows {
                check_page(&doc, &mut y, &mut current_layer);

                let name = if row.0.len() > 30 {
                    format!("{}...", &row.0[0..27])
                } else {
                    row.0.clone()
                };

                current_layer.use_text(name, 9.0, Mm(x_positions[0]), Mm(y), &font);
                current_layer.use_text(row.2.to_string(), 9.0, Mm(x_positions[1]), Mm(y), &font);
                current_layer.use_text(row.3.clone(), 9.0, Mm(x_positions[2]), Mm(y), &font);
                current_layer.use_text(
                    format!("{:.1}M", row.4 / 1_000_000.0),
                    9.0,
                    Mm(x_positions[3]),
                    Mm(y),
                    &font,
                );
                current_layer.use_text(
                    format!("{:.1}M", row.5 / 1_000_000.0),
                    9.0,
                    Mm(x_positions[4]),
                    Mm(y),
                    &font,
                );
                current_layer.use_text(
                    format!("{:.1}%", row.6),
                    9.0,
                    Mm(x_positions[5]),
                    Mm(y),
                    &font,
                );
                current_layer.use_text(
                    format!("{:.1}%", row.7),
                    9.0,
                    Mm(x_positions[6]),
                    Mm(y),
                    &font,
                );
                current_layer.use_text(
                    format!("{:.1}%", row.8),
                    9.0,
                    Mm(x_positions[7]),
                    Mm(y),
                    &font,
                );

                y -= 5.0;
            }

            let bytes = doc
                .save_to_bytes()
                .map_err(|e| AppError::InternalServerError(e.to_string()))?;
            let filename = format!("{tier}-submissions.pdf");
            Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, "application/pdf")
                .header(
                    header::CONTENT_DISPOSITION,
                    format!("attachment; filename=\"{filename}\""),
                )
                .body(Body::from(bytes))
                .map_err(|e| AppError::InternalServerError(e.to_string()))?
        }
        _ => unreachable!(),
    };

    Ok(response)
}

fn format_f64(v: f64) -> String {
    if v == 0.0 {
        String::new()
    } else {
        format!("{:.2}", v)
    }
}

// ── Monthly trend analytics endpoint ─────────────────────────────────────────

#[derive(Debug, Deserialize, IntoParams, utoipa::ToSchema)]
pub struct MonthlyTrendParams {
    pub reporting_year: Option<i32>,
    pub cooperative_id: Option<Uuid>,
    pub region: Option<String>,
    pub sector: Option<String>,
    pub federation_id: Option<Uuid>,
    pub apex_id: Option<Uuid>,
}

#[derive(Debug, Deserialize, IntoParams, utoipa::ToSchema)]
pub struct AnalyticsFilterParams {
    pub cooperative_id: Option<Uuid>,
    pub region: Option<String>,
    pub sector: Option<String>,
    pub federation_id: Option<Uuid>,
    pub apex_id: Option<Uuid>,
}

const MONTH_LABELS: [&str; 12] = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const SAVINGS_ACCOUNT_CODES: [i32; 4] = [2100, 2101, 2102, 2103];
const LOANS_ACCOUNT_CODES: [i32; 6] = [1200, 1201, 1202, 1203, 1204, 1205];
const TOTAL_ASSETS_ACCOUNT_CODES: [i32; 1] = [1999];

#[utoipa::path(
    get,
    path = "/api/v1/analytics/monthly-trend",
    params(
        ("reporting_year" = Option<i32>, Query, description = "Reporting year, defaults to current year"),
        ("cooperative_id" = Option<Uuid>, Query, description = "Filter to a single cooperative"),
    ),
    responses(
        (status = 200, description = "Monthly trend data", body = MonthlyTrendResponse),
        (status = 403, description = "Forbidden")
    ),
    tag = "Analytics"
)]
pub async fn get_monthly_trend(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<MonthlyTrendParams>,
) -> AppResult<impl IntoResponse> {
    let year = params
        .reporting_year
        .unwrap_or_else(|| chrono::Utc::now().year());

    let caller_coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let coop_ids = filter_cooperatives(
        &state,
        caller_coop_ids,
        params.cooperative_id,
        params.region,
        params.sector,
        params.federation_id,
        params.apex_id,
    )
    .await?;

    let submissions = state
        .submission_repo
        .find_by_cooperative_ids(coop_ids.clone())
        .await?;

    let year_filtered: Vec<_> = submissions
        .iter()
        .filter(|s| {
            s.reporting_year == year
                && (s.status == crate::entities::enums::SubmissionStatus::Approved
                    || s.status == crate::entities::enums::SubmissionStatus::Submitted)
        })
        .collect();

    let submission_ids: Vec<Uuid> = year_filtered.iter().map(|s| s.id).collect();
    let financial_statements = state
        .financial_statement_repo
        .find_by_submission_ids(submission_ids)
        .await?;

    let fs_ids: Vec<Uuid> = financial_statements.iter().map(|fs| fs.id).collect();
    let line_items = state
        .line_item_repo
        .find_by_financial_statement_ids(fs_ids)
        .await?;

    let mut months: Vec<MonthlyTrendPoint> = (1..=12)
        .map(|m| MonthlyTrendPoint {
            month: m,
            month_label: MONTH_LABELS[(m - 1) as usize].to_string(),
            savings: 0.0,
            loans: 0.0,
            assets: 0.0,
        })
        .collect();

    let has_monthly_breakdown = line_items.iter().any(|item| item.month > 0);

    for item in &line_items {
        if item.month == 0 && has_monthly_breakdown {
            continue;
        }

        let month_idx = if item.month == 0 {
            11 // Default to December for annual figures
        } else {
            (item.month - 1) as usize
        };

        if month_idx >= 12 {
            continue;
        }
        if let Some(code) = item.account_code {
            if let Some(val) = item.value.and_then(|d| d.to_f64()) {
                if SAVINGS_ACCOUNT_CODES.contains(&code) {
                    months[month_idx].savings += val;
                } else if LOANS_ACCOUNT_CODES.contains(&code) {
                    months[month_idx].loans += val;
                } else if TOTAL_ASSETS_ACCOUNT_CODES.contains(&code) {
                    months[month_idx].assets += val;
                }
            }
        }
    }

    tracing::info!(
        year,
        cooperative_count = coop_ids.len(),
        submission_count = year_filtered.len(),
        line_item_count = line_items.len(),
        "Monthly trend computed"
    );

    Ok((StatusCode::OK, Json(MonthlyTrendResponse { year, months })))
}

#[utoipa::path(
    get,
    path = "/api/v1/analytics/submission-activity",
    params(("reporting_year" = Option<i32>, Query, description = "Reporting year, defaults to current year")),
    responses(
        (status = 200, description = "Submission activity by month", body = SubmissionActivityResponse),
        (status = 403, description = "Forbidden")
    ),
    tag = "Analytics"
)]
pub async fn get_submission_activity(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<MonthlyTrendParams>,
) -> AppResult<impl IntoResponse> {
    let year = params
        .reporting_year
        .unwrap_or_else(|| chrono::Utc::now().year());
    let cooperative_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;
    let submissions = state
        .submission_repo
        .find_by_cooperative_ids(cooperative_ids)
        .await?;
    let mut months: Vec<SubmissionActivityPoint> = (1..=12)
        .map(|month| SubmissionActivityPoint {
            month,
            month_label: MONTH_LABELS[(month - 1) as usize].to_string(),
            submitted: 0,
            approved: 0,
            rejected: 0,
            in_review: 0,
        })
        .collect();

    for submission in submissions
        .iter()
        .filter(|submission| submission.reporting_year == year)
    {
        let activity_at = submission.submitted_at.unwrap_or(submission.created_at);
        let month_index = activity_at.month0() as usize;
        let point = &mut months[month_index];
        point.submitted += 1;
        match submission.status {
            crate::entities::enums::SubmissionStatus::Approved => point.approved += 1,
            crate::entities::enums::SubmissionStatus::Rejected => point.rejected += 1,
            crate::entities::enums::SubmissionStatus::Draft => {}
            _ => point.in_review += 1,
        }
    }

    Ok((
        StatusCode::OK,
        Json(SubmissionActivityResponse { year, months }),
    ))
}

// ── Region compliance analytics endpoint ────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/v1/analytics/region-compliance",
    params(
        AnalyticsFilterParams
    ),
    responses(
        (status = 200, description = "Region compliance data", body = RegionComplianceResponse),
        (status = 403, description = "Forbidden")
    ),
    tag = "Analytics"
)]
pub async fn get_region_compliance(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<AnalyticsFilterParams>,
) -> AppResult<impl IntoResponse> {
    let caller_coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let coop_ids = filter_cooperatives(
        &state,
        caller_coop_ids,
        params.cooperative_id,
        params.region,
        params.sector,
        params.federation_id,
        params.apex_id,
    )
    .await?;

    let cooperatives = state.cooperative_repo.find_by_ids(coop_ids.clone()).await?;

    let mut region_map: std::collections::HashMap<String, (i64, i64)> =
        std::collections::HashMap::new();

    for coop in &cooperatives {
        let region = coop
            .region
            .as_ref()
            .map(|r| r.as_str().to_string())
            .unwrap_or_else(|| "Unknown".to_string());
        let entry = region_map.entry(region).or_insert((0, 0));
        entry.0 += 1;
    }

    let submissions = state
        .submission_repo
        .find_by_cooperative_ids(coop_ids.clone())
        .await?;

    let mut region_approved: std::collections::HashMap<String, i64> =
        std::collections::HashMap::new();
    for sub in &submissions {
        if let Some(coop) = cooperatives.iter().find(|c| c.id == sub.cooperative_id) {
            let region = coop
                .region
                .as_ref()
                .map(|r| r.as_str().to_string())
                .unwrap_or_else(|| "Unknown".to_string());
            if sub.status == crate::entities::enums::SubmissionStatus::Approved
                || sub.status == crate::entities::enums::SubmissionStatus::Submitted
            {
                *region_approved.entry(region).or_insert(0) += 1;
            }
        }
    }

    let mut regions: Vec<RegionCompliancePoint> = region_map
        .into_iter()
        .map(|(name, (total, _))| {
            let approved = region_approved.get(&name).copied().unwrap_or(0);
            let score = if total > 0 {
                (approved as f64 / total as f64) * 100.0
            } else {
                0.0
            };
            RegionCompliancePoint {
                name,
                score: (score * 10.0).round() / 10.0,
                coops: total,
            }
        })
        .collect();
    regions.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok((StatusCode::OK, Json(RegionComplianceResponse { regions })))
}

// ── Sector breakdown analytics endpoint ─────────────────────────────────────

#[utoipa::path(
    get,
    path = "/api/v1/analytics/sector-breakdown",
    params(
        AnalyticsFilterParams
    ),
    responses(
        (status = 200, description = "Sector breakdown data", body = SectorBreakdownResponse),
        (status = 403, description = "Forbidden")
    ),
    tag = "Analytics"
)]
pub async fn get_sector_breakdown(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<AnalyticsFilterParams>,
) -> AppResult<impl IntoResponse> {
    let caller_coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let coop_ids = filter_cooperatives(
        &state,
        caller_coop_ids,
        params.cooperative_id,
        params.region,
        params.sector,
        params.federation_id,
        params.apex_id,
    )
    .await?;

    let cooperatives = state.cooperative_repo.find_by_ids(coop_ids).await?;

    let mut sector_map: std::collections::HashMap<String, i64> = std::collections::HashMap::new();

    for coop in &cooperatives {
        let sector = coop.sector.clone().unwrap_or_else(|| "Other".to_string());
        *sector_map.entry(sector).or_insert(0) += 1;
    }

    let mut sectors: Vec<SectorBreakdownPoint> = sector_map
        .into_iter()
        .map(|(name, count)| SectorBreakdownPoint {
            name,
            value: count,
            count,
        })
        .collect();
    sectors.sort_by_key(|s: &SectorBreakdownPoint| std::cmp::Reverse(s.value));

    Ok((StatusCode::OK, Json(SectorBreakdownResponse { sectors })))
}

/// GET /api/v1/cooperative/chart-of-accounts
/// Returns the full seeded Chart of Accounts — used to populate account code dropdowns
/// in the extraction editor. No scope restriction (reference data).
#[utoipa::path(
    get,
    path = "/api/v1/cooperative/chart-of-accounts",
    responses(
        (status = 200, description = "Full chart of accounts sorted by display_order",
         body = Vec<ChartOfAccountResponse>)
    ),
    tag = "Cooperative"
)]
pub async fn list_chart_of_accounts(State(state): State<AppState>) -> AppResult<impl IntoResponse> {
    let coa = state.coa_repo.find_all().await?;
    let mut resp: Vec<ChartOfAccountResponse> =
        coa.into_iter().map(ChartOfAccountResponse::from).collect();
    resp.sort_by_key(|c| c.display_order);
    Ok((StatusCode::OK, Json(resp)))
}
