use axum::extract::{Extension, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use chrono::Datelike;
use rust_decimal::prelude::ToPrimitive;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

use crate::api::dto::national_overview::{
    BenchmarkInsufficientData, BenchmarkParams, BenchmarkResponse, ComparativeStatementsParams,
    ComparativeStatementsResponse, CoopKpiRow, CoopNfSummary, CooperativeLineItem,
    CooperativeStatementGrid, KpiStatusCount, NationalOverviewResponse, NfPortfolioSummary,
    TrafficLightDistribution,
};
use crate::api::handlers::cooperative::resolve_caller_cooperative_ids;
use crate::auth::claims::Claims;
use crate::error::{AppError, AppResult};
use crate::services::kpi_engine::KpiEngine;
use crate::services::nf_indicator_engine::NfIndicatorEngine;
use crate::AppState;

#[derive(Debug, Deserialize, utoipa::IntoParams)]
pub struct NationalOverviewParams {
    /// Filter analytics to a specific reporting year (e.g. 2026).
    /// When omitted, uses the most recent approved submission per cooperative.
    pub reporting_year: Option<i32>,
    pub cooperative_id: Option<uuid::Uuid>,
    pub region: Option<String>,
    pub sector: Option<String>,
    pub federation_id: Option<uuid::Uuid>,
    pub apex_id: Option<uuid::Uuid>,
}

#[utoipa::path(
    get,
    path = "/api/v1/analytics/national-overview",
    params(NationalOverviewParams),
    responses(
        (status = 200, description = "National dashboard overview", body = NationalOverviewResponse),
        (status = 401, description = "Unauthorized")
    ),
    tag = "Analytics"
)]
pub async fn get_national_overview(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<NationalOverviewParams>,
) -> AppResult<impl IntoResponse> {
    let coop_ids = resolve_caller_cooperative_ids(&state, &claims).await?;
    let filtered_coop_ids = crate::api::handlers::financial_statement::filter_cooperatives(
        &state,
        coop_ids,
        params.cooperative_id,
        params.region,
        params.sector,
        params.federation_id,
        params.apex_id,
    )
    .await?;

    let coop_rows = compute_coop_rows(&state, filtered_coop_ids, params.reporting_year).await?;

    let total = coop_rows.len() as u64;

    // Recompute traffic-light status counts from the computed rows
    let mut status_counts: HashMap<String, KpiStatusCount> = HashMap::new();
    for name in &RATIO_NAMES {
        status_counts.insert(
            name.to_string(),
            KpiStatusCount {
                green: 0,
                amber: 0,
                red: 0,
                no_data: 0,
            },
        );
    }
    for row in &coop_rows {
        for name in &RATIO_NAMES {
            if let Some(kpi) = row.kpis.get(*name) {
                if let Some(counts) = status_counts.get_mut(*name) {
                    match kpi.status.as_deref() {
                        Some("green") => counts.green += 1,
                        Some("amber") => counts.amber += 1,
                        Some("red") => counts.red += 1,
                        _ => counts.no_data += 1,
                    }
                }
            }
        }
    }

    let mut distributions = HashMap::new();
    for name in &RATIO_NAMES {
        if let Some(counts) = status_counts.get(*name) {
            let with_data = counts.green + counts.amber + counts.red;
            distributions.insert(
                name.to_string(),
                TrafficLightDistribution {
                    green_pct: pct(counts.green, with_data),
                    amber_pct: pct(counts.amber, with_data),
                    red_pct: pct(counts.red, with_data),
                    no_data_pct: pct(counts.no_data, total),
                    green_count: counts.green,
                    amber_count: counts.amber,
                    red_count: counts.red,
                    no_data_count: counts.no_data,
                },
            );
        }
    }

    let nf_rows: Vec<CoopNfSummary> = coop_rows
        .iter()
        .filter(|r| r.non_financial.has_data)
        .map(|r| r.non_financial.clone())
        .collect();
    let nf_count = nf_rows.len() as u64;
    let non_financial_summary = NfPortfolioSummary {
        cooperatives_with_data: nf_count,
        average_active_members_pct: average(&nf_rows, |row| row.active_members_pct),
        average_savings_penetration_pct: average(&nf_rows, |row| row.savings_penetration_pct),
        average_credit_penetration_pct: average(&nf_rows, |row| row.credit_penetration_pct),
        average_fd_penetration_pct: average(&nf_rows, |row| row.fd_penetration_pct),
        average_on_time_repayment_pct: average(&nf_rows, |row| row.on_time_repayment_pct),
        average_dormancy_pct: average(&nf_rows, |row| row.dormancy_pct),
        average_agm_participation_pct: average(&nf_rows, |row| row.agm_participation_pct),
        average_arrears_rate_pct: average(&nf_rows, |row| row.arrears_rate_pct),
        average_fd_early_withdrawal_pct: average(&nf_rows, |row| row.fd_early_withdrawal_pct),
    };

    tracing::info!(
        caller = %claims.sub,
        cooperatives_in_scope = total,
        "National overview computed"
    );

    let custom_formulas = state.custom_kpi_repo.find_all().await?;
    let mut system_wide_custom_kpis = HashMap::new();
    for formula_def in &custom_formulas {
        let mut sum = 0.0;
        let mut count = 0;
        for row in &coop_rows {
            if let Some(&val) = row.custom_kpis.get(&formula_def.name) {
                sum += val;
                count += 1;
            }
        }
        if count > 0 {
            system_wide_custom_kpis.insert(formula_def.name.clone(), sum / count as f64);
        }
    }

    Ok((
        StatusCode::OK,
        Json(NationalOverviewResponse {
            total_cooperatives: total,
            cooperatives_with_data: coop_rows.iter().filter(|r| r.has_data).count() as u64,
            non_financial_summary,
            distributions,
            cooperatives: coop_rows,
            custom_kpis: system_wide_custom_kpis,
        }),
    ))
}

