use crate::database::Database;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseBackend, EntityTrait, QueryFilter,
    QueryOrder, Set, Statement,
};
use uuid::Uuid;

use crate::entities::enums::{ReviewTier, SubmissionStatus};
use crate::entities::submission::{self, ActiveModel, Column, Entity};
use crate::error::AppResult;
use crate::repositories::db_query;

#[derive(Clone)]
pub struct SubmissionRepository {
    db: Database,
}

impl SubmissionRepository {
    pub fn new(db: impl Into<Database>) -> Self {
        Self { db: db.into() }
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<submission::Model>> {
        db_query("submission", "find_by_id", async {
            Entity::find_by_id(id)
                .one(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    /// Fetch a submission only if it belongs to one of the provided cooperative IDs.
    /// Returns `None` if not found OR if the cooperative does not match —
    /// callers receive an identical response for both cases, preventing enumeration attacks.
    /// This is the preferred method for cooperative-scoped reads; prefer it over
    /// `find_by_id` + a manual ownership check wherever possible.
    pub async fn find_by_id_for_cooperatives(
        &self,
        id: Uuid,
        cooperative_ids: &[Uuid],
    ) -> AppResult<Option<submission::Model>> {
        if cooperative_ids.is_empty() {
            return Ok(None);
        }
        db_query("submission", "find_by_id_for_cooperatives", async {
            Entity::find_by_id(id)
                .filter(Column::CooperativeId.is_in(cooperative_ids.to_vec()))
                .one(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn find_by_cooperative(
        &self,
        cooperative_id: Uuid,
    ) -> AppResult<Vec<submission::Model>> {
        db_query("submission", "find_by_cooperative", async {
            Entity::find()
                .filter(Column::CooperativeId.eq(cooperative_id))
                .order_by_desc(Column::CreatedAt)
                .all(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn find_by_status(
        &self,
        status: SubmissionStatus,
    ) -> AppResult<Vec<submission::Model>> {
        db_query("submission", "find_by_status", async {
            let query = if status == SubmissionStatus::Approved {
                Entity::find().filter(
                    Column::Status
                        .eq(SubmissionStatus::Approved)
                        .or(Column::Status.eq(SubmissionStatus::Submitted)),
                )
            } else {
                Entity::find().filter(Column::Status.eq(status))
            };
            query
                .order_by_desc(Column::CreatedAt)
                .all(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn find_by_tier(&self, tier: ReviewTier) -> AppResult<Vec<submission::Model>> {
        db_query("submission", "find_by_tier", async {
            Entity::find()
                .filter(Column::CurrentTier.eq(tier))
                .order_by_desc(Column::CreatedAt)
                .all(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn find_by_cooperative_and_year(
        &self,
        cooperative_id: Uuid,
        reporting_year: i32,
    ) -> AppResult<Option<submission::Model>> {
        db_query("submission", "find_by_cooperative_and_year", async {
            Entity::find()
                .filter(Column::CooperativeId.eq(cooperative_id))
                .filter(Column::ReportingYear.eq(reporting_year))
                .one(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn find_all_by_cooperative_and_year(
        &self,
        cooperative_id: Uuid,
        reporting_year: i32,
    ) -> AppResult<Vec<submission::Model>> {
        db_query("submission", "find_all_by_cooperative_and_year", async {
            Entity::find()
                .filter(Column::CooperativeId.eq(cooperative_id))
                .filter(Column::ReportingYear.eq(reporting_year))
                .all(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn find_by_cooperative_and_period(
        &self,
        cooperative_id: Uuid,
        reporting_year: i32,
        period_type: crate::entities::enums::PeriodType,
        period_value: &str,
    ) -> AppResult<Option<submission::Model>> {
        db_query("submission", "find_by_cooperative_and_period", async {
            Entity::find()
                .filter(Column::CooperativeId.eq(cooperative_id))
                .filter(Column::ReportingYear.eq(reporting_year))
                .filter(Column::PeriodType.eq(period_type))
                .filter(Column::PeriodValue.eq(period_value))
                .one(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn count_by_reporting_year(&self, reporting_year: i32) -> AppResult<i64> {
        db_query("submission", "count_by_reporting_year", async {
            use sea_orm::PaginatorTrait;
            let count = Entity::find()
                .filter(Column::ReportingYear.eq(reporting_year))
                .count(&self.db)
                .await
                .map_err(crate::error::AppError::from)?;
            Ok(count as i64)
        })
        .await
    }

    /// Returns the next available reference sequence number for a reporting year,
    /// derived from the highest existing `SUB-{year}-{seq}` reference (not the row
    /// count). Rows with a NULL reference (e.g. seeded submissions) are ignored, so
    /// the sequence never collides with them. Returns 1 when no references exist yet.
    pub async fn next_reference_seq(&self, reporting_year: i32) -> AppResult<u32> {
        db_query("submission", "next_reference_seq", async {
            let stmt = Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "SELECT COALESCE(MAX(CAST(SUBSTRING(reference FROM 'SUB-[0-9]+-([0-9]+)') AS INTEGER)), 0) + 1 AS next_seq FROM submissions WHERE reporting_year = $1 AND reference LIKE 'SUB-%'",
                vec![sea_orm::Value::Int(Some(reporting_year))],
            );
            let row = self
                .db
                .query_one(stmt)
                .await
                .map_err(crate::error::AppError::from)?;
            let next_seq: i32 = row
                .ok_or_else(|| {
                    crate::error::AppError::InternalServerError(
                        "next_reference_seq returned no row".into(),
                    )
                })?
                .try_get_by_index(0)
                .map_err(crate::error::AppError::from)?;
            Ok(next_seq as u32)
        })
        .await
    }

    pub async fn find_by_cooperative_ids(
        &self,
        cooperative_ids: Vec<Uuid>,
    ) -> AppResult<Vec<submission::Model>> {
        if cooperative_ids.is_empty() {
            return Ok(vec![]);
        }
        db_query("submission", "find_by_cooperative_ids", async {
            Entity::find()
                .filter(Column::CooperativeId.is_in(cooperative_ids))
                .order_by_desc(Column::CreatedAt)
                .all(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn find_all_non_draft(&self) -> AppResult<Vec<submission::Model>> {
        db_query("submission", "find_all_non_draft", async {
            Entity::find()
                .filter(Column::Status.ne(SubmissionStatus::Draft))
                .order_by_desc(Column::CreatedAt)
                .all(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn find_by_cooperative_ids_and_tier(
        &self,
        cooperative_ids: Vec<Uuid>,
        tier: ReviewTier,
    ) -> AppResult<Vec<submission::Model>> {
        if cooperative_ids.is_empty() {
            return Ok(vec![]);
        }
        db_query("submission", "find_by_cooperative_ids_and_tier", async {
            Entity::find()
                .filter(Column::CooperativeId.is_in(cooperative_ids))
                .filter(Column::CurrentTier.eq(tier))
                .order_by_desc(Column::CreatedAt)
                .all(&self.db)
                .await
                .map_err(Into::into)
        })
        .await
    }

    pub async fn create(&self, model: ActiveModel) -> AppResult<submission::Model> {
        db_query("submission", "create", async {
            model.insert(&self.db).await.map_err(Into::into)
        })
        .await
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<()> {
        db_query("submission", "delete", async {
            Entity::delete_by_id(id)
                .exec(&self.db)
                .await
                .map_err(crate::error::AppError::from)?;
            Ok(())
        })
        .await
    }

    pub async fn update_metadata(
        &self,
        id: Uuid,
        metadata_patch: serde_json::Value,
    ) -> AppResult<submission::Model> {
        let existing = Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(crate::error::AppError::from)?
            .ok_or_else(|| crate::error::AppError::NotFound("Submission not found".into()))?;

        let mut active: ActiveModel = existing.into();
        let merged = match active.metadata.clone().unwrap() {
            serde_json::Value::Object(mut map) => {
                if let serde_json::Value::Object(patch) = metadata_patch {
                    for (k, v) in patch {
                        map.insert(k, v);
                    }
                }
                serde_json::Value::Object(map)
            }
            _ => metadata_patch,
        };
        active.metadata = Set(merged);
        active.updated_at = Set(chrono::Utc::now());
        active.update(&self.db).await.map_err(Into::into)
    }

    pub async fn update_status(
        &self,
        id: Uuid,
        status: SubmissionStatus,
        current_tier: ReviewTier,
    ) -> AppResult<submission::Model> {
        self.update_status_tx(&self.db, id, status, current_tier)
            .await
    }

    pub async fn update_status_tx<C: ConnectionTrait>(
        &self,
        db: &C,
        id: Uuid,
        status: SubmissionStatus,
        current_tier: ReviewTier,
    ) -> AppResult<submission::Model> {
        let existing = Entity::find_by_id(id)
            .one(db)
            .await
            .map_err(crate::error::AppError::from)?
            .ok_or_else(|| crate::error::AppError::NotFound("Submission not found".into()))?;

        let approving = status == SubmissionStatus::Approved;
        let mut active: ActiveModel = existing.into();
        active.status = Set(status);
        active.current_tier = Set(current_tier);
        active.updated_at = Set(chrono::Utc::now());
        let updated = active
            .update(db)
            .await
            .map_err(crate::error::AppError::from)?;

        if approving {
            Self::freeze_exchange_rate_tx(db, id).await?;
        }
        Ok(updated)
    }

    /// Copy the rate currently in force for the statement's currency onto the
    /// submission the first time it is approved; never overwrites a frozen rate.
    async fn freeze_exchange_rate_tx<C: ConnectionTrait>(db: &C, id: Uuid) -> AppResult<()> {
        db.execute(Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "UPDATE submissions s \
             SET rate_to_usd = er.rate_to_usd, \
                 rate_effective_date = er.effective_date, \
                 rate_source = er.source_note \
             FROM financial_statements fs \
             JOIN exchange_rates er ON er.currency_code = fs.currency \
             WHERE fs.submission_id = s.id AND s.id = $1 AND s.rate_to_usd IS NULL",
            [id.into()],
        ))
        .await
        .map_err(crate::error::AppError::from)?;
        Ok(())
    }

    pub async fn update_submission_method(
        &self,
        id: Uuid,
        method: String,
    ) -> AppResult<submission::Model> {
        let existing = Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(crate::error::AppError::from)?
            .ok_or_else(|| crate::error::AppError::NotFound("Submission not found".into()))?;

        let mut active: ActiveModel = existing.into();
        active.submission_method = Set(method);
        active.updated_at = Set(chrono::Utc::now());
        active.update(&self.db).await.map_err(Into::into)
    }

    pub async fn update_period(
        &self,
        id: Uuid,
        period_type: crate::entities::enums::PeriodType,
        period_value: String,
    ) -> AppResult<submission::Model> {
        let existing = Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(crate::error::AppError::from)?
            .ok_or_else(|| crate::error::AppError::NotFound("Submission not found".into()))?;

        let mut active: ActiveModel = existing.into();
        active.period_type = Set(period_type);
        active.period_value = Set(period_value);
        active.updated_at = Set(chrono::Utc::now());
        active.update(&self.db).await.map_err(Into::into)
    }

    /// Atomically claim editing rights — only succeeds if edited_by is currently NULL.
    /// Returns the updated model on success, or None if the row was already claimed.
    /// This prevents race conditions where two concurrent requests both think they own it.
    pub async fn claim_edited_by(
        &self,
        id: Uuid,
        user_id: Uuid,
        user_name: Option<String>,
    ) -> AppResult<Option<submission::Model>> {
        self.claim_edited_by_tx(&self.db, id, user_id, user_name)
            .await
    }

    pub async fn claim_edited_by_tx<C: ConnectionTrait>(
        &self,
        db: &C,
        id: Uuid,
        user_id: Uuid,
        user_name: Option<String>,
    ) -> AppResult<Option<submission::Model>> {
        let user_name_val = match user_name {
            Some(n) => sea_orm::Value::String(Some(Box::new(n))),
            None => sea_orm::Value::String(None),
        };
        let stmt = Statement::from_sql_and_values(
            DatabaseBackend::Postgres,
            "UPDATE submissions SET edited_by = $1, edited_by_name = $2, updated_at = NOW() WHERE id = $3 AND edited_by IS NULL",
            vec![
                sea_orm::Value::Uuid(Some(Box::new(user_id))),
                user_name_val,
                sea_orm::Value::Uuid(Some(Box::new(id))),
            ],
        );
        let res = db
            .execute(stmt)
            .await
            .map_err(crate::error::AppError::from)?;

        match res.rows_affected() {
            0 => Ok(None),
            _ => {
                let updated = Entity::find_by_id(id)
                    .one(db)
                    .await
                    .map_err(crate::error::AppError::from)?;
                Ok(updated)
            }
        }
    }

    /// Transfer editing rights to a new user (exclusive editor model).
    /// Use `claim_edited_by` for atomic claim-with-check; use this for unconditional sets.
    pub async fn set_edited_by(
        &self,
        id: Uuid,
        user_id: Option<Uuid>,
        user_name: Option<String>,
    ) -> AppResult<submission::Model> {
        self.set_edited_by_tx(&self.db, id, user_id, user_name)
            .await
    }

    pub async fn set_edited_by_tx<C: ConnectionTrait>(
        &self,
        db: &C,
        id: Uuid,
        user_id: Option<Uuid>,
        user_name: Option<String>,
    ) -> AppResult<submission::Model> {
        let existing = Entity::find_by_id(id)
            .one(db)
            .await
            .map_err(crate::error::AppError::from)?
            .ok_or_else(|| crate::error::AppError::NotFound("Submission not found".into()))?;

        let mut active: ActiveModel = existing.into();
        active.edited_by = Set(user_id);
        active.edited_by_name = Set(user_name);
        active.updated_at = Set(chrono::Utc::now());
        active.update(db).await.map_err(Into::into)
    }

    /// Clear edited_by when submission is submitted (no one editing).
    pub async fn clear_edited_by(&self, id: Uuid) -> AppResult<submission::Model> {
        self.set_edited_by(id, None, None).await
    }

    pub async fn set_current_tier(
        &self,
        id: Uuid,
        tier: ReviewTier,
    ) -> AppResult<submission::Model> {
        let existing = Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(crate::error::AppError::from)?
            .ok_or_else(|| crate::error::AppError::NotFound("Submission not found".into()))?;

        let mut active: ActiveModel = existing.into();
        active.current_tier = Set(tier);
        active.updated_at = Set(chrono::Utc::now());
        active.update(&self.db).await.map_err(Into::into)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The empty-cooperative guard must short-circuit to `None` without touching
    /// the database. This is the DB-free guarantee that a caller with no
    /// cooperatives in scope can never resolve a submission — a key tenant
    /// isolation invariant (prevents `is_in([])` from matching anything).
    #[tokio::test]
    async fn find_by_id_for_cooperatives_empty_scope_returns_none() {
        let repo = SubmissionRepository::new(Database::default());
        let result = repo
            .find_by_id_for_cooperatives(Uuid::new_v4(), &[])
            .await
            .expect("empty scope must not error");
        assert!(result.is_none());
    }

    /// Verifies the aggregate behaviour of `next_reference_seq`: it must return the
    /// highest existing `SUB-{year}-{seq}` + 1, not a hardcoded 1. This guards the
    /// MAX+1 aggregation, not the int4→i32 column decode (which cannot be exercised
    /// without a live Postgres returning an int4 column).
    ///
    /// Requires a live Postgres with the schema applied. Skipped by default (CI has
    /// no database). Run with:
    ///   DATABASE_URL=postgres://coopdata:...@localhost:5432/coopdata \
    ///     cargo test --bin coop-data-backend next_reference_seq -- --ignored
    #[tokio::test]
    #[ignore]
    async fn next_reference_seq_returns_highest_existing_plus_one() {
        use sea_orm::ConnectionTrait;

        let url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://coopdata:coopdata@localhost:5432/coopdata".to_string());
        let db = crate::database::connect(&url)
            .await
            .expect("failed to connect to test database");

        let fed_id = Uuid::new_v4();
        let apex_id = Uuid::new_v4();
        let coop_id = Uuid::new_v4();
        let sub_id = Uuid::new_v4();

        let exec = |sql: String| async {
            db.execute(Statement::from_string(DatabaseBackend::Postgres, sql))
                .await
                .expect("test setup SQL failed");
        };

        exec(format!(
            "INSERT INTO federations (id, keycloak_id, display_name) VALUES ('{fed_id}', 'k-{fed_id}', 'Test Fed')"
        ))
        .await;
        exec(format!(
            "INSERT INTO apexes (id, keycloak_id, federation_id, organization_keycloak_id, display_name) VALUES ('{apex_id}', 'k-{apex_id}', '{fed_id}', 'org-{apex_id}', 'Test Apex')"
        ))
        .await;
        exec(format!(
            "INSERT INTO cooperatives (id, keycloak_id, apex_id, display_name) VALUES ('{coop_id}', 'k-{coop_id}', '{apex_id}', 'Test Coop')"
        ))
        .await;
        exec(format!(
            "INSERT INTO submissions (id, reference, cooperative_id, reporting_year, period_type, period_value, fiscal_start_month, status, current_tier, priority, metadata, submission_method, created_at, updated_at, created_by_role) VALUES ('{sub_id}', 'SUB-2025-00001', '{coop_id}', 2025, 'yearly', '2025', 1, 'draft', 'cooperative', 'normal', '{{}}', 'upload', NOW(), NOW(), 'cooperative')"
        ))
        .await;

        let repo = SubmissionRepository::new(db.clone());
        let seq = repo
            .next_reference_seq(2025)
            .await
            .expect("next_reference_seq should not error");

        let cleanup = format!(
            "DELETE FROM submissions WHERE id = '{sub_id}'; \
             DELETE FROM cooperatives WHERE id = '{coop_id}'; \
             DELETE FROM apexes WHERE id = '{apex_id}'; \
             DELETE FROM federations WHERE id = '{fed_id}';"
        );
        let _ = db
            .execute(Statement::from_string(DatabaseBackend::Postgres, cleanup))
            .await;

        assert_eq!(seq, 2, "expected next sequence 2, got {seq}");
    }
}
