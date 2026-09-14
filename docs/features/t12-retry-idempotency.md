# T12: Retry with Backoff + Idempotency

> **Status:** ✅ Complete  
> **Ticket:** T12  
> **Implementation Date:** Pre-existing (inherited from previous sprints)

---

## Overview

T12 addresses two critical reliability patterns in distributed systems:

1. **Idempotency** - Ensuring duplicate requests don't cause duplicate operations
2. **Exponential Backoff** - Graceful retry with increasing delays to handle transient failures

Both patterns are essential for building resilient APIs that can handle network failures, rate limiting, and temporary service outages without data corruption or amplification of load.

---

## Part 1: Idempotency

### What is Idempotency?

An operation is **idempotent** if applying it multiple times produces the same result as applying it once.

**Examples:**
- `GET /users/1` - Idempotent (reading doesn't change data)
- `DELETE /users/1` - Idempotent (deleting twice = same as deleting once)
- `POST /users` - **NOT** idempotent by default (creates new user each time)

**The Problem:**
```
Client sends request
    ↓
Network timeout (no response)
    ↓
Client retries request
    ↓
Server processes BOTH requests
    ↓
❌ Duplicate data created!
```

### Our Implementation

**Location:** `backend/src/api/middleware.rs:93-147`

**Middleware Name:** `idempotency_middleware`

#### How It Works

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    Idempotency Middleware Flow                          │
└─────────────────────────────────────────────────────────────────────────┘

Client Request with X-Correlation-ID
            │
            ▼
    ┌───────────────────┐
    │ Is this a safe    │ ──YES──→ Execute handler normally
    │ method? (GET/HEAD)│
    └───────────────────┘
            │ NO
            ▼
    ┌───────────────────┐
    │ X-Correlation-ID  │ ──NO───→ Execute handler normally
    │ header present?   │         (no idempotency for this request)
    └───────────────────┘
            │ YES
            ▼
    ┌───────────────────┐
    │ Check Redis cache │
    │ for key           │
    │ "idem:{user}:{id}"│
    └───────────────────┘
            │
      ┌─────┴─────┐
      │           │
    Found      Not Found
      │           │
      ▼           ▼
┌───────────┐  ┌───────────────────┐
│ Return    │  │ Execute handler   │
│ cached    │  │ normally          │
│ response  │  └───────────────────┘
│ (200/204) │          │
└───────────┘          │
      ▲                │ Success?
      │                ▼
      │         ┌───────────────────┐
      │         │ Cache response in  │
      │         │ Redis for 24 hours │
      │         └───────────────────┘
      │                │
      └───────┬────────┘
              │
              ▼
      Return response
```

#### Code Implementation

```rust
pub async fn idempotency_middleware(
    State(state): State<AppState>,
    req: Request<Body>,
    next: Next,
) -> Response {
    let method = req.method().clone();
    
    // Skip idempotency for safe methods (GET, HEAD, OPTIONS)
    if method == axum::http::Method::GET
        || method == axum::http::Method::HEAD
        || method == axum::http::Method::OPTIONS
    {
        return next.run(req).await;
    }

    // Extract X-Correlation-ID header
    let correlation_id = match req
        .headers()
        .get("x-correlation-id")
        .and_then(|v| v.to_str().ok())
    {
        Some(cid) => cid.to_string(),
        None => return next.run(req).await, // No header = no idempotency
    };

    // Build cache key including user ID for isolation
    let claims = req.extensions().get::<Arc<Claims>>();
    let cache_key = match claims {
        Some(c) => format!("idem:{}:{}", c.sub, correlation_id),
        None => format!("idem:{}", correlation_id),
    };

    // Check if we've already processed this request
    if let Ok(Some(_)) = state.cache.get::<String>(&cache_key).await {
        tracing::info!(correlation_id = %correlation_id, "Idempotency hit! Returning cached success.");
        
        // Return appropriate status code based on method
        let status_code = if method == axum::http::Method::DELETE {
            axum::http::StatusCode::NO_CONTENT
        } else {
            axum::http::StatusCode::OK
        };
        return axum::response::IntoResponse::into_response(status_code);
    }

    // Execute the actual handler
    let response = next.run(req).await;

    // Cache successful responses for 24 hours
    if response.status().is_success() {
        let _ = state.cache.set(
            &cache_key,
            &"done".to_string(),
            Duration::from_secs(24 * 60 * 60), // 24 hours
        ).await;
    }

    response
}
```

#### Cache Key Structure

```
idem:{user_id}:{correlation_id}
```

**Example:**
```
idem:user-123-abc:x-correlation-456
```

**Why include user_id?**
- Ensures different users don't interfere with each other
- User A's idempotency key doesn't affect User B's requests

#### TTL (Time-to-Live)

**24 hours** - This is a balance between:
- **Long enough:** Covers retries during temporary issues
- **Short enough:** Doesn't cache indefinitely (data changes over time)

#### Current Limitations

| Aspect | Current Behavior | Ideal Behavior |
|--------|-----------------|---------------|
| Response Body | Not cached (returns 200/204 only) | Cache full response |
| Content-Type | Generic | Preserve original |
| Response Headers | None | Return original headers |

**Note:** For most use cases, returning the status code is sufficient. The client can re-fetch the resource if needed.

---

## Part 2: Exponential Backoff

### What is Exponential Backoff?

A retry strategy where the delay between attempts increases exponentially.

**Without Backoff (Immediate Retry):**
```
Attempt 1: Immediate
Attempt 2: Immediate  ← All requests hit failing service at once
Attempt 3: Immediate  ← Amplifies the problem!
```

**With Exponential Backoff:**
```
Attempt 1: Immediate
Attempt 2: Wait 1 second
Attempt 3: Wait 2 seconds
Attempt 4: Wait 4 seconds
...
```

This gives the failing service time to recover without overwhelming it.

### Our Implementation

We have **three separate backoff implementations** for different use cases:

---

#### Implementation 1: Extraction Pipeline (`extraction_pipeline.rs:155-194`)

**Use Case:** AI extraction (LLM mapping)

```rust
// FIX 6 — Retry logic: up to 3 attempts with exponential backoff on transient errors
let output = {
    let mut last_err = None;
    let mut result = None;
    
    for attempt in 1u8..=3 {
        match extractor.map_to_coa(&raw_text, &coa, &aliases, &cooperative_type, reporting_year).await {
            Ok(o) => {
                result = Some(o);
                break;
            }
            Err(e) => {
                let msg = e.to_string();
                
                // Don't retry on bad-input errors (4xx), only on transient failures
                let is_transient = !msg.contains("400")
                    && !msg.contains("401")
                    && !msg.contains("403")
                    && !msg.contains("max_tokens");
                
                tracing::warn!(attempt, error = %msg, is_transient, "LLM mapping attempt failed");
                
                if !is_transient || attempt == 3 {
                    last_err = Some(e);
                    break;
                }
                
                // Exponential backoff: 1s, 2s
                let delay = Duration::from_secs(u64::from(attempt));
                tokio::time::sleep(delay).await;
                last_err = Some(e);
            }
        }
    }
    
    result.ok_or_else(|| last_err.unwrap_or_else(|| {
        AppError::InternalServerError("LLM mapping failed after 3 attempts".into())
    }))?
};
```

**Characteristics:**
- **Max Attempts:** 3
- **Base Delay:** 1 second
- **Delay Formula:** `attempt * 1 second` (1s, 2s, 3s)
- **Retryable Errors:** Network errors, 5xx errors
- **Non-Retryable Errors:** 400, 401, 403, max_tokens

**Flow:**
```
Attempt 1: Call LLM → Error (transient) → Wait 1s
Attempt 2: Call LLM → Error (transient) → Wait 2s
Attempt 3: Call LLM → Error (non-retryable) → Fail with error
```

---

#### Implementation 2: Report Narrative (`report_narrative.rs:275-452`)

**Use Case:** AI narrative generation

```rust
const BASE_DELAY_MS: u64 = 1_000;  // 1 second base
const MAX_DELAY_MS: u64 = 20_000;  // 20 second cap

fn backoff_delay(attempt: u32, base_ms: u64, max_ms: u64) -> u64 {
    let delay = base_ms * 2u64.pow(attempt - 1);
    delay.min(max_ms)
}
```

**Delay Progression:**
```
Attempt 1: 1,000ms (1s)
Attempt 2: 2,000ms (2s)
Attempt 3: 4,000ms (4s)
Attempt 4: 8,000ms (8s)
Attempt 5: 16,000ms (16s)
Attempt 6: 20,000ms (capped at max)
...
```

**Retry Triggers:**
1. **Connection errors** - Network failures, timeouts
2. **Rate limits (429)** - Service is throttling us
3. **Service unavailable (503)** - Temporary overload
4. **Server errors (5xx)** - Internal service failures

**Special Feature: Extract Retry Delay from Response**

```rust
// Try to parse JSON and extract "retryDelay" or "Please retry in Xs"
let retry_delay = json["error"]["retryDelay"]
    .as_str()
    .or_else(|| json["retryDelay"].as_str())
    .or_else(|| json[0]["retryDelay"].as_str());

if let Some(delay_str) = retry_delay {
    // Parse "30s" or "30000" from the response
    let delay_ms = parse_delay(delay_str)?;
    return delay_ms;
}
```

This allows the AI service to tell us exactly how long to wait!

---

#### Implementation 3: AI Extraction (`ai_extraction.rs:627-720`)

**Use Case:** AI API calls with key rotation

```rust
fn is_retryable_status(status: reqwest::StatusCode) -> bool {
    // Retry on: 429 (rate limit), 5xx (server error)
    // Don't retry on: 400 (bad request), 401 (auth), 403 (forbidden)
    status == StatusCode::TOO_MANY_REQUESTS 
        || status.is_server_error()
}

if is_retryable_status(status) {
    // Rotate to next API key and retry
    tracing::warn!("Retryable error, trying next key");
}
```

**Key Features:**
- **API Key Rotation** - When one key is rate-limited, try another
- **Status Code Detection** - Only retry on appropriate errors
- **Multiple Keys** - Supports multiple API keys for resilience

---

### Backoff Comparison

| Aspect | Extraction Pipeline | Report Narrative | AI Extraction |
|--------|---------------------|------------------|---------------|
| **Max Attempts** | 3 | Variable | Variable |
| **Base Delay** | 1s | 1s | N/A |
| **Max Delay** | 3s | 20s | N/A |
| **Formula** | `attempt * 1s` | `base * 2^(attempt-1)` | N/A |
| **Jitter** | None | None | None |
| **Key Rotation** | No | No | Yes |
| **Error Extraction** | No | Yes | No |

---

## Part 3: Startup Retry

### Database Connection Retry (`main.rs:206-227`)

When the application starts, it retries database connection until successful:

```rust
async fn connect_db_with_retry(database_url: &str) -> anyhow::Result<Database> {
    loop {
        match Database::connect(database_url).await {
            Ok(db) => return Ok(db),
            Err(e) => {
                tracing::warn!(
                    error = %e,
                    "Waiting for database... retrying in 3s"
                );
                sleep(Duration::from_secs(3)).await;
            }
        }
    }
}
```

**Characteristics:**
- **Infinite Retry** - Never gives up (until process is killed)
- **Fixed Delay** - 3 seconds between attempts
- **Used For:** Database connection at startup

### JWT Validator Retry (`main.rs:168-198`)

```rust
async fn init_jwt_validator_with_retry(&config: &Config) -> anyhow::Result<Arc<JwtValidator>> {
    loop {
        match JwtValidator::new(&config).await {
            Ok(validator) => return Ok(validator),
            Err(e) => {
                tracing::warn!(
                    error = %e,
                    "Waiting for Keycloak JWKS endpoint... retrying in 2s"
                );
                sleep(Duration::from_secs(2)).await;
            }
        }
    }
}
```

**Characteristics:**
- **Infinite Retry** - Waits for Keycloak to be available
- **Fixed Delay** - 2 seconds between attempts
- **Used For:** Fetching JWKS (JSON Web Key Set) from Keycloak

---

## Part 4: Middleware Wiring

### Where It's Applied

**Location:** `backend/src/api/routes/api.rs:210-213`

```rust
.layer(axum::middleware::from_fn_with_state(
    state.clone(),
    crate::api::middleware::idempotency_middleware,
))
```

**Applied To:** All routes in the `protected` router (all authenticated endpoints).

**Middleware Order:**
```
Request
    │
    ▼
┌─────────────────────────────────────┐
│ 1. Prometheus Metrics Layer         │
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 2. Idempotency Middleware           │ ← Caches successful responses
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 3. Audit Context Layer               │ ← Extracts IP, User-Agent
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 4. Auth Layer                        │ ← Validates JWT
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 5. Role Guard Layer                  │ ← Enforces role-based access
└─────────────────────────────────────┘
    │
    ▼
Handler
    │
    ▼
Response
```

---

## Part 5: Usage Examples

### Example 1: Submitting a Submission (with Idempotency)

```
User clicks "Submit" button
    │
    ▼
Frontend generates: X-Correlation-ID: abc-123
    │
    ▼
POST /api/v1/cooperative/submissions/123/submit
Headers:
  Authorization: Bearer <token>
  X-Correlation-ID: abc-123
    │
    ▼
Idempotency Middleware checks Redis
Key: "idem:user-456:abc-123"
    │
    ▼ Not found
    │
    ▼
Handler executes: workflow.submit()
    │
    ▼ Success
    │
    ▼
Cache "done" in Redis
Key: "idem:user-456:abc-123"
TTL: 24 hours
    │
    ▼
Return 200 OK
    │
    ▼
User clicks "Submit" again (accidentally)
    │
    ▼
POST /api/v1/cooperative/submissions/123/submit
Headers:
  Authorization: Bearer <token>
  X-Correlation-ID: abc-123  ← Same ID!
    │
    ▼
Idempotency Middleware checks Redis
Key: "idem:user-456:abc-123"
    │
    ▼ Found!
    │
    ▼
Return 200 OK immediately
(No duplicate submission created!)
```

### Example 2: AI Extraction (with Backoff)

```
User uploads financial statement
    │
    ▼
Backend starts extraction pipeline
    │
    ▼
Stage 1: Raw text extraction
    │
    ▼
Stage 2: LLM mapping to CoA
    │
    ▼ Attempt 1: Call LLM API
    │
    ▼ 503 Service Unavailable
    │
    ▼ Wait 1 second
    │
    ▼ Attempt 2: Call LLM API
    │
    ▼ 503 Service Unavailable
    │
    ▼ Wait 2 seconds
    │
    ▼ Attempt 3: Call LLM API
    │
    ▼ 503 Service Unavailable
    │
    ▼ MAX ATTEMPTS REACHED
    │
    ▼ Return error to user
```

---

## Part 6: Verification

### Test 1: Idempotency

```bash
# First request (creates resource)
curl -X POST https://api.example.com/submissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Correlation-ID: test-123" \
  -d '{"reporting_year": 2026}'

# Response: 201 Created

# Duplicate request (should return cached response)
curl -X POST https://api.example.com/submissions \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Correlation-ID: test-123" \
  -d '{"reporting_year": 2026}'

# Response: 200 OK (no duplicate created!)
```

### Test 2: Backoff

```bash
# Monitor logs during AI extraction
tail -f logs/backend.log | grep "attempt"

# Should see increasing delays:
# [WARN] LLM mapping attempt failed: attempt=1, error=503, waiting 1s
# [WARN] LLM mapping attempt failed: attempt=2, error=503, waiting 2s
# [WARN] LLM mapping attempt failed: attempt=3, error=503
# [ERROR] LLM mapping failed after 3 attempts
```

---

## Summary

| Component | Status | Location |
|-----------|--------|----------|
| Idempotency Middleware | ✅ Implemented | `middleware.rs:93-147` |
| Extraction Pipeline Backoff | ✅ Implemented | `extraction_pipeline.rs:155-194` |
| Report Narrative Backoff | ✅ Implemented | `report_narrative.rs:275-452` |
| AI Extraction Retry | ✅ Implemented | `ai_extraction.rs:627-720` |
| Startup DB Retry | ✅ Implemented | `main.rs:206-227` |
| Startup JWT Retry | ✅ Implemented | `main.rs:168-198` |

---

## Future Enhancements (Not Required)

| Enhancement | Priority | Effort | Notes |
|------------|----------|--------|-------|
| Add jitter to backoff | Low | 2 hours | Prevents thundering herd |
| Cache full response body | Medium | 4 hours | Better UX for retries |
| Centralized retry utility | Medium | 1 day | Reduces code duplication |
| Circuit breaker pattern | High | 1 day | T13 covers this |

---

## References

- [REST API Idempotency](https://restfulapi.net/idempotent-rest-apis/)
- [Exponential Backoff and Jitter](https://aws.amazon.com/blogs/architecture/exponential-backoff-and-jitter/)
- [Axum Middleware](https://docs.rs/axum/latest/axum/middleware/index.html)