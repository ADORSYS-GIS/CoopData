use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::enums::AccountCategory;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "chart_of_accounts")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub account_code: i32,
    pub account_name: String,
    pub account_category: AccountCategory,
    #[sea_orm(nullable)]
    pub account_subcategory: Option<String>,
    pub is_total: bool,
    pub is_section_header: bool,
    #[sea_orm(nullable)]
    pub parent_code: Option<i32>,
    #[sea_orm(nullable)]
    pub formula: Option<String>,
    pub display_order: i32,
    pub baseline_active: bool,
    #[sea_orm(nullable)]
    pub description: Option<String>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
