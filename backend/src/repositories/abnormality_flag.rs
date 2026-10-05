use crate::database::Database;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter};
use uuid::Uuid;

use crate::entities::abnormality_flag::{self, ActiveModel, Column, Entity};
use crate::error::AppResult;

#[derive(Clone)]
pub struct AbnormalityFlagRepository {
    db: Database,
}

impl AbnormalityFlagRepository {
    pub fn new(db: impl Into<Database>) -> Self {
        Self { db: db.into() }
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

    /// Blocking flags: only "critical"/"high" severities are ever emitted by
    /// AbnormalityDetector (see services/abnormality_detector) — "error" is
    /// never used and previously made this check dead code, letting every
    /// submission through regardless of outstanding critical/high flags.
    pub async fn find_errors_by_submission(
        &self,
        submission_id: Uuid,
    ) -> AppResult<Vec<abnormality_flag::Model>> {
        Entity::find()
            .filter(Column::SubmissionId.eq(submission_id))
            .filter(Column::Severity.is_in(["critical", "high"]))
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
