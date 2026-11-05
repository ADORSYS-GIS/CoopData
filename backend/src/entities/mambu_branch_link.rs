use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "mambu_branch_links")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub cooperative_id: Uuid,
    pub mambu_branch_id: String,
    pub linked_by: Option<String>,
    /// Takes part in the automatic monthly sync.
    pub auto_sync: bool,
    /// Month (YYYY-MM) of the last automatic run that claimed this link.
    pub last_auto_sync_month: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
