use crate::entities::{organization, OrganizationColumn};
use crate::error::{AppError, AppResult};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter,
    QueryOrder, Set,
};
use uuid::Uuid;

pub struct OrganizationRepository {
    db: DatabaseConnection,
}

impl OrganizationRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<organization::Model>> {
        organization::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_all(&self) -> AppResult<Vec<organization::Model>> {
        organization::Entity::find()
            .order_by_asc(OrganizationColumn::Name)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_active(&self) -> AppResult<Vec<organization::Model>> {
        organization::Entity::find()
            .filter(organization::Column::IsActive.eq(true))
            .order_by_asc(OrganizationColumn::Name)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_type(&self, org_type: &str) -> AppResult<Vec<organization::Model>> {
        organization::Entity::find()
            .filter(organization::Column::OrganizationType.eq(org_type))
            .filter(organization::Column::IsActive.eq(true))
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn create(&self, model: organization::ActiveModel) -> AppResult<organization::Model> {
        model.insert(&self.db).await.map_err(|e| {
            if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                AppError::Conflict("Organization already exists".into())
            } else {
                AppError::DatabaseError(e)
            }
        })
    }

    pub async fn update(
        &self,
        id: Uuid,
        update: crate::api::dto::UpdateOrganizationRequest,
    ) -> AppResult<organization::Model> {
        let existing = self
            .find_by_id(id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Organization {} not found", id)))?;

        let mut active: organization::ActiveModel = existing.into();

        if let Some(name) = update.name {
            active.name = Set(name);
        }
        if let Some(organization_type) = update.organization_type {
            active.organization_type = Set(organization_type);
        }
        if let Some(registration_number) = update.registration_number {
            active.registration_number = Set(Some(registration_number));
        }
        if let Some(sector) = update.sector {
            active.sector = Set(Some(sector));
        }
        if let Some(region) = update.region {
            active.region = Set(Some(region));
        }
        if let Some(contact_email) = update.contact_email {
            active.contact_email = Set(Some(contact_email));
        }
        if let Some(contact_phone) = update.contact_phone {
            active.contact_phone = Set(Some(contact_phone));
        }
        if let Some(address) = update.address {
            active.address = Set(Some(address));
        }
        if let Some(federation_id) = update.federation_id {
            active.federation_id = Set(Some(federation_id));
        }
        if let Some(is_active) = update.is_active {
            active.is_active = Set(is_active);
        }

        active.updated_at = Set(chrono::Utc::now());

        active
            .update(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<()> {
        organization::Entity::delete_by_id(id)
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(())
    }

    pub async fn count(&self) -> AppResult<u64> {
        organization::Entity::find()
            .count(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }
}
