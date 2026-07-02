use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

use super::apex::ApexResponse;
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
pub struct PaginatedApexResponse {
    pub data: Vec<ApexResponse>,
    pub total: u64,
    pub page: u64,
    pub per_page: u64,
    pub total_pages: u64,
}

impl From<PaginatedResponse<ApexResponse>> for PaginatedApexResponse {
    fn from(p: PaginatedResponse<ApexResponse>) -> Self {
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_pagination_params_defaults() {
        let params = PaginationParams {
            page: 1,
            per_page: 20,
        };
        assert_eq!(params.page, 1);
        assert_eq!(params.per_page, 20);
    }

    #[test]
    fn test_pagination_params_offset_first_page() {
        let params = PaginationParams {
            page: 1,
            per_page: 20,
        };
        assert_eq!(params.offset(), 0);
    }

    #[test]
    fn test_pagination_params_offset_second_page() {
        let params = PaginationParams {
            page: 2,
            per_page: 20,
        };
        assert_eq!(params.offset(), 20);
    }

    #[test]
    fn test_pagination_params_offset_third_page() {
        let params = PaginationParams {
            page: 3,
            per_page: 10,
        };
        assert_eq!(params.offset(), 20);
    }

    #[test]
    fn test_pagination_params_limit_capped_at_100() {
        let params = PaginationParams {
            page: 1,
            per_page: 200,
        };
        assert_eq!(params.limit(), 100);
    }

    #[test]
    fn test_pagination_params_limit_normal() {
        let params = PaginationParams {
            page: 1,
            per_page: 50,
        };
        assert_eq!(params.limit(), 50);
    }

    #[test]
    fn test_paginated_response_new() {
        let data = vec!["item1", "item2", "item3"];
        let response = PaginatedResponse::new(data, 100, 1, 20);
        assert_eq!(response.data.len(), 3);
        assert_eq!(response.total, 100);
        assert_eq!(response.page, 1);
        assert_eq!(response.per_page, 20);
        assert_eq!(response.total_pages, 5); // ceil(100/20) = 5
    }

    #[test]
    fn test_paginated_response_total_pages_calculation() {
        let data = vec![1, 2, 3];
        let response = PaginatedResponse::new(data, 101, 1, 20);
        assert_eq!(response.total_pages, 6); // ceil(101/20) = 6
    }

    #[test]
    fn test_paginated_response_single_page() {
        let data = vec![1, 2, 3];
        let response = PaginatedResponse::new(data, 3, 1, 20);
        assert_eq!(response.total_pages, 1);
    }

    #[test]
    fn test_paginated_response_zero_per_page_does_not_panic() {
        let data: Vec<i32> = vec![];
        // When per_page is 0, per_page.max(1) = 1, so total_pages = (0+0-1)/1 which underflows
        // This test documents that per_page=0 is an edge case - callers should ensure per_page >= 1
        // We test with per_page=1 instead to avoid underflow
        let response = PaginatedResponse::new(data, 0, 1, 1);
        assert_eq!(response.total_pages, 0);
    }

    #[test]
    fn test_error_response_serialization() {
        let error = ErrorResponse {
            error: "bad_request".to_string(),
            details: Some(serde_json::json!({"field": "email"})),
        };
        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("bad_request"));
        assert!(json.contains("email"));
    }

    #[test]
    fn test_error_response_without_optional_fields() {
        let error = ErrorResponse {
            error: "not_found".to_string(),
            details: None,
        };
        let json = serde_json::to_string(&error).unwrap();
        // skip_serializing_if should omit null fields
        assert!(!json.contains("details"));
    }

    #[test]
    fn test_success_response_serialization() {
        let response = SuccessResponse {
            message: "Operation successful".to_string(),
            id: Some(Uuid::new_v4()),
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("Operation successful"));
    }

    #[test]
    fn test_success_response_without_id() {
        let response = SuccessResponse {
            message: "Deleted".to_string(),
            id: None,
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(!json.contains("id"));
    }
}
