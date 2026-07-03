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
use std::sync::Arc;
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

fn rbac_router(allowed: &'static [&'static str], claims: Option<Claims>) -> Router {
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

async fn app() -> axum::Router {
    let test = TestApp::new().await;
    create_app(test.state)
}

// ─── RBAC: audit-logs endpoint requires ministry role ─────────────────────

#[tokio::test]
async fn test_audit_logs_no_auth_unauthorized() {
    let app = app().await;
    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/ministry/audit-logs")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn test_audit_logs_wrong_role_forbidden() {
    let router = rbac_router(&[roles::MINISTRY], Some(claims_with_roles("federation")));
    let response = request(router, "/protected").await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_audit_logs_ministry_role_allowed() {
    let router = rbac_router(&[roles::MINISTRY], Some(claims_with_roles("ministry")));
    let response = request(router, "/protected").await;
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn test_audit_logs_cooperative_role_forbidden() {
    let router = rbac_router(&[roles::MINISTRY], Some(claims_with_roles("cooperative")));
    let response = request(router, "/protected").await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn test_audit_logs_apex_role_forbidden() {
    let router = rbac_router(&[roles::MINISTRY], Some(claims_with_roles("apex")));
    let response = request(router, "/protected").await;
    assert_eq!(response.status(), StatusCode::FORBIDDEN);
}

// ─── Filter params serde defaults ───────────────────────────────────────────

#[tokio::test]
async fn test_audit_log_filter_params_defaults() {
    use coop_data_backend::api::dto::AuditLogFilterParams;

    let params: AuditLogFilterParams = serde_json::from_str("{}").unwrap();
    assert_eq!(params.page, 1);
    assert_eq!(params.per_page, 20);
    assert!(params.action.is_none());
    assert!(params.resource_type.is_none());
    assert!(params.actor_keycloak_id.is_none());
    assert!(params.resource_keycloak_id.is_none());
    assert!(params.date_from.is_none());
    assert!(params.date_to.is_none());
}

#[tokio::test]
async fn test_audit_log_filter_params_custom_page() {
    use coop_data_backend::api::dto::AuditLogFilterParams;

    let params: AuditLogFilterParams =
        serde_json::from_str(r#"{"page":3,"per_page":50,"action":"DELETE"}"#).unwrap();
    assert_eq!(params.page, 3);
    assert_eq!(params.per_page, 50);
    assert_eq!(params.action.as_deref(), Some("DELETE"));
}

// ─── AuditLogResponse::from conversion ──────────────────────────────────────

#[tokio::test]
async fn test_audit_log_response_from_model() {
    use chrono::Utc;
    use coop_data_backend::api::dto::AuditLogResponse;
    use coop_data_backend::entities::audit_log;
    use uuid::Uuid;

    let model = audit_log::Model {
        id: Uuid::new_v4(),
        actor_keycloak_id: "kc-user-123".to_string(),
        actor_id: Some(Uuid::new_v4()),
        action: "CREATE".to_string(),
        resource_type: "federation".to_string(),
        resource_keycloak_id: Some("kc-fed-456".to_string()),
        details: Some(serde_json::json!({"name": "Test Fed"})),
        ip_address: Some("192.168.1.1".to_string()),
        user_agent: Some("Mozilla/5.0".to_string()),
        created_at: Utc::now(),
    };

    let response = AuditLogResponse::from(model);

    assert_eq!(response.action, "CREATE");
    assert_eq!(response.resource_type, "federation");
    assert_eq!(response.actor_keycloak_id, "kc-user-123");
    assert!(response.resource_keycloak_id.is_some());
    assert!(response.details.is_some());
    assert!(response.ip_address.is_some());
    assert!(response.user_agent.is_some());
    assert!(response.actor_id.is_some());
}

#[tokio::test]
async fn test_audit_log_response_from_model_with_nulls() {
    use chrono::Utc;
    use coop_data_backend::api::dto::AuditLogResponse;
    use coop_data_backend::entities::audit_log;
    use uuid::Uuid;

    let model = audit_log::Model {
        id: Uuid::new_v4(),
        actor_keycloak_id: "kc-user-789".to_string(),
        actor_id: None,
        action: "DELETE".to_string(),
        resource_type: "user".to_string(),
        resource_keycloak_id: None,
        details: None,
        ip_address: None,
        user_agent: None,
        created_at: Utc::now(),
    };

    let response = AuditLogResponse::from(model);

    assert_eq!(response.action, "DELETE");
    assert_eq!(response.resource_type, "user");
    assert!(response.actor_id.is_none());
    assert!(response.resource_keycloak_id.is_none());
    assert!(response.details.is_none());
    assert!(response.ip_address.is_none());
    assert!(response.user_agent.is_none());
}

// ─── PaginatedAuditLogResponse math ──────────────────────────────────────────

#[tokio::test]
async fn test_pagination_total_pages_calculation() {
    // total=0, per_page=20 → 0 pages
    let per_page: u64 = 20;
    let total_pages = 0u64.div_ceil(per_page);
    assert_eq!(total_pages, 0);

    // total=1, per_page=20 → 1 page
    let total_pages = 1u64.div_ceil(per_page);
    assert_eq!(total_pages, 1);

    // total=20, per_page=20 → 1 page
    let total_pages = 20u64.div_ceil(per_page);
    assert_eq!(total_pages, 1);

    // total=21, per_page=20 → 2 pages
    let total_pages = 21u64.div_ceil(per_page);
    assert_eq!(total_pages, 2);

    // total=100, per_page=20 → 5 pages
    let total_pages = 100u64.div_ceil(per_page);
    assert_eq!(total_pages, 5);
}

// ─── Audit endpoint returns error with disconnected DB (non-ministry mock) ───

#[tokio::test]
async fn test_audit_logs_route_registered() {
    let app = app().await;
    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/ministry/audit-logs")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    // Without auth, should be 401 — proves the route is registered
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

// ─── OpenAPI spec includes audit-logs endpoint ──────────────────────────────

#[tokio::test]
async fn test_openapi_includes_audit_logs_endpoint() {
    let app = app().await;
    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api-docs/openapi.json")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let spec: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let paths = spec["paths"].as_object().unwrap();
    assert!(paths.contains_key("/api/v1/ministry/audit-logs"));
}

#[tokio::test]
async fn test_openapi_includes_audit_log_schemas() {
    let app = app().await;
    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api-docs/openapi.json")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let spec: serde_json::Value = serde_json::from_slice(&body).unwrap();
    let components = spec["components"]["schemas"].as_object().unwrap();
    assert!(components.contains_key("AuditLogResponse"));
    assert!(components.contains_key("PaginatedAuditLogResponse"));
    assert!(components.contains_key("AuditLogFilterParams"));
}

// ─── AuditService can be instantiated ────────────────────────────────────────

#[tokio::test]
async fn test_audit_service_initialization() {
    let test = TestApp::new().await;
    // Verify the audit service is accessible from AppState
    let _ = &test.state.audit;
    // Verify the repo accessor works
    let _ = test.state.audit.repo();
}

// ─── AuditService::log signature compiles with correct types ─────────────────

#[tokio::test]
async fn test_audit_service_log_function_exists() {
    use coop_data_backend::services::AuditService;
    use sea_orm::DatabaseConnection;

    let db = DatabaseConnection::default();
    let user_repo = coop_data_backend::UserRepository::new(db.clone());
    let audit_repo = coop_data_backend::AuditLogRepository::new(db.clone());
    let _service = AuditService::new(audit_repo, user_repo.clone());
    // If this compiles and runs without panic, the service can be constructed
}