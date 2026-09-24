use chrono::NaiveDate;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, QuerySelect, Set,
    TransactionTrait,
};
use uuid::Uuid;

use crate::database::Database;
use crate::entities::enums::Currency;
use crate::entities::exchange_rate::{ActiveModel, Entity, Model};
use crate::entities::exchange_rate_history;
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

    pub async fn find_history(
        &self,
        code: Option<Currency>,
        limit: u64,
    ) -> AppResult<Vec<exchange_rate_history::Model>> {
        let mut query = exchange_rate_history::Entity::find();
        if let Some(code) = code {
            query = query.filter(exchange_rate_history::Column::CurrencyCode.eq(code));
        }
        query
            .order_by_desc(exchange_rate_history::Column::ChangedAt)
            .limit(limit)
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn upsert(
        &self,
        currency_code: Currency,
        rate_to_usd: rust_decimal::Decimal,
        effective_date: NaiveDate,
        source_note: Option<String>,
        updated_by: Option<Uuid>,
    ) -> AppResult<Model> {
        use sea_orm::sea_query::OnConflict;

        let now = chrono::Utc::now();
        let txn = self.db.begin().await?;

        let model = ActiveModel {
            currency_code: Set(currency_code.clone()),
            rate_to_usd: Set(rate_to_usd),
            updated_at: Set(now),
            updated_by: Set(updated_by),
            effective_date: Set(effective_date),
            source_note: Set(source_note.clone()),
        };
        let saved = Entity::insert(model)
            .on_conflict(
                OnConflict::column(crate::entities::exchange_rate::Column::CurrencyCode)
                    .update_columns([
                        crate::entities::exchange_rate::Column::RateToUsd,
                        crate::entities::exchange_rate::Column::UpdatedAt,
                        crate::entities::exchange_rate::Column::UpdatedBy,
                        crate::entities::exchange_rate::Column::EffectiveDate,
                        crate::entities::exchange_rate::Column::SourceNote,
                    ])
                    .to_owned(),
            )
            .exec_with_returning(&txn)
            .await?;

        exchange_rate_history::ActiveModel {
            id: Set(Uuid::new_v4()),
            currency_code: Set(currency_code),
            rate_to_usd: Set(rate_to_usd),
            effective_date: Set(effective_date),
            source_note: Set(source_note),
            changed_by: Set(updated_by),
            changed_at: Set(now),
        }
        .insert(&txn)
        .await?;

        txn.commit().await?;
        Ok(saved)
    }
}
