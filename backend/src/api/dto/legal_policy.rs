// src/api/dto/legal_policy.rs
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct LegalPolicyResponse {
    pub id: Uuid,
    pub policy_id: Uuid,
    pub slug: String,
    pub title_en: String,
    pub title_fr: String,
    pub content_en: String,
    pub content_fr: String,
    pub version: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<crate::entities::legal_policy::Model> for LegalPolicyResponse {
    fn from(m: crate::entities::legal_policy::Model) -> Self {
        Self {
            id: m.id,
            policy_id: m.policy_id,
            slug: m.slug,
            title_en: m.title_en,
            title_fr: m.title_fr,
            content_en: m.content_en,
            content_fr: m.content_fr,
            version: m.version,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct LegalPolicyCreateRequest {
    pub slug: String,
    pub title_en: String,
    pub title_fr: String,
    pub content_en: String,
    pub content_fr: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct LegalPolicyUpdateRequest {
    pub title_en: Option<String>,
    pub title_fr: Option<String>,
    pub content_en: Option<String>,
    pub content_fr: Option<String>,
}

