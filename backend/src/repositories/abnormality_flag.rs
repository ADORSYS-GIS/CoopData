use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use uuid::Uuid;

use crate::entities::abnormality_flag::{self, ActiveModel, Column, Entity};
use crate::error::AppResult;

#[derive(Clone)]
pub struct AbnormalityFlagRepository {
    db: DatabaseConnection,
}

impl AbnormalityFlagRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_submission(
        &self,
        submission_id: Uuid,
    ) -> AppResult<Vec<abnormality_flag::Model>> {
        Entity::find()
            .filter(Column::SubmissionId.eq(submission_id))
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_errors_by_submission(
        &self,
        submission_id: Uuid,
    ) -> AppResult<Vec<abnormality_flag::Model>> {
        Entity::find()
            .filter(Column::SubmissionId.eq(submission_id))
            .filter(Column::Severity.eq("error"))
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn delete_by_submission(&self, submission_id: Uuid) -> AppResult<()> {
        Entity::delete_many()
            .filter(Column::SubmissionId.eq(submission_id))
            .exec(&self.db)
            .await
            .map_err(crate::error::AppError::from)?;
        Ok(())
    }

    pub async fn create(&self, model: ActiveModel) -> AppResult<abnormality_flag::Model> {
        model.insert(&self.db).await.map_err(Into::into)
    }

    pub async fn bulk_create(&self, models: Vec<ActiveModel>) -> AppResult<()> {
        if models.is_empty() {
            return Ok(());
        }
        for m in models {
            m.insert(&self.db)
                .await
                .map_err(crate::error::AppError::from)?;
        }
        Ok(())
    }
}
