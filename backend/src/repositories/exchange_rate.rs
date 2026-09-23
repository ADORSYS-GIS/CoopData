use sea_orm::{EntityTrait, Set};
use uuid::Uuid;

use crate::database::Database;
use crate::entities::enums::Currency;
use crate::entities::exchange_rate::{ActiveModel, Entity, Model};
use crate::error::AppResult;

#[derive(Clone)]
pub struct ExchangeRateRepository {
    db: Database,
}

impl ExchangeRateRepository {
    pub fn new(db: impl Into<Database>) -> Self {
        Self { db: db.into() }
    }

    pub async fn find_all(&self) -> AppResult<Vec<Model>> {
        Entity::find().all(&self.db).await.map_err(Into::into)
    }

    pub async fn find_by_code(&self, code: Currency) -> AppResult<Option<Model>> {
        Entity::find_by_id(code)
            .one(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn upsert(
        &self,
        currency_code: Currency,
        rate_to_usd: rust_decimal::Decimal,
        updated_by: Option<Uuid>,
    ) -> AppResult<Model> {
        use sea_orm::sea_query::OnConflict;

        let model = ActiveModel {
            currency_code: Set(currency_code.clone()),
            rate_to_usd: Set(rate_to_usd),
            updated_at: Set(chrono::Utc::now()),
            updated_by: Set(updated_by),
        };
        Entity::insert(model)
            .on_conflict(
                OnConflict::column(crate::entities::exchange_rate::Column::CurrencyCode)
                    .update_columns([
                        crate::entities::exchange_rate::Column::RateToUsd,
                        crate::entities::exchange_rate::Column::UpdatedAt,
                        crate::entities::exchange_rate::Column::UpdatedBy,
                    ])
                    .to_owned(),
            )
            .exec_with_returning(&self.db)
            .await
            .map_err(Into::into)
    }
}