/// Computes a `CoopKpiRow` for every cooperative in `coop_ids`.
/// Shared by the national overview (aggregation) and the benchmark endpoint
/// (server-side averages). Rows are computed server-side and never exposed to
/// cooperative callers.
async fn compute_coop_rows(
    state: &AppState,
    coop_ids: Vec<Uuid>,
    reporting_year: Option<i32>,
) -> AppResult<Vec<CoopKpiRow>> {
    // Batch 1: fetch all cooperatives
    let cooperatives = state.cooperative_repo.find_by_ids(coop_ids.clone()).await?;

    let all_apexes = state.apex_repo.list_all().await?;
    let mut apex_map: HashMap<Uuid, String> = HashMap::new();
    for apex in all_apexes {
        apex_map.insert(apex.id, apex.display_name);
    }

    // Batch 2: retain the latest approved financial statement per cooperative.
    // Draft and rejected submissions must not affect supervisory analytics.
    let mut fs_map: HashMap<uuid::Uuid, (uuid::Uuid, uuid::Uuid)> = HashMap::new();
    let approved_submissions: Vec<_> = state
        .submission_repo
        .find_by_cooperative_ids(coop_ids)
        .await?
        .into_iter()
        .filter(|submission| {
            let is_approved = submission.status
                == crate::entities::enums::SubmissionStatus::Approved
                || submission.status == crate::entities::enums::SubmissionStatus::Submitted;
            let matches_year = reporting_year
                .map(|year| submission.reporting_year == year)
                .unwrap_or(true);
            is_approved && matches_year
        })
        .collect();
    let submission_ids: Vec<_> = approved_submissions
        .iter()
        .map(|submission| submission.id)
        .collect();
    let statements_by_submission: HashMap<_, _> = state
        .financial_statement_repo
        .find_by_submission_ids(submission_ids)
        .await?
        .into_iter()
        .map(|statement| (statement.submission_id, statement))
        .collect();
    for submission in approved_submissions {
        if let Some(statement) = statements_by_submission.get(&submission.id) {
            fs_map
                .entry(submission.cooperative_id)
                .or_insert((statement.id, submission.id));
        }
    }

    // Batch 3.5: Fetch all computed kpi records in one query
    let submission_ids_for_kpi: Vec<uuid::Uuid> = fs_map
        .values()
        .map(|(_, submission_id)| *submission_id)
        .collect();
    let all_computed_records = state
        .kpi_record_repo
        .find_by_submission_ids(submission_ids_for_kpi.clone())
        .await
        .unwrap_or_default();

    // Group records by submission_id
    let mut records_by_sub: HashMap<uuid::Uuid, Vec<crate::entities::kpi_record::Model>> =
        HashMap::new();
    for rec in all_computed_records {
        records_by_sub
            .entry(rec.submission_id)
            .or_default()
            .push(rec);
    }

    // Batch 3: fetch line items for all financial statements (needed only for fallback calculation)
    let fs_ids: Vec<_> = fs_map.values().map(|(id, _)| *id).collect();
    let all_line_items = if fs_ids.is_empty() {
        vec![]
    } else {
        state
            .line_item_repo
            .find_by_financial_statement_ids(fs_ids)
            .await
            .unwrap_or_default()
    };

    // Group line items by financial_statement_id
    let mut items_by_fs: HashMap<uuid::Uuid, Vec<_>> = HashMap::new();
    for item in all_line_items {
        items_by_fs
            .entry(item.financial_statement_id)
            .or_default()
            .push(item);
    }

    // Batch 3.6: Fetch all non-financial indicators catalog
    let catalog_items = state
        .non_financial_indicator_catalog_repo
        .find_all()
        .await
        .unwrap_or_default();
    let catalog_map: HashMap<Uuid, String> = catalog_items
        .into_iter()
        .map(|item| (item.id, item.indicator_name))
        .collect();

    // Batch 3.7: Fetch all non-financial indicator entries for these submission IDs
    let all_nf_entries = if submission_ids_for_kpi.is_empty() {
        vec![]
    } else {
        use crate::entities::non_financial_indicator_entry;
        use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
        non_financial_indicator_entry::Entity::find()
            .filter(
                non_financial_indicator_entry::Column::SubmissionId
                    .is_in(submission_ids_for_kpi.clone()),
            )
            .all(&state.db)
            .await
            .unwrap_or_default()
    };

    let mut nf_entries_by_sub: HashMap<
        uuid::Uuid,
        Vec<crate::entities::non_financial_indicator_entry::Model>,
    > = HashMap::new();
    for entry in all_nf_entries {
        nf_entries_by_sub
            .entry(entry.submission_id)
            .or_default()
            .push(entry);
    }

    let custom_formulas = state.custom_kpi_repo.find_all().await?;

    let mut coop_rows: Vec<CoopKpiRow> = Vec::new();

    let raw_account_codes = [
        1100, 1101, 1102, 1103, 1104, 1200, 1201, 1202, 1203, 1204, 1205, 1250, 1251, 1252, 1300,
        1301, 1302, 1303, 1304, 1305, 1999, 2100, 2101, 2102, 2103, 2200, 2201, 2202, 2300, 2301,
        2302, 2303, 2999, 3100, 3101, 3102, 3200, 3201, 3202, 3203, 3300, 3301, 3302, 3999, 4101,
        4102, 4201, 4999, 5101, 5102, 5201, 5202, 5203, 5204, 5301, 5999, 6999,
    ];

    for coop in &cooperatives {
        let fs_id = fs_map.get(&coop.id);
        let submission_id = fs_id.map(|(_, sub_id)| *sub_id);
        let records_opt = submission_id.and_then(|sub_id| records_by_sub.get(&sub_id));

        let (kpi_map, non_financial) = if let Some(records) = records_opt {
            let get_nf_val = |name: &str| {
                records
                    .iter()
                    .find(|r| r.kpi_name == name)
                    .map(|r| r.value)
                    .unwrap_or(0.0)
            };
            let has_data = records.iter().any(|r| r.kpi_type == "non_financial");
            let nf_summary = CoopNfSummary {
                has_data,
                total_members: get_nf_val("membership_total") as u64,
                active_members: get_nf_val("membership_active") as u64,
                active_borrowers: get_nf_val("loans_active_borrowers") as u64,
                women_borrowers: get_nf_val("loans_women_borrowers") as u64,
                youth_borrowers: get_nf_val("loans_youth_borrowers") as u64,
                rural_borrowers: get_nf_val("loans_rural_borrowers") as u64,
                active_members_pct: get_nf_val("membership_active_pct"),
                savings_penetration_pct: get_nf_val("savings_penetration_pct"),
                credit_penetration_pct: get_nf_val("loans_credit_penetration_pct"),
                fd_penetration_pct: get_nf_val("fds_fd_penetration_pct"),
                on_time_repayment_pct: get_nf_val("loans_on_time_repayment_pct"),
                dormancy_pct: get_nf_val("membership_dormancy_pct"),
                agm_participation_pct: get_nf_val("membership_agm_participation_pct"),
                arrears_rate_pct: get_nf_val("loans_arrears_rate_pct"),
                fd_early_withdrawal_pct: get_nf_val("fds_early_withdrawal_pct"),
            };

            let mut kpi_map = HashMap::new();
            for r in records {
                if r.kpi_type == "financial" {
                    kpi_map.insert(
                        r.kpi_name.clone(),
                        crate::services::kpi_engine::KpiValue {
                            name: r.kpi_name.clone(),
                            value: r.value,
                            formatted: r.formatted.clone(),
                            unit: r.unit.clone(),
                            status: r.status.clone(),
                            benchmark: crate::services::kpi_engine::KpiEngine::get_benchmark(
                                &r.kpi_name,
                            ),
                            description: r.description.clone(),
                        },
                    );
                }
            }
            (kpi_map, nf_summary)
        } else {
            // FALLBACK
            let items = fs_id
                .and_then(|(financial_statement_id, _)| items_by_fs.get(financial_statement_id))
                .map(|v| v.as_slice())
                .unwrap_or(&[]);
            let computed = KpiEngine::compute(items);
            let mut kpi_map = HashMap::new();
            for name in &RATIO_NAMES {
                if let Some(kpi) = computed.get_by_name(name) {
                    kpi_map.insert(name.to_string(), kpi.clone());
                }
            }

            let nf_summary = if let Some((_, sub_id)) = fs_id {
                let statistics =
                    NfIndicatorEngine::compute_for_submission(&state.db, coop.id, Some(*sub_id))
                        .await?;
                CoopNfSummary {
                    has_data: statistics.membership.total > 0
                        || statistics.savings.total_accounts > 0
                        || statistics.loans.total_loans > 0
                        || statistics.fixed_deposits.total_fds > 0
                        || statistics.farm_coop.total_coops > 0,
                    total_members: statistics.membership.total,
                    active_members: statistics.membership.active,
                    active_borrowers: statistics.loans.active_loans,
                    women_borrowers: statistics.loans.women_borrowers,
                    youth_borrowers: statistics.loans.youth_borrowers,
                    rural_borrowers: statistics.loans.rural_borrowers,
                    active_members_pct: statistics.membership.active_pct,
                    savings_penetration_pct: statistics.savings.savings_penetration_pct,
                    credit_penetration_pct: statistics.loans.credit_penetration_pct,
                    fd_penetration_pct: statistics.fixed_deposits.fd_penetration_pct,
                    on_time_repayment_pct: statistics.loans.on_time_repayment_pct,
                    dormancy_pct: statistics.membership.dormancy_pct,
                    agm_participation_pct: statistics.membership.agm_participation_pct,
                    arrears_rate_pct: statistics.loans.arrears_rate_pct,
                    fd_early_withdrawal_pct: statistics.fixed_deposits.early_withdrawal_pct,
                }
            } else {
                CoopNfSummary {
                    has_data: false,
                    total_members: 0,
                    active_members: 0,
                    active_borrowers: 0,
                    women_borrowers: 0,
                    youth_borrowers: 0,
                    rural_borrowers: 0,
                    active_members_pct: 0.0,
                    savings_penetration_pct: 0.0,
                    credit_penetration_pct: 0.0,
                    fd_penetration_pct: 0.0,
                    on_time_repayment_pct: 0.0,
                    dormancy_pct: 0.0,
                    agm_participation_pct: 0.0,
                    arrears_rate_pct: 0.0,
                    fd_early_withdrawal_pct: 0.0,
                }
            };
            (kpi_map, nf_summary)
        };

        let mut eval_ctx: evalexpr::HashMapContext = evalexpr::HashMapContext::new();
        use evalexpr::ContextWithMutableVariables;
        let mut set_keys = std::collections::HashSet::new();

        // Initialize all raw codes to 0.0 for compiler safety
        for code in &raw_account_codes {
            eval_ctx
                .set_value(format!("ac_{}", code), evalexpr::Value::Float(0.0))
                .unwrap();
        }

        // Expose raw account codes from line items
        if let Some((fs_id, _)) = fs_id {
            if let Some(items) = items_by_fs.get(fs_id) {
                for item in items {
                    if let Some(code) = item.account_code {
                        let val = item.value.and_then(|v| v.to_f64()).unwrap_or(0.0);
                        eval_ctx
                            .set_value(format!("ac_{}", code), evalexpr::Value::Float(val))
                            .unwrap();
                    }
                }
            }
        }

        for name in &RATIO_NAMES {
            if let Some(kpi) = kpi_map.get(*name) {
                eval_ctx
                    .set_value(name.to_string(), evalexpr::Value::Float(kpi.value))
                    .unwrap();
                set_keys.insert(name.to_string());
            } else {
                eval_ctx
                    .set_value(name.to_string(), evalexpr::Value::Float(0.0))
                    .unwrap();
            }
        }

        // Add non-financial indicator entries to eval_ctx
        if let Some(sub_id) = submission_id {
            if let Some(entries) = nf_entries_by_sub.get(&sub_id) {
                for entry in entries {
                    if let Some(name) = catalog_map.get(&entry.catalog_id) {
                        let val_f64 = if let Some(val) = entry.value_numeric {
                            val.to_f64().unwrap_or(0.0)
                        } else if let Some(val) = entry.value_boolean {
                            if val {
                                1.0
                            } else {
                                0.0
                            }
                        } else {
                            0.0
                        };
                        eval_ctx
                            .set_value(name.clone(), evalexpr::Value::Float(val_f64))
                            .unwrap();
                        set_keys.insert(name.clone());
                    }
                }
            }
        }
        // Initialize any not-yet-set catalog indicators with 0.0 to prevent evaluation errors
        for name in catalog_map.values() {
            if !set_keys.contains(name) {
                eval_ctx
                    .set_value(name.clone(), evalexpr::Value::Float(0.0))
                    .unwrap();
            }
        }

        let mut custom_kpi_map = HashMap::new();
        if !custom_formulas.is_empty() {
            for formula_def in &custom_formulas {
                match evalexpr::build_operator_tree::<evalexpr::DefaultNumericTypes>(
                    &formula_def.formula,
                ) {
                    Ok(expr) => match expr.eval_with_context(&eval_ctx) {
                        Ok(res) => {
                            let num_opt = match res {
                                evalexpr::Value::Float(f) => Some(f),
                                evalexpr::Value::Int(i) => Some(i as f64),
                                _ => None,
                            };
                            if let Some(num) = num_opt {
                                custom_kpi_map.insert(formula_def.name.clone(), num);
                            } else {
                                tracing::warn!(
                                    cooperative = %coop.display_name,
                                    kpi_name = %formula_def.name,
                                    formula = %formula_def.formula,
                                    result = ?res,
                                    "Custom KPI evaluated to non-numeric value"
                                );
                            }
                        }
                        Err(e) => {
                            tracing::error!(
                                cooperative = %coop.display_name,
                                kpi_name = %formula_def.name,
                                formula = %formula_def.formula,
                                error = %e,
                                "Failed to evaluate custom KPI formula"
                            );
                        }
                    },
                    Err(e) => {
                        tracing::error!(
                            kpi_name = %formula_def.name,
                            formula = %formula_def.formula,
                            error = %e,
                            "Failed to parse custom KPI operator tree"
                        );
                    }
                }
            }
        }

        let has_financial_data = fs_id.is_some()
            && (records_opt.is_some()
                || (fs_id.is_some()
                    && items_by_fs
                        .get(&fs_id.unwrap().0)
                        .is_some_and(|items| !items.is_empty())));

        coop_rows.push(CoopKpiRow {
            cooperative_id: coop.id,
            submission_id,
            name: coop.display_name.clone(),
            apex_id: Some(coop.apex_id),
            apex_name: apex_map.get(&coop.apex_id).cloned(),
            region: coop.region.as_ref().map(|r| r.as_str().to_string()),
            sector: coop.sector.as_ref().map(|s| s.as_str().to_string()),
            institution_type: coop
                .institution_type
                .as_ref()
                .map(|t| t.as_str().to_string()),
            has_data: has_financial_data,
            non_financial,
            kpis: kpi_map,
            custom_kpis: custom_kpi_map,
        });
    }

    Ok(coop_rows)
}

