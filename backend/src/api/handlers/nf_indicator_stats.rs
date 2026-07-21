use axum::extract::{Extension, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use std::sync::Arc;
use std::{collections::BTreeMap, collections::HashSet};
use chrono::Datelike;

use crate::api::dto::non_financial::{NfStatisticsResponse, NfTrendPoint, NfTrendResponse};
use crate::auth::claims::Claims;
use crate::error::AppResult;
use crate::services::nf_indicator_engine::NfIndicatorEngine;
use crate::AppState;

#[derive(Debug, serde::Deserialize, utoipa::IntoParams)]
pub struct NfTrendQueryParams {
    pub reporting_year: Option<i32>,
    pub cooperative_id: Option<uuid::Uuid>,
    pub region: Option<String>,
    pub sector: Option<String>,
    pub federation_id: Option<uuid::Uuid>,
    pub apex_id: Option<uuid::Uuid>,
}

#[derive(Debug, serde::Deserialize, utoipa::IntoParams)]
pub struct NfStatsQueryParams {
    pub reporting_year: Option<i32>,
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/nf-statistics",
    params(NfStatsQueryParams),
    responses(
        (status = 200, description = "NF statistics for the caller's cooperative", body = NfStatisticsResponse),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Cooperative not found")
    ),
    tag = "Non-Financial Statistics"
)]
pub async fn get_nf_statistics(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<NfStatsQueryParams>,
) -> AppResult<impl IntoResponse> {
    let coop =
        crate::api::handlers::cooperative::resolve_caller_cooperative(&state, &claims).await?;
    let stats = NfIndicatorEngine::compute(&state.db, coop.id, params.reporting_year).await?;
    Ok((StatusCode::OK, Json(NfStatisticsResponse::from(stats))))
}

#[utoipa::path(
    get,
    path = "/api/v1/analytics/nf-trend",
    params(NfTrendQueryParams),
    responses(
        (status = 200, description = "Submission-period non-financial trend", body = NfTrendResponse),
        (status = 403, description = "Forbidden")
    ),
    tag = "Analytics"
)]
pub async fn get_nf_trend(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<NfTrendQueryParams>,
) -> AppResult<impl IntoResponse> {
    let caller_coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let cooperative_ids = crate::api::handlers::financial_statement::filter_cooperatives(
        &state,
        caller_coop_ids,
        params.cooperative_id,
        params.region,
        params.sector,
        params.federation_id,
        params.apex_id,
    ).await?;

    let submissions = state
        .submission_repo
        .find_by_cooperative_ids(cooperative_ids)
        .await?;
    let mut grouped: BTreeMap<i32, Vec<_>> = BTreeMap::new();
    for submission in submissions.into_iter().filter(|submission| {
        submission.status == crate::entities::enums::SubmissionStatus::Approved
    }) {
        if params
            .reporting_year
            .map_or(true, |reporting_year| submission.reporting_year == reporting_year)
        {
            grouped
                .entry(submission.reporting_year)
                .or_default()
                .push(submission);
        }
    }

    let mut points = Vec::with_capacity(grouped.len());
    for (reporting_year, submissions) in grouped {
        let mut cooperative_ids = HashSet::new();
        let mut total_members = 0;
        let mut youth_members = 0;
        let mut women_members = 0;
        let mut active_members_pct = Vec::new();
        let mut savings_penetration_pct = Vec::new();
        let mut credit_penetration_pct = Vec::new();
        let mut fd_penetration_pct = Vec::new();
        let mut on_time_repayment_pct = Vec::new();

        for submission in submissions {
            cooperative_ids.insert(submission.cooperative_id);
            let stats = NfIndicatorEngine::compute_for_submission(
                &state.db,
                submission.cooperative_id,
                Some(submission.id),
            )
            .await?;
            total_members += stats.membership.total;
            youth_members += stats.membership.under_18 + stats.membership.age_18_35;
            women_members += stats.membership.female;

            if stats.membership.total > 0 {
                active_members_pct.push(stats.membership.active_pct);
            }
            if stats.savings.total_accounts > 0 {
                savings_penetration_pct.push(stats.savings.savings_penetration_pct);
            }
            if stats.loans.total_loans > 0 {
                credit_penetration_pct.push(stats.loans.credit_penetration_pct);
                on_time_repayment_pct.push(stats.loans.on_time_repayment_pct);
            }
            if stats.fixed_deposits.total_fds > 0 {
                fd_penetration_pct.push(stats.fixed_deposits.fd_penetration_pct);
            }
        }

        points.push(NfTrendPoint {
            reporting_year,
            cooperative_count: cooperative_ids.len() as u64,
            total_members,
            youth_members,
            women_members,
            active_members_pct: average(&active_members_pct),
            savings_penetration_pct: average(&savings_penetration_pct),
            credit_penetration_pct: average(&credit_penetration_pct),
            fd_penetration_pct: average(&fd_penetration_pct),
            on_time_repayment_pct: average(&on_time_repayment_pct),
        });
    }

    Ok((StatusCode::OK, Json(NfTrendResponse { points })))
}

