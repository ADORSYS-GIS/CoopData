# Rust Repositories Guide

> **Goal**: Encapsulate database operations in repository pattern for clean separation of concerns.
> **Rule**: ONE repository per entity. Repositories contain ONLY database queries, no business logic.

## File Structure

```
src/repositories/
├── mod.rs                  # Re-exports all repositories
├── assessments.rs          # Assessment repository
├── organizations.rs        # Organization repository
└── users.rs               # User repository
```

---

## Pattern 1: Standard CRUD Repository

**File**: `src/repositories/assessments.rs`

```rust
use crate::entities::assessments::{self, Entity as Assessments, AssessmentStatus};
use crate::error::{AppError, AppResult};
use sea_orm::*;
use uuid::Uuid;

/// Repository for Assessment entity operations.
/// All methods are async and use `AppResult<T>` for error handling.
pub struct AssessmentsRepository;

impl AssessmentsRepository {
    // ============================================
    // CREATE
    // ============================================

    /// Create a new assessment
    pub async fn create(
        db: &DbConn,
        assessment_data: assessments::ActiveModel,
    ) -> AppResult<assessments::Model> {
        assessment_data
            .insert(db)
            .await
            .map_err(AppError::from)
    }

    // ============================================
    // READ - Single
    // ============================================

    /// Find assessment by ID
    pub async fn find_by_id(
        db: &DbConn,
        assessment_id: Uuid,
    ) -> AppResult<Option<assessments::Model>> {
        Assessments::find_by_id(assessment_id)
            .one(db)
            .await
            .map_err(AppError::from)
    }

    /// Find assessment by ID or return error
    pub async fn find_by_id_or_error(
        db: &DbConn,
        assessment_id: Uuid,
    ) -> AppResult<assessments::Model> {
        Self::find_by_id(db, assessment_id)
            .await?
            .ok_or_else(|| AppError::NotFound(format!("Assessment not found: {}", assessment_id)))
    }

    // ============================================
    // READ - List
    // ============================================

    /// Find all assessments
    pub async fn find_all(db: &DbConn) -> AppResult<Vec<assessments::Model>> {
        Assessments::find()
            .all(db)
            .await
            .map_err(AppError::from)
    }

    /// Find assessments by organization ID
    pub async fn find_by_organization_id(
        db: &DbConn,
        organization_id: String,
    ) -> AppResult<Vec<assessments::Model>> {
        Assessments::find()
            .filter(assessments::Column::OrganizationId.eq(organization_id))
            .all(db)
            .await
            .map_err(AppError::from)
    }

    /// Find latest assessment by organization
    pub async fn find_latest_by_organization_id(
        db: &DbConn,
        organization_id: String,
    ) -> AppResult<Option<assessments::Model>> {
        Assessments::find()
            .filter(assessments::Column::OrganizationId.eq(organization_id))
            .order_by_desc(assessments::Column::CreatedAt)
            .one(db)
            .await
            .map_err(AppError::from)
    }

    /// Find completed assessments by organization
    pub async fn find_all_completed_by_organization_id(
        db: &DbConn,
        organization_id: String,
    ) -> AppResult<Vec<assessments::Model>> {
        Assessments::find()
            .filter(assessments::Column::OrganizationId.eq(organization_id))
            .filter(assessments::Column::Status.eq(AssessmentStatus::Completed))
            .order_by_desc(assessments::Column::CreatedAt)
            .all(db)
            .await
            .map_err(AppError::from)
    }

    /// Find by cooperation ID
    pub async fn find_by_cooperation_id(
        db: &DbConn,
        cooperation_id: String,
    ) -> AppResult<Vec<assessments::Model>> {
        Assessments::find()
            .filter(assessments::Column::CooperationId.eq(cooperation_id))
            .all(db)
            .await
            .map_err(AppError::from)
    }

    // ============================================
    // UPDATE
    // ============================================

    /// Update an existing assessment
    pub async fn update(
        db: &DbConn,
        assessment_id: Uuid,
        assessment_data: assessments::ActiveModel,
    ) -> AppResult<assessments::Model> {
        let assessment = Assessments::find_by_id(assessment_id)
            .one(db)
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Assessment not found".to_string()))?;

        let mut active_model: assessments::ActiveModel = assessment.into();

        // Only update fields that are set
        if assessment_data.organization_id.is_set() {
            active_model.organization_id = assessment_data.organization_id;
        }
        if assessment_data.document_title.is_set() {
            active_model.document_title = assessment_data.document_title;
        }
        if assessment_data.status.is_set() {
            active_model.status = assessment_data.status;
        }
        if assessment_data.started_at.is_set() {
            active_model.started_at = assessment_data.started_at;
        }
        if assessment_data.completed_at.is_set() {
            active_model.completed_at = assessment_data.completed_at;
        }
        if assessment_data.dimensions_id.is_set() {
            active_model.dimensions_id = assessment_data.dimensions_id;
        }

        active_model.updated_at = Set(chrono::Utc::now());

        active_model.update(db).await.map_err(AppError::from)
    }

    /// Update assessment status only
    pub async fn update_status(
        db: &DbConn,
        assessment_id: Uuid,
        status: AssessmentStatus,
    ) -> AppResult<assessments::Model> {
        let assessment = Self::find_by_id_or_error(db, assessment_id).await?;

        let mut active_model: assessments::ActiveModel = assessment.into();
        active_model.status = Set(status);
        active_model.updated_at = Set(chrono::Utc::now());

        active_model.update(db).await.map_err(AppError::from)
    }

    // ============================================
    // DELETE
    // ============================================

    /// Delete an assessment by ID
    pub async fn delete(db: &DbConn, assessment_id: Uuid) -> AppResult<bool> {
        let result = Assessments::delete_by_id(assessment_id)
            .exec(db)
            .await
            .map_err(AppError::from)?;

        Ok(result.rows_affected > 0)
    }

    /// Delete all assessments for an organization
    pub async fn delete_by_organization(
        db: &DbConn,
        organization_id: String,
    ) -> AppResult<u64> {
        let result = Assessments::delete_many()
            .filter(assessments::Column::OrganizationId.eq(organization_id))
            .exec(db)
            .await
            .map_err(AppError::from)?;

        Ok(result.rows_affected)
    }

    // ============================================
    // COUNT
    // ============================================

    /// Count assessments by organization
    pub async fn count_by_organization(
        db: &DbConn,
        organization_id: String,
    ) -> AppResult<u64> {
        Assessments::find()
            .filter(assessments::Column::OrganizationId.eq(organization_id))
            .count(db)
            .await
            .map_err(AppError::from)
    }

    /// Count assessments by status
    pub async fn count_by_status(
        db: &DbConn,
        status: AssessmentStatus,
    ) -> AppResult<u64> {
        Assessments::find()
            .filter(assessments::Column::Status.eq(status))
            .count(db)
            .await
            .map_err(AppError::from)
    }
}
```

