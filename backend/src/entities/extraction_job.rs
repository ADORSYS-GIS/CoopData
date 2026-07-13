use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "extraction_jobs")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub submission_id: Uuid,
    pub source_file_id: Uuid,
    pub status: String,
    #[sea_orm(nullable)]
    pub engine: Option<String>,
    #[sea_orm(nullable, column_type = "Text")]
    pub raw_text: Option<String>,
    #[sea_orm(nullable)]
    pub extracted_json: Option<Json>,
    #[sea_orm(nullable)]
    pub confidence: Option<Decimal>,
    #[sea_orm(nullable)]
    pub error_message: Option<String>,
    #[sea_orm(nullable)]
    pub started_at: Option<DateTime<Utc>>,
    #[sea_orm(nullable)]
    pub completed_at: Option<DateTime<Utc>>,
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
