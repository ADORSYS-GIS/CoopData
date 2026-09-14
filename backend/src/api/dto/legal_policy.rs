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
    pub title_pt: String,
    pub title_ss: String,
    pub content_en: String,
    pub content_fr: String,
    pub content_pt: String,
    pub content_ss: String,
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
            title_pt: m.title_pt,
            title_ss: m.title_ss,
            content_en: m.content_en,
            content_fr: m.content_fr,
            content_pt: m.content_pt,
            content_ss: m.content_ss,
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
    pub title_pt: String,
    pub title_ss: String,
    pub content_en: String,
    pub content_fr: String,
    pub content_pt: String,
    pub content_ss: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct LegalPolicyUpdateRequest {
    pub title_en: Option<String>,
    pub title_fr: Option<String>,
    pub title_pt: Option<String>,
    pub title_ss: Option<String>,
    pub content_en: Option<String>,
    pub content_fr: Option<String>,
    pub content_pt: Option<String>,
    pub content_ss: Option<String>,
}

