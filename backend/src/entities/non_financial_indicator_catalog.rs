use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::enums::IndicatorDataType;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "non_financial_indicator_catalog")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    #[sea_orm(unique)]
    pub indicator_name: String,
    pub display_name: String,
    #[sea_orm(nullable)]
    pub description: Option<String>,
    pub translations: serde_json::Value,
    pub data_type: IndicatorDataType,
    #[sea_orm(nullable)]
    pub coop_type: Option<String>,
    pub is_required: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::non_financial_indicator_entry::Entity")]
    Entries,
}

impl Related<super::non_financial_indicator_entry::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Entries.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
