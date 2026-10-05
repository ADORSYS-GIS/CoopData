use crate::database::Database;
use crate::entities::assessment;
use crate::error::AppResult;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
use uuid::Uuid;

pub struct AssessmentRepository {
    db: Database,
}

impl AssessmentRepository {
    pub fn new(db: impl Into<Database>) -> Self {
        Self { db: db.into() }
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<assessment::Model>> {
        assessment::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_organization(
        &self,
        organization_id: Uuid,
    ) -> AppResult<Vec<assessment::Model>> {
        assessment::Entity::find()
            .filter(assessment::Column::OrganizationId.eq(organization_id))
            .all(&self.db)
            .await
            .map_err(Into::into)
    }
}
