# Rust Repositories Guide

> **Goal**: Encapsulate database operations in repository pattern for clean separation of concerns.
> **Rule**: ONE repository per entity. Repositories contain ONLY database queries, no business logic.

## File Structure

```
src/repositories/
├── mod.rs                           # Re-exports all repositories
├── submission.rs                   # Submission repository
├── submission_section.rs           # Submission section repository
├── submission_review.rs            # Submission review repository
├── cooperative.rs                  # Cooperative repository
├── federation.rs                   # Federation repository
├── apex.rs                         # Apex repository
├── organization.rs                 # Organization repository
├── user.rs                         # User repository
├── member.rs                        # Member repository
├── financial_statement.rs          # Financial statement repository
├── non_financial_indicator_*.rs    # NF indicator repositories
├── questionnaire*.rs               # Questionnaire repositories
├── audit_log.rs                    # Audit log repository
└── ... (30+ repositories total)
```

---

## Pattern 1: Standard CRUD Repository

**File**: `src/repositories/submission.rs`

```rust
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, EntityTrait, QueryFilter, QueryOrder, Set,
};
use uuid::Uuid;

use crate::entities::enums::{ReviewTier, SubmissionStatus};
use crate::entities::submission::{self, ActiveModel, Column, Entity};
use crate::error::AppResult;
use crate::repositories::db_query;

/// Repository for Submission entity operations.
/// Uses struct with db field (not static methods) for metrics tracking.
#[derive(Clone)]
pub struct SubmissionRepository {
    db: DatabaseConnection,
}

impl SubmissionRepository {
    /// Create new repository instance
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    // ============================================
    // READ - Single
    // ============================================

    /// Find submission by ID
    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<submission::Model>> {
        db_query("submission", "find_by_id", async {
            Entity::find_by_id(id)
                .one(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    /// Find submission by ID or return error
    pub async fn find_by_id_or_error(&self, id: Uuid) -> AppResult<submission::Model> {
        self.find_by_id(id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Submission not found: {}", id)))
    }

    // ============================================
    // READ - List
    // ============================================

    /// Find all submissions for a cooperative
    pub async fn find_by_cooperative(
        &self,
        cooperative_id: Uuid,
    ) -> AppResult<Vec<submission::Model>> {
        db_query("submission", "find_by_cooperative", async {
            Entity::find()
                .filter(Column::CooperativeId.eq(cooperative_id))
                .order_by_desc(Column::CreatedAt)
                .all(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    /// Find submissions by status
    pub async fn find_by_status(
        &self,
        status: SubmissionStatus,
    ) -> AppResult<Vec<submission::Model>> {
        db_query("submission", "find_by_status", async {
            Entity::find()
                .filter(Column::Status.eq(status))
                .order_by_desc(Column::CreatedAt)
                .all(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    /// Find submissions by cooperative and reporting year
    pub async fn find_by_cooperative_and_year(
        &self,
        cooperative_id: Uuid,
        reporting_year: i32,
    ) -> AppResult<Option<submission::Model>> {
        db_query("submission", "find_by_cooperative_and_year", async {
            Entity::find()
                .filter(Column::CooperativeId.eq(cooperative_id))
                .filter(Column::ReportingYear.eq(reporting_year))
                .one(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    // ============================================
    // CREATE
    // ============================================

    /// Create a new submission
    pub async fn create(&self, data: ActiveModel) -> AppResult<submission::Model> {
        db_query("submission", "create", async {
            data.insert(&self.db).await.map_err(Into::into)
        })
        .await
    }

    // ============================================
    // UPDATE
    // ============================================

    /// Update submission status
    pub async fn update_status(
        &self,
        id: Uuid,
        status: SubmissionStatus,
    ) -> AppResult<submission::Model> {
        let mut model = self.find_by_id_or_error(id).await?;
        model.status = Set(status);
        model.updated_at = Set(chrono::Utc::now());
        model.update(&self.db).await.map_err(Into::into)
    }

    // ============================================
    // DELETE
    // ============================================

    /// Delete submission by ID
    pub async fn delete(&self, id: Uuid) -> AppResult<bool> {
        db_query("submission", "delete", async {
            let result = Entity::delete_by_id(id)
                .exec(&self.db)
                .await
                .map_err(Into::into)?;
            Ok(result.rows_affected > 0)
        })
        .await
    }
}
```

