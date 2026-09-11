// src/repositories/legal_policy_repository.rs
use crate::entities::legal_policy;
use crate::error::{AppError, AppResult};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use uuid::Uuid;

#[derive(Clone)]
pub struct LegalPolicyRepository {
    db: DatabaseConnection,
}

impl LegalPolicyRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    /// List latest version of each policy
    pub async fn list_latest(&self) -> AppResult<Vec<legal_policy::Model>> {
        let policies = legal_policy::Entity::find()
            .order_by_desc(legal_policy::Column::Version)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;

        // Keep only the first (latest version) per slug
        let mut seen = std::collections::HashSet::new();
        let mut latest = Vec::new();
        for p in policies {
            if seen.insert(p.slug.clone()) {
                latest.push(p);
            }
        }
        Ok(latest)
    }

    pub async fn get_latest_by_slug(&self, slug: &str) -> AppResult<Option<legal_policy::Model>> {
        legal_policy::Entity::find()
            .filter(legal_policy::Column::Slug.eq(slug))
            .order_by_desc(legal_policy::Column::Version)
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn create(
        &self,
        req: crate::api::dto::legal_policy::LegalPolicyCreateRequest,
    ) -> AppResult<legal_policy::Model> {
        let new_id = Uuid::new_v4();
        let policy_id = Uuid::new_v4();
        let active = legal_policy::ActiveModel {
            id: Set(new_id),
            policy_id: Set(policy_id),
            slug: Set(req.slug),
            title_en: Set(req.title_en),
            title_fr: Set(req.title_fr),
            content_en: Set(req.content_en),
            content_fr: Set(req.content_fr),
            version: Set(1),
            created_at: Set(chrono::Utc::now()),
            updated_at: Set(chrono::Utc::now()),
        };
        active.insert(&self.db).await.map_err(AppError::DatabaseError)
    }

    pub async fn update(
        &self,
        policy_id: Uuid,
        req: crate::api::dto::legal_policy::LegalPolicyUpdateRequest,
    ) -> AppResult<legal_policy::Model> {
        // fetch latest version to copy unchanged fields
        let latest = legal_policy::Entity::find()
            .filter(legal_policy::Column::PolicyId.eq(policy_id))
            .order_by_desc(legal_policy::Column::Version)
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)?
            .ok_or_else(|| AppError::NotFound("Legal policy not found".into()))?;

        let new_version = latest.version + 1;
        let active = legal_policy::ActiveModel {
            id: Set(Uuid::new_v4()),
            policy_id: Set(policy_id),
            slug: Set(latest.slug),
            title_en: Set(req.title_en.unwrap_or(latest.title_en)),
            title_fr: Set(req.title_fr.unwrap_or(latest.title_fr)),
            content_en: Set(req.content_en.unwrap_or(latest.content_en)),
            content_fr: Set(req.content_fr.unwrap_or(latest.content_fr)),
            version: Set(new_version),
            created_at: Set(chrono::Utc::now()),
            updated_at: Set(chrono::Utc::now()),
        };
        active.insert(&self.db).await.map_err(AppError::DatabaseError)
    }
}
