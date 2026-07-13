use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::entities::enums::{ReviewAction, ReviewTier};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "submission_reviews")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub submission_id: Uuid,
    pub tier: ReviewTier,
    #[sea_orm(nullable)]
    pub reviewer_id: Option<Uuid>,
    pub action: ReviewAction,
    #[sea_orm(nullable)]
    pub comment: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::submission::Entity",
        from = "Column::SubmissionId",
        to = "super::submission::Column::Id",
        on_delete = "Cascade"
    )]
    Submission,
}

impl Related<super::submission::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Submission.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
