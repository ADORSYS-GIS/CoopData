use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::entities::extraction_job::Model;

#[derive(Debug, Serialize, ToSchema)]
pub struct ExtractionJobResponse {
    pub id: Uuid,
    pub submission_id: Uuid,
    pub source_file_id: Uuid,
    pub status: String,
    pub engine: Option<String>,
    /// Overall extraction confidence (0.0–1.0)
    pub confidence: Option<f64>,
    pub error_message: Option<String>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
}

impl From<Model> for ExtractionJobResponse {
    fn from(m: Model) -> Self {
        use rust_decimal::prelude::ToPrimitive;
        Self {
            id: m.id,
            submission_id: m.submission_id,
            source_file_id: m.source_file_id,
            status: m.status,
            engine: m.engine,
            confidence: m.confidence.and_then(|d| d.to_f64()),
            error_message: m.error_message,
            started_at: m.started_at,
            completed_at: m.completed_at,
            created_at: m.created_at,
        }
    }
}
