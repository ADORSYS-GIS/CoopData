use crate::entities::organization_label;
use crate::error::{AppError, AppResult};
use sea_orm::{ActiveModelTrait, DatabaseConnection, EntityTrait, Set};

#[derive(Clone)]
pub struct OrganizationLabelRepository {
    db: DatabaseConnection,
}

impl OrganizationLabelRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_key(&self, key: &str) -> AppResult<Option<organization_label::Model>> {
        organization_label::Entity::find_by_id(key.to_string())
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_all(&self) -> AppResult<Vec<organization_label::Model>> {
        organization_label::Entity::find()
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn update(
        &self,
        key: &str,
        update: crate::api::dto::UpdateOrganizationLabelRequest,
    ) -> AppResult<organization_label::Model> {
        let existing = self
            .find_by_key(key)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Organization label {} not found", key)))?;

        let mut active: organization_label::ActiveModel = existing.into();

        active.label = Set(update.label);
        active.short_label = Set(update.short_label);
        active.plural_label = Set(update.plural_label);
        active.description = Set(update.description);
        active.icon = Set(update.icon);
        active.translations = Set(update.translations);
        active.updated_at = Set(chrono::Utc::now().into());

        active
            .update(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }
}
