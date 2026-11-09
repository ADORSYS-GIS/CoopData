use chrono::NaiveDate;
use rust_decimal::Decimal;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "mambu_ledger_months")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub mambu_branch_id: String,
    #[sea_orm(primary_key, auto_increment = false)]
    pub month_start: NaiveDate,
    #[sea_orm(primary_key, auto_increment = false)]
    pub gl_code: String,
    pub account_type: String,
    pub account_name: Option<String>,
    pub debit: Decimal,
    pub credit: Decimal,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
