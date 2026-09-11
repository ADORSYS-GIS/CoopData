// src/entities/legal_policy.rs
use sea_orm::entity::prelude::*;
use sea_orm::DeriveEntityModel;
use sea_orm::DerivePrimaryKey;
use sea_orm::DeriveRelation;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use chrono::{DateTime, Utc};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "legal_policies")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    /// Logical identifier that groups versions of the same policy
    pub policy_id: Uuid,
    /// URL‑safe slug (e.g. "privacy-policy")
    pub slug: String,
    /// Human readable title (English)
    pub title_en: String,
    /// Human readable title (French)
    pub title_fr: String,
    /// Markdown content (English)
    pub content_en: String,
    /// Markdown content (French)
    pub content_fr: String,
    /// Version number, starting at 1 and incremented on each edit
    pub version: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl Related<super::user::Entity> for Entity {
    fn to() -> sea_orm::RelationDef {
        // Example relation if you need to track who created it
        // Relation::User.def()
        panic!("No relation defined");
    }
}

impl ActiveModelBehavior for ActiveModel {}
