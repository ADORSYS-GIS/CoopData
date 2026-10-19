use uuid::Uuid;

use crate::entities::enums::{PeriodType, SubmissionStatus};
use crate::entities::submission;
use crate::services::period_series::{period_index, period_label};

const MONTH_NAMES: [&str; 12] = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/// A monthly submission that covers the whole year in one return.
pub const FULL_YEAR: &str = "FULL_YEAR";

fn is_full_year(period_type: PeriodType, value: &str) -> bool {
    period_type == PeriodType::Monthly && value.trim().eq_ignore_ascii_case(FULL_YEAR)
}

/// The months a period covers, in the order of its fiscal year (month 0 is the
/// single column of a yearly return). `None` for a value invalid for the type.
pub fn period_months(
    period_type: PeriodType,
    value: &str,
    fiscal_start_month: i32,
) -> Option<Vec<i16>> {
    let start = if (1..=12).contains(&fiscal_start_month) {
        fiscal_start_month
    } else {
        1
    };
    let sequence: Vec<i16> = (0..12)
        .map(|offset| (((start - 1 + offset) % 12) + 1) as i16)
        .collect();
    if is_full_year(period_type, value) {
        return Some(sequence);
    }
    let index = period_index(period_type, value)? as usize;
    match period_type {
        PeriodType::Yearly => Some(vec![0]),
        PeriodType::Monthly => Some(vec![index as i16]),
        PeriodType::Quarterly => Some(sequence[(index - 1) * 3..index * 3].to_vec()),
        PeriodType::SemiAnnual => Some(sequence[(index - 1) * 6..index * 6].to_vec()),
    }
}

fn same_period(period_type: PeriodType, stored: &str, candidate: &str) -> bool {
    match period_type {
        PeriodType::Yearly => true,
        _ if is_full_year(period_type, stored) || is_full_year(period_type, candidate) => {
            is_full_year(period_type, stored) && is_full_year(period_type, candidate)
        }
        _ => {
            period_index(period_type, stored).is_some()
                && period_index(period_type, stored) == period_index(period_type, candidate)
        }
    }
}

fn submission_period_label(submission: &submission::Model) -> String {
    if is_full_year(submission.period_type, &submission.period_value) {
        return format!("the full year {}", submission.reporting_year);
    }
    period_label(
        submission.period_type,
        submission.reporting_year,
        &submission.period_value,
    )
}

/// A statement saved on a submission must keep the period chosen when the
/// submission was created and only hold that period's months.
pub fn check_statement_period(
    submission: &submission::Model,
    period_type: Option<PeriodType>,
    period_value: Option<&str>,
    months: &[i16],
) -> Result<(), String> {
    let label = submission_period_label(submission);
    let changes_type = period_type.is_some_and(|candidate| candidate != submission.period_type);
    let changes_value = period_value.is_some_and(|candidate| {
        !same_period(submission.period_type, &submission.period_value, candidate)
    });
    if changes_type || changes_value {
        return Err(format!(
            "This submission is for {label}. Its reporting period is fixed when it is created; create a new submission to report another period."
        ));
    }

    let Some(allowed) = period_months(
        submission.period_type,
        &submission.period_value,
        submission.fiscal_start_month,
    ) else {
        return Ok(());
    };
    let mut outside: Vec<i16> = months
        .iter()
        .copied()
        .filter(|month| !allowed.contains(month))
        .collect();
    outside.sort_unstable();
    outside.dedup();
    if outside.is_empty() {
        return Ok(());
    }
    let names: Vec<&str> = outside
        .iter()
        .map(|month| match month {
            1..=12 => MONTH_NAMES[(*month - 1) as usize],
            _ => "the annual column",
        })
        .collect();
    Err(format!(
        "This submission is for {label}; it cannot hold figures for {}.",
        names.join(", ")
    ))
}

