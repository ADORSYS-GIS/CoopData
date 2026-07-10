use std::path::PathBuf;

use crate::error::{AppError, AppResult};

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
        tokio::fs::remove_file(&path)
            .await
            .map_err(|e| AppError::InternalServerError(format!("Failed to delete file: {e}")))
    }
}

// ── Factory ──────────────────────────────────────────────────────────────────

pub fn create_storage(backend: &str, local_path: &str) -> std::sync::Arc<dyn ObjectStorage> {
    match backend {
        "s3" => {
            tracing::warn!("S3 backend not yet implemented, falling back to local storage");
            std::sync::Arc::new(LocalFileStorage::new(local_path))
        }
        _ => std::sync::Arc::new(LocalFileStorage::new(local_path)),
    }
}
