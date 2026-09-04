use std::path::PathBuf;
use std::sync::Arc;

use aws_sdk_s3::primitives::ByteStream;
use aws_sdk_s3::Client;

use crate::config::AppConfig;
use crate::error::{AppError, AppResult};

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn create_test_data() -> Vec<u8> {
        b"Hello, CoopData!".to_vec()
    }

    #[tokio::test]
    async fn local_storage_store_and_retrieve() {
        let temp = TempDir::new().unwrap();
        let storage = LocalFileStorage::new(temp.path().to_str().unwrap());

        let data = create_test_data();
        storage
            .store("test/file.txt", &data, "text/plain")
            .await
            .unwrap();

        let retrieved = storage.retrieve("test/file.txt").await.unwrap();
        assert_eq!(retrieved, data);
    }

    #[tokio::test]
    async fn local_storage_retrieve_not_found() {
        let temp = TempDir::new().unwrap();
        let storage = LocalFileStorage::new(temp.path().to_str().unwrap());

        let result = storage.retrieve("nonexistent.txt").await;
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert!(matches!(err, AppError::NotFound(_)));
    }

    #[tokio::test]
    async fn local_storage_delete_removes_file() {
        let temp = TempDir::new().unwrap();
        let storage = LocalFileStorage::new(temp.path().to_str().unwrap());

        let data = create_test_data();
        storage
            .store("delete/me.txt", &data, "text/plain")
            .await
            .unwrap();
        storage.delete("delete/me.txt").await.unwrap();

        let result = storage.retrieve("delete/me.txt").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn local_storage_delete_nonexistent_is_ok() {
        let temp = TempDir::new().unwrap();
        let storage = LocalFileStorage::new(temp.path().to_str().unwrap());

        let result = storage.delete("nonexistent.txt").await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn local_storage_store_creates_parent_dirs() {
        let temp = TempDir::new().unwrap();
        let storage = LocalFileStorage::new(temp.path().to_str().unwrap());

        let data = create_test_data();
        storage
            .store("nested/deep/path/file.txt", &data, "text/plain")
            .await
            .unwrap();

        let retrieved = storage.retrieve("nested/deep/path/file.txt").await.unwrap();
        assert_eq!(retrieved, data);
    }

    #[tokio::test]
    async fn local_storage_overwrites_existing_file() {
        let temp = TempDir::new().unwrap();
        let storage = LocalFileStorage::new(temp.path().to_str().unwrap());

        storage
            .store("overwrite.txt", b"first", "text/plain")
            .await
            .unwrap();
        storage
            .store("overwrite.txt", b"second", "text/plain")
            .await
            .unwrap();

        let retrieved = storage.retrieve("overwrite.txt").await.unwrap();
        assert_eq!(retrieved, b"second");
    }

    #[tokio::test]
    async fn local_storage_handles_binary_data() {
        let temp = TempDir::new().unwrap();
        let storage = LocalFileStorage::new(temp.path().to_str().unwrap());

        let binary_data: Vec<u8> = (0..255).collect();
        storage
            .store("binary/file.bin", &binary_data, "application/octet-stream")
            .await
            .unwrap();

        let retrieved = storage.retrieve("binary/file.bin").await.unwrap();
        assert_eq!(retrieved, binary_data);
    }

    #[tokio::test]
    async fn local_storage_handles_empty_file() {
        let temp = TempDir::new().unwrap();
        let storage = LocalFileStorage::new(temp.path().to_str().unwrap());

        storage.store("empty.txt", &[], "text/plain").await.unwrap();

        let retrieved = storage.retrieve("empty.txt").await.unwrap();
        assert_eq!(retrieved, Vec::<u8>::new());
    }

    #[tokio::test]
    async fn object_storage_service_wraps_local_backend() {
        let temp = TempDir::new().unwrap();
        let storage = LocalFileStorage::new(temp.path().to_str().unwrap());
        let service = ObjectStorageService {
            backend: Arc::new(storage),
        };

        let data = create_test_data();
        service
            .put_object("service/test.txt", &data, Some("text/plain"))
            .await
            .unwrap();

        let retrieved = service.get_object("service/test.txt").await.unwrap();
        assert_eq!(retrieved, data);
    }

    #[tokio::test]
    async fn object_storage_service_delete_object() {
        let temp = TempDir::new().unwrap();
        let storage = LocalFileStorage::new(temp.path().to_str().unwrap());
        let service = ObjectStorageService {
            backend: Arc::new(storage),
        };

        service
            .store("service/delete.txt", b"to delete", "text/plain")
            .await
            .unwrap();
        service.delete("service/delete.txt").await.unwrap();

        let result = service.retrieve("service/delete.txt").await;
        assert!(result.is_err());
    }

    #[tokio::test]
    async fn object_storage_service_defaults_content_type() {
        let temp = TempDir::new().unwrap();
        let storage = LocalFileStorage::new(temp.path().to_str().unwrap());
        let service = ObjectStorageService {
            backend: Arc::new(storage),
        };

        service
            .put_object("no-ct.txt", b"no content type", None)
            .await
            .unwrap();

        let retrieved = service.retrieve("no-ct.txt").await.unwrap();
        assert_eq!(retrieved, b"no content type");
    }
}

#[async_trait::async_trait]
pub trait ObjectStorage: Send + Sync {
    async fn store(&self, key: &str, data: &[u8], _content_type: &str) -> AppResult<()>;
    async fn retrieve(&self, key: &str) -> AppResult<Vec<u8>>;
    async fn delete(&self, key: &str) -> AppResult<()>;
}

// ── Local filesystem implementation (dev default) ────────────────────────────

pub struct LocalFileStorage {
    base_path: PathBuf,
}

impl LocalFileStorage {
    pub fn new(base_path: &str) -> Self {
        Self {
            base_path: PathBuf::from(base_path),
        }
    }
}

#[async_trait::async_trait]
impl ObjectStorage for LocalFileStorage {
    async fn store(&self, key: &str, data: &[u8], _content_type: &str) -> AppResult<()> {
        let path = self.base_path.join(key);
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent)
                .await
                .map_err(|e| AppError::InternalServerError(format!("Failed to create dir: {e}")))?;
        }
        tokio::fs::write(&path, data)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to write file: {e}")))?;
        Ok(())
    }

    async fn retrieve(&self, key: &str) -> AppResult<Vec<u8>> {
        let path = self.base_path.join(key);
        tokio::fs::read(&path)
            .await
            .map_err(|e| AppError::NotFound(format!("File not found: {e}")))
    }

    async fn delete(&self, key: &str) -> AppResult<()> {
        let path = self.base_path.join(key);
        if !path.exists() {
            return Ok(());
        }
        tokio::fs::remove_file(&path)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to delete file: {e}")))
    }
}

