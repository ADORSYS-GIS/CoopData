use crate::entities::{apex, ApexColumn};
use crate::error::{AppError, AppResult};
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
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

    pub async fn update_metadata(
        &self,
        id: Uuid,
        metadata_patch: serde_json::Value,
    ) -> AppResult<apex::Model> {
        let existing = apex::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(crate::error::AppError::from)?
            .ok_or_else(|| crate::error::AppError::NotFound("Apex not found".into()))?;

        let mut active: apex::ActiveModel = existing.into();
        let current_metadata = active
            .metadata
            .clone()
            .unwrap()
            .unwrap_or(serde_json::Value::Object(serde_json::Map::new()));
        let merged = match current_metadata {
            serde_json::Value::Object(mut map) => {
                if let serde_json::Value::Object(patch) = metadata_patch {
                    for (k, v) in patch {
                        map.insert(k, v);
                    }
                }
                serde_json::Value::Object(map)
            }
            _ => metadata_patch,
        };
        active.metadata = Set(Some(merged));
        active.updated_at = Set(chrono::Utc::now());
        active.update(&self.db).await.map_err(Into::into)
    }
}
