use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "uploaded_files")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub submission_id: Uuid,
    pub original_name: String,
    #[sea_orm(nullable)]
    pub mime_type: Option<String>,
    pub storage_key: String,
    #[sea_orm(nullable)]
    pub size_bytes: Option<i64>,
    #[sea_orm(nullable)]
    pub uploaded_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
