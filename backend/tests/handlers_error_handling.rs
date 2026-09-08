mod common;

use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
};
use common::mock::TestApp;
use coop_data_backend::api::routes::api::create_app;
use tower::util::ServiceExt;

/// Creates a test application instance.
async fn app() -> axum::Router {
    let test = TestApp::new().await;
    create_app(test.state)
}

/// Helper to parse JSON response body, returning None if body is empty.
async fn try_parse_json_response(
    response: axum::response::Response,
) -> Option<serde_json::Value> {
    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .ok()?;
    if body.is_empty() {
        return None;
    }
    serde_json::from_slice(&body).ok()
}

// =============================================================================
// T10: Error Handling & Safe User Messages - Integration Tests
// =============================================================================
//
// These tests verify that the backend returns safe error messages to clients
// and does NOT expose sensitive implementation details such as:
// - Database errors (SQL, connection strings)
// - Stack traces
// - Internal file paths
// - Library versions
//
// All internal details are logged via `tracing` and NOT returned to clients.
// =============================================================================

/// Test: Health check returns 200 OK
///
/// Verifies that the public health endpoint works correctly.
#[tokio::test]
async fn test_health_check_returns_ok() {
    let app = app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/health")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let json = try_parse_json_response(response).await.unwrap();
    assert_eq!(json["status"], "healthy");
}

/// Test: Protected route without auth returns 401 Unauthorized
///
/// Verifies that protected routes return a safe 401 error without
/// exposing authentication implementation details.
#[tokio::test]
async fn test_protected_route_without_auth_returns_safe_401() {
    let app = app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/me")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let json = try_parse_json_response(response).await.unwrap();

    // Verify safe error format
    assert_eq!(json["error"], "unauthorized");
    assert!(json["message"].is_string());

    // Verify NO internal details are exposed
    let message = json["message"].as_str().unwrap_or("");
    assert!(
        !message.contains("jwt") && !message.contains("keycloak"),
        "Should not expose auth internals in message"
    );
}

/// Test: Protected route with invalid token returns 401 Unauthorized
///
/// Verifies that invalid JWT tokens return a safe 401 error.
#[tokio::test]
async fn test_invalid_token_returns_safe_401() {
    let app = app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/me")
                .header("Authorization", "Bearer invalid-token-xyz")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let json = try_parse_json_response(response).await.unwrap();

    // Verify safe error format
    assert_eq!(json["error"], "unauthorized");
    assert!(json["message"].is_string());

    // Verify NO token details are exposed
    let message = json["message"].as_str().unwrap_or("");
    assert!(
        !message.contains("invalid-token-xyz"),
        "Should not echo back the invalid token"
    );
}

/// Test: Non-existent route returns 404 Not Found
///
/// Verifies that non-existent routes return a safe 404 error.
/// Note: Axum's default 404 may return empty body, which is acceptable
/// as long as the status code is correct.
#[tokio::test]
async fn test_nonexistent_route_returns_404() {
    let app = app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/nonexistent-resource-xyz")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::NOT_FOUND);

    // If there's a body, verify it's safe
    if let Some(json) = try_parse_json_response(response).await {
        assert_eq!(json["error"], "not_found");
        let message = json["message"].as_str().unwrap_or("");
        assert!(
            !message.contains("database")
                && !message.contains("sql")
                && !message.contains("stack"),
            "Should not expose internal details"
        );
    }
    // Empty body is acceptable for 404 (Axum default behavior)
}

/// Test: Error response structure is consistent across error types
///
/// Verifies that all error responses follow the same safe format.
#[tokio::test]
async fn test_error_response_structure_is_consistent() {
    let app = app().await;

    // Test multiple error scenarios
    let test_cases = vec![
        ("/api/v1/me", StatusCode::UNAUTHORIZED, "unauthorized"),
        ("/api/v1/users", StatusCode::UNAUTHORIZED, "unauthorized"),
    ];

    for (uri, expected_status, expected_error) in test_cases {
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

        assert_eq!(response.status(), expected_status);

        let json = try_parse_json_response(response).await.unwrap();

        // Verify consistent error structure
        assert!(
            json.get("error").is_some(),
            "Error response must have 'error' field for {uri}"
        );
        assert!(
            json.get("message").is_some(),
            "Error response must have 'message' field for {uri}"
        );

        // Verify error is a string
        assert!(
            json["error"].is_string(),
            "'error' must be a string for {uri}"
        );
        assert!(
            json["message"].is_string(),
            "'message' must be a string for {uri}"
        );

        // Verify error type matches expected
        assert_eq!(
            json["error"].as_str().unwrap_or(""),
            expected_error,
            "Error type should be '{expected_error}' for {uri}"
        );
    }
}

