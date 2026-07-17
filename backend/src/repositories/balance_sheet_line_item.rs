use rust_decimal::Decimal;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use uuid::Uuid;

use crate::entities::balance_sheet_line_item::{self, ActiveModel, Column, Entity};
use crate::error::{AppError, AppResult};

#[derive(Clone)]
pub struct BalanceSheetLineItemRepository {
    db: DatabaseConnection,
}

impl BalanceSheetLineItemRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_financial_statement(
        &self,
        financial_statement_id: Uuid,
    ) -> AppResult<Vec<balance_sheet_line_item::Model>> {
        Entity::find()
            .filter(Column::FinancialStatementId.eq(financial_statement_id))
            .order_by_asc(Column::AccountCode)
            .order_by_asc(Column::Month)
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<balance_sheet_line_item::Model>> {
        Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_financial_statement_ids(
        &self,
        fs_ids: Vec<Uuid>,
    ) -> AppResult<Vec<balance_sheet_line_item::Model>> {
        if fs_ids.is_empty() {
            return Ok(vec![]);
        }
        Entity::find()
            .filter(Column::FinancialStatementId.is_in(fs_ids))
            .order_by_asc(Column::Month)
            .order_by_asc(Column::AccountCode)
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn create(&self, model: ActiveModel) -> AppResult<balance_sheet_line_item::Model> {
        model.insert(&self.db).await.map_err(Into::into)
    }

    pub async fn delete_by_financial_statement(
        &self,
        financial_statement_id: Uuid,
    ) -> AppResult<()> {
        Entity::delete_many()
            .filter(Column::FinancialStatementId.eq(financial_statement_id))
            .exec(&self.db)
            .await
            .map_err(crate::error::AppError::from)?;
        Ok(())
    }

    pub async fn delete_unmapped_by_financial_statement(
        &self,
        financial_statement_id: Uuid,
    ) -> AppResult<u64> {
        let result = Entity::delete_many()
            .filter(Column::FinancialStatementId.eq(financial_statement_id))
            .filter(Column::AccountCode.is_null())
            .exec(&self.db)
            .await
            .map_err(crate::error::AppError::from)?;
        Ok(result.rows_affected)
    }

    pub async fn update_value(
        &self,
        id: Uuid,
        value: Decimal,
        account_code: Option<i32>,
    ) -> AppResult<balance_sheet_line_item::Model> {
        let existing = Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(crate::error::AppError::from)?
            .ok_or_else(|| AppError::NotFound("Line item not found".into()))?;

        let mut active: ActiveModel = existing.into();
        active.value = Set(Some(value));
        active.manually_edited = Set(true);
        active.ai_flagged = Set(false);
        if let Some(code) = account_code {
            active.account_code = Set(Some(code));
        }
        active.updated_at = Set(chrono::Utc::now());
        active.update(&self.db).await.map_err(Into::into)
    }
}
