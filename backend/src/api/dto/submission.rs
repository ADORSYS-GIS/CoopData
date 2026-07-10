use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::entities::submission::Model as SubmissionModel;
use crate::entities::submission_section::Model as SectionModel;

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateSubmissionRequest {
    pub reporting_year: i32,
    #[serde(default = "default_priority")]
    pub priority: String,
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

#[derive(Debug, Serialize, ToSchema)]
pub struct SubmissionResponse {
    pub id: Uuid,
    pub reference: Option<String>,
    pub cooperative_id: Uuid,
    pub reporting_year: i32,
    pub status: String,
    pub current_tier: String,
    pub submitted_by: Option<Uuid>,
    pub submitted_at: Option<DateTime<Utc>>,
    pub priority: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// Financial statement ID, present after upload
    pub financial_statement_id: Option<Uuid>,
    /// Extraction job ID, present after upload
    pub extraction_job_id: Option<Uuid>,
    /// Per-section readiness statuses
    pub sections: Vec<SubmissionSectionResponse>,
}

impl From<SubmissionModel> for SubmissionResponse {
    fn from(m: SubmissionModel) -> Self {
        Self {
            id: m.id,
            reference: m.reference,
            cooperative_id: m.cooperative_id,
            reporting_year: m.reporting_year,
            status: m.status.as_str().to_string(),
            current_tier: m.current_tier.as_str().to_string(),
            submitted_by: m.submitted_by,
            submitted_at: m.submitted_at,
            priority: m.priority,
            created_at: m.created_at,
            updated_at: m.updated_at,
            financial_statement_id: None,
            extraction_job_id: None,
            sections: Vec::new(),
        }
    }
}

impl SubmissionResponse {
    pub fn with_fs(mut self, fs_id: Option<Uuid>, job_id: Option<Uuid>) -> Self {
        self.financial_statement_id = fs_id;
        self.extraction_job_id = job_id;
        self
    }

    pub fn with_sections(mut self, sections: Vec<SubmissionSectionResponse>) -> Self {
        self.sections = sections;
        self
    }
}
