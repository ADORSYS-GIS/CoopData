//! Role guards of the Mambu endpoints. Only the apex may use them: linking, syncing,
//! the automatic sync setting and the mappings. The Ministry and the cooperatives have
//! no Mambu endpoint at all.

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
        .json(&json!({ "year": 2026 }))
        .send()
        .await
        .status()
}

const APEX_SYNC: &str = "/api/v1/apex/mambu/syncs";
const APEX_STATUS: &str = "/api/v1/apex/mambu/status";
const APEX_COOPERATIVES: &str = "/api/v1/apex/mambu/cooperatives";
const APEX_BRANCH: &str = "/api/v1/apex/mambu/branches/ES0006";
const APEX_MAPPINGS: &str = "/api/v1/apex/mambu/account-mappings";
const APEX_LINK: &str = "/api/v1/apex/cooperatives/00000000-0000-0000-0000-0000000000c1/mambu-link";
const APEX_AUTO: &str =
    "/api/v1/apex/cooperatives/00000000-0000-0000-0000-0000000000c1/mambu-auto-sync";
const REMOVED: [&str; 3] = [
    "/api/v1/ministry/mambu/syncs",
    "/api/v1/ministry/mambu/links",
    "/api/v1/cooperative/mambu/syncs",
];

fn apex_endpoints() -> [(Method, &'static str); 9] {
    [
        (Method::POST, APEX_SYNC),
        (Method::GET, APEX_STATUS),
        (Method::GET, APEX_COOPERATIVES),
        (Method::GET, APEX_BRANCH),
        (Method::GET, APEX_MAPPINGS),
        (Method::PUT, APEX_MAPPINGS),
        (Method::PUT, APEX_LINK),
        (Method::DELETE, APEX_LINK),
        (Method::PUT, APEX_AUTO),
    ]
}

#[tokio::test]
async fn nobody_without_a_token_reaches_any_mambu_endpoint() {
    for (method, uri) in apex_endpoints() {
        assert_eq!(status(none, method, uri).await, 401, "{uri}");
    }
}

#[tokio::test]
async fn a_cooperative_cannot_use_any_mambu_endpoint() {
    for (method, uri) in apex_endpoints() {
        assert_eq!(status(coop, method, uri).await, 403, "{uri}");
    }
}

#[tokio::test]
async fn the_ministry_cannot_use_any_mambu_endpoint() {
    for (method, uri) in apex_endpoints() {
        assert_eq!(status(ministry, method, uri).await, 403, "{uri}");
    }
}

#[tokio::test]
async fn the_ministry_and_cooperative_routes_of_mambu_are_gone() {
    for uri in REMOVED {
        for auth in [ministry as Auth, coop as Auth] {
            let code = status(auth, Method::POST, uri).await;
            assert!(code == 404 || code == 405, "{uri} answered {code}");
        }
    }
}

#[tokio::test]
async fn the_apex_passes_the_guard_of_its_endpoints() {
    // Endpoints that read the apex group of the token answer 403 for the test token,
    // which has none, so only the ones that do not need it are listed.
    for uri in [APEX_STATUS, APEX_BRANCH] {
        let code = status(apex, Method::GET, uri).await;
        assert!(code != 401 && code != 403, "{uri} answered {code}");
    }
}
