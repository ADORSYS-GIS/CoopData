use sea_orm::{
    ActiveModelTrait, ColumnTrait, Condition, DatabaseConnection, EntityTrait, QueryFilter,
    QueryOrder,
};
use uuid::Uuid;

use crate::entities::enums::{ReviewAction, ReviewTier};
use crate::entities::submission_review::{self, ActiveModel, Column, Entity};
use crate::error::AppResult;

#[derive(Clone)]
pub struct SubmissionReviewRepository {
    db: DatabaseConnection,
}

impl SubmissionReviewRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_submission(
        &self,
        submission_id: Uuid,
    ) -> AppResult<Vec<submission_review::Model>> {
        Entity::find()
            .filter(Column::SubmissionId.eq(submission_id))
            .order_by_asc(Column::CreatedAt)
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn create(&self, model: ActiveModel) -> AppResult<submission_review::Model> {
        model.insert(&self.db).await.map_err(Into::into)
    }

    pub async fn find_by_submission_for_tier(
        &self,
        submission_id: Uuid,
        caller_tier: ReviewTier,
    ) -> AppResult<Vec<submission_review::Model>> {
        Entity::find()
            .filter(Column::SubmissionId.eq(submission_id))
            .filter(
                Condition::any()
                    .add(Column::Action.is_in([
                        ReviewAction::Approve,
                        ReviewAction::Reject,
                        ReviewAction::Comment,
                    ]))
                    .add(Column::TargetTier.is_null())
                    .add(Column::Tier.eq(caller_tier.clone()))
                    .add(Column::TargetTier.eq(caller_tier)),
            )
            .order_by_asc(Column::CreatedAt)
            .all(&self.db)
            .await
            .map_err(Into::into)
    }
}
