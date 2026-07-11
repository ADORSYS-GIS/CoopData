use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::enums::FdStatus;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "fixed_deposits")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub cooperative_id: Uuid,
    #[sea_orm(nullable)]
    pub submission_id: Option<Uuid>,
    pub member_id: Uuid,
    pub fixed_deposit_id: String,
    pub deposit_type: String,
    pub start_date: NaiveDate,
    pub maturity_date: NaiveDate,
    pub status: FdStatus,
    pub tenure_category: String,
    pub original_tenure_selected: String,
    pub early_withdrawal_flag: bool,
    pub rollover_at_maturity_flag: bool,
    pub number_of_renewals: i32,
    pub change_in_tenure_at_renewal: bool,
    pub single_depositor_dependency_flag: bool,
    pub interest_rate: Decimal,
    pub balance: Decimal,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::member::Entity",
        from = "Column::MemberId",
        to = "super::member::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Member,
    #[sea_orm(
        belongs_to = "super::cooperative::Entity",
        from = "Column::CooperativeId",
        to = "super::cooperative::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Cooperative,
}

impl Related<super::member::Entity> for Entity {
    fn to() -> sea_orm::RelationDef {
        Relation::Member.def()
    }
}

impl Related<super::cooperative::Entity> for Entity {
    fn to() -> sea_orm::RelationDef {
        Relation::Cooperative.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
