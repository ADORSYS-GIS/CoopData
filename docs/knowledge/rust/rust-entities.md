# Rust Entities/Models Guide

> **Goal**: Define database entities that map to tables with proper relationships and constraints.
> **Rule**: Entities are database representations only. Use DTOs for API responses.

## File Structure

```
src/entities/
├── mod.rs                 # Re-exports all entities
├── users.rs               # User entity
├── organizations.rs      # Organization entity
├── assessments.rs         # Assessment entity
└── *.rs                   # Other entities
```

---

## Pattern 1: Standard Entity

**File**: `src/entities/assessments.rs`

```rust
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

// ============================================
// MODEL - Database row representation
// ============================================

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "assessments")]
pub struct Model {
    #[sea_orm(primary_key, auto_generate = false)]
    pub assessment_id: Uuid,

    pub organization_id: String,
    pub cooperation_id: Option<String>,
    pub document_title: String,
    pub status: AssessmentStatus,
    pub started_at: Option<DateTimeUtc>,
    pub completed_at: Option<DateTimeUtc>,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
    pub dimensions_id: Option<JsonValue>,
}

// ============================================
// ENUM - Status values
// ============================================

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(
    rs_type = "String",
    db_type = "Enum",
    enum_name = "assessment_status_enum"
)]
pub enum AssessmentStatus {
    #[sea_orm(string_value = "draft")]
    Draft,
    #[sea_orm(string_value = "in_progress")]
    InProgress,
    #[sea_orm(string_value = "completed")]
    Completed,
    #[sea_orm(string_value = "archived")]
    Archived,
}

// Custom implementation for string parsing
impl std::str::FromStr for AssessmentStatus {
    type Err = String;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "draft" => Ok(AssessmentStatus::Draft),
            "in_progress" => Ok(AssessmentStatus::InProgress),
            "completed" => Ok(AssessmentStatus::Completed),
            "archived" => Ok(AssessmentStatus::Archived),
            _ => Err(format!("Invalid assessment status: {s}")),
        }
    }
}

// ============================================
// RELATIONS - Foreign key relationships
// ============================================

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::dimension_assessments::Entity")]
    DimensionAssessments,

    #[sea_orm(has_many = "super::reports::Entity")]
    Reports,

    #[sea_orm(has_many = "super::action_plans::Entity")]
    ActionPlans,

    #[sea_orm(has_many = "super::assessment_recommendations::Entity")]
    AssessmentRecommendations,
}

impl Related<super::dimension_assessments::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::DimensionAssessments.def()
    }
}

impl Related<super::reports::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Reports.def()
    }
}

impl Related<super::action_plans::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::ActionPlans.def()
    }
}

impl Related<super::assessment_recommendations::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::AssessmentRecommendations.def()
    }
}

// ============================================
// ACTIVE MODEL BEHAVIOR - Hooks
// ============================================

impl ActiveModelBehavior for ActiveModel {
    // Called before insert
    fn before_save(self) -> Result<Self, DbErr> {
        let timestamp = chrono::Utc::now();
        let mut active_model = self;

        // Auto-update timestamps
        if active_model.created_at.is_not_set() {
            active_model.created_at = Set(timestamp);
        }
        active_model.updated_at = Set(timestamp);

        Ok(active_model)
    }
}
```

**Why**:
- Clear sections: MODEL, ENUM, RELATIONS, BEHAVIOR
- Proper relationships defined
- Timestamps auto-updated
- Enum type-safe with database mapping

---

## Pattern 2: Entity with Composite Keys

**File**: `src/entities/dimension_assessments.rs`

