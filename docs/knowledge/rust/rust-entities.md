# Rust Entities/Models Guide

> **Goal**: Define database entities that map to tables with proper relationships and constraints.
> **Rule**: Entities are database representations only. Use DTOs for API responses.

## File Structure

```
src/entities/
├── mod.rs                           # Re-exports all entities
├── submission.rs                   # Submission entity
├── submission_section.rs           # Submission section entity
├── submission_review.rs            # Submission review entity
├── cooperative.rs                  # Cooperative entity
├── federation.rs                    # Federation entity
├── apex.rs                         # Apex entity
├── organization.rs                 # Organization entity
├── user.rs                         # User entity
├── member.rs                        # Member entity
├── financial_statement.rs          # Financial statement entity
├── non_financial_indicator_*.rs    # NF indicator entities
├── questionnaire*.rs              # Questionnaire entities
├── audit_log.rs                    # Audit log entity
├── enums.rs                        # Enum definitions
└── ... (30+ entity files total)
```

---

## Pattern 1: Standard Entity

**File**: `src/entities/submission.rs`

```rust
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

// ============================================
// MODEL - Database row representation
// ============================================

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "submissions")]
pub struct Model {
    #[sea_orm(primary_key, auto_generate = false)]
    pub id: Uuid,

    pub reference: Option<String>,
    pub cooperative_id: Uuid,
    pub reporting_year: i32,
    pub status: SubmissionStatus,
    pub current_tier: ReviewTier,
    pub submitted_by: Option<Uuid>,
    pub submitted_at: Option<DateTimeUtc>,
    pub last_reviewed_by: Option<Uuid>,
    pub last_reviewed_at: Option<DateTimeUtc>,
    pub rejection_reason: Option<String>,
    pub priority: Option<i32>,
    pub metadata: Option<JsonValue>,
    pub submission_method: Option<String>,
    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
    pub created_by_role: SubmissionCreatedByRole,
    pub created_by_user_id: Option<Uuid>,
    pub created_by_name: Option<String>,
    pub edited_by: Option<Uuid>,
    pub edited_by_name: Option<String>,
}

// ============================================
// ENUMS - Status values (defined in enums.rs)
// ============================================

// SubmissionStatus, ReviewTier, SubmissionCreatedByRole are defined in enums.rs

// ============================================
// RELATIONS - Foreign key relationships
// ============================================

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::submission_section::Entity")]
    SubmissionSections,

    #[sea_orm(has_many = "super::submission_review::Entity")]
    SubmissionReviews,

    #[sea_orm(
        belongs_to = "super::cooperative::Entity",
        from = "Column::CooperativeId",
        to = "super::cooperative::Column::Id"
    )]
    Cooperative,
}

impl Related<super::submission_section::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::SubmissionSections.def()
    }
}

impl Related<super::submission_review::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::SubmissionReviews.def()
    }
}

// ============================================
// ACTIVE MODEL BEHAVIOR - Hooks
// ============================================

impl ActiveModelBehavior for ActiveModel {}
```

**Why**:

- Clear sections: MODEL, ENUMS, RELATIONS, BEHAVIOR
- Proper relationships defined
- Enums defined separately in `enums.rs`
- Timestamps auto-updated by database triggers

---

## Pattern 2: Entity with JSON Column

**File**: `src/entities/cooperative.rs`

```rust
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, PartialEq, DeriveEntityModel, Serialize, Deserialize)]
#[sea_orm(table_name = "cooperatives")]
pub struct Model {
    #[sea_orm(primary_key, auto_generate = false)]
    pub id: Uuid,

    pub keycloak_id: String,
    pub display_name: String,
    pub tier: String,
    pub sector: Option<String>,
    pub region: Option<String>,
    pub urban_rural: Option<String>,
    pub is_active: bool,

    // JSON column for flexible data
    pub metadata: Option<JsonValue>,

    pub created_at: DateTimeUtc,
    pub updated_at: DateTimeUtc,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::submission::Entity")]
    Submissions,

    #[sea_orm(has_many = "super::member::Entity")]
    Members,
}

impl ActiveModelBehavior for ActiveModel {}
```

---

## Pattern 3: Entity Module Exports

**File**: `src/entities/mod.rs`

```rust
pub mod abnormality_flag;
pub mod account_alias;
pub mod apex;
pub mod assessment;
pub mod audit_log;
pub mod balance_sheet_line_item;
pub mod chart_of_account;
pub mod cooperative;
pub mod custom_kpi;
pub mod enums;
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
pub mod questionnaire_response;
pub mod questionnaire_template;
pub mod savings_account;
pub mod submission;
pub mod submission_review;
pub mod submission_section;
pub mod uploaded_file;
pub mod user;

// Re-export commonly used types
pub use submission::{Entity as SubmissionEntity, Model as SubmissionModel};
pub use cooperative::{Entity as CooperativeEntity, Model as CooperativeModel};
pub use federation::{Entity as FederationEntity, Model as FederationModel};
pub use apex::{Entity as ApexEntity, Model as ApexModel};
pub use organization::{Entity as OrganizationEntity, Model as OrganizationModel};
pub use user::{Entity as UserEntity, Model as UserModel};
pub use enums::*;  // All enums: SubmissionStatus, ReviewTier, etc.
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
