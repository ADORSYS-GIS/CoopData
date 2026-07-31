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
    #[serde(default = "default_submission_method")]
    pub submission_method: String,
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
