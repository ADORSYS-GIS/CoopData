# Rust Caching Strategy Guide

> **Goal**: Reduce database load and improve response times with intelligent caching.
> **Rule**: Cache READ-ONLY data aggressively. NEVER cache mutable data without invalidation.

## When to Use Caching

```
CACHEABLE (Yes):
✓ Reference data (dimensions, levels)
✓ Frequently accessed, rarely changed data
✓ Expensive computations
✓ External API responses

NOT CACHEABLE (No):
✗ User-specific data
✗ Frequently changing data
✗ Real-time data
✗ Mutable data without invalidation
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        REQUEST FLOW                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Client Request                                                  │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────┐    CACHE HIT     ┌──────────────┐             │
│  │   Handler   │ ───────────────► │ Return Cached │             │
│  └─────────────┘                 └──────────────┘             │
│       │ CACHE MISS                                               │
│       ▼                                                          │
│  ┌─────────────┐                                                │
│  │  Service/   │                                                │
│  │  Repository │                                                │
│  └─────────────┘                                                │
│       │                                                          │
│       ▼                                                          │
│  ┌─────────────┐                                                │
│  │  Database/  │                                                │
│  │  External API│                                                │
│  └─────────────┘                                                │
│       │                                                          │
│       ▼                                                          │
│  Store in Cache & Return                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## How to Implement Caching: Step-by-Step

### Step 1: Create Cache Service

**File:** `src/services/cache.rs`

```rust
use serde::{de::DeserializeOwned, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

/// In-memory cache with TTL support
/// For production, use Redis or similar
#[derive(Debug, Clone)]
pub struct CacheService {
    store: Arc<RwLock<HashMap<String, CacheEntry>>>,
    default_ttl: Duration,
}

#[derive(Debug, Clone)]
struct CacheEntry {
    value: Vec<u8>,  // Serialized value
    expires_at: Instant,
}

impl CacheService {
    /// Create new cache service
    pub fn new(default_ttl: Duration) -> Self {
        Self {
            store: Arc::new(RwLock::new(HashMap::new())),
            default_ttl,
        }
    }

    /// Get value from cache
    pub async fn get<T: DeserializeOwned>(&self, key: &str) -> Option<T> {
        let store = self.store.read().await;

        if let Some(entry) = store.get(key) {
            // Check if expired
            if entry.expires_at > Instant::now() {
                return bincode::deserialize(&entry.value).ok();
            }
        }

        None
    }

    /// Set value in cache with TTL
    pub async fn set<T: Serialize>(&self, key: &str, value: &T, ttl: Duration) {
        let entry = CacheEntry {
            value: bincode::serialize(value).unwrap_or_default(),
            expires_at: Instant::now() + ttl,
        };

        let mut store = self.store.write().await;
        store.insert(key.to_string(), entry);
    }

    /// Set value with default TTL
    pub async fn set_default<T: Serialize>(&self, key: &str, value: &T) {
        self.set(key, value, self.default_ttl).await;
    }

    /// Delete from cache
    pub async fn delete(&self, key: &str) {
        let mut store = self.store.write().await;
        store.remove(key);
    }

    /// Clear all cache entries
    pub async fn clear(&self) {
        let mut store = self.store.write().await;
        store.clear();
    }

    /// Clear entries matching pattern
    pub async fn clear_pattern(&self, pattern: &str) {
        let mut store = self.store.write().await;
        store.retain(|key, _| !key.starts_with(pattern));
    }
}

/// Default cache key builder
pub fn cache_key(prefix: &str, id: &str) -> String {
    format!("{}:{}", prefix, id)
}
```

### Step 2: Register in AppState

**File:** `src/lib.rs`

```rust
use crate::services::cache::CacheService;

#[derive(Clone)]
pub struct AppState {
    pub db: Database,
    pub config: AppConfig,
    pub cache: CacheService,   // Note: not Arc wrapped
    pub keycloak: KeycloakService,  // Note: not keycloak_service
    // ...
}

// Initialize in run()
let cache = CacheService::new(Duration::from_secs(300)); // 5 min TTL

let state = AppState {
    db,
    config,
    cache,
    keycloak,
    // ...
};
```

### Step 3: Use in Handlers

**File:** `src/api/handlers/organization.rs`

```rust
use crate::services::cache::{CacheService, cache_key};

/// Get all organizations with caching
pub async fn list_organizations(
    State(state): State<AppState>,
) -> AppResult<impl IntoResponse> {
    let cache_key = "organizations:all";

    // Try cache first
    if let Some(cached) = state.cache.get::<Vec<OrganizationResponse>>(cache_key).await {
        tracing::debug!("Cache hit for organizations");
        return Ok((StatusCode::OK, Json(cached)));
    }

    tracing::debug!("Cache miss for organizations");

    // Fetch from database
    let repo = OrganizationRepository::new(state.db.clone());
    let organizations = repo.find_all().await?;

    // Convert to response DTOs
    let responses: Vec<OrganizationResponse> = organizations
        .into_iter()
        .map(Into::into)
        .collect();

    // Store in cache (fire and forget)
    let cache = state.cache.clone();
    let responses_clone = responses.clone();
    tokio::spawn(async move {
        cache.set(cache_key, &responses_clone, Duration::from_secs(300)).await;
    });

    Ok((StatusCode::OK, Json(responses)))
}
```

### Step 4: Invalidate on Updates

```rust
/// Update organization and invalidate cache
pub async fn update_organization(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateOrganizationRequest>,
) -> AppResult<impl IntoResponse> {
    let repo = OrganizationRepository::new(state.db.clone());
    
    // Update in database
    let updated = repo.update(id, request).await?;

    // Invalidate caches
    state.cache.delete(&cache_key("organization", &id.to_string())).await;
    state.cache.delete("organizations:all").await;

    Ok((StatusCode::OK, Json(OrganizationResponse::from(updated))))
}
```

---

## Cache Key Patterns

```rust
// Single entity
cache_key("dimension", &id.to_string())  // "dimension:123-uuid..."

// List by parent
cache_key("dimensions", &format!("org:{}", org_id))  // "dimensions:org:456"

// Full list
"dimensions:all"

// User-specific
cache_key("user", &format!("{}:orgs", user_id))  // "user:789:orgs"

// External API response
cache_key("keycloak", &format!("org:{}", org_id))  // "keycloak:org:456"
```

---

## TTL Guidelines

```rust
// NEVER CHANGES: Very long TTL
const DIMENSIONS_TTL: Duration = Duration::from_secs(3600);  // 1 hour

// RARELY CHANGES: Long TTL
const LEVELS_TTL: Duration = Duration::from_secs(1800);  // 30 min

// SOMETIMES CHANGES: Medium TTL
const ORGANIZATION_TTL: Duration = Duration::from_secs(300);  // 5 min

// FREQUENTLY CHANGES: Short TTL or NO CACHE
const USER_DATA_TTL: Duration = Duration::from_secs(60);  // 1 min
```

---

## Production: Redis Cache

**File:** `src/services/redis_cache.rs`

```rust
use redis::{AsyncCommands, Client};
use serde::{de::DeserializeOwned, Serialize};

pub struct RedisCache {
    client: Client,
    default_ttl: u64,
}

impl RedisCache {
    pub async fn get<T: DeserializeOwned>(&self, key: &str) -> Option<T> {
        let mut conn = self.client.get_async_connection().await.ok()?;
        let data: Vec<u8> = conn.get(key).await.ok()?;
        bincode::deserialize(&data).ok()
    }

    pub async fn set<T: Serialize>(&self, key: &str, value: &T, ttl: u64) {
        if let Ok(mut conn) = self.client.get_async_connection().await {
            let data = bincode::serialize(value).unwrap_or_default();
            let _: () = conn.set_ex(key, data, ttl).await.unwrap_or(());
        }
    }
}
```

---

## Checklist

- [ ] CacheService created and registered in AppState
- [ ] TTL defined per data type
- [ ] Get from cache first, then database
- [ ] Set in cache after fetching
- [ ] Invalidate on create/update/delete
- [ ] Cache keys follow convention
- [ ] Logging for cache hits/misses
- [ ] Production: Use Redis instead of in-memory
