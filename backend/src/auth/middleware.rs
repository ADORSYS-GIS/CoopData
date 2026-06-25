use std::sync::Arc;

use axum::{body::Body, extract::State, http::Request, middleware::Next, response::Response};

use crate::auth::Claims;
use crate::{AppError, AppState};

pub async fn auth_layer(
    State(state): State<AppState>,
    mut request: Request<Body>,
    next: Next,
) -> Result<Response, AppError> {
    let auth_header = request
        .headers()
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .ok_or_else(|| AppError::Unauthorized("Missing authorization header".into()))?;

    let token = auth_header
        .strip_prefix("Bearer ")
        .ok_or_else(|| AppError::Unauthorized("Invalid authorization header format".into()))?;

    let claims = state
        .jwt_validator
        .validate(token)
        .map_err(|e| AppError::Unauthorized(format!("Invalid token: {}", e)))?;

    request.extensions_mut().insert(Arc::new(claims));

    Ok(next.run(request).await)
}

pub fn require_role(role: &'static str) -> impl Fn(&Claims) -> bool + Clone + 'static {
    move |claims: &Claims| {
        claims
            .realm_access
            .as_ref()
            .map(|ra| ra.roles.iter().any(|r| r == role))
            .unwrap_or(false)
    }
}
