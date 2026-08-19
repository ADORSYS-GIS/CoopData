use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use uuid::Uuid;

use crate::entities::financial_statement::{self, ActiveModel, Column, Entity};
use crate::error::{AppError, AppResult};
use crate::repositories::db_query;

#[derive(Clone)]
pub struct FinancialStatementRepository {
    db: DatabaseConnection,
}

impl FinancialStatementRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<financial_statement::Model>> {
        db_query("financial_statement", "find_by_id", async {
            Entity::find_by_id(id)
                .one(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn find_by_submission(
        &self,
        submission_id: Uuid,
    ) -> AppResult<Option<financial_statement::Model>> {
        db_query("financial_statement", "find_by_submission", async {
            Entity::find()
                .filter(Column::SubmissionId.eq(submission_id))
                .one(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn find_by_submission_id(
        &self,
        submission_id: Uuid,
    ) -> AppResult<Option<financial_statement::Model>> {
        db_query("financial_statement", "find_by_submission_id", async {
            Entity::find()
                .filter(Column::SubmissionId.eq(submission_id))
                .one(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn find_by_submission_ids(
        &self,
        submission_ids: Vec<Uuid>,
    ) -> AppResult<Vec<financial_statement::Model>> {
        if submission_ids.is_empty() {
            return Ok(vec![]);
        }
        db_query("financial_statement", "find_by_submission_ids", async {
            Entity::find()
                .filter(Column::SubmissionId.is_in(submission_ids))
                .all(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn find_latest_by_cooperative(
        &self,
        cooperative_id: Uuid,
    ) -> AppResult<Option<financial_statement::Model>> {
        db_query("financial_statement", "find_latest_by_cooperative", async {
            Entity::find()
                .filter(Column::CooperativeId.eq(cooperative_id))
                .order_by_desc(Column::CreatedAt)
                .one(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn find_by_cooperative_ids(
        &self,
        cooperative_ids: Vec<Uuid>,
    ) -> AppResult<Vec<financial_statement::Model>> {
        if cooperative_ids.is_empty() {
            return Ok(vec![]);
        }
        db_query("financial_statement", "find_by_cooperative_ids", async {
            Entity::find()
                .filter(Column::CooperativeId.is_in(cooperative_ids))
                .order_by_desc(Column::CreatedAt)
                .all(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn create(&self, model: ActiveModel) -> AppResult<financial_statement::Model> {
        db_query("financial_statement", "create", async {
            model.insert(&self.db).await.map_err(Into::into)
        })
        .await
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<()> {
        db_query("financial_statement", "delete", async {
            Entity::delete_by_id(id)
                .exec(&self.db)
                .await
                .map(|_| ())
                .map_err(Into::into)
        })
        .await
    }

    pub async fn set_validation_errors(
        &self,
        id: Uuid,
        errors: serde_json::Value,
    ) -> AppResult<financial_statement::Model> {
        db_query("financial_statement", "set_validation_errors", async {
            let existing = Entity::find_by_id(id)
                .one(&self.db)
                .await
                .map_err(crate::error::AppError::from)?
                .ok_or_else(|| AppError::NotFound("Financial statement not found".into()))?;

            let mut active: ActiveModel = existing.into();
            active.validation_errors = Set(Some(errors));
            active.updated_at = Set(chrono::Utc::now());
            active.update(&self.db).await.map_err(Into::into)
        })
        .await
    }
}
