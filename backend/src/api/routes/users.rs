use axum::routing::{get, post};
use axum::Router;

use crate::api::handlers;
use crate::AppState;

pub fn user_routes() -> Router<AppState> {
    Router::new()
        .route(
            "/users",
            get(handlers::users::list_users).post(handlers::users::create_user),
        )
        .route(
            "/users/:id",
            get(handlers::users::get_user)
                .patch(handlers::users::update_user)
                .delete(handlers::users::delete_user),
        )
        .route(
            "/users/:id/assign-role",
            post(handlers::users::assign_role_to_user),
        )
}
