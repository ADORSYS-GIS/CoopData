use chrono::{DateTime, Utc};
use serde::Serialize;
use utoipa::ToSchema;

use crate::services::report_jobs::{LanguageStatus, ReportState, ReportTarget};

/// Status of one language of a report.
#[derive(Debug, Serialize, ToSchema)]
pub struct ReportLanguageStatus {
    /// Report locale: en | fr | pt | ss
    pub lang: String,
    pub state: ReportState,
    pub updated_at: DateTime<Utc>,
}

/// What a report can be downloaded in right now and what is being prepared.
/// A language missing from `languages` has not been prepared yet.
#[derive(Debug, Serialize, ToSchema)]
pub struct ReportStatusResponse {
    pub languages: Vec<ReportLanguageStatus>,
    /// Languages this report can be prepared in (questionnaire reports: English only).
    pub available_languages: Vec<String>,
}

impl ReportStatusResponse {
    pub fn new(target: ReportTarget, statuses: Vec<LanguageStatus>) -> Self {
        Self {
            languages: statuses
                .into_iter()
                .map(|s| ReportLanguageStatus {
                    lang: s.lang,
                    state: s.state,
                    updated_at: s.updated_at,
                })
                .collect(),
            available_languages: target
                .languages()
                .iter()
                .map(|l| (*l).to_string())
                .collect(),
        }
    }
}
