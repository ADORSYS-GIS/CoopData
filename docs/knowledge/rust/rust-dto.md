# Rust DTO (Data Transfer Object) Guide

> **Goal**: Define clear request/response types that validate input and document the API.
> **Rule**: DTOs are for API boundaries only. Never use database entities as direct API responses.

## File Structure

```
src/api/dto/
├── mod.rs                           # Re-exports all DTOs
├── common.rs                        # Shared DTOs (pagination, error response)
├── organization.rs                 # Organization DTOs
├── submission.rs                    # Submission DTOs
├── cooperative.rs                   # Cooperative DTOs
├── federation.rs                    # Federation DTOs
├── apex.rs                          # Apex DTOs
├── member.rs                        # Member/user DTOs
├── financial_statement.rs          # Financial statement DTOs
├── non_financial_indicator.rs      # Non-financial indicator DTOs
├── questionnaire.rs                 # Questionnaire DTOs
└── ... (20+ DTO modules total)
```

---

## Pattern 1: Request DTO

**File**: `src/api/dto/organization.rs`

```rust
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

// ============================================
// CREATE REQUEST
// ============================================

/// Request body for creating a new organization
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateOrganizationRequest {
    /// Organization display name (required)
    #[schema(example = "Eswatini Federation")]
    pub name: String,

    /// Organization type
    #[serde(default)]
    pub organization_type: Option<String>,

    /// Registration number
    #[serde(default)]
    pub registration_number: Option<String>,

    /// Contact email
    #[serde(default)]
    pub email: Option<String>,

    /// Contact phone
    #[serde(default)]
    pub phone: Option<String>,
}

// ============================================
// UPDATE REQUEST
// ============================================

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateOrganizationRequest {
    pub name: Option<String>,
    pub organization_type: Option<String>,
    pub registration_number: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub is_active: Option<bool>,
}

// ============================================
// RESPONSE DTO
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct OrganizationResponse {
    pub id: uuid::Uuid,
    pub name: String,
    pub organization_type: Option<String>,
    pub registration_number: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub is_active: bool,
    pub created_at: chrono::DateTime<chrono::Utc>,
    pub updated_at: chrono::DateTime<chrono::Utc>,
}

// ============================================
// FROM IMPLEMENTATION (Entity -> DTO)
// ============================================

impl From<crate::entities::organization::Model> for OrganizationResponse {
    fn from(model: crate::entities::organization::Model) -> Self {
        Self {
            id: model.id,
            name: model.name,
            organization_type: model.organization_type,
            registration_number: model.registration_number,
            email: model.email,
            phone: model.phone,
            is_active: model.is_active,
            created_at: model.created_at,
            updated_at: model.updated_at,
        }
    }
}
```

---

## Pattern 2: List Response with Pagination

**File**: `src/api/dto/common.rs`

```rust
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

/// Standard pagination metadata
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PaginationMeta {
    pub page: u32,
    pub per_page: u32,
    pub total: u64,
    pub total_pages: u32,
}

/// Standard paginated list response
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PaginatedResponse<T> {
    pub data: Vec<T>,
    pub pagination: PaginationMeta,
}

impl<T> PaginatedResponse<T> {
    pub fn new(data: Vec<T>, page: u32, per_page: u32, total: u64) -> Self {
        let total_pages = ((total as f64) / (per_page as f64)).ceil() as u32;
        Self {
            data,
            pagination: PaginationMeta {
                page,
                per_page,
                total,
                total_pages: total_pages,
            },
        }
    }
}

/// Query parameters for pagination
#[derive(Debug, Deserialize, ToSchema)]
pub struct PaginationQuery {
    #[serde(default = "default_page")]
    pub page: u32,

    #[serde(default = "default_per_page")]
    pub per_page: u32,
}

fn default_page() -> u32 { 1 }
fn default_per_page() -> u32 { 20 }

impl PaginationQuery {
    pub fn offset(&self) -> u32 {
        (self.page.saturating_sub(1)) * self.per_page
    }

    pub fn limit(&self) -> u32 {
        self.per_page.min(100) // Cap at 100
    }
}
```

