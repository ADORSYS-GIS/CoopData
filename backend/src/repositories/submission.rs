use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use uuid::Uuid;

use crate::entities::enums::{ReviewTier, SubmissionStatus};
use crate::entities::submission::{self, ActiveModel, Column, Entity};
use crate::error::AppResult;
use crate::repositories::db_query;

#[derive(Clone)]
pub struct SubmissionRepository {
    db: DatabaseConnection,
}

impl SubmissionRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<submission::Model>> {
        db_query("submission", "find_by_id", async {
            Entity::find_by_id(id)
                .one(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn find_by_cooperative(
        &self,
        cooperative_id: Uuid,
    ) -> AppResult<Vec<submission::Model>> {
        db_query("submission", "find_by_cooperative", async {
            Entity::find()
                .filter(Column::CooperativeId.eq(cooperative_id))
                .order_by_desc(Column::CreatedAt)
                .all(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn find_by_status(
        &self,
        status: SubmissionStatus,
    ) -> AppResult<Vec<submission::Model>> {
        db_query("submission", "find_by_status", async {
            let query = if status == SubmissionStatus::Approved {
                Entity::find().filter(
                    Column::Status
                        .eq(SubmissionStatus::Approved)
                        .or(Column::Status.eq(SubmissionStatus::Submitted)),
                )
            } else {
                Entity::find().filter(Column::Status.eq(status))
            };
            query
                .order_by_desc(Column::CreatedAt)
                .all(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn find_by_tier(&self, tier: ReviewTier) -> AppResult<Vec<submission::Model>> {
        db_query("submission", "find_by_tier", async {
            Entity::find()
                .filter(Column::CurrentTier.eq(tier))
                .order_by_desc(Column::CreatedAt)
                .all(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn find_by_cooperative_and_year(
        &self,
        cooperative_id: Uuid,
        reporting_year: i32,
    ) -> AppResult<Option<submission::Model>> {
        db_query("submission", "find_by_cooperative_and_year", async {
            Entity::find()
                .filter(Column::CooperativeId.eq(cooperative_id))
                .filter(Column::ReportingYear.eq(reporting_year))
                .one(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn count_by_reporting_year(&self, reporting_year: i32) -> AppResult<i64> {
        db_query("submission", "count_by_reporting_year", async {
            use sea_orm::PaginatorTrait;
            let count = Entity::find()
                .filter(Column::ReportingYear.eq(reporting_year))
                .count(&self.db)
                .await
                .map_err(crate::error::AppError::from)?;
            Ok(count as i64)
        })
        .await
    }

    pub async fn find_by_cooperative_ids(
        &self,
        cooperative_ids: Vec<Uuid>,
    ) -> AppResult<Vec<submission::Model>> {
        if cooperative_ids.is_empty() {
            return Ok(vec![]);
        }
        db_query("submission", "find_by_cooperative_ids", async {
            Entity::find()
                .filter(Column::CooperativeId.is_in(cooperative_ids))
                .order_by_desc(Column::CreatedAt)
                .all(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn find_all_non_draft(&self) -> AppResult<Vec<submission::Model>> {
        db_query("submission", "find_all_non_draft", async {
            Entity::find()
                .filter(Column::Status.ne(SubmissionStatus::Draft))
                .order_by_desc(Column::CreatedAt)
                .all(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn find_by_cooperative_ids_and_tier(
        &self,
        cooperative_ids: Vec<Uuid>,
        tier: ReviewTier,
    ) -> AppResult<Vec<submission::Model>> {
        if cooperative_ids.is_empty() {
            return Ok(vec![]);
        }
        db_query("submission", "find_by_cooperative_ids_and_tier", async {
            Entity::find()
                .filter(Column::CooperativeId.is_in(cooperative_ids))
                .filter(Column::CurrentTier.eq(tier))
                .order_by_desc(Column::CreatedAt)
                .all(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn create(&self, model: ActiveModel) -> AppResult<submission::Model> {
        db_query("submission", "create", async {
            model.insert(&self.db).await.map_err(Into::into)
        })
        .await
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<()> {
        db_query("submission", "delete", async {
            Entity::delete_by_id(id)
                .exec(&self.db)
                .await
                .map_err(crate::error::AppError::from)?;
            Ok(())
        })
        .await
    }

    pub async fn update_metadata(
        &self,
        id: Uuid,
        metadata_patch: serde_json::Value,
    ) -> AppResult<submission::Model> {
        let existing = Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(crate::error::AppError::from)?
            .ok_or_else(|| crate::error::AppError::NotFound("Submission not found".into()))?;

        let mut active: ActiveModel = existing.into();
        let merged = match active.metadata.clone().unwrap() {
            serde_json::Value::Object(mut map) => {
                if let serde_json::Value::Object(patch) = metadata_patch {
                    for (k, v) in patch {
                        map.insert(k, v);
                    }
                }
                serde_json::Value::Object(map)
            }
            _ => metadata_patch,
        };
        active.metadata = Set(merged);
        active.updated_at = Set(chrono::Utc::now());
        active.update(&self.db).await.map_err(Into::into)
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

    pub async fn update_submission_method(
        &self,
        id: Uuid,
        method: String,
    ) -> AppResult<submission::Model> {
        let existing = Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(crate::error::AppError::from)?
            .ok_or_else(|| crate::error::AppError::NotFound("Submission not found".into()))?;

        let mut active: ActiveModel = existing.into();
        active.submission_method = Set(method);
        active.updated_at = Set(chrono::Utc::now());
        active.update(&self.db).await.map_err(Into::into)
    }
}
