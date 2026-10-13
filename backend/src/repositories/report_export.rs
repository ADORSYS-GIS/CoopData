use sea_orm::{ColumnTrait, ConnectionTrait, DatabaseBackend, EntityTrait, QueryFilter, Statement};
use uuid::Uuid;

use crate::database::Database;
use crate::entities::report_export::{self, STATUS_FAILED, STATUS_PREPARING, STATUS_READY};
use crate::error::{AppError, AppResult};
use crate::repositories::db_query;

/// Status rows of generated report PDFs (`report_exports`).
#[derive(Clone)]
pub struct ReportExportRepository {
    db: Database,
}

impl ReportExportRepository {
    pub fn new(db: impl Into<Database>) -> Self {
        Self { db: db.into() }
    }

    /// Marks `(report_key, lang)` as preparing and returns the row id when the
    /// caller now owns the job. Returns `None` while another job is preparing it,
    /// unless that job started more than `timeout_secs` ago (it is presumed lost,
    /// e.g. the process restarted, and is taken over). One atomic statement, so two
    /// concurrent callers can never both own the job.
    pub async fn claim(
        &self,
        report_key: &str,
        lang: &str,
        timeout_secs: u64,
    ) -> AppResult<Option<Uuid>> {
        db_query("report_export", "claim", async {
            let stmt = Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "INSERT INTO report_exports (id, report_key, lang, status, started_at, updated_at) \
                 VALUES ($1, $2, $3, $4, now(), now()) \
                 ON CONFLICT (report_key, lang) DO UPDATE \
                   SET status = EXCLUDED.status, error = NULL, started_at = now(), updated_at = now() \
                   WHERE report_exports.status <> $4 \
                      OR report_exports.started_at < now() - make_interval(secs => $5) \
                 RETURNING id",
                vec![
                    Uuid::new_v4().into(),
                    report_key.into(),
                    lang.into(),
                    STATUS_PREPARING.into(),
                    (timeout_secs as f64).into(),
                ],
            );
            let row = self.db.query_one(stmt).await.map_err(AppError::from)?;
            row.map(|r| r.try_get_by_index::<Uuid>(0))
                .transpose()
                .map_err(AppError::from)
        })
        .await
    }

    /// Records a finished job. Returns `false` when the row no longer exists
    /// because the report was invalidated while the job ran.
    pub async fn mark_ready(&self, id: Uuid, storage_key: &str) -> AppResult<bool> {
        self.finish(id, STATUS_READY, Some(storage_key), None).await
    }

    pub async fn mark_failed(&self, id: Uuid, error: &str) -> AppResult<bool> {
        self.finish(id, STATUS_FAILED, None, Some(error)).await
    }

    async fn finish(
        &self,
        id: Uuid,
        status: &str,
        storage_key: Option<&str>,
        error: Option<&str>,
    ) -> AppResult<bool> {
        db_query("report_export", "finish", async {
            let stmt = Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "UPDATE report_exports \
                 SET status = $2, storage_key = $3, error = $4, updated_at = now() \
                 WHERE id = $1 AND status = $5",
                vec![
                    id.into(),
                    status.into(),
                    storage_key.map(str::to_string).into(),
                    error.map(str::to_string).into(),
                    STATUS_PREPARING.into(),
                ],
            );
            let result = self.db.execute(stmt).await.map_err(AppError::from)?;
            Ok(result.rows_affected() > 0)
        })
        .await
    }

    /// Whether job `id` still owns its row: it exists and is preparing. A job
    /// loses it when its report is invalidated or taken over after a timeout.
    pub async fn owns(&self, id: Uuid) -> AppResult<bool> {
        db_query("report_export", "owns", async {
            let found = report_export::Entity::find_by_id(id)
                .filter(report_export::Column::Status.eq(STATUS_PREPARING))
                .one(&self.db)
                .await
                .map_err(AppError::from)?;
            Ok(found.is_some())
        })
        .await
    }

    /// Whether any job (running or finished) is recorded for this language.
    pub async fn exists(&self, report_key: &str, lang: &str) -> AppResult<bool> {
        db_query("report_export", "exists", async {
            let found = report_export::Entity::find()
                .filter(report_export::Column::ReportKey.eq(report_key))
                .filter(report_export::Column::Lang.eq(lang))
                .one(&self.db)
                .await
                .map_err(AppError::from)?;
            Ok(found.is_some())
        })
        .await
    }

    /// Records an already existing PDF as ready (reports generated before status
    /// tracking existed). Leaves an existing row untouched.
    pub async fn insert_ready(
        &self,
        report_key: &str,
        lang: &str,
        storage_key: &str,
    ) -> AppResult<()> {
        db_query("report_export", "insert_ready", async {
            let stmt = Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "INSERT INTO report_exports (id, report_key, lang, status, storage_key, started_at, updated_at) \
                 VALUES ($1, $2, $3, $4, $5, now(), now()) \
                 ON CONFLICT (report_key, lang) DO NOTHING",
                vec![
                    Uuid::new_v4().into(),
                    report_key.into(),
                    lang.into(),
                    STATUS_READY.into(),
                    storage_key.into(),
                ],
            );
            self.db.execute(stmt).await.map_err(AppError::from)?;
            Ok(())
        })
        .await
    }

    pub async fn list(&self, report_key: &str) -> AppResult<Vec<report_export::Model>> {
        db_query("report_export", "list", async {
            report_export::Entity::find()
                .filter(report_export::Column::ReportKey.eq(report_key))
                .all(&self.db)
                .await
                .map_err(AppError::from)
        })
        .await
    }

    pub async fn delete_language(&self, report_key: &str, lang: &str) -> AppResult<()> {
        db_query("report_export", "delete_language", async {
            report_export::Entity::delete_many()
                .filter(report_export::Column::ReportKey.eq(report_key))
                .filter(report_export::Column::Lang.eq(lang))
                .exec(&self.db)
                .await
                .map_err(AppError::from)?;
            Ok(())
        })
        .await
    }

    /// Forgets every language of a report except `keep` (all of them when `None`).
    pub async fn delete_languages(&self, report_key: &str, keep: Option<&str>) -> AppResult<()> {
        db_query("report_export", "delete_languages", async {
            let mut delete = report_export::Entity::delete_many()
                .filter(report_export::Column::ReportKey.eq(report_key));
            if let Some(lang) = keep {
                delete = delete.filter(report_export::Column::Lang.ne(lang));
            }
            delete.exec(&self.db).await.map_err(AppError::from)?;
            Ok(())
        })
        .await
    }
}