---

## Pattern 3: Nested DTOs with Relationships

**File**: `src/api/dto/submission.rs`

```rust
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use chrono::DateTime;

// ============================================
// CREATE REQUEST
// ============================================

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateSubmissionRequest {
    /// Reporting year (e.g., 2024)
    pub reporting_year: i32,

    /// Submission method: "financial_statement" or "questionnaire"
    #[serde(default)]
    pub submission_method: Option<String>,

    /// Priority level
    #[serde(default)]
    pub priority: Option<i32>,

    /// Optional pre-generated ID for sync
    #[serde(default)]
    pub id: Option<Uuid>,
}

// ============================================
// UPDATE REQUEST
// ============================================

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct UpdateSubmissionRequest {
    pub status: Option<String>,
    pub priority: Option<i32>,
}

// ============================================
// RESPONSE WITH RELATIONSHIPS
// ============================================

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SubmissionResponse {
    pub id: Uuid,
    pub reference: Option<String>,
    pub cooperative_id: Uuid,
    pub reporting_year: i32,
    pub status: String,
    pub current_tier: String,
    pub submission_method: Option<String>,
    pub created_at: DateTime<chrono::Utc>,
    pub updated_at: DateTime<chrono::Utc>,

    /// Nested sections (populated when requested)
    pub sections: Option<Vec<SubmissionSectionResponse>>,
}

// ============================================
// FROM IMPLEMENTATION
// ============================================

impl From<crate::entities::submission::Model> for SubmissionResponse {
    fn from(model: crate::entities::submission::Model) -> Self {
        Self {
            id: model.id,
            reference: model.reference,
            cooperative_id: model.cooperative_id,
            reporting_year: model.reporting_year,
            status: model.status.as_str().to_string(),
            current_tier: model.current_tier.as_str().to_string(),
            submission_method: model.submission_method,
            created_at: model.created_at,
            updated_at: model.updated_at,
            sections: None,
        }
    }
}
```

---

## Pattern 4: Search/Filter DTOs

**File**: `src/api/dto/filter.rs`

```rust
use serde::{Deserialize, Serialize};
use utoipa::{IntoParams, ToSchema};

/// Search/filter parameters
#[derive(Debug, Deserialize, IntoParams, ToSchema)]
pub struct AssessmentFilters {
    /// Filter by organization ID
    pub organization_id: Option<String>,

    /// Filter by cooperation ID
    pub cooperation_id: Option<String>,

    /// Filter by status
    #[serde(default)]
    pub status: Option<String>,

    /// Search in document title
    #[serde(default)]
    pub search: Option<String>,

    /// Include related dimensions
    #[serde(default)]
    pub include_dimensions: bool,

    /// Include related gaps
    #[serde(default)]
    pub include_gaps: bool,
}

/// Sort parameters
#[derive(Debug, Deserialize, ToSchema)]
pub struct SortParams {
    /// Field to sort by
    pub sort_by: Option<String>,

    /// Sort direction
    #[serde(default = "default_sort_order")]
    pub sort_order: String,
}

fn default_sort_order() -> String { "asc".to_string() }

impl SortParams {
    pub fn is_descending(&self) -> bool {
        self.sort_order.to_lowercase() == "desc"
    }
}
```

---

## Pattern 5: Builder Pattern for Complex DTOs

**File**: `src/api/dto/report.rs`

