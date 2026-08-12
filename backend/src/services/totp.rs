use crate::error::AppError;
use totp_rs::{Algorithm, Secret, TOTP};

const ISSUER: &str = "CoopData";
const DIGITS: usize = 6;
const SKEW: u8 = 1;
const STEP: u64 = 30;

/// Generate a fresh TOTP secret (base32) and its `otpauth://` URI.
///
/// The secret is returned so the user's authenticator app can be registered
/// with Keycloak once they confirm a code — nothing is persisted here.
pub fn generate_setup(account_name: &str) -> Result<(String, String), AppError> {
    let secret = Secret::generate_secret();
    let secret_bytes = secret
        .to_bytes()
        .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    let totp = TOTP::new(
        Algorithm::SHA1,
        DIGITS,
        SKEW,
        STEP,
        secret_bytes,
        Some(ISSUER.to_string()),
        account_name.to_string(),
    )
    .map_err(|e| AppError::InternalServerError(e.to_string()))?;

    Ok((totp.get_secret_base32(), totp.get_url()))
}

/// Verify a user-entered 6-digit code against a base32 TOTP secret
/// (RFC 6238, SHA1, ±1 step skew).
pub fn verify_code(secret_base32: &str, code: &str) -> bool {
    let Ok(secret_bytes) = Secret::Encoded(secret_base32.to_string()).to_bytes() else {
        return false;
    };
    let Ok(totp) = TOTP::new(
        Algorithm::SHA1,
        DIGITS,
        SKEW,
        STEP,
        secret_bytes,
        Some(ISSUER.to_string()),
        String::new(),
    ) else {
        return false;
    };
    totp.check_current(code).unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_setup_returns_valid_uri_and_secret() {
        let (secret, uri) = generate_setup("user@example.com").unwrap();

        assert!(secret.len() >= 16);
        assert!(uri.starts_with("otpauth://totp/"));
        assert!(uri.contains(&format!("secret={}", secret)));
        assert!(uri.contains("issuer=CoopData"));
        // SHA1 with 6 digits / 30s are the otpauth defaults, so the URI omits
        // them and only carries the secret + issuer.
        assert!(!uri.contains("algorithm="));
        assert!(!uri.contains("digits="));
        assert!(!uri.contains("period="));
    }

    #[test]
    fn verify_code_accepts_current_code() {
        let (secret, _) = generate_setup("user@example.com").unwrap();

        let secret_bytes = Secret::Encoded(secret.clone()).to_bytes().unwrap();
        let totp = TOTP::new(
            Algorithm::SHA1,
            DIGITS,
            SKEW,
            STEP,
            secret_bytes,
            Some(ISSUER.to_string()),
            String::new(),
        )
        .unwrap();
        let current = totp.generate_current().unwrap();

        assert!(verify_code(&secret, &current));
    }

    #[test]
    fn verify_code_rejects_garbage() {
        assert!(!verify_code("not-valid-base32", "123456"));
        assert!(!verify_code("JBSWY3DPEHPK3PXP", "000000"));
    }
}
