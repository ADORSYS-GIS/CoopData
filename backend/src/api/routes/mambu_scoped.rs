use axum::routing::{get, post};
use axum::Router;

use crate::api::handlers::mambu_scoped as h;
use crate::api::routes::api::role_guard_layer;
use crate::auth::rbac::roles;
use crate::AppState;

/// Mambu sync of one SACCO. Mounted under `/api/v1/cooperative`.
/// Only the cooperative role may use it: the SACCO is read from the token.
pub fn mambu_cooperative_routes() -> Router<AppState> {
    Router::new()
        .route("/mambu/status", get(h::coop_mambu_status))
        .route(
            "/mambu/syncs",
            post(h::coop_start_mambu_sync).get(h::coop_list_mambu_syncs),
        )
        .route("/mambu/syncs/{id}", get(h::coop_get_mambu_sync))
        .layer(axum::middleware::from_fn(role_guard_layer(&[
            roles::COOPERATIVE,
        ])))
}

/// Linking of cooperatives and sync of their data. Mounted under `/api/v1/apex`.
/// The sync endpoints are for the apex role only. The Ministry has its own.
pub fn mambu_apex_routes() -> Router<AppState> {
    let sync = Router::new()
        .route(
            "/mambu/syncs",
            post(h::apex_start_mambu_sync).get(h::apex_list_mambu_syncs),
        )
        .route("/mambu/syncs/{id}", get(h::apex_get_mambu_sync))
        .layer(axum::middleware::from_fn(role_guard_layer(&[roles::APEX])));
    Router::new()
        .route("/mambu/status", get(h::apex_mambu_status))
        .route("/mambu/branches", get(h::apex_search_mambu_branches))
        .route(
            "/mambu/branches/{branch_id}",
            get(h::apex_preview_mambu_branch),
        )
        .route(
            "/cooperatives/{id}/mambu-link",
            get(h::apex_get_mambu_link)
                .put(h::apex_set_mambu_link)
                .delete(h::apex_clear_mambu_link),
        )
        .merge(sync)
}
