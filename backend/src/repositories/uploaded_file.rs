use crate::entities::{uploaded_file, UploadedFileColumn};
use crate::error::{AppError, AppResult};
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use uuid::Uuid;

#[derive(Clone)]
pub struct UploadedFileRepository {
    db: DatabaseConnection,
}

impl UploadedFileRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn create(
        &self,
        model: uploaded_file::ActiveModel,
    ) -> AppResult<uploaded_file::Model> {
        model
            .insert(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<uploaded_file::Model>> {
        uploaded_file::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_submission_id(
        &self,
        submission_id: Uuid,
    ) -> AppResult<Vec<uploaded_file::Model>> {
        uploaded_file::Entity::find()
            .filter(UploadedFileColumn::SubmissionId.eq(submission_id))
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }
}