fn pct(part: u64, total: u64) -> f64 {
    if total == 0 {
        return 0.0;
    }
    (part as f64 / total as f64) * 100.0
}

fn average(rows: &[CoopNfSummary], selector: impl Fn(&CoopNfSummary) -> f64) -> f64 {
    if rows.is_empty() {
        0.0
    } else {
        rows.iter().map(selector).sum::<f64>() / rows.len() as f64
    }
}

const RATIO_NAMES: [&str; 18] = [
    "total_assets",
    "gross_loan_portfolio",
    "net_loan_portfolio",
    "total_member_deposits",
    "total_equity",
    "net_surplus",
    "par30",
    "par90",
    "npl_ratio",
    "loan_loss_coverage",
    "roa",
    "roe",
    "operating_expense_ratio",
    "capital_adequacy_ratio",
    "liquid_funds_ratio",
    "operational_self_sufficiency",
    "net_interest_margin",
    "deposits_to_loans",
];

/// KPI keys benchmarked for a cooperative against national/regional averages.
/// Mirrors the frontend `comparableKpis` list (financial + non-financial).
const BENCHMARK_KPIS: [&str; 28] = [
    "total_assets",
    "gross_loan_portfolio",
    "net_loan_portfolio",
    "total_member_deposits",
    "total_equity",
    "net_surplus",
    "capital_adequacy_ratio",
    "liquid_funds_ratio",
    "npl_ratio",
    "par30",
    "par90",
    "loan_loss_coverage",
    "roa",
    "roe",
    "operating_expense_ratio",
    "operational_self_sufficiency",
    "net_interest_margin",
    "deposits_to_loans",
    "total_members",
    "active_members_pct",
    "savings_penetration_pct",
    "credit_penetration_pct",
    "fd_penetration_pct",
    "on_time_repayment_pct",
    "dormancy_pct",
    "agm_participation_pct",
    "arrears_rate_pct",
    "fd_early_withdrawal_pct",
];