// ── S3/MinIO implementation ──────────────────────────────────────────────────

pub struct S3FileStorage {
    client: Client,
    bucket: String,
}

impl S3FileStorage {
    pub async fn new(config: &AppConfig) -> AppResult<Self> {
        let endpoint_url = &config.s3_endpoint;
        let region = &config.s3_region;
        let access_key = &config.s3_access_key;
        let secret_key = &config.s3_secret_key;
        let bucket = config.s3_bucket.clone();

        let credentials =
            aws_sdk_s3::config::Credentials::new(access_key, secret_key, None, None, "coopdata");

        let s3_config = aws_sdk_s3::config::Builder::new()
            .region(aws_sdk_s3::config::Region::new(region.clone()))
            .endpoint_url(endpoint_url)
            .credentials_provider(credentials)
            .force_path_style(true)
            .behavior_version_latest()
            .build();

        let client = Client::from_conf(s3_config);

        // Auto-create bucket if it doesn't exist
        match client.create_bucket().bucket(&bucket).send().await {
            Ok(_) => {
                tracing::info!(bucket = %bucket, "S3 bucket created successfully");
            }
            Err(e) => {
                let err_str = e.to_string();
                let debug_str = format!("{:?}", e);
                if err_str.contains("BucketAlreadyExists")
                    || err_str.contains("BucketAlreadyOwnedByYou")
                    || debug_str.contains("BucketAlreadyOwnedByYou")
                    || debug_str.contains("BucketAlreadyExists")
                    || err_str.contains("409")
                {
                    tracing::info!(
                        bucket = %bucket,
                        "S3 bucket already exists or owned by you, proceeding"
                    );
                } else {
                    tracing::warn!(
                        bucket = %bucket,
                        error = %err_str,
                        debug_error = ?e,
                        "Could not auto-create S3 bucket. Proceeding anyway..."
                    );
                }
            }
        }

        Ok(Self { client, bucket })
    }
}

