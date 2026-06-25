use sea_orm::{
    ActiveModelTrait, DatabaseConnection, EntityTrait, QueryFilter, ColumnTrait, Set,
    QueryOrder, PaginatorTrait,
};
use uuid::Uuid;
use crate::entities::{user, UserColumn};
use crate::error::{AppError, AppResult};

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
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_keycloak_id(&self, keycloak_id: &str) -> AppResult<Option<user::Model>> {
        user::Entity::find()
            .filter(user::Column::KeycloakId.eq(keycloak_id))
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_email(&self, email: &str) -> AppResult<Option<user::Model>> {
        user::Entity::find()
            .filter(user::Column::Email.eq(email))
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_all(&self) -> AppResult<Vec<user::Model>> {
        user::Entity::find()
            .order_by_asc(UserColumn::Email)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_organization(&self, organization_id: Uuid) -> AppResult<Vec<user::Model>> {
        user::Entity::find()
            .filter(user::Column::OrganizationId.eq(organization_id))
            .order_by_asc(UserColumn::Email)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_role(&self, role: &str) -> AppResult<Vec<user::Model>> {
        user::Entity::find()
            .filter(user::Column::Role.eq(role))
            .order_by_asc(UserColumn::Email)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_active(&self) -> AppResult<Vec<user::Model>> {
        user::Entity::find()
            .filter(user::Column::IsActive.eq(true))
            .order_by_asc(UserColumn::Email)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn create(&self, model: user::ActiveModel) -> AppResult<user::Model> {
        model.insert(&self.db).await.map_err(|e| {
            if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                AppError::Conflict("User with this email or keycloak_id already exists".into())
            } else {
                AppError::DatabaseError(e)
            }
        })
    }

    pub async fn update(&self, id: Uuid, update: crate::api::dto::UpdateUserRequest) -> AppResult<user::Model> {
        let existing = self.find_by_id(id).await?
            .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;

        let mut active: user::ActiveModel = existing.into();

        if let Some(full_name) = update.full_name { active.full_name = Set(Some(full_name)); }
        if let Some(role) = update.role { active.role = Set(role); }
        if let Some(organization_id) = update.organization_id { active.organization_id = Set(Some(organization_id)); }
        if let Some(region) = update.region { active.region = Set(Some(region)); }
        if let Some(is_active) = update.is_active { active.is_active = Set(is_active); }

        active.updated_at = Set(chrono::Utc::now());

        active.update(&self.db).await.map_err(AppError::DatabaseError)
    }

    pub async fn update_role(&self, id: Uuid, role: String) -> AppResult<user::Model> {
        let existing = self.find_by_id(id).await?
            .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;

        let mut active: user::ActiveModel = existing.into();
        active.role = Set(role);
        active.updated_at = Set(chrono::Utc::now());

        active.update(&self.db).await.map_err(AppError::DatabaseError)
    }

    pub async fn update_last_login(&self, id: Uuid) -> AppResult<()> {
        let existing = self.find_by_id(id).await?
            .ok_or_else(|| AppError::NotFound(format!("User {} not found", id)))?;

        let mut active: user::ActiveModel = existing.into();
        active.last_login_at = Set(Some(chrono::Utc::now()));
        active.update(&self.db).await.map_err(AppError::DatabaseError)?;
        Ok(())
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<()> {
        user::Entity::delete_by_id(id)
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(())
    }

    pub async fn count(&self) -> AppResult<u64> {
        user::Entity::find()
            .count(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn count_by_role(&self, role: &str) -> AppResult<u64> {
        user::Entity::find()
            .filter(user::Column::Role.eq(role))
            .count(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }
}
