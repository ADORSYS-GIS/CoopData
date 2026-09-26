use axum::extract::{Extension, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use chrono::Datelike;
use std::sync::Arc;
use std::{collections::BTreeMap, collections::HashSet};

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

    use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};
    let mut query = crate::entities::submission::Entity::find()
        .filter(crate::entities::submission::Column::CooperativeId.eq(coop.id))
        .filter(
            crate::entities::submission::Column::Status
                .eq(crate::entities::enums::SubmissionStatus::Approved),
        );

    if let Some(year) = params.reporting_year {
        query = query.filter(crate::entities::submission::Column::ReportingYear.eq(year));
    }

    let latest_approved = query
        .order_by_desc(crate::entities::submission::Column::ReportingYear)
        .one(&state.db)
        .await?;

    let mut stats = if let Some(ref sub) = latest_approved {
        let db_records = state.kpi_record_repo.find_by_submission(sub.id).await?;
        if !db_records.is_empty() {
            NfStatisticsResponse::from(reconstruct_nf_stats(&db_records))
        } else {
            let s =
                NfIndicatorEngine::compute_for_submission(&state.db, coop.id, Some(sub.id)).await?;
            NfStatisticsResponse::from(s)
        }
    } else {
        let s =
            NfIndicatorEngine::compute_for_submission(&state.db, coop.id, Some(uuid::Uuid::nil()))
                .await?;
        NfStatisticsResponse::from(s)
    };

    // Standardize on USD, same as every other analytics endpoint.
    if let Some(sub) = latest_approved {
        if let Some(fs) = state
            .financial_statement_repo
            .find_by_submission(sub.id)
            .await?
        {
            let rates = state.currency_service.load_rates().await?;
            let frozen_rate = crate::services::currency::frozen_rate_of(&sub);
            let to_usd = |v: f64| {
                crate::services::currency::to_usd_frozen(v, &fs.currency, frozen_rate, &rates)
            };
            stats.savings.total_balance = to_usd(stats.savings.total_balance);
            stats.savings.average_balance = to_usd(stats.savings.average_balance);
            stats.loans.total_balance = to_usd(stats.loans.total_balance);
            stats.loans.total_loan_amount = to_usd(stats.loans.total_loan_amount);
            stats.loans.average_loan_size = to_usd(stats.loans.average_loan_size);
            stats.fixed_deposits.total_balance = to_usd(stats.fixed_deposits.total_balance);
            stats.fixed_deposits.average_balance = to_usd(stats.fixed_deposits.average_balance);
        }
    }

    Ok((StatusCode::OK, Json(stats)))
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
    )
    .await?;

    let submissions = state
        .submission_repo
        .find_by_cooperative_ids(cooperative_ids)
        .await?;
    let mut grouped: BTreeMap<i32, Vec<_>> = BTreeMap::new();
    for submission in submissions.into_iter().filter(|submission| {
        submission.status == crate::entities::enums::SubmissionStatus::Approved
    }) {
        if params.reporting_year.map_or(true, |reporting_year| {
            submission.reporting_year == reporting_year
        }) {
            grouped
                .entry(submission.reporting_year)
                .or_default()
                .push(submission);
        }
    }

    let all_sub_ids: Vec<uuid::Uuid> = grouped
        .values()
        .flat_map(|subs| subs.iter().map(|s| s.id))
        .collect();
    let all_computed_records = state
        .kpi_record_repo
        .find_by_submission_ids(all_sub_ids)
        .await
        .unwrap_or_default();
    let mut records_by_sub: std::collections::HashMap<
        uuid::Uuid,
        Vec<crate::entities::kpi_record::Model>,
    > = std::collections::HashMap::new();
    for rec in all_computed_records {
        records_by_sub
            .entry(rec.submission_id)
            .or_default()
            .push(rec);
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
            let stats = if let Some(records) = records_by_sub.get(&submission.id) {
                reconstruct_nf_stats(records)
            } else {
                NfIndicatorEngine::compute_for_submission(
                    &state.db,
                    submission.cooperative_id,
                    Some(submission.id),
                )
                .await?
            };
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
    pub period_type: Option<String>,
    pub period_value: Option<String>,
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
    let year = params
        .reporting_year
        .unwrap_or_else(|| chrono::Utc::now().year());

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
    )
    .await?;

    let submissions = state
        .submission_repo
        .find_by_cooperative_ids(coop_ids)
        .await?;

    let year_filtered: Vec<_> = submissions
        .into_iter()
        .filter(|s| {
            let matches_year = s.reporting_year == year;
            let matches_pt = params
                .period_type
                .as_deref()
                .map(|pt| {
                    if pt.eq_ignore_ascii_case("all") {
                        true
                    } else {
                        let pt_str = match s.period_type {
                            crate::entities::enums::PeriodType::Yearly => "YEARLY",
                            crate::entities::enums::PeriodType::Quarterly => "QUARTERLY",
                            crate::entities::enums::PeriodType::Monthly => "MONTHLY",
                            crate::entities::enums::PeriodType::SemiAnnual => "SEMI_ANNUAL",
                        };
                        pt_str.eq_ignore_ascii_case(pt)
                    }
                })
                .unwrap_or(true);
            let matches_pv = params
                .period_value
                .as_deref()
                .map(|pv| {
                    if pv.eq_ignore_ascii_case("all") {
                        true
                    } else {
                        s.period_value.eq_ignore_ascii_case(pv)
                    }
                })
                .unwrap_or(true);
            matches_year
                && matches_pt
                && matches_pv
                && s.status == crate::entities::enums::SubmissionStatus::Approved
        })
        .collect();

    let year_filtered_ids: Vec<uuid::Uuid> = year_filtered.iter().map(|s| s.id).collect();
    let all_computed_records = state
        .kpi_record_repo
        .find_by_submission_ids(year_filtered_ids)
        .await
        .unwrap_or_default();

    let mut records_by_sub: std::collections::HashMap<
        uuid::Uuid,
        Vec<crate::entities::kpi_record::Model>,
    > = std::collections::HashMap::new();
    for rec in all_computed_records {
        records_by_sub
            .entry(rec.submission_id)
            .or_default()
            .push(rec);
    }

    let mut regular_savers_total = 0.0_f64;
    let mut consolidated_stats =
        crate::services::nf_indicator_engine::NfStatisticsResponse::default();

    // Balances live in whichever currency each cooperative's financial
    // statement reports in (savings/loans/fixed_deposit ledgers carry no
    // currency of their own — they belong to one submission, so they
    // inherit its statement's currency). Without converting to USD before
    // accumulating, a network mixing SZL- and USD-reporting cooperatives
    // would silently sum incompatible currencies into one meaningless
    // total. USD normalization matches how the Analytics dashboards are
    // standardized elsewhere (see services::currency).
    let rates = state.currency_service.load_rates().await?;
    let submission_ids_for_currency: Vec<uuid::Uuid> = year_filtered.iter().map(|s| s.id).collect();
    let currency_by_submission: std::collections::HashMap<
        uuid::Uuid,
        crate::entities::enums::Currency,
    > = state
        .financial_statement_repo
        .find_by_submission_ids(submission_ids_for_currency)
        .await
        .unwrap_or_default()
        .into_iter()
        .map(|fs| (fs.submission_id, fs.currency))
        .collect();

    let mut savings_penetration_members = 0.0_f64;
    let mut credit_penetration_members = 0.0_f64;
    let mut fd_penetration_members = 0.0_f64;
    let mut on_time_loans = 0.0_f64;
    let mut early_withdrawals = 0.0_f64;

    for submission in year_filtered {
        let stats_res = if let Some(records) = records_by_sub.get(&submission.id) {
            Ok(reconstruct_nf_stats(records))
        } else {
            NfIndicatorEngine::compute_for_submission(
                &state.db,
                submission.cooperative_id,
                Some(submission.id),
            )
            .await
        };

        if let Ok(mut stats) = stats_res {
            let submission_currency = currency_by_submission
                .get(&submission.id)
                .cloned()
                .unwrap_or_default();
            stats.savings.total_balance = crate::services::currency::to_usd_frozen(
                stats.savings.total_balance,
                &submission_currency,
                crate::services::currency::frozen_rate_of(&submission),
                &rates,
            );
            stats.loans.total_balance = crate::services::currency::to_usd_frozen(
                stats.loans.total_balance,
                &submission_currency,
                crate::services::currency::frozen_rate_of(&submission),
                &rates,
            );
            stats.loans.total_loan_amount = crate::services::currency::to_usd_frozen(
                stats.loans.total_loan_amount,
                &submission_currency,
                crate::services::currency::frozen_rate_of(&submission),
                &rates,
            );
            stats.fixed_deposits.total_balance = crate::services::currency::to_usd_frozen(
                stats.fixed_deposits.total_balance,
                &submission_currency,
                crate::services::currency::frozen_rate_of(&submission),
                &rates,
            );

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
            regular_savers_total +=
                stats.savings.regular_savers_pct / 100.0 * stats.savings.total_accounts as f64;
            consolidated_stats.savings.stable_trend += stats.savings.stable_trend;
            consolidated_stats.savings.declining_trend += stats.savings.declining_trend;
            consolidated_stats.savings.high_withdrawal_count += stats.savings.high_withdrawal_count;
            consolidated_stats.savings.emergency_withdrawal_count +=
                stats.savings.emergency_withdrawal_count;
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
            consolidated_stats.fixed_deposits.rolled_over_fds +=
                stats.fixed_deposits.rolled_over_fds;
            consolidated_stats.fixed_deposits.members_with_fds +=
                stats.fixed_deposits.members_with_fds;
            consolidated_stats.fixed_deposits.early_withdrawal_count +=
                stats.fixed_deposits.early_withdrawal_count;
            consolidated_stats.fixed_deposits.single_depositor_count +=
                stats.fixed_deposits.single_depositor_count;
            consolidated_stats.fixed_deposits.total_balance += stats.fixed_deposits.total_balance;

            consolidated_stats.farm_coop.total_coops += stats.farm_coop.total_coops;
            consolidated_stats.farm_coop.active_producers += stats.farm_coop.active_producers;
            consolidated_stats.farm_coop.using_planning += stats.farm_coop.using_planning;
            consolidated_stats.farm_coop.using_shared_inputs += stats.farm_coop.using_shared_inputs;
            consolidated_stats.farm_coop.with_offtake_agreement +=
                stats.farm_coop.with_offtake_agreement;
            consolidated_stats.farm_coop.with_storage += stats.farm_coop.with_storage;
            consolidated_stats.farm_coop.with_processing += stats.farm_coop.with_processing;
            consolidated_stats.farm_coop.with_irrigation += stats.farm_coop.with_irrigation;
            consolidated_stats.farm_coop.with_climate_mitigation +=
                stats.farm_coop.with_climate_mitigation;

            // Recompute percentages for membership
            let m = &mut consolidated_stats.membership;
            m.active_pct = if m.total > 0 {
                (m.active as f64 / m.total as f64) * 100.0
            } else {
                0.0
            };
            m.dormancy_pct = if m.total > 0 {
                (m.dormant as f64 / m.total as f64) * 100.0
            } else {
                0.0
            };
            m.exit_pct = if m.total > 0 {
                (m.exited as f64 / m.total as f64) * 100.0
            } else {
                0.0
            };
            m.male_pct = if m.total > 0 {
                (m.male as f64 / m.total as f64) * 100.0
            } else {
                0.0
            };
            m.female_pct = if m.total > 0 {
                (m.female as f64 / m.total as f64) * 100.0
            } else {
                0.0
            };
            m.other_pct = if m.total > 0 {
                (m.other as f64 / m.total as f64) * 100.0
            } else {
                0.0
            };
            m.youth_pct = if m.total > 0 {
                ((m.under_18 + m.age_18_35) as f64 / m.total as f64) * 100.0
            } else {
                0.0
            };
            m.adult_pct = if m.total > 0 {
                ((m.age_36_50 + m.over_50) as f64 / m.total as f64) * 100.0
            } else {
                0.0
            };
            m.urban_pct = if m.total > 0 {
                (m.urban as f64 / m.total as f64) * 100.0
            } else {
                0.0
            };
            m.rural_pct = if m.total > 0 {
                (m.rural as f64 / m.total as f64) * 100.0
            } else {
                0.0
            };
            m.agm_participation_pct = if m.total > 0 {
                (m.agm_attendance as f64 / m.total as f64) * 100.0
            } else {
                0.0
            };

            let members = stats.membership.total as f64;
            savings_penetration_members += stats.savings.savings_penetration_pct / 100.0 * members;
            credit_penetration_members += stats.loans.credit_penetration_pct / 100.0 * members;
            fd_penetration_members += stats.fixed_deposits.fd_penetration_pct / 100.0 * members;
            on_time_loans +=
                stats.loans.on_time_repayment_pct / 100.0 * stats.loans.active_loans as f64;
            early_withdrawals += stats.fixed_deposits.early_withdrawal_pct / 100.0
                * stats.fixed_deposits.total_fds as f64;
        }
    }

    let network_members = consolidated_stats.membership.total as f64;
    if network_members > 0.0 {
        consolidated_stats.savings.savings_penetration_pct =
            savings_penetration_members / network_members * 100.0;
        consolidated_stats.loans.credit_penetration_pct =
            credit_penetration_members / network_members * 100.0;
        consolidated_stats.fixed_deposits.fd_penetration_pct =
            fd_penetration_members / network_members * 100.0;
    }
    let network_loans = consolidated_stats.loans.active_loans as f64;
    if network_loans > 0.0 {
        consolidated_stats.loans.on_time_repayment_pct = on_time_loans / network_loans * 100.0;
        consolidated_stats.loans.arrears_rate_pct =
            consolidated_stats.loans.arrears as f64 / network_loans * 100.0;
    }
    if consolidated_stats.fixed_deposits.total_fds > 0 {
        consolidated_stats.fixed_deposits.early_withdrawal_pct =
            early_withdrawals / consolidated_stats.fixed_deposits.total_fds as f64 * 100.0;
    }

    // Recompute savings rates
    let total_accounts = consolidated_stats.savings.total_accounts as f64;
    if total_accounts > 0.0 {
        consolidated_stats.savings.active_savers_pct =
            (consolidated_stats.savings.active_accounts as f64 / total_accounts) * 100.0;
        consolidated_stats.savings.zero_balance_pct =
            (consolidated_stats.savings.zero_balance_count as f64 / total_accounts) * 100.0;
        consolidated_stats.savings.regular_savers_pct =
            (regular_savers_total / total_accounts) * 100.0;
    }

    // Recompute loans borrower percentages
    let active_loans = consolidated_stats.loans.active_loans as f64;
    if active_loans > 0.0 {
        consolidated_stats.loans.youth_borrower_pct =
            (consolidated_stats.loans.youth_borrowers as f64 / active_loans) * 100.0;
        consolidated_stats.loans.women_borrower_pct =
            (consolidated_stats.loans.women_borrowers as f64 / active_loans) * 100.0;
        consolidated_stats.loans.rural_borrower_pct =
            (consolidated_stats.loans.rural_borrowers as f64 / active_loans) * 100.0;
    }

    // Recompute fixed deposits ratios
    let matured_or_rolled = consolidated_stats.fixed_deposits.matured_fds
        + consolidated_stats.fixed_deposits.rolled_over_fds;
    if matured_or_rolled > 0 {
        consolidated_stats.fixed_deposits.rollover_rate_pct =
            (consolidated_stats.fixed_deposits.rolled_over_fds as f64 / matured_or_rolled as f64)
                * 100.0;
    }
    if consolidated_stats.fixed_deposits.total_fds > 0 {
        consolidated_stats.fixed_deposits.concentration_risk_pct =
            (consolidated_stats.fixed_deposits.single_depositor_count as f64
                / consolidated_stats.fixed_deposits.total_fds as f64)
                * 100.0;
    }

    // Compute aggregate averages
    if consolidated_stats.savings.total_accounts > 0 {
        consolidated_stats.savings.average_balance = consolidated_stats.savings.total_balance
            / consolidated_stats.savings.total_accounts as f64;
    }
    if consolidated_stats.loans.active_loans > 0 {
        consolidated_stats.loans.average_loan_size =
            consolidated_stats.loans.total_balance / consolidated_stats.loans.active_loans as f64;
    }
    if consolidated_stats.fixed_deposits.total_fds > 0 {
        consolidated_stats.fixed_deposits.average_balance =
            consolidated_stats.fixed_deposits.total_balance
                / consolidated_stats.fixed_deposits.total_fds as f64;
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

fn reconstruct_nf_stats(
    records: &[crate::entities::kpi_record::Model],
) -> crate::services::nf_indicator_engine::NfStatisticsResponse {
    let get_val = |name: &str| -> f64 {
        records
            .iter()
            .find(|r| r.kpi_name == name)
            .map(|r| r.value)
            .unwrap_or(0.0)
    };

    crate::services::nf_indicator_engine::NfStatisticsResponse {
        membership: crate::services::nf_indicator_engine::MembershipStats {
            total: get_val("membership_total") as u64,
            active: get_val("membership_active") as u64,
            dormant: get_val("membership_dormant") as u64,
            exited: get_val("membership_exited") as u64,
            male: get_val("membership_male") as u64,
            female: get_val("membership_female") as u64,
            other: get_val("membership_other") as u64,
            under_18: get_val("membership_under_18") as u64,
            age_18_35: get_val("membership_age_18_35") as u64,
            age_36_50: get_val("membership_age_36_50") as u64,
            over_50: get_val("membership_over_50") as u64,
            urban: get_val("membership_urban") as u64,
            rural: get_val("membership_rural") as u64,
            agm_attendance: get_val("membership_agm_attendance") as u64,
            leadership_count: get_val("membership_leadership_count") as u64,
            voting_count: get_val("membership_voting_count") as u64,
            active_pct: get_val("membership_active_pct"),
            dormancy_pct: get_val("membership_dormancy_pct"),
            exit_pct: get_val("membership_exit_pct"),
            male_pct: get_val("membership_male_pct"),
            female_pct: get_val("membership_female_pct"),
            other_pct: get_val("membership_other_pct"),
            youth_pct: get_val("membership_youth_pct"),
            adult_pct: get_val("membership_adult_pct"),
            urban_pct: get_val("membership_urban_pct"),
            rural_pct: get_val("membership_rural_pct"),
            agm_participation_pct: get_val("membership_agm_participation_pct"),
            women_in_governance_pct: get_val("membership_women_in_governance_pct"),
            youth_in_governance_pct: get_val("membership_youth_in_governance_pct"),
        },
        savings: crate::services::nf_indicator_engine::SavingsStats {
            total_accounts: get_val("savings_total_accounts") as u64,
            active_accounts: get_val("savings_active_accounts") as u64,
            dormant_accounts: get_val("savings_dormant_accounts") as u64,
            zero_balance_count: get_val("savings_zero_balance_count") as u64,
            increasing_trend: get_val("savings_increasing_trend") as u64,
            stable_trend: get_val("savings_stable_trend") as u64,
            declining_trend: get_val("savings_declining_trend") as u64,
            high_withdrawal_count: get_val("savings_high_withdrawal_count") as u64,
            emergency_withdrawal_count: get_val("savings_emergency_withdrawal_count") as u64,
            total_balance: get_val("savings_total_balance"),
            average_balance: get_val("savings_average_balance"),
            savings_penetration_pct: get_val("savings_penetration_pct"),
            active_savers_pct: get_val("savings_active_savers_pct"),
            dormant_savings_pct: get_val("savings_dormant_savings_pct"),
            zero_balance_pct: get_val("savings_zero_balance_pct"),
            increasing_trend_pct: get_val("savings_increasing_trend_pct"),
            regular_savers_pct: get_val("savings_regular_savers_pct"),
        },
        loans: crate::services::nf_indicator_engine::LoanStats {
            total_loans: get_val("loans_total_loans") as u64,
            active_loans: get_val("loans_active_loans") as u64,
            performing: get_val("loans_performing") as u64,
            arrears: get_val("loans_arrears") as u64,
            restructured: get_val("loans_restructured") as u64,
            written_off: get_val("loans_written_off") as u64,
            members_with_loans: get_val("loans_members_with_loans") as u64,
            youth_borrowers: get_val("loans_youth_borrowers") as u64,
            women_borrowers: get_val("loans_women_borrowers") as u64,
            rural_borrowers: get_val("loans_rural_borrowers") as u64,
            multiple_loan_count: get_val("loans_multiple_loan_count") as u64,
            large_borrower_count: get_val("loans_large_borrower_count") as u64,
            total_balance: get_val("loans_total_balance"),
            total_loan_amount: get_val("loans_total_loan_amount"),
            average_loan_size: get_val("loans_average_loan_size"),
            on_time_repayment_pct: get_val("loans_on_time_repayment_pct"),
            arrears_rate_pct: get_val("loans_arrears_rate_pct"),
            restructured_pct: get_val("loans_restructured_pct"),
            credit_penetration_pct: get_val("loans_credit_penetration_pct"),
            youth_borrower_pct: get_val("loans_youth_borrower_pct"),
            women_borrower_pct: get_val("loans_women_borrower_pct"),
            rural_borrower_pct: get_val("loans_rural_borrower_pct"),
        },
        fixed_deposits: crate::services::nf_indicator_engine::FixedDepositStats {
            total_fds: get_val("fds_total_fds") as u64,
            active_fds: get_val("fds_active_fds") as u64,
            matured_fds: get_val("fds_matured_fds") as u64,
            withdrawn_fds: get_val("fds_withdrawn_fds") as u64,
            rolled_over_fds: get_val("fds_rolled_over_fds") as u64,
            members_with_fds: get_val("fds_members_with_fds") as u64,
            early_withdrawal_count: get_val("fds_early_withdrawal_count") as u64,
            single_depositor_count: get_val("fds_single_depositor_count") as u64,
            total_balance: get_val("fds_total_balance"),
            average_balance: get_val("fds_average_balance"),
            fd_penetration_pct: get_val("fds_fd_penetration_pct"),
            early_withdrawal_pct: get_val("fds_early_withdrawal_pct"),
            rollover_rate_pct: get_val("fds_rollover_rate_pct"),
            concentration_risk_pct: get_val("fds_concentration_risk_pct"),
        },
        farm_coop: crate::services::nf_indicator_engine::FarmCoopStats {
            total_coops: get_val("farm_total_coops") as u64,
            active_producers: get_val("farm_active_producers") as u64,
            using_planning: get_val("farm_using_planning") as u64,
            using_shared_inputs: get_val("farm_using_shared_inputs") as u64,
            with_offtake_agreement: get_val("farm_with_offtake_agreement") as u64,
            with_storage: get_val("farm_with_storage") as u64,
            with_processing: get_val("farm_with_processing") as u64,
            with_irrigation: get_val("farm_with_irrigation") as u64,
            with_climate_mitigation: get_val("farm_with_climate_mitigation") as u64,
            active_producer_pct: get_val("farm_active_producer_pct"),
            planning_adoption_pct: get_val("farm_planning_adoption_pct"),
            shared_services_pct: get_val("farm_shared_services_pct"),
            formal_offtake_pct: get_val("farm_formal_offtake_pct"),
            storage_coverage_pct: get_val("farm_storage_coverage_pct"),
            processing_access_pct: get_val("farm_processing_access_pct"),
            irrigation_coverage_pct: get_val("farm_irrigation_coverage_pct"),
            climate_mitigation_pct: get_val("farm_climate_mitigation_pct"),
        },
        computed_at: chrono::Utc::now(),
    }
}

// ── Reconciliation audit — backend-computed, unpaginated ────────────────────
//
// Replaces the frontend's ReconciliationAuditCard, which requested up to
// 5000 rows per sub-ledger from a REST endpoint that silently caps at 200
// (backend/src/api/handlers/non_financial.rs), producing wrong sub-ledger
// totals and a variance that disagreed with the Dashboard's own (correctly,
// fully-summed) figures. This endpoint uses the same accurate SQL SUM()
// queries the Dashboard's KPI computation uses, and reports native-currency
// figures (not USD-converted) since its purpose is verification against the
// exact numbers printed in the uploaded source document.

#[derive(Debug, serde::Serialize, utoipa::ToSchema)]
pub struct ReconciliationRow {
    pub key: String,
    pub label: String,
    pub sub_ledger_name: String,
    pub coa_code: i32,
    pub sub_ledger_total: f64,
    pub sub_ledger_count: u64,
    pub financial_total: Option<f64>,
    pub currency: String,
    pub variance: Option<f64>,
    /// "match" | "variance" | "pending_subledger" | "pending_financial"
    pub status: String,
}

#[derive(Debug, serde::Serialize, utoipa::ToSchema)]
pub struct ReconciliationAuditResponse {
    pub submission_id: uuid::Uuid,
    pub rows: Vec<ReconciliationRow>,
    /// Rate to convert the native amounts to USD; None when already USD.
    pub rate_used: Option<crate::api::dto::common::RateUsed>,
}

fn reconciliation_row(
    key: &str,
    label: &str,
    sub_ledger_name: &str,
    coa_code: i32,
    (sub_total, sub_count): (f64, u64),
    fin_total: Option<f64>,
    currency: &str,
) -> ReconciliationRow {
    let has_sub = sub_count > 0 || sub_total.abs() > 0.001;
    let has_fin = fin_total.is_some();
    let (status, variance) = if !has_sub {
        ("pending_subledger".to_string(), None)
    } else if !has_fin {
        ("pending_financial".to_string(), None)
    } else {
        let v = sub_total - fin_total.unwrap();
        (
            if v.abs() < 0.01 { "match" } else { "variance" }.to_string(),
            Some(v),
        )
    };
    ReconciliationRow {
        key: key.to_string(),
        label: label.to_string(),
        sub_ledger_name: sub_ledger_name.to_string(),
        coa_code,
        sub_ledger_total: sub_total,
        sub_ledger_count: sub_count,
        financial_total: fin_total,
        currency: currency.to_string(),
        variance,
        status,
    }
}

#[utoipa::path(
    get,
    path = "/api/v1/analytics/reconciliation",
    params(("submission_id" = uuid::Uuid, Query, description = "Submission ID")),
    responses(
        (status = 200, description = "Reconciliation audit for a submission", body = ReconciliationAuditResponse),
        (status = 403, description = "Forbidden"),
        (status = 404, description = "Submission not found")
    ),
    tag = "Analytics"
)]
pub async fn get_reconciliation_audit(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> AppResult<impl IntoResponse> {
    let submission_id = params
        .get("submission_id")
        .and_then(|s| uuid::Uuid::parse_str(s).ok())
        .ok_or_else(|| crate::error::AppError::BadRequest("submission_id is required".into()))?;

    let cooperative_id = crate::api::handlers::cooperative::resolve_cooperative_id_for_nf(
        &state,
        &claims,
        Some(submission_id),
    )
    .await?;

    use rust_decimal::prelude::ToPrimitive;

    let fs = state
        .financial_statement_repo
        .find_by_submission(submission_id)
        .await?;

    let submission_row = state.submission_repo.find_by_id(submission_id).await?;
    let current_rates = state.exchange_rate_repo.find_all().await?;
    let rate_used = fs.as_ref().and_then(|f| {
        crate::api::handlers::exchange_rate::rate_used_for(
            &f.currency,
            submission_row.as_ref(),
            &current_rates,
        )
    });

    let currency_code = fs
        .as_ref()
        .map(|f| f.currency.as_str().to_string())
        .unwrap_or_else(|| "SZL".to_string());

    let resolved: std::collections::HashMap<i32, f64> = if let Some(fs) = &fs {
        let items = state
            .line_item_repo
            .find_by_financial_statement(fs.id)
            .await?;
        let max_month = items.iter().map(|i| i.month).max().unwrap_or(0);
        let mut raw = std::collections::HashMap::new();
        for item in items.iter().filter(|i| i.month == max_month) {
            if let (Some(code), Some(val)) =
                (item.account_code, item.value.and_then(|v| v.to_f64()))
            {
                raw.insert(code, val);
            }
        }
        let coa = state.coa_repo.find_all().await?;
        crate::services::coa_rollup::resolve(&raw, &coa)
    } else {
        std::collections::HashMap::new()
    };
    let fin = |code: i32| resolved.get(&code).copied().filter(|_| fs.is_some());

    let (share_total, share_count) = state
        .member_repo
        .sum_share_balance_by_submission(cooperative_id, submission_id)
        .await?;

    let nf_stats =
        NfIndicatorEngine::compute_for_submission(&state.db, cooperative_id, Some(submission_id))
            .await?;

    let rows = vec![
        reconciliation_row(
            "shares",
            "Member Share Capital",
            "Shares Register",
            3101,
            (share_total.to_f64().unwrap_or(0.0), share_count),
            fin(3101),
            &currency_code,
        ),
        reconciliation_row(
            "savings",
            "Member Short-Term Savings",
            "Savings Ledger",
            2101,
            (
                nf_stats.savings.total_balance,
                nf_stats.savings.total_accounts,
            ),
            fin(2101),
            &currency_code,
        ),
        reconciliation_row(
            "loans",
            "Performing Loan Portfolio",
            "Loan Book",
            1200,
            (nf_stats.loans.total_balance, nf_stats.loans.total_loans),
            fin(1200),
            &currency_code,
        ),
        reconciliation_row(
            "fixed_deposits",
            "Fixed Term Deposits",
            "Fixed Deposits",
            2103,
            (
                nf_stats.fixed_deposits.total_balance,
                nf_stats.fixed_deposits.total_fds,
            ),
            fin(2103),
            &currency_code,
        ),
    ];

    Ok((
        StatusCode::OK,
        Json(ReconciliationAuditResponse {
            submission_id,
            rows,
            rate_used,
        }),
    ))
}
