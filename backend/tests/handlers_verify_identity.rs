mod common;

use axum::{
    body::Body,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
    Router,
};
use common::mock::TestApp;
use coop_data_backend::api::routes::api::role_guard_layer;
use coop_data_backend::api::routes::{
    apex::apex_routes, cooperative::cooperative_routes, federation::federation_routes,
    ministry::ministry_routes, shared::shared_routes,
};
use coop_data_backend::auth::claims::{Claims, RealmAccess};
use coop_data_backend::auth::rbac::roles;
use coop_data_backend::error::AppError;
use coop_data_backend::services::VerificationTokenService;
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

fn test_router(claims: Claims, state: coop_data_backend::AppState) -> Router {
    let claims_arc = Arc::new(claims);

    let protected = Router::new()
        .merge(shared_routes())
        .nest(
            "/ministry",
            ministry_routes().layer(axum::middleware::from_fn(role_guard_layer(&[
                roles::MINISTRY,
            ]))),
        )
        .nest(
            "/federation",
            federation_routes().layer(axum::middleware::from_fn(role_guard_layer(&[
                roles::FEDERATION,
            ]))),
        )
        .nest(
            "/apex",
            apex_routes().layer(axum::middleware::from_fn(role_guard_layer(&[roles::APEX]))),
        )
        .nest(
            "/cooperative",
            cooperative_routes().layer(axum::middleware::from_fn(role_guard_layer(&[
                roles::COOPERATIVE,
                roles::APEX,
                roles::FEDERATION,
                roles::MINISTRY,
            ]))),
        )
        .layer(axum::middleware::from_fn(
            coop_data_backend::api::middleware::audit_context_layer,
        ))
        .layer(axum::middleware::from_fn(
            move |mut req: Request<Body>, next: Next| {
                let claims = Arc::clone(&claims_arc);
                async move {
                    req.extensions_mut().insert(claims);
                    next.run(req).await
                }
            },
        ))
        .with_state(state);

    Router::new().nest("/api/v1", protected)
}

async fn request(router: Router, method: &str, uri: &str, body: Option<String>) -> Response {
    let mut builder = Request::builder().method(method).uri(uri);
    if body.is_some() {
        builder = builder.header("Content-Type", "application/json");
    }
    let req = if let Some(b) = body {
        builder.body(Body::from(b)).unwrap()
    } else {
        builder.body(Body::empty()).unwrap()
    };
    router.oneshot(req).await.unwrap()
}

async fn request_with_header(
    router: Router,
    method: &str,
    uri: &str,
    header_name: &str,
    header_value: &str,
    body: Option<String>,
) -> Response {
    let mut builder = Request::builder()
        .method(method)
        .uri(uri)
        .header(header_name, header_value);
    if body.is_some() {
        builder = builder.header("Content-Type", "application/json");
    }
    let req = if let Some(b) = body {
        builder.body(Body::from(b)).unwrap()
    } else {
        builder.body(Body::empty()).unwrap()
    };
    router.oneshot(req).await.unwrap()
}

// ─── Verify Identity Endpoint ─────────────────────────────────────────────

