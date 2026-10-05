use crate::database::Database;
use crate::entities::{federation, FederationColumn};
use crate::error::{AppError, AppResult};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, QueryOrder, Set};
use uuid::Uuid;

#[derive(Clone)]
pub struct FederationRepository {
    db: Database,
}

impl FederationRepository {
    pub fn new(db: impl Into<Database>) -> Self {
        Self { db: db.into() }
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

    pub async fn find_by_ids(&self, ids: Vec<Uuid>) -> AppResult<Vec<federation::Model>> {
        if ids.is_empty() {
            return Ok(vec![]);
        }
        federation::Entity::find()
            .filter(FederationColumn::Id.is_in(ids))
            .order_by_desc(FederationColumn::CreatedAt)
            .all(&self.db)
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

    pub async fn update_display_name(
        &self,
        keycloak_id: &str,
        display_name: &str,
    ) -> AppResult<Option<federation::Model>> {
        let Some(existing) = self.find_by_keycloak_id(keycloak_id).await? else {
            return Ok(None);
        };
        let mut active: federation::ActiveModel = existing.into();
        active.display_name = Set(display_name.to_string());
        active.updated_at = Set(chrono::Utc::now());
        active
            .update(&self.db)
            .await
            .map(Some)
            .map_err(AppError::DatabaseError)
    }

    pub async fn update_metadata(
        &self,
        id: Uuid,
        metadata_patch: serde_json::Value,
    ) -> AppResult<federation::Model> {
        let existing = federation::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(crate::error::AppError::from)?
            .ok_or_else(|| crate::error::AppError::NotFound("Federation not found".into()))?;

        let mut active: federation::ActiveModel = existing.into();
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