/// Test: No stack traces in error responses
///
/// Verifies that error messages do not contain Rust stack trace patterns.
#[tokio::test]
async fn test_no_stack_traces_in_error_responses() {
    let app = app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/me")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let json = try_parse_json_response(response).await.unwrap();
    let message = json["message"].as_str().unwrap_or("");

    // Check for common stack trace patterns
    let stack_trace_patterns = ["at ", ".rs:", "thread '", "panicked at"];

    for pattern in stack_trace_patterns {
        assert!(
            !message.contains(pattern),
            "Error message should not contain stack trace pattern '{pattern}'"
        );
    }
}

/// Test: No file paths in error responses
///
/// Verifies that error messages do not expose internal file paths.
#[tokio::test]
async fn test_no_file_paths_in_error_responses() {
    let app = app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/me")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let json = try_parse_json_response(response).await.unwrap();
    let message = json["message"].as_str().unwrap_or("");

    // Check for common path patterns
    let path_patterns = ["/home/", "/src/", "/backend/", "C:\\", "/Users/"];

    for pattern in path_patterns {
        assert!(
            !message.contains(pattern),
            "Error message should not contain file path '{pattern}'"
        );
    }
}

/// Test: No SQL/database details in error responses
///
/// Verifies that database errors are logged internally but not exposed
/// to clients via the API.
#[tokio::test]
async fn test_no_database_details_in_error_responses() {
    let app = app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/me")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let json = try_parse_json_response(response).await.unwrap();
    let message = json["message"].as_str().unwrap_or("");

    // Check for SQL-related patterns that should never be exposed
    let sql_patterns = [
        "sql",
        "sqlite",
        "postgres",
        "mysql",
        "sea_orm",
        "constraint",
    ];

    for pattern in sql_patterns {
        assert!(
            !message.to_lowercase().contains(pattern),
            "Error message should not contain SQL pattern '{pattern}'"
        );
    }
}

/// Test: Error messages are user-friendly
///
/// Verifies that error messages provide helpful guidance without
/// exposing implementation details.
#[tokio::test]
async fn test_error_messages_are_user_friendly() {
    let app = app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/me")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    let json = try_parse_json_response(response).await.unwrap();
    let message = json["message"].as_str().unwrap_or("");

    // Message should be non-empty and reasonably short
    assert!(!message.is_empty(), "Error message should not be empty");
    assert!(
        message.len() < 200,
        "Error message should be reasonably short, got {} chars",
        message.len()
    );

    // Message should not contain technical jargon
    assert!(
        !message.contains("tower")
            && !message.contains("axum")
            && !message.contains("hyper"),
        "Error message should not contain framework internals"
    );
}

/// Test: OpenAPI docs endpoint is accessible
///
/// Verifies that the API documentation endpoint works correctly.
#[tokio::test]
async fn test_openapi_spec_served() {
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

    let json = try_parse_json_response(response).await.unwrap();

    // Verify it's a valid OpenAPI spec
    assert!(json.get("openapi").is_some(), "Should be valid OpenAPI spec");
    assert!(json.get("info").is_some(), "Should have info section");
}

/// Test: Malformed authorization header returns safe 401
///
/// Verifies that malformed auth headers return safe errors.
#[tokio::test]
async fn test_malformed_auth_header_returns_safe_401() {
    let app = app().await;

    let response = app
        .oneshot(
            Request::builder()
                .method(Method::GET)
                .uri("/api/v1/me")
                .header("Authorization", "Token abc123")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

    let json = try_parse_json_response(response).await.unwrap();

    // Verify safe error format
    assert_eq!(json["error"], "unauthorized");

    // Verify token is not echoed back
    let message = json["message"].as_str().unwrap_or("");
    assert!(
        !message.contains("abc123"),
        "Should not echo back the token"
    );
}