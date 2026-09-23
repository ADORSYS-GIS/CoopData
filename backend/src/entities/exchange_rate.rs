use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::enums::Currency;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "exchange_rates")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub currency_code: Currency,
    #[sea_orm(column_type = "Decimal(Some((18, 6)))")]
    pub rate_to_usd: Decimal,
    pub updated_at: DateTime<Utc>,
    #[sea_orm(nullable)]
    pub updated_by: Option<Uuid>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
