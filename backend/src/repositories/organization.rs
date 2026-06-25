use crate::entities::organization;
use crate::error::AppResult;
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use uuid::Uuid;

pub struct OrganizationRepository {
    db: DatabaseConnection,
}

impl OrganizationRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<organization::Model>> {
        organization::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_all(&self) -> AppResult<Vec<organization::Model>> {
        organization::Entity::find()
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_active(&self) -> AppResult<Vec<organization::Model>> {
        organization::Entity::find()
            .filter(organization::Column::IsActive.eq(true))
            .all(&self.db)
            .await
            .map_err(Into::into)
    }
}