**Key patterns**:
- Struct with `db` field (not static methods) for metrics tracking
- Use `db_query()` wrapper for performance metrics
- Return `Option<T>` for find_by_id, `Result<T>` for find_by_id_or_error
- Use `#[derive(Clone)]` on repository struct

---

## Pattern 2: Repository with Transactions

**File**: `src/repositories/submission.rs`

```rust
use sea_orm::{TransactionTrait, Set};
use uuid::Uuid;

pub struct SubmissionRepository {
    db: DatabaseConnection,
}

impl SubmissionRepository {
    /// Create submission with sections in a transaction
    pub async fn create_with_sections(
        &self,
        submission: ActiveModel,
        sections: Vec<SubmissionSectionActiveModel>,
    ) -> AppResult<submission::Model> {
        // Start transaction
        let txn = self.db.begin().await.map_err(AppError::from)?;

        // Create submission
        let created = submission.insert(&txn).await.map_err(AppError::from)?;

        // Create all sections
        for mut section in sections {
            section.submission_id = Set(created.id);
            section.insert(&txn).await.map_err(AppError::from)?;
        }

        // Commit transaction
        txn.commit().await.map_err(AppError::from)?;

        tracing::info!(
            submission_id = %created.id,
            sections_count = sections.len(),
            "Created submission with sections"
        );

        Ok(created)
    }

    /// Delete submission and cascade delete sections
    pub async fn delete_cascade(&self, id: Uuid) -> AppResult<bool> {
        let txn = self.db.begin().await.map_err(AppError::from)?;

        // Delete sections first
        submission_section::Entity::delete_many()
            .filter(submission_section::Column::SubmissionId.eq(id))
            .exec(&txn)
            .await
            .map_err(AppError::from)?;

        // Delete submission
        let result = submission::Entity::delete_by_id(id)
            .exec(&txn)
            .await
            .map_err(AppError::from)?;

        txn.commit().await.map_err(AppError::from)?;

        Ok(result.rows_affected > 0)
    }
}
```

---

## Pattern 3: Repository with Related Queries

**File**: `src/repositories/submission_section.rs`

```rust
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
use uuid::Uuid;

pub struct SubmissionSectionRepository {
    db: DatabaseConnection,
}

impl SubmissionSectionRepository {
    /// Find all sections for a submission
    pub async fn find_by_submission(
        &self,
        submission_id: Uuid,
    ) -> AppResult<Vec<submission_section::Model>> {
        submission_section::Entity::find()
            .filter(submission_section::Column::SubmissionId.eq(submission_id))
            .order_by_asc(submission_section::Column::DisplayOrder)
            .all(&self.db)
            .await
            .map_err(AppError::from)
    }

    /// Find section with submission details
    pub async fn find_with_submission(
        &self,
        section_id: Uuid,
    ) -> AppResult<Option<submission_section::Model>> {
        submission_section::Entity::find_by_id(section_id)
            .one(&self.db)
            .await
            .map_err(AppError::from)
    }

    /// Count sections by submission
    pub async fn count_by_submission(&self, submission_id: Uuid) -> AppResult<u64> {
        submission_section::Entity::find()
            .filter(submission_section::Column::SubmissionId.eq(submission_id))
            .count(&self.db)
            .await
            .map_err(AppError::from)
    }
}
```

---

## Pattern 4: Repository Module Export

**File**: `src/repositories/mod.rs`

