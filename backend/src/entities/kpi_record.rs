//! `SeaORM` Entity.

use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "kpi_records")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub cooperative_id: Uuid,
    pub submission_id: Uuid,
    pub reporting_year: i32,
    pub kpi_name: String,
    pub kpi_type: String,
    #[sea_orm(column_type = "Double")]
    pub value: f64,
    pub formatted: String,
    pub unit: String,
    #[sea_orm(nullable)]
    pub status: Option<String>,
    #[sea_orm(column_type = "Text")]
    pub description: String,
    pub created_at: DateTimeWithTimeZone,
    pub updated_at: DateTimeWithTimeZone,
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
    #[sea_orm(
        belongs_to = "super::submission::Entity",
        from = "Column::SubmissionId",
        to = "super::submission::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Submission,
}

impl Related<super::cooperative::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Cooperative.def()
    }
}

impl Related<super::submission::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Submission.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