```rust
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "dimension_assessments")]
pub struct Model {
    #[sea_orm(primary_key, auto_generate = false)]
    pub dimension_assessment_id: Uuid,

    pub assessment_id: Uuid,
    pub dimension_id: Uuid,
    pub current_state_id: Option<Uuid>,
    pub desired_state_id: Option<Uuid>,
    pub gap_score: i32,
    pub gap_id: Uuid,
    pub organization_id: String,
    pub cooperation_id: Option<String>,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
}

// Relationships with cascade delete
#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::assessments::Entity",
        from = "Column::AssessmentId",
        to = "super::assessments::Column::AssessmentId",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Assessments,

    #[sea_orm(
        belongs_to = "super::dimensions::Entity",
        from = "Column::DimensionId",
        to = "super::dimensions::Column::DimensionId",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Dimensions,

    #[sea_orm(
        belongs_to = "super::gaps::Entity",
        from = "Column::GapId",
        to = "super::gaps::Column::GapId",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Gaps,
}

impl Related<super::assessments::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Assessments.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
```

---

## Pattern 3: Entity with JSON Column

**File**: `src/entities/dimensions.rs`

```rust
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "dimensions")]
pub struct Model {
    #[sea_orm(primary_key, auto_generate = false)]
    pub dimension_id: Uuid,

    pub name: String,
    pub description: Option<String>,
    pub language: String,
    pub order_index: i32,

    // JSON column for flexible data
    pub metadata: Option<JsonValue>,

    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::dimension_assessments::Entity")]
    DimensionAssessments,
}

impl ActiveModelBehavior for ActiveModel {}
```

---

## Pattern 4: Entity Module Exports

**File**: `src/entities/mod.rs`

```rust
pub mod action_items;
pub mod action_plans;
pub mod assessment_recommendations;
pub mod assessments;
pub mod current_states;
pub mod desired_states;
pub mod dimension_assessments;
pub mod dimensions;
pub mod gaps;
pub mod organisation_dimension;
pub mod recommendations;
pub mod reports;

// Re-export commonly used types
pub use assessments::{Entity as Assessments, Model as Assessment, AssessmentStatus};
pub use dimensions::{Entity as Dimensions, Model as Dimension};
pub use organisations::{Entity as Organisations, Model as Organisation};
pub use users::{Entity as Users, Model as User};
```

---

## Pattern 5: Entity with Soft Delete

**File**: `src/entities/recommendations.rs`

```rust
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "recommendations")]
pub struct Model {
    #[sea_orm(primary_key, auto_generate = false)]
    pub recommendation_id: Uuid,

    pub dimension_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub priority: String,

    // Soft delete field
    pub deleted_at: Option<DateTimeUtc>,

    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::dimensions::Entity",
        from = "Column::DimensionId",
        to = "super::dimensions::Column::DimensionId"
    )]
    Dimensions,
}

impl ActiveModelBehavior for ActiveModel {
    fn before_save(self) -> Result<Self, DbErr> {
        // Auto-update timestamps
        let mut active_model = self;
        active_model.updated_at = Set(chrono::Utc::now());
        Ok(active_model)
    }
}
```

---

## Best Practices

1. **Use Uuid for primary keys**: Better for distributed systems
2. **Always have created_at/updated_at**: Enable audit trails
3. **Use Option properly**: None means database NULL
4. **Define relationships clearly**: Use `belongs_to` and `has_many`
5. **Cascade delete carefully**: Only when semantically correct
6. **Use enums for status fields**: Type-safe status values
7. **Implement FromStr for enums**: Convert strings to enum values
8. **Keep entities pure**: No business logic in entities
9. **Use JsonValue for flexible data**: For dynamic metadata columns
10. **Soft delete over hard delete**: Preserve referential integrity

## Checklist

- [ ] Primary key is Uuid
- [ ] created_at and updated_at columns exist
- [ ] Relationships defined with `#[sea_orm(...)]`
- [ ] Enum types are properly defined
- [ ] FromStr implemented for enums
- [ ] ActiveModelBehavior implemented
- [ ] Exported in mod.rs
- [ ] Serde Serialize/Deserialize derived
- [ ] Optional fields marked with Option
- [ ] Cascade behavior explicitly defined