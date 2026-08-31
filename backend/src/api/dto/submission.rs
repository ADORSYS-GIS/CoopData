use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::entities::enums::PeriodType;
use crate::entities::submission::Model as SubmissionModel;
use crate::entities::submission_section::Model as SectionModel;

/// Shared period resolution and validation logic used by all submission
/// creation request types. Extracted here to avoid duplication.
pub fn resolve_period(period_type: Option<&str>, period_value: Option<&str>, reporting_year: i32) -> (PeriodType, String) {
    let pt = period_type
        .and_then(PeriodType::parse)
        .unwrap_or(PeriodType::Yearly);
    let pv = match period_value {
        Some(v) if !v.trim().is_empty() => v.trim().to_string(),
        _ => reporting_year.to_string(),
    };
    (pt, pv)
}

pub fn validate_period(period_type: Option<&str>, period_value: Option<&str>, reporting_year: i32) -> Result<(), String> {
    let (pt, pv) = resolve_period(period_type, period_value, reporting_year);
    match pt {
        PeriodType::Yearly => Ok(()),
        PeriodType::Quarterly => {
            if matches!(pv.to_uppercase().as_str(), "Q1" | "Q2" | "Q3" | "Q4") {
                Ok(())
            } else {
                Err("Invalid period_value for QUARTERLY. Must be one of Q1, Q2, Q3, Q4.".into())
            }
        }
        PeriodType::Monthly => {
            if matches!(
                pv.as_str(),
                "01" | "02" | "03" | "04" | "05" | "06" | "07" | "08" | "09"
                    | "10" | "11" | "12" | "1" | "2" | "3" | "4" | "5" | "6"
                    | "7" | "8" | "9" | "FULL_YEAR" | "1-12"
            ) {
                Ok(())
            } else {
                Err("Invalid period_value for MONTHLY. Must be a month (01-12) or 1-12.".into())
            }
        }
        PeriodType::SemiAnnual => {
            if matches!(pv.to_uppercase().as_str(), "H1" | "H2") {
                Ok(())
            } else {
                Err("Invalid period_value for SEMI_ANNUAL. Must be H1 or H2.".into())
            }
        }
    }
}

pub trait SubmissionPeriodRequest {
    fn period_type(&self) -> Option<&str>;
    fn period_value(&self) -> Option<&str>;
    fn reporting_year(&self) -> i32;

    fn resolved_period(&self) -> (PeriodType, String) {
        resolve_period(self.period_type(), self.period_value(), self.reporting_year())
    }

