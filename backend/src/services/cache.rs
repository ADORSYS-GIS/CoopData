use metrics::counter;
use redis::AsyncCommands;
use serde::de::DeserializeOwned;
use serde::Serialize;
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
                counter!("coopdata_cache_hits_total", "entity" => entity.to_string()).increment(1);
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
            counter!("coopdata_cache_sets_total", "entity" => entity.to_string()).increment(1);
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

#[cfg(test)]
mod tests {
    use super::*;
    use serde::{Deserialize, Serialize};

    #[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
    struct TestStruct {
        name: String,
        value: i32,
    }

    fn create_test_data() -> TestStruct {
        TestStruct {
            name: "test".to_string(),
            value: 42,
        }
    }

    #[tokio::test]
    async fn cache_get_returns_none_when_key_missing() {
        let cache = CacheService::new("memory://").await.unwrap();
        let result: Option<TestStruct> = cache.get("missing-key").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn cache_set_and_get_returns_stored_value() {
        let cache = CacheService::new("memory://").await.unwrap();
        let data = create_test_data();
        cache
            .set("test:key", &data, Duration::from_secs(300))
            .await
            .unwrap();

        let result: Option<TestStruct> = cache.get("test:key").await.unwrap();
        assert!(result.is_some());
        let val = result.unwrap();
        assert_eq!(val.name, "test");
        assert_eq!(val.value, 42);
    }

    #[tokio::test]
    async fn cache_set_overwrites_existing_value() {
        let cache = CacheService::new("memory://").await.unwrap();
        let data1 = TestStruct {
            name: "first".to_string(),
            value: 1,
        };
        let data2 = TestStruct {
            name: "second".to_string(),
            value: 2,
        };

        cache
            .set("test:overwrite", &data1, Duration::from_secs(300))
            .await
            .unwrap();
        cache
            .set("test:overwrite", &data2, Duration::from_secs(300))
            .await
            .unwrap();

        let result: Option<TestStruct> = cache.get("test:overwrite").await.unwrap();
        let val = result.unwrap();
        assert_eq!(val.name, "second");
        assert_eq!(val.value, 2);
    }

    #[tokio::test]
    async fn cache_delete_removes_key() {
        let cache = CacheService::new("memory://").await.unwrap();
        let data = create_test_data();
        cache
            .set("test:delete", &data, Duration::from_secs(300))
            .await
            .unwrap();

        cache.delete("test:delete").await.unwrap();

        let result: Option<TestStruct> = cache.get("test:delete").await.unwrap();
        assert!(result.is_none());
    }

    #[tokio::test]
    async fn cache_exists_returns_true_for_existing_key() {
        let cache = CacheService::new("memory://").await.unwrap();
        let data = create_test_data();
        cache
            .set("test:exists", &data, Duration::from_secs(300))
            .await
            .unwrap();

        let exists = cache.exists("test:exists").await.unwrap();
        assert!(exists);
    }

    #[tokio::test]
    async fn cache_exists_returns_false_for_missing_key() {
        let cache = CacheService::new("memory://").await.unwrap();
        let exists = cache.exists("test:missing").await.unwrap();
        assert!(!exists);
    }

    #[tokio::test]
    async fn cache_invalidate_pattern_clears_matching_keys() {
        let cache = CacheService::new("memory://").await.unwrap();
        let data = create_test_data();

        cache
            .set("user:1", &data, Duration::from_secs(300))
            .await
            .unwrap();
        cache
            .set("user:2", &data, Duration::from_secs(300))
            .await
            .unwrap();
        cache
            .set("org:1", &data, Duration::from_secs(300))
            .await
            .unwrap();

        cache.invalidate_pattern("user:*").await.unwrap();

        let user1: Option<TestStruct> = cache.get("user:1").await.unwrap();
        let user2: Option<TestStruct> = cache.get("user:2").await.unwrap();
        let org1: Option<TestStruct> = cache.get("org:1").await.unwrap();

        assert!(user1.is_none());
        assert!(user2.is_none());
        assert!(org1.is_some());
    }

    #[tokio::test]
    async fn cache_invalidate_pattern_star_clears_all() {
        let cache = CacheService::new("memory://").await.unwrap();
        let data = create_test_data();

        cache
            .set("key1", &data, Duration::from_secs(300))
            .await
            .unwrap();
        cache
            .set("key2", &data, Duration::from_secs(300))
            .await
            .unwrap();

        cache.invalidate_pattern("*").await.unwrap();

        let result1: Option<TestStruct> = cache.get("key1").await.unwrap();
        let result2: Option<TestStruct> = cache.get("key2").await.unwrap();

        assert!(result1.is_none());
        assert!(result2.is_none());
    }

    #[tokio::test]
    async fn cache_handles_complex_struct() {
        let cache = CacheService::new("memory://").await.unwrap();
        let complex_data = TestStruct {
            name: "complex".to_string(),
            value: 999,
        };

        cache
            .set("complex:data", &complex_data, Duration::from_secs(300))
            .await
            .unwrap();

        let result: Option<TestStruct> = cache.get("complex:data").await.unwrap();
        assert!(result.is_some());
        assert_eq!(result.unwrap().value, 999);
    }

    #[tokio::test]
    async fn cache_handles_empty_string_key() {
        let cache = CacheService::new("memory://").await.unwrap();
        let data = create_test_data();

        cache
            .set("", &data, Duration::from_secs(300))
            .await
            .unwrap();

        let result: Option<TestStruct> = cache.get("").await.unwrap();
        assert!(result.is_some());
    }

    #[tokio::test]
    async fn cache_handles_special_characters_in_key() {
        let cache = CacheService::new("memory://").await.unwrap();
        let data = create_test_data();

        cache
            .set("coop:eswatini:region:shiselweni:2024", &data, Duration::from_secs(300))
            .await
            .unwrap();

        let result: Option<TestStruct> = cache.get("coop:eswatini:region:shiselweni:2024").await.unwrap();
        assert!(result.is_some());
    }

    #[tokio::test]
    async fn cache_new_with_memory_url_creates_memory_backend() {
        let cache = CacheService::new("memory://").await.unwrap();
        let data = create_test_data();

        cache
            .set("memory:test", &data, Duration::from_secs(300))
            .await
            .unwrap();

        let result: Option<TestStruct> = cache.get("memory:test").await.unwrap();
        assert!(result.is_some());
    }

    #[tokio::test]
    async fn cache_clone_works_independently() {
        let cache1 = CacheService::new("memory://").await.unwrap();
        let data = create_test_data();

        cache1
            .set("clone:test", &data, Duration::from_secs(300))
            .await
            .unwrap();

        let cache2 = cache1.clone();

        let result1: Option<TestStruct> = cache1.get("clone:test").await.unwrap();
        let result2: Option<TestStruct> = cache2.get("clone:test").await.unwrap();

        assert!(result1.is_some());
        assert!(result2.is_some());
    }

    #[tokio::test]
    async fn cache_multiple_operations_sequence() {
        let cache = CacheService::new("memory://").await.unwrap();
        let _data = create_test_data();

        for i in 0..100 {
            let key = format!("batch:{}", i);
            let item = TestStruct {
                name: format!("item-{}", i),
                value: i,
            };
            cache
                .set(&key, &item, Duration::from_secs(300))
                .await
                .unwrap();
        }

        for i in 0..100 {
            let key = format!("batch:{}", i);
            let result: Option<TestStruct> = cache.get(&key).await.unwrap();
            assert!(result.is_some());
            assert_eq!(result.unwrap().value, i);
        }
    }
}
