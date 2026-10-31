//! Role guards of the Mambu endpoints. Each level may use only its own endpoints:
//! the cooperative syncs its SACCO, the apex links and syncs its cooperatives, and
//! the Ministry keeps the global ones.

mod common;

use axum::http::Method;
use common::mock::{TestApp, TestRequestBuilder};
use serde_json::json;

type Auth = fn(TestRequestBuilder) -> TestRequestBuilder;

fn none(b: TestRequestBuilder) -> TestRequestBuilder {
    b
}
fn ministry(b: TestRequestBuilder) -> TestRequestBuilder {
    b.with_ministry_auth()
}
fn apex(b: TestRequestBuilder) -> TestRequestBuilder {
    b.with_apex_auth()
}
fn coop(b: TestRequestBuilder) -> TestRequestBuilder {
    b.with_coop_admin_auth()
}

async fn status(auth: Auth, method: Method, uri: &str) -> u16 {
    let app = TestApp::new().await;
    auth(app.request().method(method).uri(uri))
        .json(&json!({ "year": 2026, "month": 9 }))
        .send()
        .await
        .status()
}

const COOP_SYNC: &str = "/api/v1/cooperative/mambu/syncs";
const COOP_STATUS: &str = "/api/v1/cooperative/mambu/status";
const APEX_SYNC: &str = "/api/v1/apex/mambu/syncs";
const APEX_BRANCH: &str = "/api/v1/apex/mambu/branches/ES0006";
const APEX_LINK: &str = "/api/v1/apex/cooperatives/00000000-0000-0000-0000-0000000000c1/mambu-link";
const MINISTRY_SYNC: &str = "/api/v1/ministry/mambu/syncs";

#[tokio::test]
async fn nobody_without_a_token_reaches_any_mambu_endpoint() {
    for (method, uri) in [
        (Method::POST, COOP_SYNC),
        (Method::GET, COOP_STATUS),
        (Method::POST, APEX_SYNC),
        (Method::GET, APEX_BRANCH),
        (Method::PUT, APEX_LINK),
        (Method::POST, MINISTRY_SYNC),
    ] {
        assert_eq!(status(none, method, uri).await, 401, "{uri}");
    }
}

#[tokio::test]
async fn a_cooperative_cannot_use_apex_or_ministry_endpoints() {
    for (method, uri) in [
        (Method::POST, APEX_SYNC),
        (Method::GET, APEX_BRANCH),
        (Method::PUT, APEX_LINK),
        (Method::DELETE, APEX_LINK),
        (Method::POST, MINISTRY_SYNC),
    ] {
        assert_eq!(status(coop, method, uri).await, 403, "{uri}");
    }
}

#[tokio::test]
async fn an_apex_cannot_start_a_cooperative_or_ministry_sync() {
    for (method, uri) in [
        (Method::POST, COOP_SYNC),
        (Method::GET, COOP_STATUS),
        (Method::POST, MINISTRY_SYNC),
    ] {
        assert_eq!(status(apex, method, uri).await, 403, "{uri}");
    }
}

#[tokio::test]
async fn the_ministry_cannot_start_a_cooperative_or_apex_sync() {
    for (method, uri) in [
        (Method::POST, COOP_SYNC),
        (Method::GET, COOP_STATUS),
        (Method::POST, APEX_SYNC),
    ] {
        assert_eq!(status(ministry, method, uri).await, 403, "{uri}");
    }
}

#[tokio::test]
async fn each_level_passes_the_guard_of_its_own_endpoints() {
    // The apex sync is not listed: its handler needs an apex group in the token,
    // which the test token does not carry, so it answers 403 for that reason.
    let cases: [(Auth, Method, &str); 4] = [
        (coop, Method::GET, COOP_STATUS),
        (coop, Method::POST, COOP_SYNC),
        (apex, Method::GET, APEX_BRANCH),
        (ministry, Method::GET, APEX_BRANCH),
    ];
    for (auth, method, uri) in cases {
        let code = status(auth, method, uri).await;
        assert!(code != 401 && code != 403, "{uri} answered {code}");
    }
}
