use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use validator::Validate;

#[derive(Debug, Serialize, Deserialize, ToSchema, Validate)]
pub struct CreateInvitationRequest {
    #[validate(email(message = "Invalid email format"))]
    pub email: String,
    #[validate(length(min = 1, max = 100, message = "First name must be 1-100 characters"))]
    pub first_name: String,
    #[validate(length(min = 1, max = 100, message = "Last name must be 1-100 characters"))]
    pub last_name: String,
    #[validate(length(min = 1, max = 50, message = "Role must be 1-50 characters"))]
    pub role: String,
    #[serde(default)]
    #[validate(url(message = "Invalid redirect URL format"))]
    pub redirect_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct InvitationResponse {
    pub id: String,
    pub email: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    /// Unix epoch seconds
    pub created_at: Option<i64>,
    /// true when the invitation email was dispatched
    pub email_sent: bool,
    /// "PENDING" | "ACCEPTED" | "EXPIRED" — from Keycloak 26
    pub status: Option<String>,
}

impl From<crate::models::keycloak::KeycloakInvitation> for InvitationResponse {
    fn from(inv: crate::models::keycloak::KeycloakInvitation) -> Self {
        // Keycloak 26 returns createdAt in epoch milliseconds; convert to seconds
        let created_at_secs = inv.created_at.map(|ms| {
            if ms > 1_000_000_000_000 {
                ms / 1000 // was milliseconds
            } else {
                ms // already seconds
            }
        });

        // Derive email_sent: Keycloak 26 uses status field; treat "PENDING" / no status as sent
        let email_sent = inv.email_sent
            || inv
                .status
                .as_deref()
                .map(|s| s != "EXPIRED")
                .unwrap_or(true);

        Self {
            id: inv.id,
            email: inv.email,
            first_name: inv.first_name,
            last_name: inv.last_name,
            created_at: created_at_secs,
            email_sent,
            status: inv.status,
        }
    }
}
