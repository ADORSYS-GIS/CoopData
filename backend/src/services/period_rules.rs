use uuid::Uuid;

use crate::entities::enums::{PeriodType, SubmissionStatus};
use crate::entities::submission;

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
