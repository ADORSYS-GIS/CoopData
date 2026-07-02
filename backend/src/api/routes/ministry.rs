//! Ministry-level routes (Level 1 in the 4-level IAM hierarchy).
//!
//! Ministry users are platform super-admins who can:
//! - Create, read, update, delete federations
//! - Invite users to federations
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
use crate::api::handlers::{create_organization, create_user, delete_organization, delete_user, get_organization, get_user, list_organizations, list_users, update_organization, update_user, assign_role_to_user};
use crate::AppState;

/// Creates the Ministry routes router.
/// All routes are prefixed with `/api/v1/ministry`.
///
/// # Required Role
/// `ministry` (enforced by middleware)
///
/// # Routes
/// - `POST /federations` - Create a new federation
/// - `GET /federations` - List all federations
/// - `GET /federations/:id` - Get a federation by ID
/// - `PATCH /federations/:id` - Update a federation
/// - `DELETE /federations/:id` - Delete a federation
/// - `POST /federations/:id/invitations` - Invite user to federation
/// - `GET /federations/:id/invitations` - List federation invitations
/// - `DELETE /federations/:id/invitations/:invitation_id` - Cancel invitation
/// - `POST /federations/:id/invitations/:invitation_id/resend` - Resend invitation
/// - `GET /federations/:id/members` - List federation members
/// - `GET /organizations` - List organizations
/// - `POST /organizations` - Create organization
/// - `GET /organizations/:id` - Get organization
/// - `PATCH /organizations/:id` - Update organization
/// - `DELETE /organizations/:id` - Delete organization
/// - `GET /users` - List users
/// - `POST /users` - Create user
/// - `GET /users/:id` - Get user
/// - `PATCH /users/:id` - Update user
/// - `DELETE /users/:id` - Delete user
/// - `POST /users/:id/assign-role` - Assign role to user
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
        // User Management
        .route("/users", get(list_users).post(create_user))
        .route(
            "/users/{id}",
            get(get_user).patch(update_user).delete(delete_user),
        )
        .route("/users/{id}/assign-role", post(assign_role_to_user))
}