---

## Pattern 2: Repository with Joins

**File**: `src/repositories/dimension_assessments.rs`

```rust
use crate::entities::{
    assessments,
    dimension_assessments,
    dimensions,
    DimensionAssessments,
    Dimensions,
};
use crate::error::{AppError, AppResult};
use sea_orm::*;
use uuid::Uuid;

pub struct DimensionAssessmentsRepository;

impl DimensionAssessmentsRepository {
    /// Find dimension assessment with related dimension
    pub async fn find_with_dimension(
        db: &DbConn,
        dimension_assessment_id: Uuid,
    ) -> AppResult<Option<(dimension_assessments::Model, Option<dimensions::Model>)>> {
        dimension_assessments::Entity::find_by_id(dimension_assessment_id)
            .find_also_related(dimensions::Entity)
            .one(db)
            .await
            .map_err(AppError::from)
    }

    /// Find all dimension assessments for an assessment with their dimensions
    pub async fn find_all_by_assessment_with_dimensions(
        db: &DbConn,
        assessment_id: Uuid,
    ) -> AppResult<Vec<(dimension_assessments::Model, dimensions::Model)>> {
        dimension_assessments::Entity::find()
            .filter(dimension_assessments::Column::AssessmentId.eq(assessment_id))
            .find_also_related(dimensions::Entity)
            .all(db)
            .await
            .map_err(AppError::from)?
            .into_iter()
            .map(|(da, d)| {
                d.map(|dimension| (da, dimension))
            })
            .collect::<Option<Vec<_>>>()
            .ok_or_else(|| AppError::NotFound("One or more dimensions not found".to_string()))
    }

    /// Find by assessment and dimension IDs
    pub async fn find_by_assessment_and_dimension(
        db: &DbConn,
        assessment_id: Uuid,
        dimension_id: Uuid,
    ) -> AppResult<Option<dimension_assessments::Model>> {
        dimension_assessments::Entity::find()
            .filter(dimension_assessments::Column::AssessmentId.eq(assessment_id))
            .filter(dimension_assessments::Column::DimensionId.eq(dimension_id))
            .one(db)
            .await
            .map_err(AppError::from)
    }
}
```

---

## Pattern 3: Repository with Transactions

**File**: `src/repositories/action_plans.rs`

