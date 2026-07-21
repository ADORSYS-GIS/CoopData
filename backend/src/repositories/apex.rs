use crate::entities::{apex, ApexColumn};
use crate::error::{AppError, AppResult};
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use uuid::Uuid;

#[derive(Clone)]
pub struct ApexRepository {
    db: DatabaseConnection,
}

impl ApexRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_keycloak_id(&self, kc_id: &str) -> AppResult<Option<apex::Model>> {
        apex::Entity::find()
            .filter(ApexColumn::KeycloakId.eq(kc_id))
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<apex::Model>> {
        apex::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_federation_id(&self, federation_id: Uuid) -> AppResult<Vec<apex::Model>> {
        apex::Entity::find()
            .filter(ApexColumn::FederationId.eq(federation_id))
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_ids(&self, ids: Vec<Uuid>) -> AppResult<Vec<apex::Model>> {
        if ids.is_empty() {
            return Ok(vec![]);
        }
        apex::Entity::find()
            .filter(ApexColumn::Id.is_in(ids))
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn list_all(&self) -> AppResult<Vec<apex::Model>> {
        apex::Entity::find()
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn create(&self, model: apex::ActiveModel) -> AppResult<apex::Model> {
        model.insert(&self.db).await.map_err(|e| {
            if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                AppError::Conflict("Apex already exists".into())
            } else {
                AppError::DatabaseError(e)
            }
        })
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<()> {
        apex::Entity::delete_by_id(id)
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(())
    }
}
