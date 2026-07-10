use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use uuid::Uuid;

use crate::entities::enums::{ReviewTier, SubmissionStatus};
use crate::entities::submission::{self, ActiveModel, Column, Entity};
use crate::error::AppResult;

#[derive(Clone)]
pub struct SubmissionRepository {
    db: DatabaseConnection,
}

impl SubmissionRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<submission::Model>> {
        Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_cooperative(
        &self,
        cooperative_id: Uuid,
    ) -> AppResult<Vec<submission::Model>> {
        Entity::find()
            .filter(Column::CooperativeId.eq(cooperative_id))
            .order_by_desc(Column::CreatedAt)
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_status(&self, status: SubmissionStatus) -> AppResult<Vec<submission::Model>> {
        Entity::find()
            .filter(Column::Status.eq(status))
            .order_by_desc(Column::CreatedAt)
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_tier(&self, tier: ReviewTier) -> AppResult<Vec<submission::Model>> {
        Entity::find()
            .filter(Column::CurrentTier.eq(tier))
            .order_by_desc(Column::CreatedAt)
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_cooperative_and_year(
        &self,
        cooperative_id: Uuid,
        reporting_year: i32,
    ) -> AppResult<Option<submission::Model>> {
        Entity::find()
            .filter(Column::CooperativeId.eq(cooperative_id))
            .filter(Column::ReportingYear.eq(reporting_year))
            .one(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn create(&self, model: ActiveModel) -> AppResult<submission::Model> {
        model.insert(&self.db).await.map_err(Into::into)
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<()> {
        Entity::delete_by_id(id)
            .exec(&self.db)
            .await
            .map_err(crate::error::AppError::from)?;
        Ok(())
    }

    pub async fn update_status(
        &self,
        id: Uuid,
        status: SubmissionStatus,
        current_tier: ReviewTier,
    ) -> AppResult<submission::Model> {
        let existing = Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(crate::error::AppError::from)?
            .ok_or_else(|| crate::error::AppError::NotFound("Submission not found".into()))?;

        let mut active: ActiveModel = existing.into();
        active.status = Set(status);
        active.current_tier = Set(current_tier);
        active.updated_at = Set(chrono::Utc::now());
        active.update(&self.db).await.map_err(Into::into)
    }
}
