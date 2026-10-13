use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

/// Status of one language of one generated report PDF.
#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "report_exports")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub report_key: String,
    pub lang: String,
    pub status: String,
    pub storage_key: Option<String>,
    /// Internal failure detail for operators; never returned by the API.
    pub error: Option<String>,
    pub started_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}

pub const STATUS_PREPARING: &str = "preparing";
pub const STATUS_READY: &str = "ready";
pub const STATUS_FAILED: &str = "failed";
