use sea_orm::{DatabaseConnection, EntityTrait, QueryFilter, ColumnTrait};
use uuid::Uuid;
use crate::entities::{assessment};
use crate::error::AppResult;

pub struct AssessmentRepository {
    db: DatabaseConnection,
}

impl AssessmentRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<assessment::Model>> {
        assessment::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_organization(&self, organization_id: Uuid) -> AppResult<Vec<assessment::Model>> {
        assessment::Entity::find()
            .filter(assessment::Column::OrganizationId.eq(organization_id))
            .all(&self.db)
            .await
            .map_err(Into::into)
    }
}