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
/// 1. `X-Forwarded-For` header (first IP in the chain)
/// 2. `X-Real-IP` header
/// 3. `ConnectInfo<SocketAddr>` extension (direct connection)
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
            if let Some(first) = val.split(',').next() {
                let trimmed = first.trim();
                if !trimmed.is_empty() {
                    return Some(trimmed.to_string());
                }
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
    if method == axum::http::Method::GET || method == axum::http::Method::HEAD || method == axum::http::Method::OPTIONS {
        return next.run(req).await;
    }

    let correlation_id = match req.headers().get("x-correlation-id").and_then(|v| v.to_str().ok()) {
        Some(cid) => cid.to_string(),
        None => return next.run(req).await,
    };

    let claims = req.extensions().get::<std::sync::Arc<crate::auth::claims::Claims>>();
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
        let _ = state.cache.set(&cache_key, &"done".to_string(), std::time::Duration::from_secs(24 * 60 * 60)).await;
    }

    response
}