/// Minimum number of contributing cooperatives required before a regional
/// average is disclosed. Below this, the average would reveal individual data.
const MIN_CONTRIBUTORS: usize = 3;

/// Returns the benchmark comparison for the calling cooperative: its own KPI
/// row plus server-computed national and regional averages. Other cooperatives'
/// raw rows are never returned — the response type cannot contain them.
#[utoipa::path(
    get,
    path = "/api/v1/analytics/benchmark",
    params(BenchmarkParams),
    responses(
        (status = 200, description = "Benchmark comparison for the calling cooperative", body = BenchmarkResponse),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Cooperative data not found")
    ),
    tag = "Analytics"
)]
pub async fn get_benchmark(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<BenchmarkParams>,
) -> AppResult<impl IntoResponse> {
    let caller_coop_ids = resolve_caller_cooperative_ids(&state, &claims).await?;

    // Compute rows for the FULL population server-side. Only aggregates are
    // returned to the caller; individual rows never leave this function.
    let all_coops = state.cooperative_repo.list_all().await?;
    let all_coop_ids: Vec<Uuid> = all_coops.iter().map(|c| c.id).collect();
    let all_rows = compute_coop_rows(&state, all_coop_ids, params.reporting_year).await?;

    let own_row = all_rows
        .iter()
        .find(|r| caller_coop_ids.contains(&r.cooperative_id))
        .cloned()
        .ok_or_else(|| AppError::NotFound("Cooperative data not found".into()))?;

    let national_average = compute_averages(&all_rows, &BENCHMARK_KPIS);

    let (regional_average, regional_insufficient) = match own_row.region.as_deref() {
        Some(region) => scoped_average(&all_rows, |r| r.region.as_deref() == Some(region)),
        None => (None, true),
    };

    let (sector_average, sector_insufficient) = match own_row.sector.as_deref() {
        Some(sector) => scoped_average(&all_rows, |r| r.sector.as_deref() == Some(sector)),
        None => (None, true),
    };

    let (sector_regional_average, sector_regional_insufficient) =
        match (own_row.sector.as_deref(), own_row.region.as_deref()) {
            (Some(sector), Some(region)) => scoped_average(&all_rows, |r| {
                r.sector.as_deref() == Some(sector) && r.region.as_deref() == Some(region)
            }),
            _ => (None, true),
        };

    tracing::info!(
        caller = %claims.sub,
        cooperative = %own_row.cooperative_id,
        "Benchmark computed for cooperative"
    );

    Ok((
        StatusCode::OK,
        Json(BenchmarkResponse {
            reporting_year: params.reporting_year,
            cooperative: own_row,
            national_average,
            regional_average,
            sector_average,
            sector_regional_average,
            insufficient_data: BenchmarkInsufficientData {
                regional: regional_insufficient,
                sector: sector_insufficient,
                sector_regional: sector_regional_insufficient,
            },
        }),
    ))
}

