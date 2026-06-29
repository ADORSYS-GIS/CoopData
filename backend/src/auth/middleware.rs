//! Auth middleware for JWT validation and RBAC enforcement.

use std::sync::Arc;

use axum::{
    body::Body,
    extract::{Request, State},
    middleware::Next,
    response::Response,
};

use crate::auth::claims::Claims;
use crate::auth::rbac::roles;
use crate::{forbidden_with_roles, AppError, AppState};

/// Auth middleware layer that validates JWT tokens and extracts claims.
/// This should be applied to all protected routes.
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

/// Creates a role-checking function that validates user has one of the required roles.
/// Use this to wrap route groups with role-based access control.
///
/// # Arguments
/// * `roles` - List of allowed roles (e.g., &[roles::MINISTRY, roles::FEDERATION])
///
/// # Returns
/// A closure that validates claims and returns Ok(()) or Err(AppError::Forbidden)
///
/// # Example
/// ```ignore
/// let ministry_routes = Router::new()
///     .route("/federations", get(list_federations))
///     .layer(axum::middleware::from_fn_with_state(
///         state.clone(),
///         role_guard_layer(&[roles::MINISTRY]),
///     ));
/// ```
pub fn require_role_layer(
    allowed_roles: &'static [&'static str],
) -> impl Fn(&Claims) -> Result<(), AppError> + Clone + 'static {
    move |claims: &Claims| {
        if claims.has_any_role(allowed_roles) {
            tracing::debug!(
                user_id = %claims.sub,
                required_roles = ?allowed_roles,
                user_roles = ?claims.all_roles(),
                "RBAC: Role check passed"
            );
            Ok(())
        } else {
            tracing::info!(
                user_id = %claims.sub,
                required_roles = ?allowed_roles,
                user_roles = ?claims.all_roles(),
                "RBAC: Access denied - missing required role"
            );
            Err(forbidden_with_roles(
                format!("Access denied. Required role: {}", allowed_roles.join(" or ")),
                allowed_roles.to_vec(),
            ))
        }
    }
}

/// Role guard function for use in handler-level checks.
/// Extracts claims from request extensions and validates role.
///
/// # Example
/// ```ignore
/// async fn list_federations(
///     Extension(claims): Extension<Arc<Claims>>,
///     State(state): State<AppState>,
/// ) -> AppResult<Json<Vec<Federation>>> {
///     role_guard(&[roles::MINISTRY], &claims)?;
///     // ... handler logic
/// }
/// ```
pub fn role_guard(allowed_roles: &'static [&'static str], claims: &Claims) -> Result<(), AppError> {
    if claims.has_any_role(allowed_roles) {
        Ok(())
    } else {
        Err(forbidden_with_roles(
            format!("Access denied. Required role: {}", allowed_roles.join(" or ")),
            allowed_roles.to_vec(),
        ))
    }
}

/// Ministry-only role guard.
/// Shorthand for `role_guard(&[roles::MINISTRY], &claims)`.
pub fn require_ministry(claims: &Claims) -> Result<(), AppError> {
    role_guard(&[roles::MINISTRY], claims)
}

/// Federation-only role guard.
/// Shorthand for `role_guard(&[roles::FEDERATION], &claims)`.
pub fn require_federation(claims: &Claims) -> Result<(), AppError> {
    role_guard(&[roles::FEDERATION], claims)
}

/// Apex-only role guard.
/// Shorthand for `role_guard(&[roles::APEX], &claims)`.
pub fn require_apex(claims: &Claims) -> Result<(), AppError> {
    role_guard(&[roles::APEX], claims)
}

/// Cooperative-or-Apex role guard.
/// Both roles can access cooperative-level endpoints.
pub fn require_cooperative_or_apex(claims: &Claims) -> Result<(), AppError> {
    role_guard(&[roles::COOPERATIVE, roles::APEX], claims)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::claims::RealmAccess;

    fn make_claims_with_roles(roles: Vec<&str>) -> Claims {
        Claims {
            sub: "test-user-id".to_string(),
            exp: 9999999999,
            iat: 0,
            iss: "test".to_string(),
            aud: None,
            preferred_username: None,
            email: None,
            email_verified: None,
            realm_access: Some(RealmAccess {
                roles: roles.iter().map(|s| s.to_string()).collect(),
            }),
            resource_access: None,
            organization: None,
            cooperation: None,
            assigned_dimensions: None,
            name: None,
        }
    }

    #[test]
    fn test_role_guard_ministry() {
        let ministry_claims = make_claims_with_roles(vec!["ministry"]);
        let federation_claims = make_claims_with_roles(vec!["federation"]);

        assert!(role_guard(&[roles::MINISTRY], &ministry_claims).is_ok());
        assert!(role_guard(&[roles::MINISTRY], &federation_claims).is_err());
    }

    #[test]
    fn test_role_guard_multiple_roles() {
        let coop_claims = make_claims_with_roles(vec!["cooperative"]);

        assert!(role_guard(&[roles::COOPERATIVE, roles::APEX], &coop_claims).is_ok());
    }
}
