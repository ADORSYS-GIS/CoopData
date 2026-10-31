use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "mambu_product_mappings")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub mambu_product_id: String,
    #[sea_orm(primary_key, auto_increment = false)]
    pub product_kind: String,
    pub mapped_type: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
