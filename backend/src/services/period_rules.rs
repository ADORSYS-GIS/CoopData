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