#[async_trait::async_trait]
impl ObjectStorage for S3FileStorage {
    async fn store(&self, key: &str, data: &[u8], content_type: &str) -> AppResult<()> {
        self.client
            .put_object()
            .bucket(&self.bucket)
            .key(key)
            .body(ByteStream::from(data.to_vec()))
            .content_type(content_type)
            .send()
            .await
            .map_err(|e| {
                let debug_str = format!("{:?}", e);
                let err_str = e.to_string();
                tracing::error!(error = %err_str, debug_error = %debug_str, bucket = %self.bucket, key = %key, "S3 put_object failed");
                if debug_str.contains("XMinioStorageFull") || debug_str.contains("minimum free drive threshold") || err_str.contains("XMinioStorageFull") {
                    AppError::ExternalServiceError("Storage server is out of disk space (MinIO free drive threshold reached). Please free up disk space on your computer to proceed with file uploads.".to_string())
                } else {
                    AppError::ExternalServiceError(format!("File storage failed: {err_str}"))
                }
            })?;

        Ok(())
    }

    async fn retrieve(&self, key: &str) -> AppResult<Vec<u8>> {
        let response = self
            .client
            .get_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| {
                let err_str = e.to_string();
                if err_str.contains("NoSuchKey") {
                    AppError::NotFound(format!("Object '{key}' not found"))
                } else {
                    AppError::ExternalServiceError(format!(
                        "Failed to retrieve file from storage: {err_str}"
                    ))
                }
            })?;

        let bytes = response.body.collect().await.map_err(|e| {
            AppError::ExternalServiceError(format!(
                "Failed to read file contents from storage: {e}"
            ))
        })?;

        Ok(bytes.into_bytes().to_vec())
    }

    async fn delete(&self, key: &str) -> AppResult<()> {
        self.client
            .delete_object()
            .bucket(&self.bucket)
            .key(key)
            .send()
            .await
            .map_err(|e| {
                AppError::ExternalServiceError(format!("Failed to delete file from storage: {e}"))
            })?;

        Ok(())
    }
}

// ── High-level service wrapper ───────────────────────────────────────────────

#[derive(Clone)]
pub struct ObjectStorageService {
    backend: Arc<dyn ObjectStorage>,
}

impl ObjectStorageService {
    pub async fn new(config: &AppConfig) -> AppResult<Self> {
        let backend: Arc<dyn ObjectStorage> = if config.storage_type == "s3" {
            Arc::new(S3FileStorage::new(config).await?)
        } else {
            Arc::new(LocalFileStorage::new(&config.storage_path))
        };
        Ok(Self { backend })
    }

    pub async fn put_object(
        &self,
        key: &str,
        bytes: &[u8],
        content_type: Option<&str>,
    ) -> AppResult<()> {
        let ct = content_type.unwrap_or("application/octet-stream");
        self.backend.store(key, bytes, ct).await
    }

    pub async fn get_object(&self, key: &str) -> AppResult<Vec<u8>> {
        self.backend.retrieve(key).await
    }

    pub async fn delete_object(&self, key: &str) -> AppResult<()> {
        self.backend.delete(key).await
    }

    pub async fn store(&self, key: &str, data: &[u8], content_type: &str) -> AppResult<()> {
        self.put_object(key, data, Some(content_type)).await
    }

    pub async fn retrieve(&self, key: &str) -> AppResult<Vec<u8>> {
        self.get_object(key).await
    }

    pub async fn delete(&self, key: &str) -> AppResult<()> {
        self.delete_object(key).await
    }
}
