use axum::{
    body::Body,
    extract::State,
    http::Request,
    middleware::Next,
    response::Response,
};

use crate::{AppError, AppState};

pub async fn auth_layer(
    State(_state): State<AppState>,
    request: Request<Body>,
    next: Next,
) -> Result<Response, AppError> {
    let auth_header = request
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Missing authorization header".into()))?;

    let _token = auth_header
        .strip_prefix("Bearer ")
        .ok_or_else(|| AppError::Unauthorized("Invalid authorization header format".into()))?;

    // TODO: Validate token using JwtValidator once integrated into AppState
    Ok(next.run(request).await)
}

pub fn require_role(_role: &str) -> impl Fn() -> bool + Clone {
    // TODO: Implement role checking once JwtValidator is integrated
    move || true
}