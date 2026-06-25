use crate::entities::user;
use crate::error::AppResult;
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use uuid::Uuid;

pub struct UserRepository {
    db: DatabaseConnection,
}

impl UserRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<user::Model>> {
        user::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_keycloak_id(&self, keycloak_id: &str) -> AppResult<Option<user::Model>> {
        user::Entity::find()
            .filter(user::Column::KeycloakId.eq(keycloak_id))
            .one(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_email(&self, email: &str) -> AppResult<Option<user::Model>> {
        user::Entity::find()
            .filter(user::Column::Email.eq(email))
            .one(&self.db)
            .await
            .map_err(Into::into)
    }
}
