use axum::extract::{Extension, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;

use crate::api::dto::national_overview::{
    CoopKpiRow, CoopNfSummary, KpiStatusCount, NationalOverviewResponse, NfPortfolioSummary,
    TrafficLightDistribution,
};
use crate::api::handlers::cooperative::resolve_caller_cooperative_ids;
use crate::auth::claims::Claims;
use crate::error::AppResult;
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
    ).await?;

    // Batch 1: fetch all cooperatives
    let cooperatives = state.cooperative_repo.find_by_ids(filtered_coop_ids.clone()).await?;

    // Batch 2: retain the latest approved financial statement per cooperative.
    // Draft and rejected submissions must not affect supervisory analytics.
    let mut fs_map: HashMap<uuid::Uuid, (uuid::Uuid, uuid::Uuid)> = HashMap::new();
    let approved_submissions: Vec<_> = state
        .submission_repo
        .find_by_cooperative_ids(filtered_coop_ids)
        .await?
        .into_iter()
        .filter(|submission| {
            let is_approved = submission.status == crate::entities::enums::SubmissionStatus::Approved;
            let matches_year = params.reporting_year
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
            fs_map.entry(submission.cooperative_id).or_insert((statement.id, submission.id));
        }
    }

    // Batch 3: fetch line items for all financial statements
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

    // Compute KPIs per cooperative
    let ratio_names = [
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

    let mut status_counts: HashMap<String, KpiStatusCount> = HashMap::new();
    for name in &ratio_names {
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

    let mut coop_rows: Vec<CoopKpiRow> = Vec::new();
    let mut nf_rows: Vec<CoopNfSummary> = Vec::new();

    for coop in &cooperatives {
        let fs_id = fs_map.get(&coop.id);
        let items = fs_id
            .and_then(|(financial_statement_id, _)| items_by_fs.get(financial_statement_id))
            .map(|v| v.as_slice())
            .unwrap_or(&[]);

        let kpis = KpiEngine::compute(items);
        let non_financial = if let Some((_, submission_id)) = fs_id {
            let statistics =
                NfIndicatorEngine::compute_for_submission(&state.db, coop.id, Some(*submission_id))
                    .await?;
            CoopNfSummary {
                has_data: statistics.membership.total > 0
                    || statistics.savings.total_accounts > 0
                    || statistics.loans.total_loans > 0
                    || statistics.fixed_deposits.total_fds > 0
                    || statistics.farm_coop.total_coops > 0,
                total_members: statistics.membership.total,
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
        if non_financial.has_data {
            nf_rows.push(non_financial.clone());
        }
        let mut kpi_map = HashMap::new();
        for name in &ratio_names {
            if let Some(kpi) = kpis.get_by_name(name) {
                kpi_map.insert(name.to_string(), kpi.clone());
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

        coop_rows.push(CoopKpiRow {
            cooperative_id: coop.id,
            submission_id: fs_id.map(|(_, submission_id)| *submission_id),
            name: coop.display_name.clone(),
            region: coop.region.as_ref().map(|r| r.as_str().to_string()),
            sector: coop.sector.clone(),
            institution_type: coop
                .institution_type
                .as_ref()
                .map(|t| t.as_str().to_string()),
            has_data: !items.is_empty(),
            non_financial,
            kpis: kpi_map,
        });
    }

    let total = cooperatives.len() as u64;

    let mut distributions = HashMap::new();
    for name in &ratio_names {
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

    Ok((
        StatusCode::OK,
        Json(NationalOverviewResponse {
            total_cooperatives: total,
            cooperatives_with_data: coop_rows.iter().filter(|r| r.has_data).count() as u64,
            non_financial_summary,
            distributions,
            cooperatives: coop_rows,
        }),
    ))
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
