use sea_orm::{DatabaseConnection, EntityTrait};

use crate::entities::account_alias::{Entity, Model};
use crate::error::AppResult;

#[derive(Clone)]
pub struct AccountAliasRepository {
    db: DatabaseConnection,
}

impl AccountAliasRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_all(&self) -> AppResult<Vec<Model>> {
        Entity::find().all(&self.db).await.map_err(Into::into)
    }
}
