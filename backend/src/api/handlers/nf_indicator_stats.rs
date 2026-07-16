use axum::extract::{Extension, Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
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
}

#[utoipa::path(
    get,
    path = "/api/v1/cooperative/nf-statistics",
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
) -> AppResult<impl IntoResponse> {
    let coop =
        crate::api::handlers::cooperative::resolve_caller_cooperative(&state, &claims).await?;
    let stats = NfIndicatorEngine::compute(&state.db, coop.id).await?;
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

    let cooperative_ids = if let Some(cooperative_id) = params.cooperative_id {
        if !caller_coop_ids.contains(&cooperative_id) {
            return Err(crate::error::AppError::Forbidden(
                "Access denied to this cooperative".into(),
            ));
        }
        vec![cooperative_id]
    } else {
        caller_coop_ids
    };

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

fn average(values: &[f64]) -> f64 {
    if values.is_empty() {
        0.0
    } else {
        values.iter().sum::<f64>() / values.len() as f64
    }
}
