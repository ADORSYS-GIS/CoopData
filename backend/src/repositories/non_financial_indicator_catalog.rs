use crate::entities::{non_financial_indicator_catalog, NonFinancialIndicatorCatalogColumn};
use crate::error::{AppError, AppResult};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder,
};
use uuid::Uuid;

#[derive(Clone)]
pub struct NonFinancialIndicatorCatalogRepository {
    db: DatabaseConnection,
}

impl NonFinancialIndicatorCatalogRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_all(&self) -> AppResult<Vec<non_financial_indicator_catalog::Model>> {
        non_financial_indicator_catalog::Entity::find()
            .order_by_asc(NonFinancialIndicatorCatalogColumn::IndicatorName)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_id(
        &self,
        id: Uuid,
    ) -> AppResult<Option<non_financial_indicator_catalog::Model>> {
        non_financial_indicator_catalog::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_coop_type(
        &self,
        coop_type: &str,
    ) -> AppResult<Vec<non_financial_indicator_catalog::Model>> {
        non_financial_indicator_catalog::Entity::find()
            .filter(
                NonFinancialIndicatorCatalogColumn::CoopType
                    .eq(coop_type)
                    .or(NonFinancialIndicatorCatalogColumn::CoopType.is_null()),
            )
            .order_by_asc(NonFinancialIndicatorCatalogColumn::IndicatorName)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn create(
        &self,
        model: non_financial_indicator_catalog::ActiveModel,
    ) -> AppResult<non_financial_indicator_catalog::Model> {
        model.insert(&self.db).await.map_err(|e| {
            if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                AppError::Conflict("Indicator with this name already exists".into())
            } else {
                AppError::DatabaseError(e)
            }
        })
    }

    pub async fn update(
        &self,
        model: non_financial_indicator_catalog::ActiveModel,
    ) -> AppResult<non_financial_indicator_catalog::Model> {
        model.update(&self.db).await.map_err(|e| {
            if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                AppError::Conflict("Indicator with this name already exists".into())
            } else {
                AppError::DatabaseError(e)
            }
        })
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<()> {
        non_financial_indicator_catalog::Entity::delete_by_id(id)
            .exec(&self.db)
            .await
            .map_err(|e| {
                if e.to_string().contains("violates foreign key constraint") {
                    AppError::Conflict("Cannot delete indicator: entries exist for it".into())
                } else {
                    AppError::DatabaseError(e)
                }
            })?;
        Ok(())
    }
}
