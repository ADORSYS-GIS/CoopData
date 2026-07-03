use crate::entities::{audit_log, AuditLogColumn};
use crate::error::{AppError, AppResult};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter,
    QueryOrder, QuerySelect,
};

#[derive(Clone)]
pub struct AuditLogRepository {
    db: DatabaseConnection,
}

impl AuditLogRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn create(&self, model: audit_log::ActiveModel) -> AppResult<audit_log::Model> {
        model
            .insert(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_filters(
        &self,
        action: Option<&str>,
        resource_type: Option<&str>,
        actor_keycloak_id: Option<&str>,
        resource_keycloak_id: Option<&str>,
        _date_from: Option<&str>,
        _date_to: Option<&str>,
        page: u64,
        per_page: u64,
    ) -> AppResult<(Vec<audit_log::Model>, u64)> {
        let mut query = audit_log::Entity::find()
            .order_by_desc(AuditLogColumn::CreatedAt);

        if let Some(action) = action {
            query = query.filter(AuditLogColumn::Action.eq(action));
        }
        if let Some(resource_type) = resource_type {
            query = query.filter(AuditLogColumn::ResourceType.eq(resource_type));
        }
        if let Some(actor_keycloak_id) = actor_keycloak_id {
            query = query.filter(AuditLogColumn::ActorKeycloakId.eq(actor_keycloak_id));
        }
        if let Some(resource_keycloak_id) = resource_keycloak_id {
            query = query.filter(AuditLogColumn::ResourceKeycloakId.eq(resource_keycloak_id));
        }

        let total = query
            .clone()
            .count(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;

        let offset = (page.saturating_sub(1)) * per_page;

        let items = query
            .offset(offset)
            .limit(per_page)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;

        Ok((items, total))
    }
}
