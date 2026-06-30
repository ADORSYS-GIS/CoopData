use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::organization::OrganizationResponse;
use super::user::UserResponse;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PaginationParams {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_per_page")]
    pub per_page: u64,
}

fn default_page() -> u64 {
    1
}
fn default_per_page() -> u64 {
    20
}

impl PaginationParams {
    pub fn offset(&self) -> u64 {
        (self.page.saturating_sub(1)) * self.per_page
    }

    pub fn limit(&self) -> u64 {
        self.per_page.min(100)
    }
}

/// Generic paginated response — not registered as a schema directly.
/// Use the concrete type aliases below for OpenAPI schema registration.
#[derive(Debug, Serialize, Deserialize)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub total: u64,
    pub page: u64,
    pub per_page: u64,
    pub total_pages: u64,
}

impl<T> PaginatedResponse<T> {
    pub fn new(data: Vec<T>, total: u64, page: u64, per_page: u64) -> Self {
        let total_pages = (total + per_page - 1) / per_page.max(1);
        Self {
            data,
            total,
            page,
            per_page,
            total_pages,
        }
    }
}

// Concrete paginated response types for OpenAPI schema generation.
// utoipa cannot handle generic type parameters in OpenAPI 3.0 schemas,
// so we define explicit type aliases with ToSchema derives.

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PaginatedOrganizationResponse {
    pub data: Vec<OrganizationResponse>,
    pub total: u64,
    pub page: u64,
    pub per_page: u64,
    pub total_pages: u64,
}

impl From<PaginatedResponse<OrganizationResponse>> for PaginatedOrganizationResponse {
    fn from(p: PaginatedResponse<OrganizationResponse>) -> Self {
        Self {
            data: p.data,
            total: p.total,
            page: p.page,
            per_page: p.per_page,
            total_pages: p.total_pages,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PaginatedUserResponse {
    pub data: Vec<UserResponse>,
    pub total: u64,
    pub page: u64,
    pub per_page: u64,
    pub total_pages: u64,
}

impl From<PaginatedResponse<UserResponse>> for PaginatedUserResponse {
    fn from(p: PaginatedResponse<UserResponse>) -> Self {
        Self {
            data: p.data,
            total: p.total,
            page: p.page,
            per_page: p.per_page,
            total_pages: p.total_pages,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ErrorResponse {
    pub error: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SuccessResponse {
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<Uuid>,
}
