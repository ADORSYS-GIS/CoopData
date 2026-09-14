use axum::{
    body::Body,
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::Response,
};

use crate::api::middleware::AuditContext;
use crate::AppState;

/// Rate-limits sensitive auth-adjacent endpoints by client IP.
///
/// Uses the shared `CacheService` (Redis token bucket in production, in-memory
/// in dev/tests). On limit exceeded returns `429 Too Many Requests` with a
/// `Retry-After` header. Fails open (logs + allows) if the cache is unavailable
/// so a Redis outage never locks out all users.
pub async fn rate_limit_auth(
    State(state): State<AppState>,
    req: Request<Body>,
    next: Next,
) -> Response {
    let ip = req
        .extensions()
        .get::<AuditContext>()
        .and_then(|ctx| ctx.ip_address.clone());

    let key = match ip {
        Some(ip) => format!("rl:auth:{}", ip),
        None => return next.run(req).await,
    };

    let max = state.config.rate_limit_auth_max;
    let window = state.config.rate_limit_auth_window_secs;

    match state.cache.rate_limit(&key, max, window).await {
        Ok(result) if result.allowed => next.run(req).await,
        Ok(result) => {
            let retry_after = result.retry_after_secs.max(1);
            tracing::warn!(
                ip = %key,
                retry_after_secs = retry_after,
                "Rate limit exceeded on sensitive auth endpoint"
            );
            Response::builder()
                .status(StatusCode::TOO_MANY_REQUESTS)
                .header("Retry-After", retry_after.to_string())
                .header("X-RateLimit-Limit", max.to_string())
                .header("X-RateLimit-Remaining", "0")
                .body(Body::from(
                    serde_json::json!({
                        "error": "too_many_requests",
                        "message": "Too many requests. Please try again later."
                    })
                    .to_string(),
                ))
                .unwrap()
        }
        Err(e) => {
            tracing::error!(error = %e, "Rate limiter error; allowing request (fail-open)");
            next.run(req).await
        }
    }
}
