use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use uuid::Uuid;

use crate::entities::extraction_job::{self, ActiveModel, Column, Entity};
use crate::error::{AppError, AppResult};

#[derive(Clone)]
pub struct ExtractionJobRepository {
    db: DatabaseConnection,
}

impl ExtractionJobRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<extraction_job::Model>> {
        Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_submission(
        &self,
        submission_id: Uuid,
    ) -> AppResult<Option<extraction_job::Model>> {
        Entity::find()
            .filter(Column::SubmissionId.eq(submission_id))
            .one(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_submission_ids(
        &self,
        submission_ids: Vec<Uuid>,
    ) -> AppResult<Vec<extraction_job::Model>> {
        if submission_ids.is_empty() {
            return Ok(vec![]);
        }
        Entity::find()
            .filter(Column::SubmissionId.is_in(submission_ids))
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn create(&self, model: ActiveModel) -> AppResult<extraction_job::Model> {
        model.insert(&self.db).await.map_err(Into::into)
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<()> {
        Entity::delete_by_id(id)
            .exec(&self.db)
            .await
            .map(|_| ())
            .map_err(Into::into)
    }

    pub async fn update_status(
        &self,
        id: Uuid,
        status: &str,
        started_at: Option<chrono::DateTime<chrono::Utc>>,
        completed_at: Option<chrono::DateTime<chrono::Utc>>,
        error_message: Option<String>,
    ) -> AppResult<extraction_job::Model> {
        let existing = Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(crate::error::AppError::from)?
            .ok_or_else(|| AppError::NotFound("Extraction job not found".into()))?;

        let mut active: ActiveModel = existing.into();
        active.status = Set(status.to_string());
        if let Some(t) = started_at {
            active.started_at = Set(Some(t));
        }
        if let Some(t) = completed_at {
            active.completed_at = Set(Some(t));
        }
        if let Some(msg) = error_message {
            active.error_message = Set(Some(msg));
        }
        active.update(&self.db).await.map_err(Into::into)
    }

    pub async fn update_result(
        &self,
        id: Uuid,
        raw_text: &str,
        extracted_json: serde_json::Value,
        confidence: rust_decimal::Decimal,
        engine: &str,
    ) -> AppResult<extraction_job::Model> {
        let existing = Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(crate::error::AppError::from)?
            .ok_or_else(|| AppError::NotFound("Extraction job not found".into()))?;

        let mut active: ActiveModel = existing.into();
        active.raw_text = Set(Some(raw_text.to_string()));
        active.extracted_json = Set(Some(extracted_json));
        active.confidence = Set(Some(confidence));
        active.engine = Set(Some(engine.to_string()));
        active.update(&self.db).await.map_err(Into::into)
    }
}