/// Computes an average over rows matching `predicate`, withholding it when fewer
/// than `MIN_CONTRIBUTORS` cooperatives-with-data contribute. Shared by the
/// regional, sector and sector+regional slices to avoid duplication.
fn scoped_average(
    all_rows: &[CoopKpiRow],
    predicate: impl Fn(&CoopKpiRow) -> bool,
) -> (Option<HashMap<String, f64>>, bool) {
    let rows: Vec<CoopKpiRow> = all_rows
        .iter()
        .filter(|r| r.has_data && predicate(r))
        .cloned()
        .collect();
    if rows.len() >= MIN_CONTRIBUTORS {
        (Some(compute_averages(&rows, &BENCHMARK_KPIS)), false)
    } else {
        (None, true)
    }
}

/// Averages each KPI over the given rows (cooperatives-with-data only).
fn compute_averages(rows: &[CoopKpiRow], keys: &[&str]) -> HashMap<String, f64> {
    keys.iter()
        .map(|key| {
            let vals: Vec<f64> = rows
                .iter()
                .filter(|r| r.has_data)
                .filter_map(|r| get_kpi_value(r, key))
                .filter(|v| !v.is_nan())
                .collect();
            let avg = if vals.is_empty() {
                0.0
            } else {
                vals.iter().sum::<f64>() / vals.len() as f64
            };
            (key.to_string(), avg)
        })
        .collect()
}

