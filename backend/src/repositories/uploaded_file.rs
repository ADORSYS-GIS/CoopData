use crate::database::Database;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter};
use uuid::Uuid;

use crate::entities::uploaded_file::{self, ActiveModel, Column, Entity};
use crate::error::AppResult;

#[derive(Clone)]
pub struct UploadedFileRepository {
    db: Database,
}

impl UploadedFileRepository {
    pub fn new(db: impl Into<Database>) -> Self {
        Self { db: db.into() }
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<uploaded_file::Model>> {
        Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_submission(
        &self,
        submission_id: Uuid,
    ) -> AppResult<Vec<uploaded_file::Model>> {
        Entity::find()
            .filter(Column::SubmissionId.eq(submission_id))
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_submission_id(
        &self,
        submission_id: Uuid,
    ) -> AppResult<Vec<uploaded_file::Model>> {
        self.find_by_submission(submission_id).await
    }

    pub async fn create(&self, model: ActiveModel) -> AppResult<uploaded_file::Model> {
        model.insert(&self.db).await.map_err(Into::into)
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<()> {
        Entity::delete_by_id(id)
            .exec(&self.db)
            .await
            .map(|_| ())
            .map_err(Into::into)
    }
}
