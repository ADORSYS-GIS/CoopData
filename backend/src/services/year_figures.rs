//! Loads the figures of complete reporting years (see `reporting_year`).

use std::collections::HashMap;

use uuid::Uuid;

use crate::entities::balance_sheet_line_item::Model as LineItem;
use crate::entities::enums::PeriodType;
use crate::entities::submission;
use crate::error::AppResult;
use crate::services::reporting_year::{self, period_line_items, year_line_items, YearProgress};
use crate::AppState;

/// A complete year and the statement lines that describe it as one year.
#[derive(Debug, Clone)]
pub struct YearStatement {
    pub year: YearProgress,
    /// The last period's submission: its registers and questionnaire answers
    /// give the year-end figures, and its stored non-financial KPIs apply.
    pub anchor: submission::Model,
    pub line_items: Vec<LineItem>,
    /// The same lines kept month by month, for screens that read the year up
    /// to a chosen period. Equal to `line_items` for a single return.
    pub period_items: Vec<LineItem>,
    /// At least one period of the year has a financial statement.
    pub has_statement: bool,
    /// Every statement of the year passed validation.
    pub is_validated: bool,
    /// Currency of the last period's statement (the one the year ends in).
    pub currency: crate::entities::enums::Currency,
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
        let currency = year_statements
            .iter()
            .find(|fs| fs.submission_id == anchor.id)
            .or_else(|| year_statements.last())
            .map(|fs| fs.currency.clone())
            .unwrap_or(crate::entities::enums::Currency::Szl);
        result.insert(
            (year.cooperative_id, year.year),
            YearStatement {
                year: year.clone(),
                anchor: anchor.clone(),
                line_items: year_line_items(year, &by_id, &items_by_submission),
                period_items: period_line_items(year, &by_id, &items_by_submission),
                has_statement,
                is_validated,
                currency,
            },
        );
    }
    Ok(result)
}

/// KPI records of a complete year. A yearly (or full-year) return keeps its
/// stored KPIs. A year built from periods gets its financial KPIs recomputed
/// from the combined statement and keeps the last period's non-financial KPIs
/// (member, loan and savings registers are year-end figures).
pub async fn year_kpi_records(
    state: &AppState,
    statement: &YearStatement,
) -> AppResult<Vec<crate::entities::kpi_record::Model>> {
    let stored = state
        .kpi_record_repo
        .find_by_submission(statement.anchor.id)
        .await?;
    if !statement.year.is_multi_period() {
        return Ok(stored);
    }
    let now = chrono::Utc::now().fixed_offset();
    let mut records: Vec<crate::entities::kpi_record::Model> =
        crate::services::KpiEngine::compute(&statement.line_items)
            .to_vec()
            .into_iter()
            .map(|kpi| crate::entities::kpi_record::Model {
                id: Uuid::new_v4(),
                cooperative_id: statement.anchor.cooperative_id,
                submission_id: statement.anchor.id,
                reporting_year: statement.year.year,
                kpi_name: kpi.name,
                kpi_type: "financial".to_string(),
                value: kpi.value,
                formatted: kpi.formatted,
                unit: kpi.unit,
                status: kpi.status,
                description: kpi.description,
                created_at: now,
                updated_at: now,
            })
            .collect();
    records.extend(stored.into_iter().filter(|r| r.kpi_type != "financial"));
    Ok(records)
}

/// `year_kpi_records` as API items.
pub async fn year_kpis(
    state: &AppState,
    statement: &YearStatement,
) -> AppResult<Vec<crate::api::dto::financial::KpiItemResponse>> {
    Ok(year_kpi_records(state, statement)
        .await?
        .into_iter()
        .map(|r| crate::api::dto::financial::KpiItemResponse {
            benchmark: crate::services::KpiEngine::get_benchmark(&r.kpi_name),
            name: r.kpi_name,
            value: r.value,
            formatted: r.formatted,
            unit: r.unit,
            status: r.status,
            description: r.description,
        })
        .collect())
}

/// The year a submission belongs to, and the cooperative's previous year.
#[derive(Debug, Clone, Default)]
pub struct SubmissionYear {
    /// Progress of the submission's year.
    pub progress: Option<YearProgress>,
    /// The year as one statement, once it is complete.
    pub current: Option<YearStatement>,
    /// The previous year, when it is complete: the only year a complete year
    /// is compared with.
    pub prior: Option<YearStatement>,
}

/// The year of `submission`. With `include_submission`, the submission counts
/// as approved (a report prepared for it before its approval).
pub async fn for_submission(
    state: &AppState,
    submission: &submission::Model,
    include_submission: bool,
) -> AppResult<SubmissionYear> {
    let mut subs = state
        .submission_repo
        .find_by_cooperative_ids(vec![submission.cooperative_id])
        .await?;
    if include_submission {
        if let Some(s) = subs.iter_mut().find(|s| s.id == submission.id) {
            s.status = crate::entities::enums::SubmissionStatus::Approved;
        }
    }
    let progress = reporting_year::year_progress(&subs);
    let of_year = |year: i32| progress.iter().find(|p| p.year == year);
    let current = of_year(submission.reporting_year).filter(|p| p.complete);
    let prior = of_year(submission.reporting_year - 1).filter(|p| p.complete);
    let mut statements = load_statements(state, current.into_iter().chain(prior), &subs).await?;
    Ok(SubmissionYear {
        progress: of_year(submission.reporting_year).cloned(),
        current: current.and_then(|y| statements.remove(&(y.cooperative_id, y.year))),
        prior: prior.and_then(|y| statements.remove(&(y.cooperative_id, y.year))),
    })
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
