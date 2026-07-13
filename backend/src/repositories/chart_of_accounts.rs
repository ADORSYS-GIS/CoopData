use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder};

use crate::entities::chart_of_account::{Column, Entity, Model};
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
}
