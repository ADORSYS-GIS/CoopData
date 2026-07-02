mod common;

use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
    middleware::Next,
    response::Response,
    routing::get,
    Router,
};
use common::mock::TestApp;
use coop_data_backend::api::routes::api::create_app;
use coop_data_backend::auth::claims::{Claims, RealmAccess};
use coop_data_backend::auth::rbac::roles;
use coop_data_backend::auth::ScopeEnforcement;
use tower::util::ServiceExt;

fn claims_with_roles(role: &str) -> Claims {
    Claims {
        sub: "test-user-id".to_string(),
        exp: 9999999999,
        iat: 0,
        iss: "test-issuer".to_string(),
        aud: None,
        preferred_username: Some("testuser".to_string()),
        email: Some("test@example.com".to_string()),
        email_verified: Some(true),
        realm_access: Some(RealmAccess {
            roles: vec![role.to_string()],
        }),
        resource_access: None,
        organization: None,
        cooperation: None,
        assigned_dimensions: None,
        name: Some("Test User".to_string()),
    }
}

fn claims_with_org(role: &str, org_id: &str) -> Claims {
    let mut c = claims_with_roles(role);
    c.organization = Some(serde_json::json!({
        "TestFederation": { "id": org_id }
    }));
    c
}

fn claims_with_cooperation(role: &str, path: &str) -> Claims {
    let mut c = claims_with_roles(role);
    c.cooperation = Some(coop_data_backend::auth::claims::Cooperation(vec![
        path.to_string()
    ]));
    c
}

fn rbac_router(allowed: &'static [&'static str], claims: Option<Claims>) -> Router {
    use std::sync::Arc;

    let router = Router::new()
        .route("/protected", get(|| async { (StatusCode::OK, "ok") }))
        .layer(axum::middleware::from_fn(
            coop_data_backend::api::routes::api::role_guard_layer(allowed),
        ));

    match claims {
        Some(claims) => router.layer(axum::middleware::from_fn(
            move |mut req: Request<Body>, next: Next| {
                let claims = Arc::new(claims.clone());
                async move {
                    req.extensions_mut().insert(claims);
                    next.run(req).await
                }
            },
        )),
        None => router,
    }
}

async fn request(router: Router, uri: &str) -> Response {
    router
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri(uri)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap()
}

#[tokio::test]
async fn test_role_guard_no_claims_unauthorized() {
    let router = rbac_router(&[roles::MINISTRY], None);
    let response = request(router, "/protected").await;
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_role_guard_wrong_role_forbidden() {
    let router = rbac_router(&[roles::MINISTRY], Some(claims_with_roles("cooperative")));
    let response = request(router, "/protected").await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_role_guard_correct_role_allowed() {
    let router = rbac_router(&[roles::MINISTRY], Some(claims_with_roles("ministry")));
    let response = request(router, "/protected").await;
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_role_guard_multiple_allowed_roles() {
    let router = rbac_router(
        &[roles::COOPERATIVE, roles::APEX],
        Some(claims_with_roles("apex")),
    );
    let response = request(router, "/protected").await;
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_role_guard_cooperative_allowed_for_cooperative_or_apex() {
    let router = rbac_router(
        &[roles::COOPERATIVE, roles::APEX],
        Some(claims_with_roles("cooperative")),
    );
    let response = request(router, "/protected").await;
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_role_guard_ministry_blocked_from_cooperative_routes() {
    let router = rbac_router(
        &[roles::COOPERATIVE, roles::APEX],
        Some(claims_with_roles("ministry")),
    );
    let response = request(router, "/protected").await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

// ─── ScopeEnforcement (logic-level, DB-free) ─────────────────────────────────

#[tokio::test]
async fn test_scope_federation_can_access_own_org() {
    let claims = claims_with_org("federation", "fed-org-123");
    assert!(ScopeEnforcement::federation_can_access_org(&claims, "fed-org-123").is_ok());
}

#[tokio::test]
async fn test_scope_federation_cannot_access_other_org() {
    let claims = claims_with_org("federation", "fed-org-123");
    assert!(ScopeEnforcement::federation_can_access_org(&claims, "fed-org-999").is_err());
}

#[tokio::test]
async fn test_scope_federation_no_org_forbidden() {
    let claims = claims_with_roles("federation");
    assert!(ScopeEnforcement::federation_can_access_org(&claims, "any").is_err());
}

#[tokio::test]
async fn test_scope_apex_can_access_own_group() {
    let claims = claims_with_cooperation("apex", "/apex-group-456/cooperative-789");
    assert!(ScopeEnforcement::apex_can_access_group(&claims, "apex-group-456").is_ok());
}

#[tokio::test]
async fn test_scope_apex_cannot_access_other_group() {
    let claims = claims_with_cooperation("apex", "/apex-group-456/cooperative-789");
    assert!(ScopeEnforcement::apex_can_access_group(&claims, "other-group").is_err());
}

#[tokio::test]
async fn test_scope_get_cooperative_id_valid_path() {
    let claims = claims_with_cooperation("cooperative", "/apex-group-456/cooperative-789");
    assert_eq!(
        ScopeEnforcement::get_cooperative_id(&claims).unwrap(),
        "cooperative-789"
    );
}

#[tokio::test]
async fn test_scope_get_cooperative_id_missing_segment_invalid() {
    let claims = claims_with_cooperation("cooperative", "/apex-group-456");
    assert!(ScopeEnforcement::get_cooperative_id(&claims).is_err());
}

#[tokio::test]
async fn test_scope_get_federation_org_id() {
    let claims = claims_with_org("federation", "fed-org-123");
    assert_eq!(
        ScopeEnforcement::get_federation_org_id(&claims).unwrap(),
        "fed-org-123"
    );
}

#[tokio::test]
async fn test_scope_get_apex_group_id() {
    let claims = claims_with_cooperation("apex", "/apex-group-456/cooperative-789");
    assert_eq!(
        ScopeEnforcement::get_apex_group_id(&claims).unwrap(),
        "apex-group-456"
    );
}

// ─── Full app wiring: protected routes reject unauthenticated ───────────────

#[tokio::test]
async fn test_cooperative_routes_require_auth() {
    let test = TestApp::new().await;
    let app = create_app(test.state);

    for uri in ["/api/v1/apex/cooperatives", "/api/v1/cooperative/profile"] {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method(Method::GET)
                    .uri(uri)
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
    }
}
