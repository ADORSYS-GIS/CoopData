use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

use super::enums::CooperativeType;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "chart_of_accounts_coop_types")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub account_code: i32,
    #[sea_orm(primary_key, auto_increment = false)]
    pub cooperative_type: CooperativeType,
    pub is_required: bool,
    pub is_active: bool,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::chart_of_account::Entity",
        from = "Column::AccountCode",
        to = "super::chart_of_account::Column::AccountCode",
        on_delete = "Cascade"
    )]
    ChartOfAccount,
}

impl Related<super::chart_of_account::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::ChartOfAccount.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}