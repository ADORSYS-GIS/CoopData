use redis::AsyncCommands;
use serde::{de::DeserializeOwned, Serialize};
use std::time::Duration;

pub struct CacheService {
    client: redis::Client,
}

impl Clone for CacheService {
    fn clone(&self) -> Self {
        Self {
            client: self.client.clone(),
        }
    }
}

impl CacheService {
    pub async fn new(redis_url: &str) -> Result<Self, redis::RedisError> {
        let client = redis::Client::open(redis_url)?;
        Ok(Self { client })
    }

    pub async fn get_connection(
        &self,
    ) -> Result<redis::aio::MultiplexedConnection, redis::RedisError> {
        self.client.get_multiplexed_async_connection().await
    }

    pub async fn get<T: DeserializeOwned>(
        &self,
        key: &str,
    ) -> Result<Option<T>, redis::RedisError> {
        let mut conn = self.get_connection().await?;
        let result: Option<String> = conn.get(key).await?;

        match result {
            Some(json) => {
                let value = serde_json::from_str(&json).map_err(|e| {
                    redis::RedisError::from((
                        redis::ErrorKind::TypeError,
                        "deserialization error",
                        e.to_string(),
                    ))
                })?;
                Ok(Some(value))
            }
            None => Ok(None),
        }
    }

    pub async fn set<T: Serialize>(
        &self,
        key: &str,
        value: &T,
        ttl: Duration,
    ) -> Result<(), redis::RedisError> {
        let mut conn = self.get_connection().await?;
        let json = serde_json::to_string(value).map_err(|e| {
            redis::RedisError::from((
                redis::ErrorKind::TypeError,
                "serialization error",
                e.to_string(),
            ))
        })?;

        conn.set_ex(key, json, ttl.as_secs()).await
    }

    pub async fn delete(&self, key: &str) -> Result<(), redis::RedisError> {
        let mut conn = self.get_connection().await?;
        conn.del::<_, ()>(key).await
    }

    pub async fn exists(&self, key: &str) -> Result<bool, redis::RedisError> {
        let mut conn = self.get_connection().await?;
        conn.exists(key).await
    }

    pub async fn invalidate_pattern(&self, pattern: &str) -> Result<(), redis::RedisError> {
        let mut conn = self.get_connection().await?;
        let keys: Vec<String> = redis::cmd("KEYS")
            .arg(pattern)
            .query_async(&mut conn)
            .await?;

        if !keys.is_empty() {
            conn.del::<_, ()>(&keys).await?;
        }

        Ok(())
    }
}
