use crate::entities::{cooperative, CooperativeColumn};
use crate::error::{AppError, AppResult};
use crate::repositories::db_query;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder,
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
        db_query("cooperative", "find_by_keycloak_id", async {
            cooperative::Entity::find()
                .filter(CooperativeColumn::KeycloakId.eq(kc_id))
                .one(&self.db)
                .await
                .map_err(AppError::DatabaseError)
        })
        .await
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<cooperative::Model>> {
        db_query("cooperative", "find_by_id", async {
            cooperative::Entity::find_by_id(id)
                .one(&self.db)
                .await
                .map_err(AppError::DatabaseError)
        })
        .await
    }

    pub async fn find_by_keycloak_group_id(
        &self,
        group_id: Uuid,
    ) -> AppResult<Option<cooperative::Model>> {
        db_query("cooperative", "find_by_keycloak_group_id", async {
            cooperative::Entity::find()
                .filter(CooperativeColumn::KeycloakGroupId.eq(group_id))
                .one(&self.db)
                .await
                .map_err(AppError::DatabaseError)
        })
        .await
    }

    pub async fn find_by_name(&self, name: &str) -> AppResult<Option<cooperative::Model>> {
        db_query("cooperative", "find_by_name", async {
            cooperative::Entity::find()
                .filter(CooperativeColumn::Name.eq(name))
                .one(&self.db)
                .await
                .map_err(AppError::DatabaseError)
        })
        .await
    }

    pub async fn find_by_reg_no(&self, reg_no: &str) -> AppResult<Option<cooperative::Model>> {
        db_query("cooperative", "find_by_reg_no", async {
            cooperative::Entity::find()
                .filter(CooperativeColumn::RegNo.eq(reg_no))
                .one(&self.db)
                .await
                .map_err(AppError::DatabaseError)
        })
        .await
    }

    pub async fn find_by_apex_id(&self, apex_id: Uuid) -> AppResult<Vec<cooperative::Model>> {
        db_query("cooperative", "find_by_apex_id", async {
            cooperative::Entity::find()
                .filter(CooperativeColumn::ApexId.eq(apex_id))
                .order_by_desc(CooperativeColumn::CreatedAt)
                .all(&self.db)
                .await
                .map_err(AppError::DatabaseError)
        })
        .await
    }

    pub async fn find_by_ids(&self, ids: Vec<Uuid>) -> AppResult<Vec<cooperative::Model>> {
        if ids.is_empty() {
            return Ok(vec![]);
        }
        db_query("cooperative", "find_by_ids", async {
            cooperative::Entity::find()
                .filter(CooperativeColumn::Id.is_in(ids))
                .all(&self.db)
                .await
                .map_err(AppError::DatabaseError)
        })
        .await
    }

    pub async fn list_all(&self) -> AppResult<Vec<cooperative::Model>> {
        db_query("cooperative", "list_all", async {
            cooperative::Entity::find()
                .order_by_desc(CooperativeColumn::CreatedAt)
                .all(&self.db)
                .await
                .map_err(AppError::DatabaseError)
        })
        .await
    }

    pub async fn create(&self, model: cooperative::ActiveModel) -> AppResult<cooperative::Model> {
        db_query("cooperative", "create", async {
            model.insert(&self.db).await.map_err(|e| {
                if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                    AppError::Conflict("Cooperative already exists".into())
                } else {
                    AppError::DatabaseError(e)
                }
            })
        })
        .await
    }

    pub async fn update(&self, model: cooperative::ActiveModel) -> AppResult<cooperative::Model> {
        db_query("cooperative", "update", async {
            model.update(&self.db).await.map_err(|e| {
                if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                    AppError::Conflict("Cooperative with this reg_no already exists".into())
                } else {
                    AppError::DatabaseError(e)
                }
            })
        })
        .await
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<()> {
        db_query("cooperative", "delete", async {
            cooperative::Entity::delete_by_id(id)
                .exec(&self.db)
                .await
                .map_err(AppError::DatabaseError)?;
            Ok(())
        })
        .await
    }
}
