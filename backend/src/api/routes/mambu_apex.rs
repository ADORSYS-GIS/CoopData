use axum::routing::{delete, get, post, put};
use axum::Router;

use crate::api::handlers::mambu as mapping;
use crate::api::handlers::mambu_apex as h;
use crate::api::routes::api::role_guard_layer;
use crate::auth::rbac::roles;
use crate::AppState;

/// Everything about Mambu is for the apex role only: linking its cooperatives, syncing
/// them and mapping the Mambu accounts and products. Mounted under `/api/v1/apex`.
pub fn mambu_routes() -> Router<AppState> {
    Router::new()
        .route("/mambu/status", get(h::apex_mambu_status))
        .route("/mambu/branches", get(h::apex_search_mambu_branches))
        .route(
            "/mambu/branches/{branch_id}",
            get(h::apex_preview_mambu_branch),
        )
        .route("/mambu/cooperatives", get(h::apex_list_mambu_cooperatives))
        .route(
            "/cooperatives/{id}/mambu-link",
            get(h::apex_get_mambu_link)
                .put(h::apex_set_mambu_link)
                .delete(h::apex_clear_mambu_link),
        )
        .route(
            "/cooperatives/{id}/mambu-auto-sync",
            put(h::apex_set_mambu_auto_sync),
        )
        .route(
            "/mambu/syncs",
            post(h::apex_start_mambu_sync).get(h::apex_list_mambu_syncs),
        )
        .route("/mambu/syncs/{id}", get(h::apex_get_mambu_sync))
        .route("/mambu/syncs/{id}/cancel", post(h::apex_cancel_mambu_sync))
        .route("/mambu/gl-accounts", get(mapping::list_mambu_gl_accounts))
        .route("/mambu/coop-accounts", get(mapping::list_coop_accounts))
        .route(
            "/mambu/account-mappings",
            get(mapping::list_account_mappings).put(mapping::upsert_account_mapping),
        )
        .route(
            "/mambu/account-mappings/{code}",
            delete(mapping::delete_account_mapping),
        )
        .route("/mambu/products", get(mapping::list_mambu_products))
        .route(
            "/mambu/product-mappings",
            get(mapping::list_product_mappings).put(mapping::upsert_product_mapping),
        )
        .route(
            "/mambu/product-mappings/{kind}/{id}",
            delete(mapping::delete_product_mapping),
        )
        .layer(axum::middleware::from_fn(role_guard_layer(&[roles::APEX])))
}
