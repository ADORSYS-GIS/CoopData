// src/repositories/legal_policy_repository.rs
use crate::database::Database;
use crate::entities::legal_policy;
use crate::error::{AppError, AppResult};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};

#[derive(Clone)]
pub struct LegalPolicyRepository {
    db: Database,
}

impl LegalPolicyRepository {
    pub fn new(db: impl Into<Database>) -> Self {
        Self { db: db.into() }
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
}
