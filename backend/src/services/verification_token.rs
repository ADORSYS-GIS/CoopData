use std::time::Duration;

use uuid::Uuid;

use crate::error::AppError;
use crate::services::CacheService;

const TOKEN_TTL: Duration = Duration::from_secs(120);

fn token_key(user_id: &str, token: &str) -> String {
    format!("verify:{user_id}:{token}")
}

pub struct VerificationTokenService;

impl VerificationTokenService {
    pub fn generate() -> String {
        Uuid::new_v4().to_string()
    }

    pub fn redis_key(user_id: &str, token: &str) -> String {
        token_key(user_id, token)
    }

    pub async fn store(cache: &CacheService, user_id: &str, token: &str) -> Result<(), AppError> {
        cache
            .set(&token_key(user_id, token), &true, TOKEN_TTL)
            .await
            .map_err(AppError::from)
    }

    pub async fn validate_and_consume(
        cache: &CacheService,
        user_id: &str,
        token: &str,
    ) -> Result<(), AppError> {
        let key = token_key(user_id, token);
        let exists: Option<bool> = cache.get(&key).await.map_err(AppError::from)?;

        match exists {
            Some(true) => {
                cache.delete(&key).await.map_err(AppError::from)?;
                Ok(())
            }
            _ => Err(AppError::PreconditionRequired(
                "Identity verification is required for destructive actions. Please verify your identity and try again.".to_string(),
            )),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_token_is_unique() {
        let t1 = VerificationTokenService::generate();
        let t2 = VerificationTokenService::generate();
        assert_ne!(t1, t2);
        assert!(!t1.is_empty());
    }

    #[test]
    fn test_redis_key_format() {
        let key = VerificationTokenService::redis_key("user-123", "abc-456");
        assert_eq!(key, "verify:user-123:abc-456");
    }

    #[test]
    fn test_token_key_format() {
        let key = token_key("u1", "t1");
        assert_eq!(key, "verify:u1:t1");
    }
}