/// Extracts a KPI value from a row: financial KPIs live in `row.kpis`,
/// non-financial KPIs live in `row.non_financial`.
fn get_kpi_value(row: &CoopKpiRow, key: &str) -> Option<f64> {
    if let Some(kpi) = row.kpis.get(key) {
        return Some(kpi.value);
    }
    match key {
        "total_members" => Some(row.non_financial.total_members as f64),
        "active_members_pct" => Some(row.non_financial.active_members_pct),
        "savings_penetration_pct" => Some(row.non_financial.savings_penetration_pct),
        "credit_penetration_pct" => Some(row.non_financial.credit_penetration_pct),
        "fd_penetration_pct" => Some(row.non_financial.fd_penetration_pct),
        "on_time_repayment_pct" => Some(row.non_financial.on_time_repayment_pct),
        "dormancy_pct" => Some(row.non_financial.dormancy_pct),
        "agm_participation_pct" => Some(row.non_financial.agm_participation_pct),
        "arrears_rate_pct" => Some(row.non_financial.arrears_rate_pct),
        "fd_early_withdrawal_pct" => Some(row.non_financial.fd_early_withdrawal_pct),
        _ => None,
    }
}

#[utoipa::path(
    get,
    path = "/api/v1/analytics/comparative-statements",
    params(
        ("reporting_year" = Option<i32>, Query, description = "Reporting year"),
        ("cooperative_ids" = Option<String>, Query, description = "Comma-separated cooperative UUIDs to filter")
    ),
    responses(
        (status = 200, description = "Comparative statements grid", body = ComparativeStatementsResponse),
        (status = 403, description = "Forbidden")
    ),
    tag = "Analytics"
)]
pub async fn get_comparative_statements(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<ComparativeStatementsParams>,
) -> AppResult<impl IntoResponse> {
    let year = params
        .reporting_year
        .unwrap_or_else(|| chrono::Utc::now().year());

    // 1. Resolve user cooperative scope
    let caller_coop_ids = resolve_caller_cooperative_ids(&state, &claims).await?;

    // 2. Filter cooperatives list if user explicitly requested specific ones
    let selected_coop_ids = if let Some(ref ids_str) = params.cooperative_ids {
        if ids_str.trim().is_empty() || ids_str == "all" {
            caller_coop_ids.clone()
        } else {
            ids_str
                .split(',')
                .filter_map(|s| Uuid::parse_str(s.trim()).ok())
                .filter(|id| caller_coop_ids.contains(id))
                .collect::<Vec<Uuid>>()
        }
    } else {
        caller_coop_ids.clone()
    };

    if selected_coop_ids.is_empty() {
        return Ok((
            StatusCode::OK,
            Json(ComparativeStatementsResponse {
                year,
                grids: vec![],
            }),
        ));
    }

    // 3. Fetch all cooperatives to get their names
    let cooperatives = state
        .cooperative_repo
        .find_by_ids(selected_coop_ids.clone())
        .await?;

    // 4. Fetch the submissions for the selected year and cooperatives
    let submissions = state
        .submission_repo
        .find_by_cooperative_ids(selected_coop_ids)
        .await?;

    let year_submissions: Vec<_> = submissions
        .into_iter()
        .filter(|s| {
            s.reporting_year == year
                && (s.status == crate::entities::enums::SubmissionStatus::Approved
                    || s.status == crate::entities::enums::SubmissionStatus::Submitted)
        })
        .collect();

    let submission_ids: Vec<Uuid> = year_submissions.iter().map(|s| s.id).collect();

    // 5. Fetch financial statements
    let financial_statements = state
        .financial_statement_repo
        .find_by_submission_ids(submission_ids.clone())
        .await?;

    let fs_ids: Vec<Uuid> = financial_statements.iter().map(|fs| fs.id).collect();

    // 6. Fetch all line items for these financial statements
    let line_items = if fs_ids.is_empty() {
        vec![]
    } else {
        state
            .line_item_repo
            .find_by_financial_statement_ids(fs_ids)
            .await?
    };

    // Group line items by financial_statement_id
    let mut items_by_fs: HashMap<Uuid, Vec<crate::entities::balance_sheet_line_item::Model>> =
        HashMap::new();
    for item in line_items {
        items_by_fs
            .entry(item.financial_statement_id)
            .or_default()
            .push(item);
    }

    // Map financial statement ID to cooperative ID
    let mut fs_to_coop: HashMap<Uuid, Uuid> = HashMap::new();
    for fs in &financial_statements {
        if let Some(sub) = year_submissions.iter().find(|s| s.id == fs.submission_id) {
            fs_to_coop.insert(fs.id, sub.cooperative_id);
        }
    }

    // Build the grids response
    let mut grids = vec![];

    for coop in cooperatives {
        // Find if they have a financial statement for this year
        let fs_opt = financial_statements
            .iter()
            .find(|fs| fs_to_coop.get(&fs.id) == Some(&coop.id));

        let mut grid_items = vec![];
        if let Some(fs) = fs_opt {
            if let Some(items) = items_by_fs.get(&fs.id) {
                for item in items {
                    grid_items.push(CooperativeLineItem {
                        account_code: item.account_code,
                        account_name: item.account_name.clone(),
                        value: item.value.and_then(|v| v.to_f64()).unwrap_or(0.0),
                        month: item.month as i32,
                    });
                }
            }
        }

        grids.push(CooperativeStatementGrid {
            cooperative_id: coop.id,
            cooperative_name: coop.name,
            line_items: grid_items,
        });
    }

    Ok((
        StatusCode::OK,
        Json(ComparativeStatementsResponse { year, grids }),
    ))
}
