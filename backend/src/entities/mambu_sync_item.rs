use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "mambu_sync_items")]
pub struct Model {
    #[sea_orm(primary_key, auto_increment = false)]
    pub id: Uuid,
    pub run_id: Uuid,
    pub cooperative_id: Option<Uuid>,
    pub mambu_branch_id: String,
    pub status: String,
    pub submission_id: Option<Uuid>,
    pub members: i32,
    pub savings_accounts: i32,
    pub loans: i32,
    pub fixed_deposits: i32,
    pub ledger_lines: i32,
    pub unmapped_ledger_accounts: i32,
    pub warnings: Json,
    pub error: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
