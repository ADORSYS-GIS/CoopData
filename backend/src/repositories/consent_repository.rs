use chrono::Utc;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use uuid::Uuid;

use crate::entities::{privacy_requests, user_consents, PrivacyRequestsColumn, UserConsentsColumn};
use crate::error::{AppError, AppResult};

#[derive(Clone)]
pub struct ConsentRepository {
    db: DatabaseConnection,
}

impl ConsentRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn record_consent(
        &self,
        user_id: &str,
        document_type: &str,
        document_version: &str,
        ip_address: Option<String>,
        user_agent: Option<String>,
    ) -> AppResult<user_consents::Model> {
        let active_model = user_consents::ActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user_id.to_string()),
            document_type: Set(document_type.to_string()),
            document_version: Set(document_version.to_string()),
            accepted_at: Set(Utc::now()),
            ip_address: Set(ip_address),
            user_agent: Set(user_agent),
            created_at: Set(Utc::now()),
        };

        active_model
            .insert(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn get_user_consents(&self, user_id: &str) -> AppResult<Vec<user_consents::Model>> {
        user_consents::Entity::find()
            .filter(UserConsentsColumn::UserId.eq(user_id))
            .order_by_desc(UserConsentsColumn::AcceptedAt)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn get_latest_user_consent(
        &self,
        user_id: &str,
        document_type: &str,
    ) -> AppResult<Option<user_consents::Model>> {
        user_consents::Entity::find()
            .filter(UserConsentsColumn::UserId.eq(user_id))
            .filter(UserConsentsColumn::DocumentType.eq(document_type))
            .order_by_desc(UserConsentsColumn::AcceptedAt)
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn create_privacy_request(
        &self,
        user_id: &str,
        request_type: &str,
        details: Option<String>,
    ) -> AppResult<privacy_requests::Model> {
        let active_model = privacy_requests::ActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(user_id.to_string()),
            request_type: Set(request_type.to_string()),
            status: Set("PENDING".to_string()),
            details: Set(details),
            created_at: Set(Utc::now()),
            updated_at: Set(Utc::now()),
        };

        active_model
            .insert(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn get_user_privacy_requests(
        &self,
        user_id: &str,
    ) -> AppResult<Vec<privacy_requests::Model>> {
        privacy_requests::Entity::find()
            .filter(PrivacyRequestsColumn::UserId.eq(user_id))
            .order_by_desc(PrivacyRequestsColumn::CreatedAt)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn get_privacy_request_by_id(
        &self,
        id: Uuid,
    ) -> AppResult<Option<privacy_requests::Model>> {
        privacy_requests::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn list_all_privacy_requests(
        &self,
    ) -> AppResult<Vec<privacy_requests::Model>> {
        privacy_requests::Entity::find()
            .order_by_desc(PrivacyRequestsColumn::CreatedAt)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn update_privacy_request_status(
        &self,
        id: Uuid,
        status: &str,
    ) -> AppResult<Option<privacy_requests::Model>> {
        let existing = privacy_requests::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;

        let Some(model) = existing else {
            return Ok(None);
        };

        let mut active: privacy_requests::ActiveModel = model.into();
        active.status = Set(status.to_string());
        active.updated_at = Set(Utc::now());
        active.update(&self.db).await.map_err(AppError::DatabaseError).map(Some)
    }
}
