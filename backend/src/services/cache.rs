use metrics::counter;
use redis::AsyncCommands;
use serde::{de::DeserializeOwned, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

pub struct CacheService {
    backend: CacheBackend,
}

#[derive(Clone)]
enum CacheBackend {
    Redis(redis::Client),
    Memory(Arc<Mutex<HashMap<String, String>>>),
}

impl Clone for CacheService {
    fn clone(&self) -> Self {
        Self {
            backend: self.backend.clone(),
        }
    }
}

impl CacheService {
    pub async fn new(url: &str) -> Result<Self, redis::RedisError> {
        if url.starts_with("memory://") {
            Ok(Self {
                backend: CacheBackend::Memory(Arc::new(Mutex::new(HashMap::new()))),
            })
        } else {
            let client = redis::Client::open(url)?;
            Ok(Self {
                backend: CacheBackend::Redis(client),
            })
        }
    }

    pub async fn get<T: DeserializeOwned>(
        &self,
        key: &str,
    ) -> Result<Option<T>, redis::RedisError> {
        let entity = key.split(':').next().unwrap_or("unknown");
        let result = match &self.backend {
            CacheBackend::Redis(client) => {
                let mut conn = client.get_multiplexed_async_connection().await?;
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
            CacheBackend::Memory(map) => {
                let lock = map.lock().unwrap();
                match lock.get(key) {
                    Some(json) => {
                        let value = serde_json::from_str(json).map_err(|e| {
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
        };

        match &result {
            Ok(Some(_)) => {
                counter!("coopdata_cache_hits_total", "entity" => entity.to_string())
                    .increment(1);
            }
            Ok(None) => {
                counter!("coopdata_cache_misses_total", "entity" => entity.to_string())
                    .increment(1);
            }
            Err(_) => {}
        }

        result
    }

    pub async fn set<T: Serialize>(
        &self,
        key: &str,
        value: &T,
        ttl: Duration,
    ) -> Result<(), redis::RedisError> {
        let entity = key.split(':').next().unwrap_or("unknown");
        let result = match &self.backend {
            CacheBackend::Redis(client) => {
                let mut conn = client.get_multiplexed_async_connection().await?;
                let json = serde_json::to_string(value).map_err(|e| {
                    redis::RedisError::from((
                        redis::ErrorKind::TypeError,
                        "serialization error",
                        e.to_string(),
                    ))
                })?;
                conn.set_ex(key, json, ttl.as_secs()).await
            }
            CacheBackend::Memory(map) => {
                let json = serde_json::to_string(value).map_err(|e| {
                    redis::RedisError::from((
                        redis::ErrorKind::TypeError,
                        "serialization error",
                        e.to_string(),
                    ))
                })?;
                let mut lock = map.lock().unwrap();
                lock.insert(key.to_string(), json);
                Ok(())
            }
        };

        if result.is_ok() {
            counter!("coopdata_cache_sets_total", "entity" => entity.to_string())
                .increment(1);
        }

        result
    }

    pub async fn delete(&self, key: &str) -> Result<(), redis::RedisError> {
        match &self.backend {
            CacheBackend::Redis(client) => {
                let mut conn = client.get_multiplexed_async_connection().await?;
                conn.del::<_, ()>(key).await
            }
            CacheBackend::Memory(map) => {
                let mut lock = map.lock().unwrap();
                lock.remove(key);
                Ok(())
            }
        }
    }

    pub async fn exists(&self, key: &str) -> Result<bool, redis::RedisError> {
        match &self.backend {
            CacheBackend::Redis(client) => {
                let mut conn = client.get_multiplexed_async_connection().await?;
                conn.exists(key).await
            }
            CacheBackend::Memory(map) => {
                let lock = map.lock().unwrap();
                Ok(lock.contains_key(key))
            }
        }
    }

    pub async fn invalidate_pattern(&self, pattern: &str) -> Result<(), redis::RedisError> {
        match &self.backend {
            CacheBackend::Redis(client) => {
                let mut conn = client.get_multiplexed_async_connection().await?;
                let keys: Vec<String> = redis::cmd("KEYS")
                    .arg(pattern)
                    .query_async(&mut conn)
                    .await?;
                if !keys.is_empty() {
                    conn.del::<_, ()>(&keys).await?;
                }
                Ok(())
            }
            CacheBackend::Memory(map) => {
                let mut lock = map.lock().unwrap();
                if pattern == "*" {
                    lock.clear();
                    return Ok(());
                }
                let prefix = pattern.trim_end_matches('*');
                lock.retain(|k, _| !k.starts_with(prefix));
                Ok(())
            }
        }
    }
}
