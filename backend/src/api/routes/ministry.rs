//! Ministry-level routes (Level 1 in the 4-level IAM hierarchy).
//!
//! Ministry users are platform super-admins who can:
//! - Create, read, update, delete federations
//! - Invite users to federations and manage federation members
//! - Manage organizations and users
//!
//! All routes require the `ministry` role.
//! Role enforcement is handled by middleware in `api.rs`.

use axum::routing::{delete, get, post};
use axum::Router;

use crate::api::handlers::federation::{
    create_federation, delete_federation, delete_federation_invitation, get_federation,
    invite_user_to_federation, list_federation_invitations, list_federation_members,
    list_federations, remove_federation_member, resend_federation_invitation, update_federation,
};
use crate::api::handlers::{
    assign_role_to_user, create_organization, create_user, delete_organization, delete_user,
    get_organization, get_user, list_organizations, list_users, update_organization, update_user,
};
use crate::AppState;

/// Creates the Ministry routes router.
/// All routes are prefixed with `/api/v1/ministry`.
pub fn ministry_routes() -> Router<AppState> {
    Router::new()
        // Federation CRUD
        .route(
            "/federations",
            post(create_federation).get(list_federations),
        )
        .route(
            "/federations/{id}",
            get(get_federation)
                .patch(update_federation)
                .delete(delete_federation),
        )
        // Federation Invitations
        .route(
            "/federations/{id}/invitations",
            post(invite_user_to_federation).get(list_federation_invitations),
        )
        .route(
            "/federations/{id}/invitations/{invitation_id}",
            delete(delete_federation_invitation),
        )
        .route(
            "/federations/{id}/invitations/{invitation_id}/resend",
            post(resend_federation_invitation),
        )
        // Federation Members
        .route("/federations/{id}/members", get(list_federation_members))
        .route(
            "/federations/{id}/members/{user_id}",
            delete(remove_federation_member),
        )
        // Organization CRUD
        .route(
            "/organizations",
            get(list_organizations).post(create_organization),
        )
        .route(
            "/organizations/{id}",
            get(get_organization)
                .patch(update_organization)
                .delete(delete_organization),
        )
        // User management
        .route("/users", get(list_users).post(create_user))
        .route(
            "/users/{id}",
            get(get_user).patch(update_user).delete(delete_user),
        )
        .route("/users/{id}/assign-role", post(assign_role_to_user))
}
