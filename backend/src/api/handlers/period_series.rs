use std::collections::{BTreeMap, HashMap};
use std::sync::Arc;

use axum::extract::{Extension, Query, State};
use axum::response::IntoResponse;
use axum::Json;
use rust_decimal::prelude::ToPrimitive;
use uuid::Uuid;

use crate::api::dto::period_series::{PeriodSeriesParams, PeriodSeriesPoint, PeriodSeriesResponse};
use crate::auth::claims::Claims;
use crate::entities::balance_sheet_line_item::Model as LineItem;
use crate::entities::enums::PeriodType;
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
/// quarterly). Only complete years count: a yearly series combines the periods
/// of a year reported by quarters, halves or months, and a quarterly (or other)
/// series only shows the periods of complete years.
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

    let all_submissions: Vec<submission::Model> = state
        .submission_repo
        .find_by_cooperative_ids(coop_ids)
        .await?;
    let counted = crate::services::year_figures::counted(
        &all_submissions,
        crate::services::year_figures::YearFilter::default(),
    );

    // One entry per cooperative and period: its key, period value and lines.
    // A yearly series uses every complete year, a year reported by periods
    // being combined into one; any other frequency shows the periods of
    // complete years only.
    let entries: Vec<((i32, u32), String, Vec<LineItem>)> = if period_type == PeriodType::Yearly {
        crate::services::year_figures::load_statements(&state, &counted, &all_submissions)
            .await?
            .into_values()
            .filter(|statement| statement.has_statement)
            .map(|statement| {
                let year = statement.year.year;
                ((year, 0), year.to_string(), statement.line_items)
            })
            .collect()
    } else {
        let counted_ids: std::collections::HashSet<Uuid> = counted
            .iter()
            .flat_map(|year| year.submission_ids.iter().copied())
            .collect();
        let periods: Vec<&submission::Model> = all_submissions
            .iter()
            .filter(|s| s.period_type == period_type && counted_ids.contains(&s.id))
            .collect();
        let statements = state
            .financial_statement_repo
            .find_by_submission_ids(periods.iter().map(|s| s.id).collect())
            .await?;
        let submission_of: HashMap<Uuid, Uuid> = statements
            .iter()
            .map(|fs| (fs.id, fs.submission_id))
            .collect();
        let mut items_by_submission: HashMap<Uuid, Vec<LineItem>> = HashMap::new();
        for item in state
            .line_item_repo
            .find_by_financial_statement_ids(statements.iter().map(|fs| fs.id).collect())
            .await?
        {
            if let Some(submission_id) = submission_of.get(&item.financial_statement_id) {
                items_by_submission
                    .entry(*submission_id)
                    .or_default()
                    .push(item);
            }
        }
        periods
            .into_iter()
            .filter_map(|s| {
                let key = period_key(period_type, s.reporting_year, &s.period_value)?;
                let items = items_by_submission.remove(&s.id)?;
                Some((key, s.period_value.clone(), items))
            })
            .collect()
    };

    let available: Vec<(i32, u32)> = entries.iter().map(|(key, _, _)| *key).collect();
    let end = params.reporting_year.map(|year| {
        let index = params
            .period_value
            .as_deref()
            .filter(|value| !value.eq_ignore_ascii_case("all"))
            .filter(|_| period_type != PeriodType::Yearly)
            .and_then(|value| period_key(period_type, year, value))
            .map(|(_, index)| index);
        (year, index)
    });
    let limit = params.limit.unwrap_or(DEFAULT_PERIOD_LIMIT);
    let selected = select_periods(&available, end, limit);

    let coa = state.coa_repo.find_all().await?;

    let mut totals_by_period: BTreeMap<(i32, u32), (StatementTotals, i64, String)> =
        BTreeMap::new();

    for (key, value, items) in entries.iter().filter(|(key, _, _)| selected.contains(key)) {
        let mut raw: BTreeMap<i16, HashMap<i32, f64>> = BTreeMap::new();
        for item in items {
            if let (Some(code), Some(amount)) =
                (item.account_code, item.value.and_then(|d| d.to_f64()))
            {
                raw.entry(item.month).or_default().insert(code, amount);
            }
        }
        if raw.is_empty() {
            continue;
        }
        let native = statement_totals(&raw, &coa);
        let entry = totals_by_period
            .entry(*key)
            .or_insert_with(|| (StatementTotals::default(), 0, value.clone()));
        entry.0.add(&native);
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
    }))
}