```rust
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use chrono::DateTime;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ConsolidatedReportResponse {
    pub report_id: Uuid,
    pub organization_id: String,
    pub generated_at: DateTime<chrono::Utc>,
    pub summary: ReportSummary,
    pub dimensions: Vec<DimensionReport>,
    pub recommendations: Vec<RecommendationItem>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ReportSummary {
    pub total_gaps: i32,
    pub avg_gap_score: f64,
    pub critical_gaps: i32,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct DimensionReport {
    pub dimension_id: Uuid,
    pub name: String,
    pub current_level: i32,
    pub desired_level: i32,
    pub gap_score: i32,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RecommendationItem {
    pub id: Uuid,
    pub title: String,
    pub priority: String,
}

/// Builder for creating complex report responses
pub struct ReportBuilder {
    report_id: Option<Uuid>,
    organization_id: Option<String>,
    summary: Option<ReportSummary>,
    dimensions: Vec<DimensionReport>,
    recommendations: Vec<RecommendationItem>,
}

impl ReportBuilder {
    pub fn new() -> Self {
        Self {
            report_id: None,
            organization_id: None,
            summary: None,
            dimensions: Vec::new(),
            recommendations: Vec::new(),
        }
    }

    pub fn report_id(mut self, id: Uuid) -> Self {
        self.report_id = Some(id);
        self
    }

    pub fn organization_id(mut self, id: String) -> Self {
        self.organization_id = Some(id);
        self
    }

    pub fn summary(mut self, summary: ReportSummary) -> Self {
        self.summary = Some(summary);
        self
    }

    pub fn add_dimension(mut self, dimension: DimensionReport) -> Self {
        self.dimensions.push(dimension);
        self
    }

    pub fn add_recommendation(mut self, rec: RecommendationItem) -> Self {
        self.recommendations.push(rec);
        self
    }

    pub fn build(self) -> Result<ConsolidatedReportResponse, String> {
        let report_id = self.report_id.ok_or("report_id is required")?;
        let organization_id = self.organization_id.ok_or("organization_id is required")?;
        let summary = self.summary.ok_or("summary is required")?;

        Ok(ConsolidatedReportResponse {
            report_id,
            organization_id,
            generated_at: chrono::Utc::now(),
            summary,
            dimensions: self.dimensions,
            recommendations: self.recommendations,
        })
    }
}
```

---

## Pattern 6: DTOs module file

**File**: `src/api/dto/mod.rs`

```rust
pub mod common;
pub mod organization;
pub mod submission;
pub mod cooperative;
pub mod federation;
pub mod apex;
pub mod member;
pub mod financial_statement;
pub mod non_financial_indicator;
pub mod questionnaire;
pub mod verification;

// Re-export commonly used types
pub use common::{
    PaginationMeta, PaginatedResponse, PaginationParams,
    ErrorResponse, SuccessResponse,
};
pub use organization::{
    CreateOrganizationRequest,
    UpdateOrganizationRequest,
    OrganizationResponse,
    PaginatedOrganizationResponse,
};
pub use submission::{
    CreateSubmissionRequest,
    UpdateSubmissionRequest,
    SubmissionResponse,
    SubmissionReviewResponse,
};
```

---

## Best Practices

1. **Separate request/response**: Never use the same DTO for both
2. **Validate in DTO**: Add `validate()` method to request DTOs
3. **Rename fields**: Use `#[serde(rename = "...")]` for camelCase API
4. **Document fields**: Use `#[schema]` for example values
5. **Use Option sparingly**: Only for truly optional fields
6. **From/Into traits**: Implement conversion from entities to DTOs
7. **Builder pattern**: Use for complex response construction
8. **Nested DTOs**: Separate structs for nested objects
9. **Pagination**: Include standard pagination metadata
10. **Never expose entities**: Convert entities to DTOs before returning

## Checklist

- [ ] Request and response DTOs are separate
- [ ] `#[serde(rename)]` used for camelCase
- [ ] `#[schema]` examples provided
- [ ] Input validation method added
- [ ] `From` trait implemented for conversion
- [ ] Pagination DTOs defined
- [ ] Builder pattern for complex responses
- [ ] Exported in `mod.rs`
- [ ] Documentation comments added
- [ ] Optional fields properly marked
