use axum::routing::{delete, get, post, put};
use axum::Router;

use crate::api::handlers::mambu as h;
use crate::AppState;

/// Ministry routes of the Mambu synchronisation.
/// Mounted under `/api/v1/ministry` (ministry role required).
pub fn mambu_routes() -> Router<AppState> {
    Router::new()
        .route("/mambu/status", get(h::mambu_status))
        .route("/mambu/branches", get(h::list_mambu_branches))
        .route("/mambu/cooperatives", get(h::list_mambu_cooperatives))
        .route("/mambu/links", put(h::upsert_mambu_link))
        .route(
            "/mambu/links/{cooperative_id}",
            delete(h::delete_mambu_link),
        )
        .route(
            "/mambu/syncs",
            post(h::start_mambu_sync).get(h::list_mambu_syncs),
        )
        .route("/mambu/syncs/{id}", get(h::get_mambu_sync))
        .route("/mambu/gl-accounts", get(h::list_mambu_gl_accounts))
        .route("/mambu/coop-accounts", get(h::list_coop_accounts))
        .route(
            "/mambu/account-mappings",
            get(h::list_account_mappings).put(h::upsert_account_mapping),
        )
        .route(
            "/mambu/account-mappings/{code}",
            delete(h::delete_account_mapping),
        )
        .route("/mambu/products", get(h::list_mambu_products))
        .route(
            "/mambu/product-mappings",
            get(h::list_product_mappings).put(h::upsert_product_mapping),
        )
        .route(
            "/mambu/product-mappings/{kind}/{id}",
            delete(h::delete_product_mapping),
        )
}