/// A "Full 12 Mo" monthly return already covers every month of the year, so it
/// cannot sit next to single-month returns of the same year.
pub fn check_period_overlap(
    existing: &[submission::Model],
    period_type: PeriodType,
    period_value: &str,
    ignore_id: Option<Uuid>,
) -> Result<(), String> {
    if period_type != PeriodType::Monthly {
        return Ok(());
    }
    let candidate_full = is_full_year(period_type, period_value);
    let conflict = existing.iter().find(|s| {
        Some(s.id) != ignore_id
            && s.period_type == PeriodType::Monthly
            && (candidate_full || is_full_year(s.period_type, &s.period_value))
    });
    match conflict {
        None => Ok(()),
        Some(s) if is_full_year(s.period_type, &s.period_value) => Err(format!(
            "This cooperative already has a full-year monthly return for {}, which covers every month.",
            s.reporting_year
        )),
        Some(s) => Err(format!(
            "This cooperative already has single-month returns for {}; a full-year return would cover them twice.",
            s.reporting_year
        )),
    }
}

pub fn check_frequency(
    existing: &[submission::Model],
    candidate: PeriodType,
    ignore_id: Option<Uuid>,
) -> Result<(), String> {
    let conflict = existing
        .iter()
        .filter(|s| Some(s.id) != ignore_id)
        .find(|s| s.period_type != candidate);

    match conflict {
        None => Ok(()),
        Some(s) if s.status == SubmissionStatus::Draft => Err(format!(
            "This cooperative already has a {} draft for {}. Delete your draft submissions for that year to change the reporting frequency.",
            s.period_type.as_str(),
            s.reporting_year
        )),
        Some(s) => Err(format!(
            "This cooperative already reports {} for {}. Only one reporting frequency is allowed per year.",
            s.period_type.as_str(),
            s.reporting_year
        )),
    }
}

pub fn locked_method(existing: &[submission::Model]) -> Option<String> {
    existing
        .iter()
        .filter(|s| s.status != SubmissionStatus::Draft)
        .max_by_key(|s| s.created_at)
        .or_else(|| existing.iter().max_by_key(|s| s.created_at))
        .map(|s| s.submission_method.clone())
}

/// The submission method a cooperative's type forces, if any. Multipurpose
/// cooperatives always report through the questionnaire; SACCO cooperatives
/// choose between upload and manual (see `check_method_allowed_for_type`).
pub fn forced_method_for_type(institution_type: Option<&str>) -> Option<&'static str> {
    match institution_type {
        Some("multipurpose") => Some("questionnaire"),
        _ => None,
    }
}

/// Rejects a submission method that a cooperative's type does not allow.
/// SACCO cooperatives report through upload or manual entry, never the
/// questionnaire; multipurpose cooperatives are forced to the questionnaire
/// by `forced_method_for_type` before this ever runs. Cooperatives with no
/// recognised type keep the pre-existing, unrestricted behaviour.
pub fn check_method_allowed_for_type(
    institution_type: Option<&str>,
    method: &str,
) -> Result<(), String> {
    match institution_type {
        Some("sacco") if method == "questionnaire" => Err(
            "SACCO cooperatives report through upload or manual entry; the questionnaire method is only available to multipurpose cooperatives.".to_string(),
        ),
        Some("multipurpose") if method != "questionnaire" => Err(
            "Multipurpose cooperatives report through the questionnaire; upload and manual entry are only available to SACCO cooperatives.".to_string(),
        ),
        _ => Ok(()),
    }
}

pub fn check_method(
    existing: &[submission::Model],
    candidate: &str,
    ignore_id: Option<Uuid>,
) -> Result<(), String> {
    let conflict = existing
        .iter()
        .filter(|s| Some(s.id) != ignore_id && s.status != SubmissionStatus::Draft)
        .find(|s| s.submission_method != candidate);

    match conflict {
        None => Ok(()),
        Some(s) => Err(format!(
            "This cooperative already submitted {} using the '{}' method. Only one submission method is allowed per year.",
            s.reporting_year, s.submission_method
        )),
    }
}

#[cfg(test)]
mod tests;
