//! Which reporting years count. A year counts once every period of its
//! frequency is approved; until then none of its figures are used. The order in
//! which periods are filed and the fiscal start month do not matter.

use std::collections::{BTreeMap, HashMap};

use uuid::Uuid;

use crate::entities::balance_sheet_line_item::Model as LineItem;
use crate::entities::enums::{AccountCategory, PeriodType, SubmissionStatus};
use crate::entities::submission;
use crate::services::period_rules::{period_months, FULL_YEAR};
use crate::services::period_series::period_index;

/// Progress of one cooperative's reporting year.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct YearProgress {
    pub cooperative_id: Uuid,
    pub year: i32,
    pub period_type: PeriodType,
    /// Every period the frequency needs, in order ("Q1".."Q4", "01".."12", the year).
    pub expected: Vec<String>,
    pub approved: Vec<String>,
    /// Submitted and waiting for a decision.
    pub in_review: Vec<String>,
    /// Being prepared or sent back for corrections.
    pub drafts: Vec<String>,
    /// Not started, or rejected.
    pub missing: Vec<String>,
    pub complete: bool,
    /// Approved submissions of a complete year, first period first. Empty while
    /// the year is incomplete.
    pub submission_ids: Vec<Uuid>,
    /// The last period of a complete year: its balance sheet and registers are
    /// the year-end figures.
    pub anchor_id: Option<Uuid>,
}

impl YearProgress {
    /// A complete year built from several periods (not a single yearly or
    /// full-year return), whose figures have to be added up.
    pub fn is_multi_period(&self) -> bool {
        self.submission_ids.len() > 1
    }
}

/// Period labels a frequency needs for a full year.
pub fn expected_periods(period_type: PeriodType, year: i32) -> Vec<String> {
    match period_type {
        PeriodType::Yearly => vec![year.to_string()],
        PeriodType::SemiAnnual => vec!["H1".into(), "H2".into()],
        PeriodType::Quarterly => (1..=4).map(|q| format!("Q{q}")).collect(),
        PeriodType::Monthly => (1..=12).map(|m| format!("{m:02}")).collect(),
    }
}

/// Position of a submission's period in its year (`None` for an invalid value).
/// A full-year monthly return covers the whole year.
fn covered_positions(s: &submission::Model) -> Option<Vec<u32>> {
    if s.period_type == PeriodType::Monthly && s.period_value.trim().eq_ignore_ascii_case(FULL_YEAR)
    {
        return Some((1..=12).collect());
    }
    let index = period_index(s.period_type, &s.period_value)?;
    Some(vec![index.max(1)])
}

enum Stage {
    Approved,
    InReview,
    Draft,
    Ignored,
}

fn stage(status: &SubmissionStatus) -> Stage {
    match status {
        SubmissionStatus::Approved => Stage::Approved,
        SubmissionStatus::Submitted | SubmissionStatus::InReview | SubmissionStatus::Escalated => {
            Stage::InReview
        }
        SubmissionStatus::Draft
        | SubmissionStatus::Returned
        | SubmissionStatus::Synced
        | SubmissionStatus::SyncFailed => Stage::Draft,
        _ => Stage::Ignored,
    }
}

