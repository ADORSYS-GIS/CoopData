use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use validator::Validate;

use crate::entities::{privacy_requests, user_consents};

#[derive(Debug, Serialize, Deserialize, ToSchema, Validate)]
pub struct RecordConsentRequest {
    #[validate(length(min = 1, max = 50))]
    pub document_type: String,
    #[validate(length(min = 1, max = 20))]
    pub document_version: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UserConsentResponse {
    pub id: Uuid,
    pub user_id: String,
    pub document_type: String,
    pub document_version: String,
    pub accepted_at: DateTime<Utc>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl From<user_consents::Model> for UserConsentResponse {
    fn from(m: user_consents::Model) -> Self {
        Self {
            id: m.id,
            user_id: m.user_id,
            document_type: m.document_type,
            document_version: m.document_version,
            accepted_at: m.accepted_at,
            ip_address: m.ip_address,
            user_agent: m.user_agent,
            created_at: m.created_at,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ConsentStatusResponse {
    pub terms_accepted: bool,
    pub terms_version: String,
    pub privacy_accepted: bool,
    pub privacy_version: String,
    pub has_accepted_all_required: bool,
    pub accepted_consents: Vec<UserConsentResponse>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema, Validate)]
pub struct PrivacyRequestInput {
    #[validate(length(min = 1, max = 50))]
    pub request_type: String,
    pub details: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PrivacyRequestResponse {
    pub id: Uuid,
    pub user_id: String,
    pub request_type: String,
    pub status: String,
    pub details: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl From<privacy_requests::Model> for PrivacyRequestResponse {
    fn from(m: privacy_requests::Model) -> Self {
        Self {
            id: m.id,
            user_id: m.user_id,
            request_type: m.request_type,
            status: m.status,
            details: m.details,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}
