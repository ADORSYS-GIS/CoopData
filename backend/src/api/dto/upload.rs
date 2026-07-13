use serde::Serialize;
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Debug, Serialize, ToSchema)]
pub struct UploadResponse {
    pub submission_id: Uuid,
    pub financial_statement_id: Uuid,
    pub extraction_job_id: Uuid,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct AbnormalityFlagResponse {
    pub id: Uuid,
    pub submission_id: Uuid,
    pub rule_id: String,
    pub severity: String,
    pub message: String,
    pub field_ref: Option<String>,
}

impl From<crate::entities::abnormality_flag::Model> for AbnormalityFlagResponse {
    fn from(m: crate::entities::abnormality_flag::Model) -> Self {
        Self {
            id: m.id,
            submission_id: m.submission_id,
            rule_id: m.rule_id,
            severity: m.severity,
            message: m.message,
            field_ref: m.field_ref,
        }
    }
}

#[derive(Debug, serde::Deserialize, ToSchema)]
pub struct ReviewActionRequest {
    pub comment: Option<String>,
}
