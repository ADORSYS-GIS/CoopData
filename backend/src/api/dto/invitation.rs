use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreateInvitationRequest {
    pub email: String,
    pub first_name: String,
    pub last_name: String,
    pub role: String,
    #[serde(default)]
    pub redirect_url: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct InvitationResponse {
    pub id: String,
    pub email: Option<String>,
    pub created_at: Option<i64>,
    pub email_sent: bool,
}

impl From<crate::models::keycloak::KeycloakInvitation> for InvitationResponse {
    fn from(inv: crate::models::keycloak::KeycloakInvitation) -> Self {
        Self {
            id: inv.id,
            email: inv.email,
            created_at: inv.created_at,
            email_sent: inv.email_sent,
        }
    }
}