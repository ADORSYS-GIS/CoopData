use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use crate::entities::{
    mambu_account_mapping, mambu_branch_link, mambu_product_mapping, mambu_sync_item,
    mambu_sync_run,
};

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MambuStatusResponse {
    pub configured: bool,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MambuBranchResponse {
    pub id: String,
    pub name: String,
    pub state: Option<String>,
    pub region: Option<String>,
    pub linked_cooperative_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MambuCooperativeOption {
    pub id: Uuid,
    pub name: String,
    pub institution_type: Option<String>,
    pub linked_mambu_branch_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MambuLinkResponse {
    pub cooperative_id: Uuid,
    pub mambu_branch_id: String,
    pub linked_by: Option<String>,
    pub updated_at: DateTime<Utc>,
}

impl From<mambu_branch_link::Model> for MambuLinkResponse {
    fn from(m: mambu_branch_link::Model) -> Self {
        Self {
            cooperative_id: m.cooperative_id,
            mambu_branch_id: m.mambu_branch_id,
            linked_by: m.linked_by,
            updated_at: m.updated_at,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpsertMambuLinkRequest {
    pub cooperative_id: Uuid,
    pub mambu_branch_id: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct StartMambuSyncRequest {
    pub year: i32,
    pub month: u32,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MambuSyncRunResponse {
    pub id: Uuid,
    pub reporting_year: i32,
    pub month: i16,
    pub status: String,
    pub started_by: Option<String>,
    pub total_saccos: i32,
    pub error: Option<String>,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
}

impl From<mambu_sync_run::Model> for MambuSyncRunResponse {
    fn from(m: mambu_sync_run::Model) -> Self {
        Self {
            id: m.id,
            reporting_year: m.reporting_year,
            month: m.month,
            status: m.status,
            started_by: m.started_by,
            total_saccos: m.total_saccos,
            error: m.error,
            started_at: m.started_at,
            finished_at: m.finished_at,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MambuSyncWarning {
    pub code: String,
    pub severity: String,
    pub count: u64,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MambuSyncItemResponse {
    pub id: Uuid,
    pub cooperative_id: Option<Uuid>,
    pub cooperative_name: Option<String>,
    pub mambu_branch_id: String,
    pub status: String,
    pub submission_id: Option<Uuid>,
    pub members: i32,
    pub savings_accounts: i32,
    pub loans: i32,
    pub fixed_deposits: i32,
    pub ledger_lines: i32,
    pub unmapped_ledger_accounts: i32,
    pub warnings: Vec<MambuSyncWarning>,
    pub error: Option<String>,
}

impl MambuSyncItemResponse {
    pub fn from_model(m: mambu_sync_item::Model, cooperative_name: Option<String>) -> Self {
        let warnings = serde_json::from_value(m.warnings).unwrap_or_default();
        Self {
            id: m.id,
            cooperative_id: m.cooperative_id,
            cooperative_name,
            mambu_branch_id: m.mambu_branch_id,
            status: m.status,
            submission_id: m.submission_id,
            members: m.members,
            savings_accounts: m.savings_accounts,
            loans: m.loans,
            fixed_deposits: m.fixed_deposits,
            ledger_lines: m.ledger_lines,
            unmapped_ledger_accounts: m.unmapped_ledger_accounts,
            warnings,
            error: m.error,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MambuSyncDetailResponse {
    pub run: MambuSyncRunResponse,
    pub items: Vec<MambuSyncItemResponse>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MambuGlAccountResponse {
    pub gl_code: String,
    pub name: Option<String>,
    pub account_type: String,
    pub usage: Option<String>,
    pub currency: Option<String>,
    pub mapped_to: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CoopAccountOption {
    pub account_code: i32,
    pub account_name: String,
    pub category: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MambuAccountMappingResponse {
    pub mambu_gl_code: String,
    pub coop_account_code: i32,
    pub sign: i16,
}

impl From<mambu_account_mapping::Model> for MambuAccountMappingResponse {
    fn from(m: mambu_account_mapping::Model) -> Self {
        Self {
            mambu_gl_code: m.mambu_gl_code,
            coop_account_code: m.coop_account_code,
            sign: m.sign,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpsertMambuAccountMappingRequest {
    pub mambu_gl_code: String,
    pub coop_account_code: i32,
    pub sign: i16,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MambuProductMappingResponse {
    pub mambu_product_id: String,
    pub product_kind: String,
    pub mapped_type: String,
}

impl From<mambu_product_mapping::Model> for MambuProductMappingResponse {
    fn from(m: mambu_product_mapping::Model) -> Self {
        Self {
            mambu_product_id: m.mambu_product_id,
            product_kind: m.product_kind,
            mapped_type: m.mapped_type,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpsertMambuProductMappingRequest {
    pub mambu_product_id: String,
    pub product_kind: String,
    pub mapped_type: String,
}

/// Result of a branch lookup by ID. The name is empty when the branch is already
/// linked to another cooperative.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MambuBranchPreviewResponse {
    pub id: String,
    pub name: Option<String>,
    pub available: bool,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MambuCooperativeLinkResponse {
    pub cooperative_id: Uuid,
    pub mambu_branch_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SetMambuBranchRequest {
    pub mambu_branch_id: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MambuCooperativeStatusResponse {
    pub configured: bool,
    pub linked: bool,
    pub mambu_branch_id: Option<String>,
    pub running: bool,
    pub cooldown_seconds_left: i64,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct StartApexMambuSyncRequest {
    pub year: i32,
    pub month: u32,
    /// Sync only this cooperative. All linked cooperatives of the apex when empty.
    pub cooperative_id: Option<Uuid>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MambuProductResponse {
    pub id: String,
    pub name: Option<String>,
    pub product_kind: String,
    pub product_type: Option<String>,
    pub mapped_type: Option<String>,
}
