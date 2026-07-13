use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::enums::AccountCategory;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "balance_sheet_line_items")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub financial_statement_id: Uuid,
    #[sea_orm(nullable)]
    pub account_code: Option<i32>,
    pub account_name: String,
    pub account_category: AccountCategory,
    pub account_subcategory: String,
    pub month: i16,
    #[sea_orm(nullable)]
    pub value: Option<Decimal>,
    #[sea_orm(nullable)]
    pub ai_confidence: Option<Decimal>,
    pub ai_flagged: bool,
    pub manually_edited: bool,
    #[sea_orm(nullable)]
    pub raw_label: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::financial_statement::Entity",
        from = "Column::FinancialStatementId",
        to = "super::financial_statement::Column::Id",
        on_delete = "Cascade"
    )]
    FinancialStatement,
}

impl Related<super::financial_statement::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::FinancialStatement.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