fn progress_for(
    cooperative_id: Uuid,
    year: i32,
    period_type: PeriodType,
    subs: &[&submission::Model],
) -> YearProgress {
    let expected = expected_periods(period_type, year);
    let mut approved_at: BTreeMap<u32, &submission::Model> = BTreeMap::new();
    let mut in_review = std::collections::BTreeSet::new();
    let mut drafts = std::collections::BTreeSet::new();
    for s in subs.iter().filter(|s| s.period_type == period_type) {
        let Some(positions) = covered_positions(s) else {
            continue;
        };
        for position in positions {
            match stage(&s.status) {
                Stage::Approved => {
                    approved_at.insert(position, s);
                }
                Stage::InReview => {
                    in_review.insert(position);
                }
                Stage::Draft => {
                    drafts.insert(position);
                }
                Stage::Ignored => {}
            }
        }
    }

    let label = |position: u32| expected[(position.max(1) - 1) as usize].clone();
    let approved: Vec<String> = approved_at.keys().map(|p| label(*p)).collect();
    let in_review: Vec<String> = in_review
        .into_iter()
        .filter(|p| !approved_at.contains_key(p))
        .map(label)
        .collect();
    let drafts: Vec<String> = drafts
        .into_iter()
        .filter(|p| !approved_at.contains_key(p))
        .map(label)
        .filter(|l| !in_review.contains(l))
        .collect();
    let missing: Vec<String> = expected
        .iter()
        .filter(|l| !approved.contains(l) && !in_review.contains(l) && !drafts.contains(l))
        .cloned()
        .collect();
    let complete = approved.len() == expected.len();

    let mut submission_ids: Vec<Uuid> = Vec::new();
    if complete {
        for s in approved_at.values() {
            if !submission_ids.contains(&s.id) {
                submission_ids.push(s.id);
            }
        }
    }
    let anchor_id = complete.then(|| submission_ids.last().copied()).flatten();

    YearProgress {
        cooperative_id,
        year,
        period_type,
        expected,
        approved,
        in_review,
        drafts,
        missing,
        complete,
        submission_ids,
        anchor_id,
    }
}

/// Progress of every cooperative year found in `subs`, newest year first.
///
/// A year normally has one frequency. Older data may mix several; then a
/// complete frequency wins (yearly first), otherwise the one with the most
/// approved periods.
pub fn year_progress(subs: &[submission::Model]) -> Vec<YearProgress> {
    let mut groups: BTreeMap<(Uuid, i32), Vec<&submission::Model>> = BTreeMap::new();
    for s in subs {
        groups
            .entry((s.cooperative_id, s.reporting_year))
            .or_default()
            .push(s);
    }

    let mut result: Vec<YearProgress> = groups
        .into_iter()
        .map(|((cooperative_id, year), in_year)| {
            let mut types: Vec<PeriodType> = Vec::new();
            for s in &in_year {
                if !types.contains(&s.period_type) {
                    types.push(s.period_type);
                }
            }
            types.sort_by_key(|t| match t {
                PeriodType::Yearly => 0,
                PeriodType::SemiAnnual => 1,
                PeriodType::Quarterly => 2,
                PeriodType::Monthly => 3,
            });
            let candidates: Vec<YearProgress> = types
                .into_iter()
                .map(|t| progress_for(cooperative_id, year, t, &in_year))
                .collect();
            candidates
                .iter()
                .find(|p| p.complete)
                .or_else(|| {
                    candidates
                        .iter()
                        .max_by_key(|p| p.approved.len() * 100 / p.expected.len())
                })
                .cloned()
                .expect("a year group always has at least one submission")
        })
        .collect();
    result.sort_by(|a, b| {
        b.year
            .cmp(&a.year)
            .then(a.cooperative_id.cmp(&b.cooperative_id))
    });
    result
}

/// The complete years in `subs`.
pub fn counted_years(subs: &[submission::Model]) -> Vec<YearProgress> {
    year_progress(subs)
        .into_iter()
        .filter(|p| p.complete)
        .collect()
}

/// Ids of every approved submission that belongs to a complete year.
pub fn counted_submission_ids(subs: &[submission::Model]) -> Vec<Uuid> {
    counted_years(subs)
        .into_iter()
        .flat_map(|p| p.submission_ids)
        .collect()
}

