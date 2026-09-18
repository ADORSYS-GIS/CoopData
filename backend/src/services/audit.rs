use crate::api::middleware::AuditContext;
use crate::auth::claims::Claims;
use crate::entities::audit_log;
use crate::error::AppResult;
use crate::repositories::audit_log::AuditLogRepository;
use crate::repositories::user::UserRepository;

#[derive(Clone)]
pub struct AuditService {
    repo: AuditLogRepository,
    user_repo: UserRepository,
}

impl AuditService {
    pub fn new(repo: AuditLogRepository, user_repo: UserRepository) -> Self {
        Self { repo, user_repo }
    }

    pub fn repo(&self) -> &AuditLogRepository {
        &self.repo
    }

    #[allow(clippy::too_many_arguments)]
    pub async fn log(
        &self,
        claims: &Claims,
        action: &str,
        resource_type: &str,
        resource_keycloak_id: Option<&str>,
        details: Option<serde_json::Value>,
        ip_address: Option<&str>,
        user_agent: Option<&str>,
    ) -> AppResult<audit_log::Model> {
        let actor_id = self
            .user_repo
            .find_by_keycloak_id(&claims.sub)
            .await
            .ok()
            .flatten()
            .map(|u| u.id);

        let model = audit_log::ActiveModel {
            id: sea_orm::Set(uuid::Uuid::new_v4()),
            actor_keycloak_id: sea_orm::Set(claims.sub.clone()),
            actor_id: sea_orm::Set(actor_id),
            action: sea_orm::Set(action.to_uppercase()),
            resource_type: sea_orm::Set(resource_type.to_string()),
            resource_keycloak_id: sea_orm::Set(resource_keycloak_id.map(|s| s.to_string())),
            details: sea_orm::Set(details),
            ip_address: sea_orm::Set(ip_address.map(|s| s.to_string())),
            user_agent: sea_orm::Set(user_agent.map(|s| s.to_string())),
            created_at: sea_orm::Set(chrono::Utc::now()),
        };

        self.repo.create(model).await
    }

    /// Convenience method that takes AuditContext directly instead of separate IP/user-agent.
    pub async fn log_with_context(
        &self,
        audit_ctx: &AuditContext,
        claims: &Claims,
        action: &str,
        resource_type: &str,
        resource_keycloak_id: Option<&str>,
        details: Option<serde_json::Value>,
    ) -> AppResult<audit_log::Model> {
        self.log(
            claims,
            action,
            resource_type,
            resource_keycloak_id,
            details,
            audit_ctx.ip_address.as_deref(),
            audit_ctx.user_agent.as_deref(),
        )
        .await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::Database;
    use sea_orm::{DatabaseBackend, MockDatabase};

    fn test_claims() -> Claims {
        Claims {
            sub: "mock-user-123".into(),
            exp: 9999999999,
            iat: 0,
            iss: "test-issuer".into(),
            aud: None,
            email: None,
            email_verified: None,
            name: None,
            preferred_username: None,
            realm_access: None,
            resource_access: None,
            organization: None,
            cooperation: None,
            assigned_dimensions: None,
        }
    }

    fn audit_row(action: &str, resource_type: &str) -> audit_log::Model {
        audit_log::Model {
            id: uuid::Uuid::new_v4(),
            actor_keycloak_id: "mock-user-123".into(),
            actor_id: None,
            action: action.to_string(),
            resource_type: resource_type.to_string(),
            resource_keycloak_id: None,
            details: None,
            ip_address: None,
            user_agent: None,
            created_at: chrono::Utc::now(),
        }
    }

    /// Mock DB with the two pops `AuditService::log` makes:
    /// 1. user lookup SELECT (no match) → 2. INSERT…RETURNING row.
    fn mock_db(returned: audit_log::Model) -> Database {
        let mock = MockDatabase::new(DatabaseBackend::Postgres)
            .append_query_results(vec![Vec::<audit_log::Model>::new()])
            .append_query_results(vec![vec![returned]]);
        Database::new(mock.into_connection())
    }

    #[tokio::test]
    async fn test_audit_service_log() {
        let returned = audit_row("TEST_ACTION", "test_resource");
        let db = mock_db(returned);
        let service = AuditService::new(
            AuditLogRepository::new(db.clone()),
            UserRepository::new(db.clone()),
        );

        let claims = test_claims();

        let result = service
            .log(
                &claims,
                "TEST_ACTION",
                "test_resource",
                Some("resource-123"),
                None,
                Some("127.0.0.1"),
                Some("test-agent"),
            )
            .await;

        assert!(result.is_ok());
        let log = result.unwrap();
        assert_eq!(log.action, "TEST_ACTION");
        assert_eq!(log.resource_type, "test_resource");
        assert_eq!(log.actor_keycloak_id, "mock-user-123");
    }

    #[tokio::test]
    async fn test_audit_service_log_with_context() {
        let returned = audit_row("TEST_CTX", "ctx_resource");
        let db = mock_db(returned);
        let service = AuditService::new(
            AuditLogRepository::new(db.clone()),
            UserRepository::new(db.clone()),
        );

        let claims = test_claims();

        let ctx = AuditContext {
            ip_address: Some("192.168.1.1".into()),
            user_agent: Some("curl/7.68.0".into()),
        };

        let result = service
            .log_with_context(
                &ctx,
                &claims,
                "TEST_CTX",
                "ctx_resource",
                None,
                Some(serde_json::json!({"key": "value"})),
            )
            .await;

        assert!(result.is_ok());
        let log = result.unwrap();
        assert_eq!(log.action, "TEST_CTX");
        assert_eq!(log.resource_type, "ctx_resource");
    }
}
