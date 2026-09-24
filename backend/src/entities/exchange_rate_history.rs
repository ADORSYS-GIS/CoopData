use chrono::{DateTime, NaiveDate, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::enums::Currency;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "exchange_rate_history")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub currency_code: Currency,
    #[sea_orm(column_type = "Decimal(Some((18, 6)))")]
    pub rate_to_usd: Decimal,
    pub effective_date: NaiveDate,
    #[sea_orm(nullable)]
    pub source_note: Option<String>,
    #[sea_orm(nullable)]
    pub changed_by: Option<Uuid>,
    pub changed_at: DateTime<Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