```rust
use metrics::histogram;
use std::future::Future;
use std::time::Instant;

use crate::error::AppResult;

/// Performance tracking wrapper for repository queries
pub async fn db_query<F, T>(entity: &str, operation: &str, f: F) -> AppResult<T>
where
    F: Future<Output = AppResult<T>>,
{
    let start = Instant::now();
    let result = f.await;
    let elapsed = start.elapsed().as_secs_f64();

    histogram!("coopdata_db_query_duration_seconds",
        "entity" => entity.to_string(),
        "operation" => operation.to_string()
    )
    .record(elapsed);

    result
}

// Entity repositories
pub mod abnormality_flag;
pub mod account_alias;
pub mod apex;
pub mod assessment;
pub mod audit_log;
pub mod balance_sheet_line_item;
pub mod chart_of_accounts;
pub mod cooperative;
pub mod custom_kpi_repository;
pub mod extraction_job;
pub mod farm_coop;
pub mod federation;
pub mod financial_statement;
pub mod fixed_deposit;
pub mod kpi_record;
pub mod loan;
pub mod member;
pub mod ministry_report_narratives;
pub mod non_financial_indicator_catalog;
pub mod non_financial_indicator_entry;
pub mod organization;
pub mod organization_label;
pub mod questionnaire;
pub mod questionnaire_template;
pub mod savings_account;
pub mod submission;
pub mod submission_review;
pub mod submission_section;
pub mod uploaded_file;
pub mod user;

// Re-export commonly used types
pub use submission::SubmissionRepository;
pub use cooperative::CooperativeRepository;
pub use federation::FederationRepository;
pub use apex::ApexRepository;
pub use organization::OrganizationRepository;
pub use user::UserRepository;
pub use audit_log::AuditLogRepository;
```

---

## Pattern 5: Pagination (Handled in Handlers)

Pagination is NOT done in repositories. Instead, repositories return full lists and handlers apply pagination:

**File**: `src/api/handlers/organizations.rs`

```rust
use crate::api::dto::{
    PaginatedOrganizationResponse, PaginatedResponse, PaginationParams,
};

pub async fn list_organizations(
    State(state): State<AppState>,
    Query(params): Query<PaginationParams>,
) -> AppResult<impl IntoResponse> {
    let repo = OrganizationRepository::new(state.db.clone());
    let organizations = repo.find_all().await?;

    // Convert to response DTOs
    let responses: Vec<OrganizationResponse> = organizations
        .into_iter()
        .map(Into::into)
        .collect();
    let total = responses.len() as u64;

    // Wrap in paginated response
    Ok((
        StatusCode::OK,
        Json(PaginatedOrganizationResponse::from(PaginatedResponse::new(
            responses,
            total,
            params.page,
            params.per_page,
        ))),
    ))
}
```

**Key points**:
- Repository returns `Vec<Model>` (full list)
- Handler applies pagination with `PaginatedResponse::new()`
- `PaginationParams` struct handles `page` and `per_page` query params
- Response wrapped in `PaginatedResponse<T>`

---

## Best Practices

1. **One entity = One repository**: Keep focused, single responsibility
2. **Struct with db field**: Use `#[derive(Clone)]` and `Repository::new(db)`
3. **Consistent naming**: `find_by_*`, `create`, `update`, `delete`
4. **Return AppResult**: Convert all errors with `.map_err(Into::into)`
5. **Use transactions**: For multi-entity operations (create_with_*)
6. **Use db_query wrapper**: For performance metrics tracking
7. **Handle not found**: Return `Option<T>` for find_by_id, error for *_or_error
8. **Use SeaORM queries**: Don't write raw SQL
9. **Pagination in handlers**: Repository returns full list, handler paginates
10. **Cloneable**: Derive Clone so repository can be stored in AppState

## Checklist

- [ ] Repository struct with `db: DatabaseConnection` field
- [ ] `#[derive(Clone)]` on repository struct
- [ ] `Repository::new(db)` constructor
- [ ] `find_by_id` returns `Option<T>`
- [ ] `find_by_id_or_error` returns `Result<T>`
- [ ] `find_all` returns `Vec<T>`
- [ ] `create` method
- [ ] `update` method
- [ ] `delete` method
- [ ] Transactions for related operations
- [ ] Exported in `mod.rs`
- [ ] All methods are async
- [ ] `AppResult<T>` return type
