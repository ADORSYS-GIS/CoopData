use crate::entities::{cooperative, CooperativeColumn};
use crate::error::{AppError, AppResult};
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

    pub async fn find_by_keycloak_group_id(
        &self,
        group_id: Uuid,
    ) -> AppResult<Option<cooperative::Model>> {
        cooperative::Entity::find()
            .filter(CooperativeColumn::KeycloakGroupId.eq(group_id))
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_name(&self, name: &str) -> AppResult<Option<cooperative::Model>> {
        cooperative::Entity::find()
            .filter(CooperativeColumn::Name.eq(name))
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_reg_no(&self, reg_no: &str) -> AppResult<Option<cooperative::Model>> {
        cooperative::Entity::find()
            .filter(CooperativeColumn::RegNo.eq(reg_no))
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_apex_id(&self, apex_id: Uuid) -> AppResult<Vec<cooperative::Model>> {
        cooperative::Entity::find()
            .filter(CooperativeColumn::ApexId.eq(apex_id))
            .order_by_desc(CooperativeColumn::CreatedAt)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn list_all(&self) -> AppResult<Vec<cooperative::Model>> {
        cooperative::Entity::find()
            .order_by_desc(CooperativeColumn::CreatedAt)
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

    pub async fn update(&self, model: cooperative::ActiveModel) -> AppResult<cooperative::Model> {
        model.update(&self.db).await.map_err(|e| {
            if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                AppError::Conflict("Cooperative with this reg_no already exists".into())
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
