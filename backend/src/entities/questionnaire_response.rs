use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "questionnaire_responses")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub submission_id: Uuid,
    pub cooperative_id: Uuid,
    pub questionnaire_type: String,
    pub reporting_year: i32,
    pub answers: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::submission::Entity",
        from = "Column::SubmissionId",
        to = "super::submission::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Submission,
    #[sea_orm(
        belongs_to = "super::cooperative::Entity",
        from = "Column::CooperativeId",
        to = "super::cooperative::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Cooperative,
}

impl Related<super::submission::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Submission.def()
    }
}

impl Related<super::cooperative::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Cooperative.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
