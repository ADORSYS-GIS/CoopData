# Rust Services Guide

> **Goal**: Encapsulate external integrations and complex business logic.
> **Rule**: Services handle EXTERNAL systems (Keycloak, S3, Email) and complex operations spanning multiple repositories.

## File Structure

```
src/services/
├── mod.rs               # Re-exports
├── keycloak.rs         # Keycloak integration
├── s3_storage.rs       # S3/MinIO storage
├── report_service.rs   # Report generation
└── email.rs            # Email service
```

---

## When to Create a Service

**CREATE A SERVICE WHEN:**
- Integrating with external APIs (Keycloak, payment gateways)
- Complex business logic spanning 3+ repositories
- File operations (upload, download, processing)
- Sending notifications (email, push, SMS)
- Caching strategies

**DON'T CREATE SERVICE WHEN:**
- Single CRUD operation → Use Repository directly
- Simple data validation → Do in Handler or DTO
- Single database table query → Use Repository

---

## Pattern: External Service

**File**: `src/services/keycloak.rs`

```rust
use anyhow::Result;
use reqwest::Client;
use crate::config::Config;

#[derive(Debug, Clone)]
pub struct KeycloakService {
    client: Client,
    config: Config,
}

impl KeycloakService {
    /// Create new service instance
    pub fn new(config: Config) -> Self {
        let client = Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");
        
        Self { client, config }
    }

    /// Get admin token (called once, cached in handlers)
    pub async fn get_admin_token(&self) -> Result<String> {
        let url = format!(
            "{}/realms/{}/protocol/openid-connect/token",
            self.config.keycloak.url,
            self.config.keycloak.realm
        );
        
        let response = self.client
            .post(&url)
            .form(&[
                ("grant_type", "client_credentials"),
                ("client_id", &self.config.keycloak.client_id),
                ("client_secret", &self.config.keycloak.client_secret),
            ])
            .send()
            .await?;
        
        // Parse and return token
        let token: TokenResponse = response.json().await?;
        Ok(token.access_token)
    }

    /// Create user with error handling
    pub async fn create_user(
        &self,
        token: &str,
        request: &CreateUserRequest,
    ) -> Result<KeycloakUser> {
        // Implementation with proper error propagation
        // ...
    }
}
```

---

## How to Create a New Service

### Step 1: Define the Service Struct
```rust
pub struct MyService {
    client: Client,       // HTTP client if needed
    config: Config,       // Configuration
    // Add caches, connections as needed
}
```

### Step 2: Implement Constructor
```rust
impl MyService {
    pub fn new(config: Config) -> Self {
        Self {
            client: Client::new(),
            config,
        }
    }
}
```

### Step 3: Add Methods
```rust
impl MyService {
    pub async fn do_something(&self, param: &str) -> Result<Output> {
        // Always return Result for error propagation
        // Use tracing for logging
        tracing::info!(param = %param, "Doing something");
        
        // Implementation
        Ok(output)
    }
}
```

### Step 4: Register in AppState
File: `src/lib.rs`
```rust
#[derive(Clone)]
pub struct AppState {
    pub db: Arc<DatabaseConnection>,
    pub keycloak_service: Arc<KeycloakService>,
    pub my_service: Arc<MyService>,  // Add here
}
```

### Step 5: Initialize in `run()`
```rust
let my_service = Arc::new(MyService::new(config.clone()));

let state = AppState {
    db,
    keycloak_service,
    my_service,
};
```

---

## Pattern: Report Generation Service

**File**: `src/services/report_service.rs`

```rust
use crate::error::{AppError, AppResult};
use crate::repositories::*;
use sea_orm::*;

pub struct ReportService {
    db: Arc<DatabaseConnection>,
}

impl ReportService {
    pub fn new(db: Arc<DatabaseConnection>) -> Self {
        Self { db }
    }

    /// Generate consolidated report (complex business logic)
    pub async fn generate_consolidated_report(
        &self,
        organization_id: &str,
    ) -> AppResult<ConsolidatedReport> {
        // This spans multiple repositories - perfect for service layer
        
        // Step 1: Get all completed assessments
        let assessments = AssessmentsRepository::find_all_completed_by_organization_id(
            &self.db,
            organization_id.to_string(),
        ).await?;
        
        // Step 2: Calculate dimensions
        let dimensions = self.calculate_dimensions(&assessments).await?;
        
        // Step 3: Calculate gaps
        let gaps = self.calculate_gaps(&assessments).await?;
        
        // Step 4: Generate recommendations
        let recommendations = self.generate_recommendations(&gaps).await?;
        
        Ok(ConsolidatedReport {
            organization_id: organization_id.to_string(),
            generated_at: chrono::Utc::now(),
            dimensions,
            gaps,
            recommendations,
        })
    }
    
    async fn calculate_dimensions(&self, ...) -> AppResult<Vec<...>> { }
    async fn calculate_gaps(&self, ...) -> AppResult<Vec<...>> { }
    async fn generate_recommendations(&self, ...) -> AppResult<Vec<...>> { }
}
```

---

## Best Practices

1. **Arc for thread safety**: Wrap in `Arc<Service>` in AppState
2. **Return Result**: All service methods return `Result<T>`
3. **Use tracing**: Log important operations
4. **Handle timeouts**: Set HTTP client timeouts
5. **Retry logic**: Implement for transient failures
6. **No direct DB in external services**: Use Repositories
7. **Single responsibility**: One external system per service
8. **Config injection**: Pass config to constructor

## Checklist

- [ ] Service struct defined
- [ ] Constructor `new()` implemented
- [ ] Methods return `Result<T>`
- [ ] Tracing/logging added
- [ ] Registered in AppState
- [ ] Initialized in `run()`
- [ ] Arc wrapped for thread safety