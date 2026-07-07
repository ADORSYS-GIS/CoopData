use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Deserialize, ToSchema)]
pub struct VerifyIdentityRequest {
    pub password: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub otp: Option<String>,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct VerifyIdentityResponse {
    pub verification_token: String,
    pub requires_otp: bool,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct DeletePreviewResponse {
    pub apexes: u64,
    pub cooperatives: u64,
    pub members: u64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_verify_identity_request_deserialize() {
        let json = r#"{"password":"secret"}"#;
        let req: VerifyIdentityRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.password, "secret");
        assert!(req.otp.is_none());
    }

    #[test]
    fn test_verify_identity_request_with_otp() {
        let json = r#"{"password":"secret","otp":"123456"}"#;
        let req: VerifyIdentityRequest = serde_json::from_str(json).unwrap();
        assert_eq!(req.password, "secret");
        assert_eq!(req.otp.as_deref(), Some("123456"));
    }

    #[test]
    fn test_verify_identity_response_serialize() {
        let resp = VerifyIdentityResponse {
            verification_token: "abc-123".to_string(),
            requires_otp: false,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("abc-123"));
        assert!(json.contains("false"));
    }

    #[test]
    fn test_delete_preview_response_serialize() {
        let resp = DeletePreviewResponse {
            apexes: 3,
            cooperatives: 7,
            members: 42,
        };
        let json = serde_json::to_string(&resp).unwrap();
        assert!(json.contains("\"apexes\":3"));
        assert!(json.contains("\"cooperatives\":7"));
        assert!(json.contains("\"members\":42"));
    }
}
