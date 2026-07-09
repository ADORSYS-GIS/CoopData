use crate::config::AppConfig;
use crate::error::{AppError, AppResult};
use std::path::PathBuf;

#[derive(Clone)]
pub struct ObjectStorageService {
    backend: StorageBackend,
}

#[derive(Clone)]
enum StorageBackend {
    S3 { bucket: Box<s3::Bucket> },
    Local { base_path: PathBuf },
}

impl ObjectStorageService {
    pub fn new(config: &AppConfig) -> AppResult<Self> {
        if config.storage_type == "s3" {
            let region = s3::Region::Custom {
                region: config.s3_region.clone(),
                endpoint: config.s3_endpoint.clone(),
            };
            let credentials = s3::creds::Credentials::new(
                Some(&config.s3_access_key),
                Some(&config.s3_secret_key),
                None,
                None,
                None,
            )
            .map_err(|e| AppError::ExternalServiceError(format!("S3 credentials error: {}", e)))?;
            let bucket = s3::Bucket::new(&config.s3_bucket, region, credentials)
                .map_err(|e| AppError::ExternalServiceError(format!("S3 bucket error: {}", e)))?;
            let bucket = bucket.with_path_style();
            Ok(Self {
                backend: StorageBackend::S3 { bucket },
            })
        } else {
            let base_path = PathBuf::from(&config.storage_path);
            std::fs::create_dir_all(&base_path).map_err(|e| {
                AppError::ExternalServiceError(format!("Failed to create storage dir: {}", e))
            })?;
            Ok(Self {
                backend: StorageBackend::Local { base_path },
            })
        }
    }

    pub async fn put_object(
        &self,
        key: &str,
        bytes: &[u8],
        content_type: Option<&str>,
    ) -> AppResult<()> {
        match &self.backend {
            StorageBackend::S3 { bucket } => {
                let ct = content_type.unwrap_or("application/octet-stream");
                bucket
                    .put_object_with_content_type(key, bytes, ct)
                    .await
                    .map(|_| ())
                    .map_err(|e| {
                        AppError::ExternalServiceError(format!("S3 put_object error: {}", e))
                    })
            }
            StorageBackend::Local { base_path } => {
                let path = base_path.join(key);
                if let Some(parent) = path.parent() {
                    std::fs::create_dir_all(parent).map_err(|e| {
                        AppError::ExternalServiceError(format!("Failed to create dir: {}", e))
                    })?;
                }
                std::fs::write(&path, bytes).map_err(|e| {
                    AppError::ExternalServiceError(format!("Failed to write file: {}", e))
                })
            }
        }
    }

    pub async fn get_object(&self, key: &str) -> AppResult<Vec<u8>> {
        match &self.backend {
            StorageBackend::S3 { bucket } => {
                let response_data = bucket.get_object(key).await.map_err(|e| {
                    AppError::ExternalServiceError(format!("S3 get_object error: {}", e))
                })?;
                if response_data.status_code() == 200 {
                    Ok(response_data.to_vec())
                } else {
                    Err(AppError::NotFound(format!(
                        "Object '{}' not found (status {})",
                        key,
                        response_data.status_code()
                    )))
                }
            }
            StorageBackend::Local { base_path } => {
                let path = base_path.join(key);
                std::fs::read(&path)
                    .map_err(|e| AppError::NotFound(format!("File '{}' not found: {}", key, e)))
            }
        }
    }

    pub async fn delete_object(&self, key: &str) -> AppResult<()> {
        match &self.backend {
            StorageBackend::S3 { bucket } => {
                bucket.delete_object(key).await.map(|_| ()).map_err(|e| {
                    AppError::ExternalServiceError(format!("S3 delete_object error: {}", e))
                })
            }
            StorageBackend::Local { base_path } => {
                let path = base_path.join(key);
                std::fs::remove_file(&path)
                    .map_err(|e| AppError::NotFound(format!("File '{}' not found: {}", key, e)))
            }
        }
    }
}
