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
            action: sea_orm::Set(action.to_string()),
            resource_type: sea_orm::Set(resource_type.to_string()),
            resource_keycloak_id: sea_orm::Set(resource_keycloak_id.map(|s| s.to_string())),
            details: sea_orm::Set(details),
            ip_address: sea_orm::Set(ip_address.map(|s| s.to_string())),
            user_agent: sea_orm::Set(user_agent.map(|s| s.to_string())),
            created_at: sea_orm::Set(chrono::Utc::now()),
        };

        self.repo.create(model).await
    }
}