```rust
use crate::entities::{action_plans, action_items};
use crate::error::{AppError, AppResult};
use sea_orm::*;
use uuid::Uuid;

pub struct ActionPlansRepository;

impl ActionPlansRepository {
    /// Create action plan with items in a transaction
    pub async fn create_with_items(
        db: &DbConn,
        action_plan: action_plans::ActiveModel,
        items: Vec<action_items::ActiveModel>,
    ) -> AppResult<action_plans::Model> {
        // Start transaction
        let txn = db.begin().await.map_err(AppError::from)?;

        // Create action plan
        let created_plan = action_plan
            .insert(&txn)
            .await
            .map_err(AppError::from)?;

        // Create all items
        let plan_id = created_plan.action_plan_id;
        let mut created_items = Vec::new();

        for mut item in items {
            item.action_plan_id = Set(plan_id);
            let created = item.insert(&txn).await.map_err(AppError::from)?;
            created_items.push(created);
        }

        // Commit transaction
        txn.commit().await.map_err(AppError::from)?;

        tracing::info!(
            action_plan_id = %plan_id,
            items_count = created_items.len(),
            "Created action plan with items"
        );

        Ok(created_plan)
    }

    /// Delete action plan and all its items
    pub async fn delete_cascade(
        db: &DbConn,
        action_plan_id: Uuid,
    ) -> AppResult<bool> {
        let txn = db.begin().await.map_err(AppError::from)?;

        // Delete items first
        action_items::Entity::delete_many()
            .filter(action_items::Column::ActionPlanId.eq(action_plan_id))
            .exec(&txn)
            .await
            .map_err(AppError::from)?;

        // Delete plan
        let result = action_plans::Entity::delete_by_id(action_plan_id)
            .exec(&txn)
            .await
            .map_err(AppError::from)?;

        txn.commit().await.map_err(AppError::from)?;

        Ok(result.rows_affected > 0)
    }
}
```

---

## Pattern 4: Repository Module Export

**File**: `src/repositories/mod.rs`

```rust
pub mod action_items;
pub mod action_plans;
pub mod assessment_recommendations;
pub mod assessments;
pub mod consolidated_report;
pub mod current_states;
pub mod desired_states;
pub mod dimension_assessments;
pub mod dimensions;
pub mod gaps;
pub mod organisation_dimension;
pub mod recommendations;
pub mod reports;

// Re-export commonly used types
pub use assessments::AssessmentsRepository;
pub use action_plans::ActionPlansRepository;
pub use dimensions::DimensionsRepository;
pub use gaps::GapsRepository;
```

---

## Pattern 5: Paginated Query

**File**: `src/repositories/recommendations.rs`

```rust
use crate::entities::recommendations;
use crate::error::{AppError, AppResult};
use sea_orm::*;
use uuid::Uuid;

pub struct RecommendationsRepository;

impl RecommendationsRepository {
    /// Find all recommendations with pagination
    pub async fn find_paginated(
        db: &DbConn,
        page: u32,
        per_page: u32,
    ) -> AppResult<(Vec<recommendations::Model>, u64)> {
        let offset = (page.saturating_sub(1)) * per_page;

        // Get total count
        let total = recommendations::Entity::find()
            .count(db)
            .await
            .map_err(AppError::from)?;

        // Get paginated results
        let items = recommendations::Entity::find()
            .order_by_asc(recommendations::Column::Priority)
            .offset(offset as u64)
            .limit(per_page as u64)
            .all(db)
            .await
            .map_err(AppError::from)?;

        Ok((items, total))
    }

    /// Search recommendations by title
    pub async fn search(
        db: &DbConn,
        query: &str,
        limit: u64,
    ) -> AppResult<Vec<recommendations::Model>> {
        recommendations::Entity::find()
            .filter(
                Condition::any()
                    .add(recommendations::Column::Title.contains(query))
                    .add(recommendations::Column::Description.contains(query))
            )
            .limit(limit)
            .all(db)
            .await
            .map_err(AppError::from)
    }
}
```

---

## Best Practices

1. **One entity = One repository**: Keep focused
2. **Static methods**: No state, just functions
3. **Consistent naming**: `find_by_*`, `create`, `update`, `delete`
4. **Return AppResult**: Convert all errors
5. **Use transactions**: For multi-entity operations
6. **Add documentation**: Document what each method does
7. **Implement count methods**: Useful for pagination
8. **Handle not found**: Return `Option<T>` or error
9. **Use SeaORM queries**: Don't write raw SQL
10. **Log important operations**: Create, Update, Delete

## Checklist

- [ ] Repository name matches entity
- [ ] All CRUD operations implemented
- [ ] `find_by_id` returns `Option<T>`
- [ ] `find_by_id_or_error` returns `Result<T>`
- [ ] Transactions used for related operations
- [ ] Pagination utilities included
- [ ] Count methods available
- [ ] Delete cascade handled
- [ ] Exported in mod.rs
- [ ] All methods are async
- [ ] `AppResult<T>` return type
