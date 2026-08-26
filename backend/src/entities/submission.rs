use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::entities::enums::{ReviewTier, SubmissionCreatedByRole, SubmissionStatus};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "submissions")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    #[sea_orm(nullable)]
    pub reference: Option<String>,
    pub cooperative_id: Uuid,
    pub reporting_year: i32,
    pub status: SubmissionStatus,
    pub current_tier: ReviewTier,
    #[sea_orm(nullable)]
    pub submitted_by: Option<Uuid>,
    #[sea_orm(nullable)]
    pub submitted_at: Option<DateTime<Utc>>,
    #[sea_orm(nullable)]
    pub last_reviewed_by: Option<Uuid>,
    #[sea_orm(nullable)]
    pub last_reviewed_at: Option<DateTime<Utc>>,
    #[sea_orm(nullable)]
    pub rejection_reason: Option<String>,
    pub priority: String,
    pub metadata: Json,
    pub submission_method: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    /// Who created this submission: cooperative or apex
    pub created_by_role: SubmissionCreatedByRole,
    /// UUID of the user who created this submission
    #[sea_orm(nullable)]
    pub created_by_user_id: Option<Uuid>,
    /// Display name of the creator (denormalized for read performance)
    #[sea_orm(nullable)]
    pub created_by_name: Option<String>,
    /// UUID of the user who currently owns the draft (exclusive editing)
    #[sea_orm(nullable)]
    pub edited_by: Option<Uuid>,
    /// Display name of the current editor (denormalized for read performance)
    #[sea_orm(nullable)]
    pub edited_by_name: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::cooperative::Entity",
        from = "Column::CooperativeId",
        to = "super::cooperative::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Cooperative,
}

impl Related<super::cooperative::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Cooperative.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
