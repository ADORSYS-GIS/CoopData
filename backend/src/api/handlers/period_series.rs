use std::collections::{BTreeMap, HashMap};
use std::sync::Arc;

use axum::extract::{Extension, Query, State};
use axum::response::IntoResponse;
use axum::Json;
use rust_decimal::prelude::ToPrimitive;
use uuid::Uuid;

use crate::api::dto::common::RateUsed;
use crate::api::dto::period_series::{PeriodSeriesParams, PeriodSeriesPoint, PeriodSeriesResponse};
use crate::auth::claims::Claims;
use crate::entities::enums::{PeriodType, SubmissionStatus};
use crate::entities::submission;
use crate::error::{AppError, AppResult};
use crate::services::period_series::{
    period_key, period_label, select_periods, statement_totals, StatementTotals,
    DEFAULT_PERIOD_LIMIT,
};
use crate::AppState;

/// GET /api/v1/analytics/period-series
///
/// Statement totals per period of one frequency, ending at the chosen period,
/// so charts follow the frequency filter (yearly stays yearly, quarterly stays
/// quarterly). Only approved submissions count.
#[utoipa::path(
    get,
    path = "/api/v1/analytics/period-series",
    params(PeriodSeriesParams),
    responses(
        (status = 200, description = "Statement totals per period", body = PeriodSeriesResponse),
        (status = 400, description = "Invalid period type"),
        (status = 403, description = "Forbidden")
    ),
    tag = "Analytics"
)]
pub async fn get_period_series(
    State(state): State<AppState>,
    Extension(claims): Extension<Arc<Claims>>,
    Query(params): Query<PeriodSeriesParams>,
) -> AppResult<impl IntoResponse> {
    let period_type = match params.period_type.as_deref() {
        None => PeriodType::Yearly,
        Some(raw) if raw.eq_ignore_ascii_case("all") => PeriodType::Yearly,
        Some(raw) => PeriodType::parse(raw)
            .ok_or_else(|| AppError::BadRequest(format!("Invalid period_type '{raw}'")))?,
    };

    let caller_coop_ids =
        crate::api::handlers::cooperative::resolve_caller_cooperative_ids(&state, &claims).await?;
    let coop_ids = crate::api::handlers::financial_statement::filter_cooperatives(
        &state,
        caller_coop_ids,
        params.cooperative_id,
        params.region,
        params.sector,
        params.federation_id,
        params.apex_id,
    )
    .await?;

    let approved: Vec<submission::Model> = state
        .submission_repo
        .find_by_cooperative_ids(coop_ids)
        .await?
        .into_iter()
        .filter(|s| s.status == SubmissionStatus::Approved && s.period_type == period_type)
        .collect();

    let keyed: Vec<((i32, u32), submission::Model)> = approved
        .into_iter()
        .filter_map(|s| {
            period_key(period_type, s.reporting_year, &s.period_value).map(|key| (key, s))
        })
        .collect();

    let available: Vec<(i32, u32)> = keyed.iter().map(|(key, _)| *key).collect();
    let end = params.reporting_year.map(|year| {
        let index = params
            .period_value
            .as_deref()
            .filter(|value| !value.eq_ignore_ascii_case("all"))
            .and_then(|value| period_key(period_type, year, value))
            .map(|(_, index)| index);
        (year, index)
    });
    let limit = params.limit.unwrap_or(DEFAULT_PERIOD_LIMIT);
    let selected = select_periods(&available, end, limit);

    let in_series: Vec<&((i32, u32), submission::Model)> = keyed
        .iter()
        .filter(|(key, _)| selected.contains(key))
        .collect();
    let submission_ids: Vec<Uuid> = in_series.iter().map(|(_, s)| s.id).collect();

    let statements = state
        .financial_statement_repo
        .find_by_submission_ids(submission_ids)
        .await?;
    let items = state
        .line_item_repo
        .find_by_financial_statement_ids(statements.iter().map(|fs| fs.id).collect())
        .await?;

    let coa = state.coa_repo.find_all().await?;
    let rates = state.currency_service.load_rates().await?;
    let current_rates = state.exchange_rate_repo.find_all().await?;

    let mut raw_by_statement: HashMap<Uuid, BTreeMap<i16, HashMap<i32, f64>>> = HashMap::new();
    for item in &items {
        if let (Some(code), Some(value)) = (item.account_code, item.value.and_then(|d| d.to_f64()))
        {
            raw_by_statement
                .entry(item.financial_statement_id)
                .or_default()
                .entry(item.month)
                .or_default()
                .insert(code, value);
        }
    }
    let statement_of: HashMap<Uuid, &crate::entities::financial_statement::Model> =
        statements.iter().map(|fs| (fs.submission_id, fs)).collect();

    let mut totals_by_period: BTreeMap<(i32, u32), (StatementTotals, i64, String)> =
        BTreeMap::new();
    let mut rates_used: Vec<RateUsed> = Vec::new();

    for (key, submission) in &in_series {
        let Some(statement) = statement_of.get(&submission.id) else {
            continue;
        };
        let Some(raw) = raw_by_statement.get(&statement.id) else {
            continue;
        };
        let frozen = crate::services::currency::frozen_rate_of(submission);
        if let Some(used) = crate::api::handlers::exchange_rate::rate_used_for(
            &statement.currency,
            Some(submission),
            &current_rates,
        ) {
            if !rates_used.contains(&used) {
                rates_used.push(used);
            }
        }
        let native = statement_totals(raw, &coa);
        let usd = native.map(|value| {
            crate::services::currency::to_usd_frozen(value, &statement.currency, frozen, &rates)
        });
        let entry = totals_by_period.entry(*key).or_insert_with(|| {
            (
                StatementTotals::default(),
                0,
                submission.period_value.clone(),
            )
        });
        entry.0.add(&usd);
        entry.1 += 1;
    }

    let points = selected
        .iter()
        .filter_map(|key| {
            totals_by_period
                .get(key)
                .map(|(totals, count, value)| PeriodSeriesPoint {
                    period_label: period_label(period_type, key.0, value),
                    reporting_year: key.0,
                    period_type: period_type.as_str().to_string(),
                    period_value: value.clone(),
                    cooperatives_reporting: *count,
                    assets: totals.assets,
                    loans: totals.loans,
                    liquid_assets: totals.liquid_assets,
                    savings: totals.savings,
                    liabilities: totals.liabilities,
                    equity: totals.equity,
                    total_income: totals.total_income,
                    total_expenses: totals.total_expenses,
                    net_income: totals.net_income,
                    arrears_1_30: totals.arrears_1_30,
                    arrears_31_60: totals.arrears_31_60,
                    arrears_61_90: totals.arrears_61_90,
                    non_performing: totals.non_performing,
                    provisions: totals.provisions,
                    borrowings: totals.borrowings,
                    share_capital: totals.share_capital,
                    reserves: totals.reserves,
                    statutory_reserve: totals.statutory_reserve,
                    retained_earnings: totals.retained_earnings,
                    financial_income: totals.financial_income,
                    other_income: totals.other_income,
                    financial_expenses: totals.financial_expenses,
                    operating_expenses: totals.operating_expenses,
                    credit_loss_expense: totals.credit_loss_expense,
                })
        })
        .collect();

    Ok(Json(PeriodSeriesResponse {
        period_type: period_type.as_str().to_string(),
        points,
        rates_used,
    }))
}
