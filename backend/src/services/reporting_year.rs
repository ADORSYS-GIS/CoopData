//! Which reporting years count. A year counts once every period of its
//! frequency is approved; until then none of its figures are used. The order in
//! which periods are filed and the fiscal start month do not matter.

use std::collections::BTreeMap;

use uuid::Uuid;

use crate::entities::enums::{PeriodType, SubmissionStatus};
use crate::entities::submission;
use crate::services::period_rules::FULL_YEAR;
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

#[cfg(test)]
mod tests;
