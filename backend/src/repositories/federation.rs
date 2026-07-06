use crate::entities::{federation, FederationColumn};
use crate::error::{AppError, AppResult};
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use uuid::Uuid;

#[derive(Clone)]
pub struct FederationRepository {
    db: DatabaseConnection,
}

impl FederationRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_keycloak_id(&self, kc_id: &str) -> AppResult<Option<federation::Model>> {
        federation::Entity::find()
            .filter(FederationColumn::KeycloakId.eq(kc_id))
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<federation::Model>> {
        federation::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn create(&self, model: federation::ActiveModel) -> AppResult<federation::Model> {
        model.insert(&self.db).await.map_err(|e| {
            if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                AppError::Conflict("Federation already exists".into())
            } else {
                AppError::DatabaseError(e)
            }
        })
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<()> {
        federation::Entity::delete_by_id(id)
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(())
    }
}
