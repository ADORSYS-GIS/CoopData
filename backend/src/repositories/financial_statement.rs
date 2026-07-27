use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use uuid::Uuid;

use crate::entities::financial_statement::{self, ActiveModel, Column, Entity};
use crate::error::{AppError, AppResult};

#[derive(Clone)]
pub struct FinancialStatementRepository {
    db: DatabaseConnection,
}

impl FinancialStatementRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<financial_statement::Model>> {
        Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_submission(
        &self,
        submission_id: Uuid,
    ) -> AppResult<Option<financial_statement::Model>> {
        Entity::find()
            .filter(Column::SubmissionId.eq(submission_id))
            .one(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_submission_id(
        &self,
        submission_id: Uuid,
    ) -> AppResult<Option<financial_statement::Model>> {
        Entity::find()
            .filter(Column::SubmissionId.eq(submission_id))
            .one(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_submission_ids(
        &self,
        submission_ids: Vec<Uuid>,
    ) -> AppResult<Vec<financial_statement::Model>> {
        if submission_ids.is_empty() {
            return Ok(vec![]);
        }
        Entity::find()
            .filter(Column::SubmissionId.is_in(submission_ids))
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_latest_by_cooperative(
        &self,
        cooperative_id: Uuid,
    ) -> AppResult<Option<financial_statement::Model>> {
        Entity::find()
            .filter(Column::CooperativeId.eq(cooperative_id))
            .order_by_desc(Column::CreatedAt)
            .one(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_cooperative_ids(
        &self,
        cooperative_ids: Vec<Uuid>,
    ) -> AppResult<Vec<financial_statement::Model>> {
        if cooperative_ids.is_empty() {
            return Ok(vec![]);
        }
        Entity::find()
            .filter(Column::CooperativeId.is_in(cooperative_ids))
            .order_by_desc(Column::CreatedAt)
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn create(&self, model: ActiveModel) -> AppResult<financial_statement::Model> {
        model.insert(&self.db).await.map_err(Into::into)
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<()> {
        Entity::delete_by_id(id)
            .exec(&self.db)
            .await
            .map(|_| ())
            .map_err(Into::into)
    }

    pub async fn set_validation_errors(
        &self,
        id: Uuid,
        errors: serde_json::Value,
    ) -> AppResult<financial_statement::Model> {
        let existing = Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(crate::error::AppError::from)?
            .ok_or_else(|| AppError::NotFound("Financial statement not found".into()))?;

        let mut active: ActiveModel = existing.into();
        active.validation_errors = Set(Some(errors));
        active.updated_at = Set(chrono::Utc::now());
        active.update(&self.db).await.map_err(Into::into)
    }
}
