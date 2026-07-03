use crate::entities::{cooperative, CooperativeColumn};
use crate::error::{AppError, AppResult};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter,
};
use uuid::Uuid;

#[derive(Clone)]
pub struct CooperativeRepository {
    db: DatabaseConnection,
}

impl CooperativeRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_keycloak_id(&self, kc_id: &str) -> AppResult<Option<cooperative::Model>> {
        cooperative::Entity::find()
            .filter(CooperativeColumn::KeycloakId.eq(kc_id))
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<cooperative::Model>> {
        cooperative::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_apex_id(&self, apex_id: Uuid) -> AppResult<Vec<cooperative::Model>> {
        cooperative::Entity::find()
            .filter(CooperativeColumn::ApexId.eq(apex_id))
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn create(&self, model: cooperative::ActiveModel) -> AppResult<cooperative::Model> {
        model.insert(&self.db).await.map_err(|e| {
            if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                AppError::Conflict("Cooperative already exists".into())
            } else {
                AppError::DatabaseError(e)
            }
        })
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<()> {
        cooperative::Entity::delete_by_id(id)
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(())
    }
}
