use axum::{
    body::Body, extract::Request, http::Request as HttpRequest, middleware::Next,
    response::Response,
};

/// Context extracted from the HTTP request for audit logging.
/// Contains the client IP address and user agent string.
#[derive(Clone, Debug, Default)]
pub struct AuditContext {
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
}

/// Middleware that extracts IP address and user agent from the request
/// and stores them in request extensions as `AuditContext`.
///
/// IP resolution order:
/// 1. `X-Forwarded-For` header (LAST IP in the chain — the trusted proxy
///    appends the real client IP last via `$proxy_add_x_forwarded_for`)
/// 2. `X-Real-IP` header
/// 3. `ConnectInfo<SocketAddr>` extension (direct connection)
///
/// The LAST X-Forwarded-For entry is used (not the first) so a client cannot
/// spoof the rate-limit / audit key by prepending a fake `X-Forwarded-For`.
pub async fn audit_context_layer(mut req: Request<Body>, next: Next) -> Response {
    let ip_address = extract_ip(&req);
    let user_agent = extract_user_agent(&req);

    req.extensions_mut().insert(AuditContext {
        ip_address,
        user_agent,
    });

    next.run(req).await
}

fn extract_ip(req: &HttpRequest<Body>) -> Option<String> {
    if let Some(xff) = req.headers().get("x-forwarded-for") {
        if let Ok(val) = xff.to_str() {
            let ips: Vec<&str> = val
                .split(',')
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .collect();
            if let Some(last) = ips.last() {
                return Some(last.to_string());
            }
        }
    }

    if let Some(xrip) = req.headers().get("x-real-ip") {
        if let Ok(val) = xrip.to_str() {
            let trimmed = val.trim();
            if !trimmed.is_empty() {
                return Some(trimmed.to_string());
            }
        }
    }

    req.extensions()
        .get::<axum::extract::ConnectInfo<std::net::SocketAddr>>()
        .map(|ci| ci.0.ip().to_string())
}

fn extract_user_agent(req: &HttpRequest<Body>) -> Option<String> {
    req.headers()
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
}

pub async fn request_logging(req: Request<Body>, next: Next) -> Response {
    let method = req.method().to_string();
    let uri = req.uri().to_string();
    let start = std::time::Instant::now();

    let response = next.run(req).await;

    let duration = start.elapsed();
    let status = response.status();

    tracing::info!(
        method = %method,
        uri = %uri,
        status = %status.as_u16(),
        duration_ms = %duration.as_millis(),
        "Request completed"
    );

    response
}

pub async fn idempotency_middleware(
    axum::extract::State(state): axum::extract::State<crate::AppState>,
    req: Request<Body>,
    next: Next,
) -> Response {
    let method = req.method().clone();
    if method == axum::http::Method::GET
        || method == axum::http::Method::HEAD
        || method == axum::http::Method::OPTIONS
    {
        return next.run(req).await;
    }

    let correlation_id = match req
        .headers()
        .get("x-correlation-id")
        .and_then(|v| v.to_str().ok())
    {
        Some(cid) => cid.to_string(),
        None => return next.run(req).await,
    };

    let claims = req
        .extensions()
        .get::<std::sync::Arc<crate::auth::claims::Claims>>();
    let cache_key = match claims {
        Some(c) => format!("idem:{}:{}", c.sub, correlation_id),
        None => format!("idem:{}", correlation_id),
    };

    if let Ok(Some(_)) = state.cache.get::<String>(&cache_key).await {
        tracing::info!(correlation_id = %correlation_id, "Idempotency hit! Returning cached success.");
        let status_code = if method == axum::http::Method::DELETE {
            axum::http::StatusCode::NO_CONTENT
        } else {
            axum::http::StatusCode::OK
        };
        return axum::response::IntoResponse::into_response(status_code);
    }

    let response = next.run(req).await;

    if response.status().is_success() {
        let _ = state
            .cache
            .set(
                &cache_key,
                &"done".to_string(),
                std::time::Duration::from_secs(24 * 60 * 60),
            )
            .await;
    }

    response
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::Request;

    fn req_with_xff(xff: &str) -> HttpRequest<Body> {
        Request::builder()
            .uri("/")
            .header("x-forwarded-for", xff)
            .body(Body::empty())
            .unwrap()
    }

    #[test]
    fn extract_ip_uses_last_xff_entry() {
        // nginx appends the real client IP last; a spoofed first entry must be ignored.
        let req = req_with_xff("1.2.3.4, 203.0.113.7");
        assert_eq!(extract_ip(&req).as_deref(), Some("203.0.113.7"));
    }

    #[test]
    fn extract_ip_handles_single_xff_entry() {
        let req = req_with_xff("203.0.113.7");
        assert_eq!(extract_ip(&req).as_deref(), Some("203.0.113.7"));
    }

    #[test]
    fn extract_ip_ignores_empty_trailing_entries() {
        let req = req_with_xff("1.2.3.4, 203.0.113.7, ");
        assert_eq!(extract_ip(&req).as_deref(), Some("203.0.113.7"));
    }

    #[test]
    fn extract_ip_returns_none_without_headers() {
        let req = Request::builder().uri("/").body(Body::empty()).unwrap();
        assert_eq!(extract_ip(&req), None);
    }
}
