use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::entities::audit_log;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct AuditLogResponse {
    pub id: Uuid,
    pub actor_keycloak_id: String,
    pub actor_id: Option<Uuid>,
    pub action: String,
    pub resource_type: String,
    pub resource_keycloak_id: Option<String>,
    pub details: Option<serde_json::Value>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
}

impl From<audit_log::Model> for AuditLogResponse {
    fn from(m: audit_log::Model) -> Self {
        Self {
            id: m.id,
            actor_keycloak_id: m.actor_keycloak_id,
            actor_id: m.actor_id,
            action: m.action,
            resource_type: m.resource_type,
            resource_keycloak_id: m.resource_keycloak_id,
            details: m.details,
            ip_address: m.ip_address,
            user_agent: m.user_agent,
            created_at: m.created_at,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PaginatedAuditLogResponse {
    pub data: Vec<AuditLogResponse>,
    pub total: u64,
    pub page: u64,
    pub per_page: u64,
    pub total_pages: u64,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct AuditLogFilterParams {
    pub action: Option<String>,
    pub resource_type: Option<String>,
    pub actor_keycloak_id: Option<String>,
    pub resource_keycloak_id: Option<String>,
    pub date_from: Option<String>,
    pub date_to: Option<String>,
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_per_page")]
    pub per_page: u64,
}

fn default_page() -> u64 {
    1
}

fn default_per_page() -> u64 {
    20
}
