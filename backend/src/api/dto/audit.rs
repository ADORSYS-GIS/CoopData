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

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;
    use uuid::Uuid;

    #[test]
    fn test_audit_log_response_from_model_full() {
        let model = audit_log::Model {
            id: Uuid::new_v4(),
            actor_keycloak_id: "kc-123".to_string(),
            actor_id: Some(Uuid::new_v4()),
            action: "CREATE".to_string(),
            resource_type: "federation".to_string(),
            resource_keycloak_id: Some("kc-fed-1".to_string()),
            details: Some(serde_json::json!({"key": "value"})),
            ip_address: Some("10.0.0.1".to_string()),
            user_agent: Some("test-agent".to_string()),
            created_at: Utc::now(),
        };

        let resp = AuditLogResponse::from(model);
        assert_eq!(resp.action, "CREATE");
        assert_eq!(resp.resource_type, "federation");
        assert_eq!(resp.actor_keycloak_id, "kc-123");
        assert!(resp.actor_id.is_some());
        assert_eq!(resp.resource_keycloak_id.as_deref(), Some("kc-fed-1"));
        assert!(resp.details.is_some());
        assert!(resp.ip_address.is_some());
        assert!(resp.user_agent.is_some());
    }

    #[test]
    fn test_audit_log_response_from_model_nulls() {
        let model = audit_log::Model {
            id: Uuid::new_v4(),
            actor_keycloak_id: "kc-456".to_string(),
            actor_id: None,
            action: "DELETE".to_string(),
            resource_type: "user".to_string(),
            resource_keycloak_id: None,
            details: None,
            ip_address: None,
            user_agent: None,
            created_at: Utc::now(),
        };

        let resp = AuditLogResponse::from(model);
        assert_eq!(resp.action, "DELETE");
        assert!(resp.actor_id.is_none());
        assert!(resp.resource_keycloak_id.is_none());
        assert!(resp.details.is_none());
        assert!(resp.ip_address.is_none());
        assert!(resp.user_agent.is_none());
    }

    #[test]
    fn test_filter_params_defaults() {
        let params: AuditLogFilterParams = serde_json::from_str("{}").unwrap();
        assert_eq!(params.page, 1);
        assert_eq!(params.per_page, 20);
        assert!(params.action.is_none());
        assert!(params.resource_type.is_none());
    }

    #[test]
    fn test_filter_params_custom_values() {
        let params: AuditLogFilterParams =
            serde_json::from_str(r#"{"page":5,"per_page":10,"action":"UPDATE"}"#).unwrap();
        assert_eq!(params.page, 5);
        assert_eq!(params.per_page, 10);
        assert_eq!(params.action.as_deref(), Some("UPDATE"));
    }

    #[test]
    fn test_filter_params_partial_defaults() {
        let params: AuditLogFilterParams = serde_json::from_str(r#"{"action":"DELETE"}"#).unwrap();
        assert_eq!(params.page, 1);
        assert_eq!(params.per_page, 20);
        assert_eq!(params.action.as_deref(), Some("DELETE"));
        assert!(params.resource_type.is_none());
    }

    #[test]
    fn test_paginated_response_serialization() {
        let model = audit_log::Model {
            id: Uuid::new_v4(),
            actor_keycloak_id: "kc-789".to_string(),
            actor_id: None,
            action: "INVITE".to_string(),
            resource_type: "federation".to_string(),
            resource_keycloak_id: Some("kc-fed-2".to_string()),
            details: None,
            ip_address: None,
            user_agent: None,
            created_at: Utc::now(),
        };

        let resp = PaginatedAuditLogResponse {
            data: vec![AuditLogResponse::from(model)],
            total: 1,
            page: 1,
            per_page: 20,
            total_pages: 1,
        };

        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["total"], 1);
        assert_eq!(json["page"], 1);
        assert_eq!(json["per_page"], 20);
        assert_eq!(json["total_pages"], 1);
        assert_eq!(json["data"].as_array().unwrap().len(), 1);
        assert_eq!(json["data"][0]["action"], "INVITE");
    }

    #[test]
    fn test_paginated_response_empty() {
        let resp = PaginatedAuditLogResponse {
            data: vec![],
            total: 0,
            page: 1,
            per_page: 20,
            total_pages: 0,
        };

        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["data"].as_array().unwrap().len(), 0);
        assert_eq!(json["total"], 0);
    }
}
