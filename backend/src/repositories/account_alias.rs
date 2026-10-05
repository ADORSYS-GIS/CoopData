use crate::database::Database;
use sea_orm::EntityTrait;

use crate::entities::account_alias::{Entity, Model};
use crate::error::AppResult;

#[derive(Clone)]
pub struct AccountAliasRepository {
    db: Database,
}

impl AccountAliasRepository {
    pub fn new(db: impl Into<Database>) -> Self {
        Self { db: db.into() }
    }

    pub async fn find_all(&self) -> AppResult<Vec<Model>> {
        Entity::find().all(&self.db).await.map_err(Into::into)
    }
}