/// The submission whose report describes `submission`'s year. A yearly (or
/// full-year) return is its own report. A period of a year reported by
/// quarters, halves or months shares the year's report, kept under the last
/// period, and only once the year is complete; `submission` counts as approved
/// (a report may be prepared while it is reviewed). Returns the year's progress
/// while it is incomplete.
pub fn report_submission(
    subs: &[submission::Model],
    submission: &submission::Model,
) -> Result<Uuid, Box<YearProgress>> {
    let single = submission.period_type == PeriodType::Yearly
        || (submission.period_type == PeriodType::Monthly
            && submission
                .period_value
                .trim()
                .eq_ignore_ascii_case(FULL_YEAR));
    if single {
        return Ok(submission.id);
    }
    let in_year: Vec<submission::Model> = subs
        .iter()
        .filter(|s| {
            s.cooperative_id == submission.cooperative_id
                && s.reporting_year == submission.reporting_year
                && s.id != submission.id
        })
        .cloned()
        .chain(std::iter::once(submission::Model {
            status: SubmissionStatus::Approved,
            ..submission.clone()
        }))
        .collect();
    let year = year_progress(&in_year)
        .into_iter()
        .find(|p| p.period_type == submission.period_type)
        .expect("the submission's own year is always present");
    match year.anchor_id {
        Some(anchor) if year.complete => Ok(anchor),
        _ => Err(Box::new(year)),
    }
}

/// Position (1-12) of a calendar month in a fiscal year starting at `start`.
fn fiscal_position(month: i16, start: i32) -> i16 {
    let start = if (1..=12).contains(&start) { start } else { 1 } as i16;
    (month - start).rem_euclid(12) + 1
}

/// Statement lines of a complete year, ready for `KpiEngine::compute` and
/// `period_series::statement_totals`.
///
/// A yearly (or full-year) return is used as it is. A year built from several
/// periods comes back as one annual column (month 0), like a yearly return:
/// each period keeps only its own months, income and expense lines are added up
/// over the year and balance-sheet lines are taken from the last month of the
/// last period, whatever the fiscal start month.
pub fn year_line_items(
    year: &YearProgress,
    submissions: &HashMap<Uuid, submission::Model>,
    items_by_submission: &HashMap<Uuid, Vec<LineItem>>,
) -> Vec<LineItem> {
    if !year.is_multi_period() {
        return year
            .submission_ids
            .first()
            .and_then(|id| items_by_submission.get(id))
            .cloned()
            .unwrap_or_default();
    }
    let mut positioned: Vec<LineItem> = Vec::new();
    for id in &year.submission_ids {
        let (Some(s), Some(lines)) = (submissions.get(id), items_by_submission.get(id)) else {
            continue;
        };
        let months = period_months(s.period_type, &s.period_value, s.fiscal_start_month);
        for line in lines {
            if line.month == 0 || months.as_ref().is_some_and(|m| !m.contains(&line.month)) {
                continue;
            }
            let mut line = line.clone();
            line.month = fiscal_position(line.month, s.fiscal_start_month);
            positioned.push(line);
        }
    }
    annual_column(positioned)
}

fn is_flow(line: &LineItem) -> bool {
    match line.account_code {
        Some(code) => code >= 4000,
        None => matches!(
            line.account_category,
            AccountCategory::Income | AccountCategory::Expenses | AccountCategory::Surplus
        ),
    }
}

/// Folds lines numbered by fiscal position (1-12) into one annual column.
fn annual_column(mut lines: Vec<LineItem>) -> Vec<LineItem> {
    let Some(last_month) = lines.iter().map(|l| l.month).max() else {
        return lines;
    };
    lines.sort_by_key(|l| l.month);
    let mut annual: Vec<LineItem> = Vec::new();
    let mut index: HashMap<(Option<i32>, String), usize> = HashMap::new();
    for line in lines {
        let flow = is_flow(&line);
        if !flow && line.month != last_month {
            continue;
        }
        let key = (line.account_code, line.account_name.clone());
        match index.get(&key) {
            Some(&at) if flow => {
                let total = annual[at].value.unwrap_or_default() + line.value.unwrap_or_default();
                annual[at].value = Some(total);
            }
            Some(_) => {}
            None => {
                index.insert(key, annual.len());
                annual.push(LineItem { month: 0, ..line });
            }
        }
    }
    annual
}

#[cfg(test)]
mod tests;
