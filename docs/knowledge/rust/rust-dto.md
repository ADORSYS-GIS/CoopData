# Rust DTO (Data Transfer Object) Guide

> **Goal**: Define clear request/response types that validate input and document the API.
> **Rule**: DTOs are for API boundaries only. Never use database entities as direct API responses.

## File Structure

```
src/api/dto/
├── mod.rs                # Re-exports all DTOs
├── common.rs             # Shared DTOs (pagination, etc.)
├── user.rs               # User-related DTOs
├── organization.rs       # Organization DTOs
└── assessment.rs         # Assessment DTOs
```

---

## Pattern 1: Request DTO

**File**: `src/api/dto/organization.rs`

```rust
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;

// ============================================
// CREATE REQUEST
// ============================================

/// Request body for creating a new organization
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct OrganizationCreateRequest {
    /// Organization display name (required)
    #[schema(example = "Acme Corporation")]
    pub name: String,

    /// Associated domains for the organization
    pub domains: Vec<OrganizationDomainRequest>,

    /// Redirect URL after authentication
    #[serde(rename = "redirectUrl")]
    pub redirect_url: String,

    /// Organization enabled status
    #[schema(example = "true")]
    pub enabled: String,

    /// Custom attributes (key-value pairs)
    pub attributes: Option<HashMap<String, Vec<String>>>,
}

impl OrganizationCreateRequest {
    /// Validate the request
    pub fn validate(&self) -> Result<(), Vec<String>> {
        let mut errors = Vec::new();

        if self.name.trim().is_empty() {
            errors.push("Name is required".to_string());
        }

        if self.name.len() > 255 {
            errors.push("Name must be less than 255 characters".to_string());
        }

        if self.domains.is_empty() {
            errors.push("At least one domain is required".to_string());
        }

        if self.redirect_url.trim().is_empty() {
            errors.push("Redirect URL is required".to_string());
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(errors)
        }
    }
}

// ============================================
// UPDATE REQUEST
// ============================================

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct OrganizationUpdateRequest {
    pub name: String,
    pub domains: Vec<OrganizationDomainRequest>,
    pub attributes: Option<HashMap<String, Vec<String>>>,
}

// ============================================
// DOMAIN SUB-DTO
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct OrganizationDomainRequest {
    #[schema(example = "acme.com")]
    pub name: String,
}

// ============================================
// RESPONSE DTO
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct OrganizationDomain {
    pub name: String,
    pub verified: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct KeycloakOrganization {
    pub id: String,
    pub name: String,
    pub alias: Option<String>,
    pub enabled: bool,
    pub description: Option<String>,
    #[serde(rename = "redirectUrl")]
    pub redirect_url: Option<String>,
    pub domains: Option<Vec<OrganizationDomain>>,
    pub attributes: Option<serde_json::Value>,
}

// ============================================
// FROM IMPLEMENTATION (Entity -> DTO)
// ============================================

impl From<crate::entities::organizations::Model> for KeycloakOrganization {
    fn from(model: crate::entities::organizations::Model) -> Self {
        Self {
            id: model.id,
            name: model.name,
            alias: model.alias,
            enabled: model.enabled,
            description: model.description,
            redirect_url: model.redirect_url,
            domains: None, // Populated separately if needed
            attributes: model.attributes,
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

**File**: `src/api/dto/assessment.rs`

```rust
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use chrono::DateTime;

// ============================================
// CREATE REQUEST
// ============================================

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct AssessmentCreateRequest {
    pub organization_id: String,
    pub cooperation_id: Option<String>,
    pub document_title: String,
    pub dimensions_id: Option<serde_json::Value>,
}

// ============================================
// UPDATE REQUEST
// ============================================

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct AssessmentUpdateRequest {
    pub document_title: Option<String>,
    pub status: Option<String>,
    pub dimensions_id: Option<serde_json::Value>,
}

// ============================================
// RESPONSE WITH RELATIONSHIPS
// ============================================

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct AssessmentResponse {
    pub id: Uuid,
    pub organization_id: String,
    pub cooperation_id: Option<String>,
    pub document_title: String,
    pub status: String,
    pub started_at: Option<DateTime<chrono::Utc>>,
    pub completed_at: Option<DateTime<chrono::Utc>>,
    pub created_at: DateTime<chrono::Utc>,
    pub updated_at: DateTime<chrono::Utc>,

    /// Nested relationships (populated when requested)
    pub dimensions: Option<Vec<DimensionSummary>>,
    pub gaps: Option<Vec<GapSummary>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct DimensionSummary {
    pub id: Uuid,
    pub name: String,
    pub current_score: Option<i32>,
    pub desired_score: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct GapSummary {
    pub id: Uuid,
    pub dimension_name: String,
    pub gap_score: i32,
}

// ============================================
// FROM IMPLEMENTATION
// ============================================

impl From<crate::entities::assessments::Model> for AssessmentResponse {
    fn from(model: crate::entities::assessments::Model) -> Self {
        Self {
            id: model.assessment_id,
            organization_id: model.organization_id,
            cooperation_id: model.cooperation_id,
            document_title: model.document_title,
            status: model.status.to_string(),
            started_at: model.started_at,
            completed_at: model.completed_at,
            created_at: model.created_at,
            updated_at: model.updated_at,
            dimensions: None,
            gaps: None,
        }
    }
}

impl AssessmentResponse {
    /// Attach related dimensions
    pub fn with_dimensions(mut self, dimensions: Vec<DimensionSummary>) -> Self {
        self.dimensions = Some(dimensions);
        self
    }

    /// Attach related gaps
    pub fn with_gaps(mut self, gaps: Vec<GapSummary>) -> Self {
        self.gaps = Some(gaps);
        self
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
pub mod assessment;
pub mod dimension;
pub mod user;
pub mod report;

// Re-export commonly used types
pub use common::{PaginationMeta, PaginatedResponse, PaginationQuery};
pub use organization::{
    OrganizationCreateRequest,
    OrganizationUpdateRequest,
    OrganizationDomainRequest,
    KeycloakOrganization,
};
pub use assessment::{
    AssessmentCreateRequest,
    AssessmentUpdateRequest,
    AssessmentResponse,
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
