use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder};

use crate::entities::chart_of_account::{Column, Entity, Model};
use crate::entities::chart_of_accounts_coop_type as coa_ct;
use crate::entities::enums::CooperativeType;
use crate::error::AppResult;

#[derive(Clone)]
pub struct ChartOfAccountsRepository {
    db: DatabaseConnection,
}

impl ChartOfAccountsRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_all(&self) -> AppResult<Vec<Model>> {
        Entity::find()
            .order_by_asc(Column::DisplayOrder)
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_code(&self, code: i32) -> AppResult<Option<Model>> {
        Entity::find_by_id(code)
            .one(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_with_formula(&self) -> AppResult<Vec<Model>> {
        Entity::find()
            .filter(Column::Formula.is_not_null())
            .order_by_asc(Column::DisplayOrder)
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_required_by_coop_type(
        &self,
        coop_type: &CooperativeType,
    ) -> AppResult<Vec<i32>> {
        let rows = coa_ct::Entity::find()
            .filter(coa_ct::Column::CooperativeType.eq(coop_type.clone()))
            .filter(coa_ct::Column::IsRequired.eq(true))
            .filter(coa_ct::Column::IsActive.eq(true))
            .all(&self.db)
            .await
            .map_err(crate::error::AppError::from)?;
        Ok(rows.into_iter().map(|r| r.account_code).collect())
    }
}
