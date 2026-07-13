use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::enums::{DpdCategory, LoanStatus};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "loans")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub cooperative_id: Uuid,
    #[sea_orm(nullable)]
    pub submission_id: Option<Uuid>,
    pub member_id: Uuid,
    pub loan_id: String,
    pub loan_product_type: String,
    pub loan_start_date: NaiveDate,
    pub loan_maturity_date: NaiveDate,
    pub loan_status: LoanStatus,
    pub borrower_type: String,
    pub youth_borrower_flag: bool,
    pub women_borrower_flag: bool,
    pub rural_borrower_flag: bool,
    pub repayment_regularity: String,
    pub days_past_due_category: DpdCategory,
    pub missed_installments_count: i32,
    pub restructured_loan_flag: bool,
    pub number_of_restructurings: i32,
    pub early_settlement_flag: bool,
    pub multiple_loans_flag: bool,
    pub large_borrower_flag: bool,
    pub interest_rate: Decimal,
    pub balance: Decimal,
    pub loan_amount: Decimal,
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
