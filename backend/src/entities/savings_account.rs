use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::enums::AccountType;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "savings_accounts")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub cooperative_id: Uuid,
    #[sea_orm(nullable)]
    pub submission_id: Option<Uuid>,
    pub member_id: Uuid,
    pub savings_account_id: String,
    pub account_type: AccountType,
    pub account_opening_date: NaiveDate,
    pub account_status: String,
    pub contribution_frequency: String,
    pub last_contribution_date: NaiveDate,
    pub number_of_contributions: i32,
    pub balance_trend: String,
    pub zero_balance_flag: bool,
    pub withdrawal_frequency_category: String,
    pub emergency_withdrawals_flag: bool,
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