    fn validate_period(&self) -> Result<(), String> {
        validate_period(self.period_type(), self.period_value(), self.reporting_year())
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateSubmissionRequest {
    pub id: Option<Uuid>,
    pub reporting_year: i32,
    #[serde(default)]
    pub period_type: Option<String>,
    #[serde(default)]
    pub period_value: Option<String>,
    #[serde(default = "default_priority")]
    pub priority: String,
    #[serde(default = "default_submission_method")]
    pub submission_method: String,
}

impl SubmissionPeriodRequest for CreateSubmissionRequest {
    fn period_type(&self) -> Option<&str> {
        self.period_type.as_deref()
    }

    fn period_value(&self) -> Option<&str> {
        self.period_value.as_deref()
    }

    fn reporting_year(&self) -> i32 {
        self.reporting_year
    }
}

fn default_submission_method() -> String {
    "manual_grid".to_string()
}

fn default_priority() -> String {
    "Routine".to_string()
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SubmissionSectionResponse {
    pub id: Uuid,
    pub submission_id: Uuid,
    pub section: String,
    pub status: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<SectionModel> for SubmissionSectionResponse {
    fn from(m: SectionModel) -> Self {
        Self {
            id: m.id,
            submission_id: m.submission_id,
            section: m.section,
            status: m.status,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateSectionStatusRequest {
    pub status: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateSubmissionMethodRequest {
    /// One of "upload", "manual", "questionnaire"
    pub submission_method: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SubmissionResponse {
    pub id: Uuid,
    pub reference: Option<String>,
    pub cooperative_id: Uuid,
    pub reporting_year: i32,
    pub period_type: String,
    pub period_value: String,
    pub status: String,
    pub current_tier: String,
    pub submitted_by: Option<Uuid>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub priority: String,
    pub submission_method: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// Financial statement ID, present after upload
    pub financial_statement_id: Option<Uuid>,
    /// Extraction job ID, present after upload
    pub extraction_job_id: Option<Uuid>,
    /// Uploaded file ID, present after upload
    pub file_id: Option<Uuid>,
    /// Per-section readiness statuses
    pub sections: Vec<SubmissionSectionResponse>,
    /// Cooperative display name (populated by list handlers for apex/federation/ministry)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cooperative_name: Option<String>,
    /// Apex display name (populated by list handlers for federation/ministry)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub apex_name: Option<String>,
    /// Federation display name (populated by list handlers for ministry)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub federation_name: Option<String>,
    /// Apex ID (populated for hierarchical filtering)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub apex_id: Option<Uuid>,
    /// Federation ID (populated for hierarchical filtering)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub federation_id: Option<Uuid>,
    /// Who created this submission: cooperative or apex
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by_role: Option<String>,
    /// UUID of the user who created this submission
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by_user_id: Option<Uuid>,
    /// Display name of the creator
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by_name: Option<String>,
    /// UUID of the user who currently owns the draft (exclusive editing)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edited_by: Option<Uuid>,
    /// Display name of the current editor
    #[serde(skip_serializing_if = "Option::is_none")]
    pub edited_by_name: Option<String>,
}

impl From<SubmissionModel> for SubmissionResponse {
    fn from(m: SubmissionModel) -> Self {
        Self {
            id: m.id,
            reference: m.reference,
            cooperative_id: m.cooperative_id,
            reporting_year: m.reporting_year,
            period_type: m.period_type.as_str().to_string(),
            period_value: m.period_value,
            status: m.status.as_str().to_string(),
            current_tier: m.current_tier.as_str().to_string(),
            submitted_by: m.submitted_by,
            submitted_at: m.submitted_at,
            priority: m.priority,
            submission_method: m.submission_method,
            created_at: m.created_at,
            updated_at: m.updated_at,
            financial_statement_id: None,
            extraction_job_id: None,
            file_id: None,
            sections: Vec::new(),
            cooperative_name: None,
            apex_name: None,
            federation_name: None,
            apex_id: None,
            federation_id: None,
            created_by_role: Some(m.created_by_role.as_str().to_string()),
            created_by_user_id: m.created_by_user_id,
            created_by_name: m.created_by_name,
            edited_by: m.edited_by,
            edited_by_name: m.edited_by_name,
        }
    }
}

impl SubmissionResponse {
    pub fn with_fs(
        mut self,
        fs_id: Option<Uuid>,
        job_id: Option<Uuid>,
        file_id: Option<Uuid>,
    ) -> Self {
        self.financial_statement_id = fs_id;
        self.extraction_job_id = job_id;
        self.file_id = file_id;
        self
    }

    pub fn with_sections(mut self, sections: Vec<SubmissionSectionResponse>) -> Self {
        self.sections = sections;
        self
    }

    pub fn with_cooperative_name(mut self, name: Option<String>) -> Self {
        self.cooperative_name = name;
        self
    }

    pub fn with_apex_name(mut self, name: Option<String>) -> Self {
        self.apex_name = name;
        self
    }

    pub fn with_federation_name(mut self, name: Option<String>) -> Self {
        self.federation_name = name;
        self
    }

    pub fn with_apex_id(mut self, id: Option<Uuid>) -> Self {
        self.apex_id = id;
        self
    }

    pub fn with_federation_id(mut self, id: Option<Uuid>) -> Self {
        self.federation_id = id;
        self
    }

    pub fn with_created_by_name(mut self, name: Option<String>) -> Self {
        self.created_by_name = name;
        self
    }

    pub fn with_edited_by(mut self, user_id: Option<Uuid>, name: Option<String>) -> Self {
        self.edited_by = user_id;
        self.edited_by_name = name;
        self
    }
}

#[derive(Debug, Serialize, ToSchema)]
pub struct CooperativeStatsResponse {
    pub total_submissions: u64,
    pub draft_submissions: u64,
    pub pending_submissions: u64,
    pub approved_submissions: u64,
    pub rejected_submissions: u64,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct SubmissionReviewResponse {
    pub id: Uuid,
    pub submission_id: Uuid,
    pub tier: String,
    pub reviewer_id: Option<Uuid>,
    pub action: String,
    pub comment: Option<String>,
    pub target_tier: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl From<crate::entities::submission_review::Model> for SubmissionReviewResponse {
    fn from(m: crate::entities::submission_review::Model) -> Self {
        Self {
            id: m.id,
            submission_id: m.submission_id,
            tier: m.tier.as_str().to_string(),
            reviewer_id: m.reviewer_id,
            action: m.action.as_str().to_string(),
            comment: m.comment,
            target_tier: m.target_tier.map(|t| t.as_str().to_string()),
            created_at: m.created_at,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PortfolioCategoryDto {
    pub category: String,
    pub balance: f64,
    pub count: i64,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PortfolioBreakdownResponse {
    pub submission_id: Uuid,
    pub categories: Vec<PortfolioCategoryDto>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MembershipStatsResponse {
    pub submission_id: Uuid,
    pub male_members: i64,
    pub female_members: i64,
    pub youth_members: i64,
    pub active_members: i64,
    pub inactive_members: i64,
    pub agm_attendance: i64,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateApexSubmissionRequest {
    pub cooperative_id: Uuid,
    pub reporting_year: i32,
    #[serde(default)]
    pub period_type: Option<String>,
    #[serde(default)]
    pub period_value: Option<String>,
    #[serde(default = "default_priority")]
    pub priority: String,
    #[serde(default = "default_submission_method")]
    pub submission_method: String,
}

impl SubmissionPeriodRequest for CreateApexSubmissionRequest {
    fn period_type(&self) -> Option<&str> {
        self.period_type.as_deref()
    }

    fn period_value(&self) -> Option<&str> {
        self.period_value.as_deref()
    }

    fn reporting_year(&self) -> i32 {
        self.reporting_year
    }
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct DelegateSubmissionRequest {
    pub comment: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct ReclaimSubmissionRequest {
    pub comment: Option<String>,
}

#[cfg(test)]
mod period_validation_tests {
    use super::validate_period;

    // --- Yearly ---
    #[test]
    fn yearly_any_value_is_valid() {
        assert!(validate_period(Some("YEARLY"), Some("2024"), 2024).is_ok());
        assert!(validate_period(Some("YEARLY"), None, 2024).is_ok());
        assert!(validate_period(None, None, 2024).is_ok()); // defaults to Yearly
    }

    // --- Quarterly ---
    #[test]
    fn quarterly_valid_values() {
        for v in &["Q1", "Q2", "Q3", "Q4", "q1", "q4"] {
            assert!(
                validate_period(Some("QUARTERLY"), Some(v), 2024).is_ok(),
                "Expected {v} to be valid for QUARTERLY"
            );
        }
    }

    #[test]
    fn quarterly_invalid_values() {
        for v in &["Q5", "Q0", "H1", "01", "2024", "quarter1", ""] {
            assert!(
                validate_period(Some("QUARTERLY"), Some(v), 2024).is_err(),
                "Expected {v} to be invalid for QUARTERLY"
            );
        }
    }

    // --- Monthly ---
    #[test]
    fn monthly_valid_values() {
        let valid = [
            "1", "2", "3", "4", "5", "6", "7", "8", "9",
            "01", "02", "03", "04", "05", "06", "07", "08", "09",
            "10", "11", "12", "FULL_YEAR", "1-12",
        ];
        for v in &valid {
            assert!(
                validate_period(Some("MONTHLY"), Some(v), 2024).is_ok(),
                "Expected {v} to be valid for MONTHLY"
            );
        }
    }

    #[test]
    fn monthly_invalid_values() {
        for v in &["13", "00", "Q1", "H1", "january", "month1", ""] {
            assert!(
                validate_period(Some("MONTHLY"), Some(v), 2024).is_err(),
                "Expected {v} to be invalid for MONTHLY"
            );
        }
    }

    // --- Semi-Annual ---
    #[test]
    fn semi_annual_valid_values() {
        for v in &["H1", "H2", "h1", "h2"] {
            assert!(
                validate_period(Some("SEMI_ANNUAL"), Some(v), 2024).is_ok(),
                "Expected {v} to be valid for SEMI_ANNUAL"
            );
        }
    }

    #[test]
    fn semi_annual_invalid_values() {
        for v in &["H3", "H0", "Q1", "01", "half1", ""] {
            assert!(
                validate_period(Some("SEMI_ANNUAL"), Some(v), 2024).is_err(),
                "Expected {v} to be invalid for SEMI_ANNUAL"
            );
        }
    }

    // --- Case insensitivity for period_type parsing ---
    #[test]
    fn period_type_case_insensitive() {
        assert!(validate_period(Some("quarterly"), Some("Q1"), 2024).is_ok());
        assert!(validate_period(Some("semiannual"), Some("H1"), 2024).is_ok());
        assert!(validate_period(Some("monthly"), Some("06"), 2024).is_ok());
    }
}
