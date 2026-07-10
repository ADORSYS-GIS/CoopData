use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "non_financial_indicator_entries")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub submission_id: Uuid,
    pub catalog_id: Uuid,
    #[sea_orm(nullable)]
    pub value_numeric: Option<Decimal>,
    #[sea_orm(nullable)]
    pub value_text: Option<String>,
    #[sea_orm(nullable)]
    pub value_boolean: Option<bool>,
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
        belongs_to = "super::non_financial_indicator_catalog::Entity",
        from = "Column::CatalogId",
        to = "super::non_financial_indicator_catalog::Column::Id",
        on_update = "Cascade",
        on_delete = "Restrict"
    )]
    Catalog,
}

impl Related<super::submission::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Submission.def()
    }
}

impl Related<super::non_financial_indicator_catalog::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Catalog.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
