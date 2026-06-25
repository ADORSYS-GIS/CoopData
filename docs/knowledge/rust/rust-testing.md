# Rust Testing Guide

> **Goal**: Write comprehensive tests that are fast, reliable, and maintainable.
> **Rule**: Test behavior, not implementation. Unit tests for logic, integration tests for APIs.

## Testing Strategy Overview

```
tests/
├── unit/              # Fast, isolated tests
│   ├── handlers/      # Handler logic tests
│   ├── services/      # Service logic tests
│   └── repositories/  # Repository tests (mocked DB)
├── integration/       # Full stack tests with real DB
│   ├── api/           # End-to-end API tests
│   └── db/            # Database integration tests
└── common/            # Test utilities and fixtures
    ├── fixtures.rs    # Test data factories
    ├── mocks.rs       # Mock implementations
    └── helpers.rs     # Test helpers
```

---

## How to Write Tests: Step-by-Step

### Step 1: Unit Test for Handler

**File:** `tests/unit/handlers/assessment_test.rs`

```rust
#[cfg(test)]
mod tests {
    use axum::{
        body::Body,
        http::{Request, StatusCode},
    };
    use tower::ServiceExt;  // for oneshot

    #[tokio::test]
    async fn test_create_assessment_success() {
        // 1. ARRANGE: Set up test data and dependencies
        let state = create_test_app_state().await;
        let request = Request::builder()
            .method("POST")
            .uri("/assessments")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"organization_id": "org-123", "document_title": "Test"}"#))
            .unwrap();

        // 2. ACT: Execute the handler
        let response = create_assessment(State(state), Extension("test-token".to_string()), ...)
            .await
            .expect("Failed to execute handler");

        // 3. ASSERT: Verify the result
        assert_eq!(response.status(), StatusCode::CREATED);
    }

    #[tokio::test]
    async fn test_create_assessment_validation_error() {
        // Test validation failure
        let request = Request::builder()
            .method("POST")
            .uri("/assessments")
            .body(Body::from(r#"{}"#))  // Missing required fields
            .unwrap();

        let result = create_assessment(...).await;

        assert!(result.is_err());
    }
}
```

### Step 2: Integration Test for API

**File:** `tests/integration/api/assessment_integration_test.rs`

```rust
#[cfg(test)]
mod tests {
    use sqlx::postgres::PgPoolOptions;
    use test_context::{test_context, AsyncTestContext};

    struct TestContext {
        db: PgPool,
        app: Router,
    }

    impl AsyncTestContext for TestContext {
        async fn setup() -> TestContext {
            // Create test database connection
            let db = PgPoolOptions::new()
                .connect("postgres://test:test@localhost/test_db")
                .await
                .expect("Failed to connect to test database");

            // Run migrations
            sqlx::migrate!("./migrations")
                .run(&db)
                .await
                .expect("Failed to run migrations");

            // Create app with test state
            let app = create_test_app(db.clone());

            TestContext { db, app }
        }

        async fn teardown(self) {
            // Clean up test database
            sqlx::query("DELETE FROM assessments").execute(&self.db).await.ok();drop(self.db);
        }
    }

    #[test_context(TestContext)]
    #[tokio::test]
    async fn test_full_assessment_lifecycle(ctx: &mut TestContext) {
        // CREATE
        let create_response = ctx.app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/assessments")
                    .json(&json!({"organization_id": "org-123", "document_title": "Test"}))
            )
            .await
            .unwrap();

        assert_eq!(create_response.status(), StatusCode::CREATED);
        let assessment: Assessment = serde_json::from_slice(&create_response.into_body()).unwrap();

        // READ
        let get_response = ctx.app
            .oneshot(
                Request::builder()
                    .method("GET")
                    .uri(&format!("/assessments/{}", assessment.id))
                    .body(Body::empty())
            )
            .await
            .unwrap();

        assert_eq!(get_response.status(), StatusCode::OK);

        // UPDATE
        // DELETE
    }
}
```

### Step 3: Test Fixtures

**File:** `tests/common/fixtures.rs`

```rust
use uuid::Uuid;

/// Factory for creating test entities
pub struct AssessmentFactory;

impl AssessmentFactory {
    pub fn create() -> assessments::ActiveModel {
        assessments::ActiveModel {
            assessment_id: Set(Uuid::new_v4()),
            organization_id: Set("test-org".to_string()),
            document_title: Set("Test Assessment".to_string()),
            status: Set(AssessmentStatus::Draft),
            created_at: Set(chrono::Utc::now()),
            updated_at: Set(chrono::Utc::now()),
            ..Default::default()
        }
    }

    pub fn with_organization(mut model: assessments::ActiveModel, org_id: &str) -> Self {
        model.organization_id = Set(org_id.to_string());
        model
    }
}

/// Use in tests
#[test]
fn test_with_factory() {
    let assessment = AssessmentFactory::create()
        .with_organization("org-456")
        .build();
}
```

---

## Running Tests

### Run All Tests

```bash
cargo test
```

### Run Specific Test

```bash
cargo test test_create_assessment_success
```

### Run with Output

```bash
cargo test -- --nocapture
```

### Run Integration Tests Only

```bash
cargo test --test integration
```

### Run with Coverage

```bash
cargo tarpaulin --out Html --output-dir ./coverage
```

---

## Test Naming Convention

```
test_<function>_<scenario>_<expected_result>

Examples:
- test_create_assessment_valid_input_returns_created
- test_create_assessment_missing_name_returns_error
- test_get_assessment_not_found_returns_404
- test_update_assessment_concurrent_updates_handled
```

---

## Best Practices

1. **AAA Pattern**: Arrange, Act, Assert
2. **One assertion per test**: Or logically related assertions
3. **Descriptive names**: `test_create_assessment_success`
4. **Isolate tests**: Use transactions, clean up after
5. **Mock external services**: Don't call real APIs in tests
6. **Test edge cases**: Not just happy path
7. **Fast tests**: Unit tests should be instant
8. **CI Integration**: Tests must pass in CI environment

---

## What to Test

| Layer        | What to Test                     | Test Type          |
| ------------ | -------------------------------- | ------------------ |
| DTOs         | Validation, serialization        | Unit               |
| Handlers     | Request parsing, response format | Unit + Integration |
| Services     | Business logic, external calls   | Unit (mocked)      |
| Repositories | Database queries                 | Integration        |
| Routes       | Routing, middleware              | Integration        |

---

## Checklist

- [ ] Unit tests for handlers
- [ ] Integration tests for API endpoints
- [ ] Test fixtures created
- [ ] Edge cases tested
- [ ] Error paths tested
- [ ] Tests pass in CI
- [ ] Coverage > 80%