#[derive(Debug, serde::Deserialize, utoipa::IntoParams)]
pub struct ConsolidatedNfStatsQueryParams {
    pub reporting_year: Option<i32>,
    pub federation_id: Option<String>,
    pub apex_id: Option<String>,
    pub cooperative_id: Option<String>,
    pub region: Option<String>,
    pub sector: Option<String>,
}

#[utoipa::path(
    get,
    path = "/api/v1/analytics/consolidated-nf-statistics",
    params(ConsolidatedNfStatsQueryParams),
    responses(
        (status = 200, description = "Consolidated non-financial statistics", body = NfStatisticsResponse),
        (status = 403, description = "Forbidden")
    ),
    tag = "Analytics"
)]
pub async fn get_consolidated_nf_statistics(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<ConsolidatedNfStatsQueryParams>,
) -> AppResult<impl IntoResponse> {
    let year = params.reporting_year.unwrap_or_else(|| chrono::Utc::now().year());

    let caller_coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;

    let filter_coop_id = if let Some(ref cid_str) = params.cooperative_id {
        if cid_str != "all" {
            Some(uuid::Uuid::parse_str(cid_str).unwrap_or_default())
        } else {
            None
        }
    } else {
        None
    };

    let filter_fed_id = if let Some(ref fid_str) = params.federation_id {
        if fid_str != "all" {
            Some(uuid::Uuid::parse_str(fid_str).unwrap_or_default())
        } else {
            None
        }
    } else {
        None
    };

    let filter_apex_id = if let Some(ref aid_str) = params.apex_id {
        if aid_str != "all" {
            Some(uuid::Uuid::parse_str(aid_str).unwrap_or_default())
        } else {
            None
        }
    } else {
        None
    };

    let coop_ids = crate::api::handlers::financial_statement::filter_cooperatives(
        &state,
        caller_coop_ids,
        filter_coop_id,
        params.region.clone(),
        params.sector.clone(),
        filter_fed_id,
        filter_apex_id,
    ).await?;

    let submissions = state
        .submission_repo
        .find_by_cooperative_ids(coop_ids)
        .await?;

    let year_filtered: Vec<_> = submissions
        .into_iter()
        .filter(|s| {
            s.reporting_year == year
                && s.status == crate::entities::enums::SubmissionStatus::Approved
        })
        .collect();

    let mut consolidated_stats = crate::services::nf_indicator_engine::NfStatisticsResponse::default();

    let mut coop_count = 0;
    let mut total_active_pct = 0.0;
    let mut total_dormancy_pct = 0.0;
    let mut total_agm_pct = 0.0;
    let mut total_savings_pen_pct = 0.0;
    let mut total_credit_pen_pct = 0.0;
    let mut total_on_time_pct = 0.0;
    let mut total_arrears_pct = 0.0;
    let mut total_fd_pen_pct = 0.0;
    let mut total_early_wd_pct = 0.0;

    for submission in year_filtered {
        if let Ok(stats) = NfIndicatorEngine::compute_for_submission(
            &state.db,
            submission.cooperative_id,
            Some(submission.id),
        ).await {
            coop_count += 1;
            
            // Sum up totals
            consolidated_stats.membership.total += stats.membership.total;
            consolidated_stats.membership.active += stats.membership.active;
            consolidated_stats.membership.dormant += stats.membership.dormant;
            consolidated_stats.membership.exited += stats.membership.exited;
            consolidated_stats.membership.male += stats.membership.male;
            consolidated_stats.membership.female += stats.membership.female;
            consolidated_stats.membership.other += stats.membership.other;
            consolidated_stats.membership.under_18 += stats.membership.under_18;
            consolidated_stats.membership.age_18_35 += stats.membership.age_18_35;
            consolidated_stats.membership.age_36_50 += stats.membership.age_36_50;
            consolidated_stats.membership.over_50 += stats.membership.over_50;
            consolidated_stats.membership.urban += stats.membership.urban;
            consolidated_stats.membership.rural += stats.membership.rural;
            consolidated_stats.membership.agm_attendance += stats.membership.agm_attendance;
            consolidated_stats.membership.leadership_count += stats.membership.leadership_count;
            consolidated_stats.membership.voting_count += stats.membership.voting_count;
            
            consolidated_stats.savings.total_accounts += stats.savings.total_accounts;
            consolidated_stats.savings.active_accounts += stats.savings.active_accounts;
            consolidated_stats.savings.dormant_accounts += stats.savings.dormant_accounts;
            consolidated_stats.savings.zero_balance_count += stats.savings.zero_balance_count;
            consolidated_stats.savings.increasing_trend += stats.savings.increasing_trend;
            consolidated_stats.savings.stable_trend += stats.savings.stable_trend;
            consolidated_stats.savings.declining_trend += stats.savings.declining_trend;
            consolidated_stats.savings.high_withdrawal_count += stats.savings.high_withdrawal_count;
            consolidated_stats.savings.emergency_withdrawal_count += stats.savings.emergency_withdrawal_count;
            consolidated_stats.savings.total_balance += stats.savings.total_balance;
            
            consolidated_stats.loans.total_loans += stats.loans.total_loans;
            consolidated_stats.loans.active_loans += stats.loans.active_loans;
            consolidated_stats.loans.performing += stats.loans.performing;
            consolidated_stats.loans.arrears += stats.loans.arrears;
            consolidated_stats.loans.restructured += stats.loans.restructured;
            consolidated_stats.loans.written_off += stats.loans.written_off;
            consolidated_stats.loans.members_with_loans += stats.loans.members_with_loans;
            consolidated_stats.loans.youth_borrowers += stats.loans.youth_borrowers;
            consolidated_stats.loans.women_borrowers += stats.loans.women_borrowers;
            consolidated_stats.loans.rural_borrowers += stats.loans.rural_borrowers;
            consolidated_stats.loans.multiple_loan_count += stats.loans.multiple_loan_count;
            consolidated_stats.loans.large_borrower_count += stats.loans.large_borrower_count;
            consolidated_stats.loans.total_balance += stats.loans.total_balance;
            consolidated_stats.loans.total_loan_amount += stats.loans.total_loan_amount;
            
            consolidated_stats.fixed_deposits.total_fds += stats.fixed_deposits.total_fds;
            consolidated_stats.fixed_deposits.active_fds += stats.fixed_deposits.active_fds;
            consolidated_stats.fixed_deposits.matured_fds += stats.fixed_deposits.matured_fds;
            consolidated_stats.fixed_deposits.withdrawn_fds += stats.fixed_deposits.withdrawn_fds;
            consolidated_stats.fixed_deposits.rolled_over_fds += stats.fixed_deposits.rolled_over_fds;
            consolidated_stats.fixed_deposits.members_with_fds += stats.fixed_deposits.members_with_fds;
            consolidated_stats.fixed_deposits.early_withdrawal_count += stats.fixed_deposits.early_withdrawal_count;
            consolidated_stats.fixed_deposits.single_depositor_count += stats.fixed_deposits.single_depositor_count;
            consolidated_stats.fixed_deposits.total_balance += stats.fixed_deposits.total_balance;
            
            consolidated_stats.farm_coop.total_coops += stats.farm_coop.total_coops;
            consolidated_stats.farm_coop.active_producers += stats.farm_coop.active_producers;
            consolidated_stats.farm_coop.using_planning += stats.farm_coop.using_planning;
            consolidated_stats.farm_coop.using_shared_inputs += stats.farm_coop.using_shared_inputs;
            consolidated_stats.farm_coop.with_offtake_agreement += stats.farm_coop.with_offtake_agreement;
            consolidated_stats.farm_coop.with_storage += stats.farm_coop.with_storage;
            consolidated_stats.farm_coop.with_processing += stats.farm_coop.with_processing;
            consolidated_stats.farm_coop.with_irrigation += stats.farm_coop.with_irrigation;
            consolidated_stats.farm_coop.with_climate_mitigation += stats.farm_coop.with_climate_mitigation;

            // Recompute percentages for membership
            let m = &mut consolidated_stats.membership;
            m.active_pct = if m.total > 0 { (m.active as f64 / m.total as f64) * 100.0 } else { 0.0 };
            m.dormancy_pct = if m.total > 0 { (m.dormant as f64 / m.total as f64) * 100.0 } else { 0.0 };
            m.exit_pct = if m.total > 0 { (m.exited as f64 / m.total as f64) * 100.0 } else { 0.0 };
            m.male_pct = if m.total > 0 { (m.male as f64 / m.total as f64) * 100.0 } else { 0.0 };
            m.female_pct = if m.total > 0 { (m.female as f64 / m.total as f64) * 100.0 } else { 0.0 };
            m.other_pct = if m.total > 0 { (m.other as f64 / m.total as f64) * 100.0 } else { 0.0 };
            m.youth_pct = if m.total > 0 { ((m.under_18 + m.age_18_35) as f64 / m.total as f64) * 100.0 } else { 0.0 };
            m.adult_pct = if m.total > 0 { ((m.age_36_50 + m.over_50) as f64 / m.total as f64) * 100.0 } else { 0.0 };
            m.urban_pct = if m.total > 0 { (m.urban as f64 / m.total as f64) * 100.0 } else { 0.0 };
            m.rural_pct = if m.total > 0 { (m.rural as f64 / m.total as f64) * 100.0 } else { 0.0 };
            m.agm_participation_pct = if m.total > 0 { (m.agm_attendance as f64 / m.total as f64) * 100.0 } else { 0.0 };

            // Sum up other percentages to average later
            total_agm_pct += stats.membership.agm_participation_pct;
            
            total_savings_pen_pct += stats.savings.savings_penetration_pct;
            total_credit_pen_pct += stats.loans.credit_penetration_pct;
            total_on_time_pct += stats.loans.on_time_repayment_pct;
            total_arrears_pct += stats.loans.arrears_rate_pct;
            
            total_fd_pen_pct += stats.fixed_deposits.fd_penetration_pct;
            total_early_wd_pct += stats.fixed_deposits.early_withdrawal_pct;
        }
    }

    if coop_count > 0 {
        let f_count = coop_count as f64;
        
        consolidated_stats.savings.savings_penetration_pct = total_savings_pen_pct / f_count;
        
        consolidated_stats.loans.credit_penetration_pct = total_credit_pen_pct / f_count;
        consolidated_stats.loans.on_time_repayment_pct = total_on_time_pct / f_count;
        consolidated_stats.loans.arrears_rate_pct = total_arrears_pct / f_count;
        
        consolidated_stats.fixed_deposits.fd_penetration_pct = total_fd_pen_pct / f_count;
        consolidated_stats.fixed_deposits.early_withdrawal_pct = total_early_wd_pct / f_count;
    }
    
    // Compute aggregate averages
    if consolidated_stats.savings.total_accounts > 0 {
        consolidated_stats.savings.average_balance = consolidated_stats.savings.total_balance / consolidated_stats.savings.total_accounts as f64;
    }
    if consolidated_stats.loans.active_loans > 0 {
        consolidated_stats.loans.average_loan_size = consolidated_stats.loans.total_balance / consolidated_stats.loans.active_loans as f64;
    }
    if consolidated_stats.fixed_deposits.total_fds > 0 {
        consolidated_stats.fixed_deposits.average_balance = consolidated_stats.fixed_deposits.total_balance / consolidated_stats.fixed_deposits.total_fds as f64;
    }

    let response: crate::api::dto::non_financial::NfStatisticsResponse = consolidated_stats.into();
    Ok((StatusCode::OK, Json(response)))
}

fn average(values: &[f64]) -> f64 {
    if values.is_empty() {
        0.0
    } else {
        values.iter().sum::<f64>() / values.len() as f64
    }
}
