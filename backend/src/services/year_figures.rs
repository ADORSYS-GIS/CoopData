//! Loads the figures of complete reporting years (see `reporting_year`).

use std::collections::HashMap;

use uuid::Uuid;

use crate::entities::balance_sheet_line_item::Model as LineItem;
use crate::entities::enums::PeriodType;
use crate::entities::submission;
use crate::error::AppResult;
use crate::services::reporting_year::{self, year_line_items, YearProgress};
use crate::AppState;

/// A complete year and the statement lines that describe it as one year.
#[derive(Debug, Clone)]
pub struct YearStatement {
    pub year: YearProgress,
    /// The last period's submission: its registers and questionnaire answers
    /// give the year-end figures, and its stored non-financial KPIs apply.
    pub anchor: submission::Model,
    pub line_items: Vec<LineItem>,
    /// At least one period of the year has a financial statement.
    pub has_statement: bool,
    /// Every statement of the year passed validation.
    pub is_validated: bool,
}

/// Which complete years a screen asks for.
#[derive(Debug, Clone, Copy, Default)]
pub struct YearFilter {
    pub reporting_year: Option<i32>,
    /// Only years reported with this frequency.
    pub period_type: Option<PeriodType>,
}

impl YearFilter {
    pub fn matches(&self, year: &YearProgress) -> bool {
        self.reporting_year.map_or(true, |y| year.year == y)
            && self.period_type.map_or(true, |t| year.period_type == t)
    }
}

/// Complete years among `subs` that pass `filter`, newest first.
pub fn counted(subs: &[submission::Model], filter: YearFilter) -> Vec<YearProgress> {
    reporting_year::counted_years(subs)
        .into_iter()
        .filter(|y| filter.matches(y))
        .collect()
}

/// The newest complete year of each cooperative that passes `filter`.
pub fn latest_per_cooperative(
    subs: &[submission::Model],
    filter: YearFilter,
) -> HashMap<Uuid, YearProgress> {
    let mut latest: HashMap<Uuid, YearProgress> = HashMap::new();
    for year in counted(subs, filter) {
        latest.entry(year.cooperative_id).or_insert(year);
    }
    latest
}

/// Cooperatives left out of a year's figures because that year is not
/// complete yet. Without a year: those whose newest year is incomplete.
pub fn incomplete_cooperatives(subs: &[submission::Model], reporting_year: Option<i32>) -> u64 {
    let mut newest: HashMap<Uuid, &YearProgress> = HashMap::new();
    let progress = reporting_year::year_progress(subs);
    for year in &progress {
        let wanted = reporting_year.map_or(true, |y| year.year == y);
        if wanted {
            newest.entry(year.cooperative_id).or_insert(year);
        }
    }
    newest.values().filter(|year| !year.complete).count() as u64
}

/// Statement lines of each year in `years`, keyed by (cooperative, year).
pub async fn load_statements<'a>(
    state: &AppState,
    years: impl IntoIterator<Item = &'a YearProgress>,
    subs: &[submission::Model],
) -> AppResult<HashMap<(Uuid, i32), YearStatement>> {
    let years: Vec<&YearProgress> = years.into_iter().collect();
    let by_id: HashMap<Uuid, submission::Model> = subs.iter().map(|s| (s.id, s.clone())).collect();
    let submission_ids: Vec<Uuid> = years
        .iter()
        .flat_map(|y| y.submission_ids.iter().copied())
        .collect();

    let statements = state
        .financial_statement_repo
        .find_by_submission_ids(submission_ids)
        .await?;
    let submission_of: HashMap<Uuid, Uuid> = statements
        .iter()
        .map(|fs| (fs.id, fs.submission_id))
        .collect();
    let lines = state
        .line_item_repo
        .find_by_financial_statement_ids(statements.iter().map(|fs| fs.id).collect())
        .await?;
    let mut items_by_submission: HashMap<Uuid, Vec<LineItem>> = HashMap::new();
    for line in lines {
        if let Some(submission_id) = submission_of.get(&line.financial_statement_id) {
            items_by_submission
                .entry(*submission_id)
                .or_default()
                .push(line);
        }
    }

    let mut result = HashMap::new();
    for year in years {
        let Some(anchor) = year.anchor_id.and_then(|id| by_id.get(&id)) else {
            continue;
        };
        let year_statements: Vec<&crate::entities::financial_statement::Model> = statements
            .iter()
            .filter(|fs| year.submission_ids.contains(&fs.submission_id))
            .collect();
        let has_statement = !year_statements.is_empty();
        let is_validated = has_statement && year_statements.iter().all(|fs| fs.is_validated);
        result.insert(
            (year.cooperative_id, year.year),
            YearStatement {
                year: year.clone(),
                anchor: anchor.clone(),
                line_items: year_line_items(year, &by_id, &items_by_submission),
                has_statement,
                is_validated,
            },
        );
    }
    Ok(result)
}

/// KPIs of a complete year. A yearly (or full-year) return keeps its stored
/// KPIs. A year built from periods gets its financial KPIs recomputed from the
/// combined statement and keeps the last period's non-financial KPIs (member,
/// loan and savings registers are year-end figures).
pub async fn year_kpis(
    state: &AppState,
    statement: &YearStatement,
) -> AppResult<Vec<crate::api::dto::financial::KpiItemResponse>> {
    use crate::api::dto::financial::KpiItemResponse;

    let stored = state
        .kpi_record_repo
        .find_by_submission(statement.anchor.id)
        .await?;
    let from_record = |r: crate::entities::kpi_record::Model| KpiItemResponse {
        benchmark: crate::services::KpiEngine::get_benchmark(&r.kpi_name),
        name: r.kpi_name,
        value: r.value,
        formatted: r.formatted,
        unit: r.unit,
        status: r.status,
        description: r.description,
    };
    if !statement.year.is_multi_period() {
        return Ok(stored.into_iter().map(from_record).collect());
    }
    let mut kpis: Vec<KpiItemResponse> = crate::services::KpiEngine::compute(&statement.line_items)
        .to_vec()
        .into_iter()
        .map(KpiItemResponse::from)
        .collect();
    kpis.extend(
        stored
            .into_iter()
            .filter(|r| r.kpi_type != "financial")
            .map(from_record),
    );
    Ok(kpis)
}

/// "2026 is not complete yet: 2 of 4 periods approved." for an incomplete year.
pub fn incomplete_message(year: &YearProgress) -> String {
    format!(
        "{} is not complete yet: {} of {} periods approved. A year is used once every period of it is approved.",
        year.year,
        year.approved.len(),
        year.expected.len()
    )
}