#[tokio::test]
async fn test_verify_identity_empty_password_returns_400() {
    let claims = claims_with_roles("ministry");
    let test = TestApp::new().await;
    let router = test_router(claims, test.state.clone());
    let res = request(
        router,
        "POST",
        "/api/v1/me/verify-identity",
        Some(r#"{"password":""}"#.to_string()),
    )
    .await;
    assert_eq!(res.status(), StatusCode::BAD_REQUEST);
}

#[tokio::test]
async fn test_verify_identity_missing_password_returns_4xx() {
    let claims = claims_with_roles("ministry");
    let test = TestApp::new().await;
    let router = test_router(claims, test.state.clone());
    let res = request(
        router,
        "POST",
        "/api/v1/me/verify-identity",
        Some(r#"{}"#.to_string()),
    )
    .await;
    assert!(
        res.status().is_client_error(),
        "Expected 4xx, got {}",
        res.status()
    );
}

#[tokio::test]
async fn test_verify_identity_invalid_json_returns_400() {
    let claims = claims_with_roles("ministry");
    let test = TestApp::new().await;
    let router = test_router(claims, test.state.clone());
    let res = request(
        router,
        "POST",
        "/api/v1/me/verify-identity",
        Some(r#"not valid json"#.to_string()),
    )
    .await;
    assert!(res.status().is_client_error());
}

// ─── Delete Without Token → 428 ───────────────────────────────────────────

#[tokio::test]
async fn test_delete_federation_without_verification_token_returns_428() {
    let claims = claims_with_roles("ministry");
    let test = TestApp::new().await;
    let router = test_router(claims, test.state.clone());
    let res = request(
        router,
        "DELETE",
        "/api/v1/ministry/federations/test-org-id",
        None,
    )
    .await;
    assert_eq!(res.status(), StatusCode::PRECONDITION_REQUIRED);
}

#[tokio::test]
async fn test_delete_apex_without_verification_token_returns_428() {
    let claims = claims_with_roles("federation");
    let test = TestApp::new().await;
    let router = test_router(claims, test.state.clone());
    let res = request(
        router,
        "DELETE",
        "/api/v1/federation/apexes/test-group-id",
        None,
    )
    .await;
    assert_eq!(res.status(), StatusCode::PRECONDITION_REQUIRED);
}

#[tokio::test]
async fn test_delete_cooperative_without_verification_token_returns_4xx() {
    let claims = claims_with_roles("apex");
    let test = TestApp::new().await;
    let router = test_router(claims, test.state.clone());
    let res = request(
        router,
        "DELETE",
        "/api/v1/apex/cooperatives/test-coop-id",
        None,
    )
    .await;
    assert!(
        res.status().is_client_error(),
        "Expected 4xx, got {}",
        res.status()
    );
}

#[tokio::test]
async fn test_delete_submission_without_verification_token_returns_428() {
    let claims = claims_with_roles("cooperative");
    let test = TestApp::new().await;
    let router = test_router(claims, test.state.clone());
    let sub_id = uuid::Uuid::new_v4();
    let res = request(
        router,
        "DELETE",
        &format!("/api/v1/cooperative/submissions/{}", sub_id),
        None,
    )
    .await;
    assert_eq!(res.status(), StatusCode::PRECONDITION_REQUIRED);
}

// ─── Delete With Invalid Token → 428 ──────────────────────────────────────

#[tokio::test]
async fn test_delete_federation_with_invalid_token_returns_428() {
    let claims = claims_with_roles("ministry");
    let test = TestApp::new().await;
    let router = test_router(claims, test.state.clone());
    let res = request_with_header(
        router,
        "DELETE",
        "/api/v1/ministry/federations/test-org-id",
        "x-verification-token",
        "invalid-token-uuid",
        None,
    )
    .await;
    assert_eq!(res.status(), StatusCode::PRECONDITION_REQUIRED);
}

#[tokio::test]
async fn test_delete_with_nonexistent_token_returns_428() {
    let claims = claims_with_roles("ministry");
    let test = TestApp::new().await;
    let router = test_router(claims, test.state.clone());
    let res = request_with_header(
        router,
        "DELETE",
        "/api/v1/ministry/federations/test-org-id",
        "x-verification-token",
        "00000000-0000-0000-0000-000000000000",
        None,
    )
    .await;
    assert_eq!(res.status(), StatusCode::PRECONDITION_REQUIRED);
}

// ─── VerificationTokenService unit-level tests (integration with Redis) ────

#[tokio::test]
async fn test_token_store_and_validate_succeeds() {
    let test = TestApp::new().await;
    let user_id = "test-user-token-valid";
    let token = VerificationTokenService::generate();

    VerificationTokenService::store(&test.state.cache, user_id, &token)
        .await
        .expect("Failed to store token");

    let result =
        VerificationTokenService::validate_and_consume(&test.state.cache, user_id, &token).await;
    assert!(result.is_ok(), "Token should validate successfully");
}

#[tokio::test]
async fn test_token_is_single_use() {
    let test = TestApp::new().await;
    let user_id = "test-user-token-singleuse";
    let token = VerificationTokenService::generate();

    VerificationTokenService::store(&test.state.cache, user_id, &token)
        .await
        .unwrap();

    let first =
        VerificationTokenService::validate_and_consume(&test.state.cache, user_id, &token).await;
    assert!(first.is_ok());

    let second =
        VerificationTokenService::validate_and_consume(&test.state.cache, user_id, &token).await;
    assert!(second.is_err());
    match second {
        Err(AppError::PreconditionRequired(_)) => {}
        _ => panic!("Expected PreconditionRequired for reused token"),
    }
}

#[tokio::test]
async fn test_token_wrong_user_fails() {
    let test = TestApp::new().await;
    let token = VerificationTokenService::generate();

    VerificationTokenService::store(&test.state.cache, "user-a", &token)
        .await
        .unwrap();

    let result =
        VerificationTokenService::validate_and_consume(&test.state.cache, "user-b", &token).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_token_nonexistent_fails() {
    let test = TestApp::new().await;
    let result =
        VerificationTokenService::validate_and_consume(&test.state.cache, "nobody", "fake-token")
            .await;
    assert!(result.is_err());
}

// ─── Delete-preview endpoints are accessible ──────────────────────────────

#[tokio::test]
async fn test_delete_preview_federation_returns_200_or_error() {
    let claims = claims_with_roles("ministry");
    let test = TestApp::new().await;
    let router = test_router(claims, test.state.clone());
    let res = request(
        router,
        "GET",
        "/api/v1/ministry/federations/test-id/delete-preview",
        None,
    )
    .await;
    assert!(
        res.status() == StatusCode::OK || res.status().is_client_error(),
        "Expected OK or client error, got {}",
        res.status()
    );
}

#[tokio::test]
async fn test_delete_preview_apex_returns_200_or_error() {
    let claims = claims_with_roles("federation");
    let test = TestApp::new().await;
    let router = test_router(claims, test.state.clone());
    let res = request(
        router,
        "GET",
        "/api/v1/federation/apexes/test-id/delete-preview",
        None,
    )
    .await;
    assert!(
        res.status() == StatusCode::OK || res.status().is_client_error(),
        "Expected OK or client error, got {}",
        res.status()
    );
}

#[tokio::test]
async fn test_delete_preview_cooperative_returns_200_or_error() {
    let claims = claims_with_roles("apex");
    let test = TestApp::new().await;
    let router = test_router(claims, test.state.clone());
    let res = request(
        router,
        "GET",
        "/api/v1/apex/cooperatives/test-id/delete-preview",
        None,
    )
    .await;
    assert!(
        res.status() == StatusCode::OK || res.status().is_client_error(),
        "Expected OK or client error, got {}",
        res.status()
    );
}

// ─── Role-based access: wrong role can't access delete-preview ─────────────

#[tokio::test]
async fn test_delete_preview_federation_requires_ministry_role() {
    let claims = claims_with_roles("federation");
    let test = TestApp::new().await;
    let router = test_router(claims, test.state.clone());
    let res = request(
        router,
        "GET",
        "/api/v1/ministry/federations/test-id/delete-preview",
        None,
    )
    .await;
    assert_eq!(res.status(), StatusCode::FORBIDDEN);
}
