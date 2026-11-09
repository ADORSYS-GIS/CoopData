use std::collections::{HashMap, HashSet};

use chrono::{DateTime, NaiveDate, Utc};
use sea_orm::sea_query::OnConflict;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseBackend, EntityTrait, PaginatorTrait,
    QueryFilter, QueryOrder, QuerySelect, Set, Statement,
};
use uuid::Uuid;

use crate::database::Database;
use crate::entities::{
    mambu_account_mapping, mambu_branch_link, mambu_ledger_cache, mambu_ledger_month,
    mambu_product_mapping, mambu_sync_item, mambu_sync_run,
};
use crate::error::{AppError, AppResult};

pub const RUN_RUNNING: &str = "running";
pub const RUN_COMPLETED: &str = "completed";
pub const RUN_FAILED: &str = "failed";

#[derive(Clone)]
pub struct MambuRepository {
    db: Database,
}

impl MambuRepository {
    pub fn new(db: impl Into<Database>) -> Self {
        Self { db: db.into() }
    }

    pub async fn list_links(&self) -> AppResult<Vec<mambu_branch_link::Model>> {
        mambu_branch_link::Entity::find()
            .order_by_asc(mambu_branch_link::Column::MambuBranchId)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_link(
        &self,
        cooperative_id: Uuid,
    ) -> AppResult<Option<mambu_branch_link::Model>> {
        mambu_branch_link::Entity::find_by_id(cooperative_id)
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_link_by_branch(
        &self,
        mambu_branch_id: &str,
    ) -> AppResult<Option<mambu_branch_link::Model>> {
        mambu_branch_link::Entity::find()
            .filter(mambu_branch_link::Column::MambuBranchId.eq(mambu_branch_id))
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn list_links_for(
        &self,
        cooperative_ids: Vec<Uuid>,
    ) -> AppResult<Vec<mambu_branch_link::Model>> {
        mambu_branch_link::Entity::find()
            .filter(mambu_branch_link::Column::CooperativeId.is_in(cooperative_ids))
            .order_by_asc(mambu_branch_link::Column::MambuBranchId)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn upsert_link(
        &self,
        cooperative_id: Uuid,
        mambu_branch_id: &str,
        linked_by: Option<String>,
    ) -> AppResult<()> {
        let now = Utc::now();
        let model = mambu_branch_link::ActiveModel {
            cooperative_id: Set(cooperative_id),
            mambu_branch_id: Set(mambu_branch_id.to_string()),
            linked_by: Set(linked_by),
            created_at: Set(now),
            updated_at: Set(now),
            ..Default::default()
        };
        mambu_branch_link::Entity::insert(model)
            .on_conflict(
                OnConflict::column(mambu_branch_link::Column::CooperativeId)
                    .update_columns([
                        mambu_branch_link::Column::MambuBranchId,
                        mambu_branch_link::Column::LinkedBy,
                        mambu_branch_link::Column::UpdatedAt,
                    ])
                    .to_owned(),
            )
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(())
    }

    /// True once a sync has imported data for the cooperative. From then on its link to
    /// Mambu is fixed.
    pub async fn has_synced(&self, cooperative_id: Uuid) -> AppResult<bool> {
        let count = mambu_sync_item::Entity::find()
            .filter(mambu_sync_item::Column::CooperativeId.eq(cooperative_id))
            .filter(mambu_sync_item::Column::Status.is_in(["synced", "flagged"]))
            .count(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(count > 0)
    }

    /// The cooperatives among `ids` that a sync has already imported data for.
    pub async fn synced_cooperative_ids(&self, ids: Vec<Uuid>) -> AppResult<HashSet<Uuid>> {
        let items = mambu_sync_item::Entity::find()
            .filter(mambu_sync_item::Column::CooperativeId.is_in(ids))
            .filter(mambu_sync_item::Column::Status.is_in(["synced", "flagged"]))
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(items.into_iter().filter_map(|i| i.cooperative_id).collect())
    }

    pub async fn delete_link(&self, cooperative_id: Uuid) -> AppResult<()> {
        mambu_branch_link::Entity::delete_by_id(cooperative_id)
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(())
    }

    pub async fn list_account_mappings(&self) -> AppResult<Vec<mambu_account_mapping::Model>> {
        mambu_account_mapping::Entity::find()
            .order_by_asc(mambu_account_mapping::Column::MambuGlCode)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn upsert_account_mapping(
        &self,
        mambu_gl_code: &str,
        coop_account_code: i32,
        sign: i16,
    ) -> AppResult<()> {
        let now = Utc::now();
        let model = mambu_account_mapping::ActiveModel {
            mambu_gl_code: Set(mambu_gl_code.to_string()),
            coop_account_code: Set(coop_account_code),
            sign: Set(sign),
            created_at: Set(now),
            updated_at: Set(now),
        };
        mambu_account_mapping::Entity::insert(model)
            .on_conflict(
                OnConflict::column(mambu_account_mapping::Column::MambuGlCode)
                    .update_columns([
                        mambu_account_mapping::Column::CoopAccountCode,
                        mambu_account_mapping::Column::Sign,
                        mambu_account_mapping::Column::UpdatedAt,
                    ])
                    .to_owned(),
            )
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(())
    }

    pub async fn delete_account_mapping(&self, mambu_gl_code: &str) -> AppResult<()> {
        mambu_account_mapping::Entity::delete_by_id(mambu_gl_code.to_string())
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(())
    }

    pub async fn list_product_mappings(&self) -> AppResult<Vec<mambu_product_mapping::Model>> {
        mambu_product_mapping::Entity::find()
            .order_by_asc(mambu_product_mapping::Column::ProductKind)
            .order_by_asc(mambu_product_mapping::Column::MambuProductId)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn upsert_product_mapping(
        &self,
        mambu_product_id: &str,
        product_kind: &str,
        mapped_type: &str,
    ) -> AppResult<()> {
        let now = Utc::now();
        let model = mambu_product_mapping::ActiveModel {
            mambu_product_id: Set(mambu_product_id.to_string()),
            product_kind: Set(product_kind.to_string()),
            mapped_type: Set(mapped_type.to_string()),
            created_at: Set(now),
            updated_at: Set(now),
        };
        mambu_product_mapping::Entity::insert(model)
            .on_conflict(
                OnConflict::columns([
                    mambu_product_mapping::Column::MambuProductId,
                    mambu_product_mapping::Column::ProductKind,
                ])
                .update_columns([
                    mambu_product_mapping::Column::MappedType,
                    mambu_product_mapping::Column::UpdatedAt,
                ])
                .to_owned(),
            )
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(())
    }

    pub async fn delete_product_mapping(
        &self,
        mambu_product_id: &str,
        product_kind: &str,
    ) -> AppResult<()> {
        mambu_product_mapping::Entity::delete_by_id((
            mambu_product_id.to_string(),
            product_kind.to_string(),
        ))
        .exec(&self.db)
        .await
        .map_err(AppError::DatabaseError)?;
        Ok(())
    }

    pub async fn list_running_runs(&self) -> AppResult<Vec<mambu_sync_run::Model>> {
        mambu_sync_run::Entity::find()
            .filter(mambu_sync_run::Column::Status.eq(RUN_RUNNING))
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    /// Cooperatives that still wait for their result in one of the given runs.
    pub async fn pending_cooperative_ids(&self, run_ids: Vec<Uuid>) -> AppResult<HashSet<Uuid>> {
        let items = mambu_sync_item::Entity::find()
            .filter(mambu_sync_item::Column::RunId.is_in(run_ids))
            .filter(mambu_sync_item::Column::Status.eq("pending"))
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(items.into_iter().filter_map(|i| i.cooperative_id).collect())
    }

    /// Latest sync start per cooperative since `since`, used for the cooldown.
    /// Items skipped without a Mambu call do not count.
    pub async fn last_sync_starts(
        &self,
        cooperative_ids: Vec<Uuid>,
        since: DateTime<Utc>,
    ) -> AppResult<HashMap<Uuid, DateTime<Utc>>> {
        let items = mambu_sync_item::Entity::find()
            .filter(mambu_sync_item::Column::CooperativeId.is_in(cooperative_ids))
            .filter(mambu_sync_item::Column::CreatedAt.gte(since))
            .filter(mambu_sync_item::Column::Status.ne("skipped"))
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        let mut latest: HashMap<Uuid, DateTime<Utc>> = HashMap::new();
        for item in items {
            if let Some(coop) = item.cooperative_id {
                let entry = latest.entry(coop).or_insert(item.created_at);
                if item.created_at > *entry {
                    *entry = item.created_at;
                }
            }
        }
        Ok(latest)
    }

    /// Most recent runs that include at least one of the given cooperatives.
    pub async fn list_runs_for_cooperatives(
        &self,
        cooperative_ids: Vec<Uuid>,
        limit: u64,
    ) -> AppResult<Vec<mambu_sync_run::Model>> {
        let run_ids: Vec<Uuid> = mambu_sync_item::Entity::find()
            .filter(mambu_sync_item::Column::CooperativeId.is_in(cooperative_ids))
            .select_only()
            .column(mambu_sync_item::Column::RunId)
            .distinct()
            .into_tuple()
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        mambu_sync_run::Entity::find()
            .filter(mambu_sync_run::Column::Id.is_in(run_ids))
            .order_by_desc(mambu_sync_run::Column::StartedAt)
            .limit(limit)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn list_items_for_cooperatives(
        &self,
        run_id: Uuid,
        cooperative_ids: Vec<Uuid>,
    ) -> AppResult<Vec<mambu_sync_item::Model>> {
        mambu_sync_item::Entity::find()
            .filter(mambu_sync_item::Column::RunId.eq(run_id))
            .filter(mambu_sync_item::Column::CooperativeId.is_in(cooperative_ids))
            .order_by_asc(mambu_sync_item::Column::MambuBranchId)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn create_run(
        &self,
        reporting_year: i32,
        month: i16,
        started_by: Option<String>,
        total_saccos: i32,
    ) -> AppResult<mambu_sync_run::Model> {
        mambu_sync_run::ActiveModel {
            id: Set(Uuid::new_v4()),
            reporting_year: Set(reporting_year),
            month: Set(month),
            status: Set(RUN_RUNNING.to_string()),
            started_by: Set(started_by),
            total_saccos: Set(total_saccos),
            error: Set(None),
            started_at: Set(Utc::now()),
            finished_at: Set(None),
        }
        .insert(&self.db)
        .await
        .map_err(AppError::DatabaseError)
    }

    pub async fn finish_run(
        &self,
        run_id: Uuid,
        status: &str,
        error: Option<String>,
    ) -> AppResult<()> {
        let run = self
            .find_run(run_id)
            .await?
            .ok_or_else(|| AppError::NotFound("Sync run not found".into()))?;
        let mut active: mambu_sync_run::ActiveModel = run.into();
        active.status = Set(status.to_string());
        active.error = Set(error);
        active.finished_at = Set(Some(Utc::now()));
        active
            .update(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(())
    }

    pub async fn find_run(&self, run_id: Uuid) -> AppResult<Option<mambu_sync_run::Model>> {
        mambu_sync_run::Entity::find_by_id(run_id)
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn list_runs(&self, limit: u64) -> AppResult<Vec<mambu_sync_run::Model>> {
        mambu_sync_run::Entity::find()
            .order_by_desc(mambu_sync_run::Column::StartedAt)
            .limit(limit)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn count_runs(&self) -> AppResult<u64> {
        mambu_sync_run::Entity::find()
            .count(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn create_item(
        &self,
        run_id: Uuid,
        cooperative_id: Option<Uuid>,
        mambu_branch_id: &str,
        status: &str,
    ) -> AppResult<mambu_sync_item::Model> {
        let now = Utc::now();
        mambu_sync_item::ActiveModel {
            id: Set(Uuid::new_v4()),
            run_id: Set(run_id),
            cooperative_id: Set(cooperative_id),
            mambu_branch_id: Set(mambu_branch_id.to_string()),
            status: Set(status.to_string()),
            submission_id: Set(None),
            members: Set(0),
            savings_accounts: Set(0),
            loans: Set(0),
            fixed_deposits: Set(0),
            ledger_lines: Set(0),
            unmapped_ledger_accounts: Set(0),
            warnings: Set(serde_json::json!([])),
            error: Set(None),
            created_at: Set(now),
            updated_at: Set(now),
        }
        .insert(&self.db)
        .await
        .map_err(AppError::DatabaseError)
    }

    pub async fn save_item(&self, item: mambu_sync_item::Model) -> AppResult<()> {
        let mut active: mambu_sync_item::ActiveModel = item.into();
        active.updated_at = Set(Utc::now());
        active
            .reset_all()
            .update(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(())
    }

    /// Marks the items of a run that never got a result as failed, so they stop
    /// blocking their cooperative.
    pub async fn fail_pending_items(&self, run_id: Uuid, reason: &str) -> AppResult<()> {
        let items = mambu_sync_item::Entity::find()
            .filter(mambu_sync_item::Column::RunId.eq(run_id))
            .filter(mambu_sync_item::Column::Status.eq("pending"))
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        for mut item in items {
            item.status = "failed".to_string();
            item.error = Some(reason.to_string());
            self.save_item(item).await?;
        }
        Ok(())
    }

    pub async fn list_items(&self, run_id: Uuid) -> AppResult<Vec<mambu_sync_item::Model>> {
        mambu_sync_item::Entity::find()
            .filter(mambu_sync_item::Column::RunId.eq(run_id))
            .order_by_asc(mambu_sync_item::Column::MambuBranchId)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }
    /// The closed months of the general ledger kept for a branch, with the date up to
    /// which the cache is complete.
    pub async fn ledger_cache(
        &self,
        mambu_branch_id: &str,
    ) -> AppResult<Option<(NaiveDate, Vec<mambu_ledger_month::Model>)>> {
        let Some(state) = mambu_ledger_cache::Entity::find_by_id(mambu_branch_id.to_string())
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)?
        else {
            return Ok(None);
        };
        let rows = mambu_ledger_month::Entity::find()
            .filter(mambu_ledger_month::Column::MambuBranchId.eq(mambu_branch_id))
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(Some((state.cached_through, rows)))
    }

    /// Stores months of the general ledger and moves the date up to which the cache is
    /// complete. Months stored again replace the earlier figures.
    pub async fn save_ledger_cache(
        &self,
        mambu_branch_id: &str,
        cached_through: NaiveDate,
        rows: Vec<mambu_ledger_month::ActiveModel>,
    ) -> AppResult<()> {
        for chunk in rows.chunks(500) {
            mambu_ledger_month::Entity::insert_many(chunk.to_vec())
                .on_conflict(
                    OnConflict::columns([
                        mambu_ledger_month::Column::MambuBranchId,
                        mambu_ledger_month::Column::MonthStart,
                        mambu_ledger_month::Column::GlCode,
                    ])
                    .update_columns([
                        mambu_ledger_month::Column::AccountType,
                        mambu_ledger_month::Column::AccountName,
                        mambu_ledger_month::Column::Debit,
                        mambu_ledger_month::Column::Credit,
                    ])
                    .to_owned(),
                )
                .exec(&self.db)
                .await
                .map_err(AppError::DatabaseError)?;
        }
        mambu_ledger_cache::Entity::insert(mambu_ledger_cache::ActiveModel {
            mambu_branch_id: Set(mambu_branch_id.to_string()),
            cached_through: Set(cached_through),
            updated_at: Set(Utc::now()),
        })
        .on_conflict(
            OnConflict::column(mambu_ledger_cache::Column::MambuBranchId)
                .update_columns([
                    mambu_ledger_cache::Column::CachedThrough,
                    mambu_ledger_cache::Column::UpdatedAt,
                ])
                .to_owned(),
        )
        .exec(&self.db)
        .await
        .map_err(AppError::DatabaseError)?;
        Ok(())
    }
    pub async fn set_auto_sync(&self, cooperative_id: Uuid, auto_sync: bool) -> AppResult<bool> {
        let result = mambu_branch_link::Entity::update_many()
            .col_expr(
                mambu_branch_link::Column::AutoSync,
                sea_orm::sea_query::Expr::value(auto_sync),
            )
            .col_expr(
                mambu_branch_link::Column::UpdatedAt,
                sea_orm::sea_query::Expr::value(Utc::now()),
            )
            .filter(mambu_branch_link::Column::CooperativeId.eq(cooperative_id))
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(result.rows_affected > 0)
    }

    /// Claims, in one statement, the links that are due for the automatic sync of
    /// `month` (YYYY-MM). Two servers running at once cannot claim the same link.
    pub async fn claim_due_auto_syncs(&self, month: &str) -> AppResult<Vec<Uuid>> {
        let rows = self
            .db
            .query_all(Statement::from_sql_and_values(
                DatabaseBackend::Postgres,
                "UPDATE mambu_branch_links SET last_auto_sync_month = $1 \
                 WHERE auto_sync AND (last_auto_sync_month IS NULL OR last_auto_sync_month <> $1) \
                 RETURNING cooperative_id",
                vec![month.into()],
            ))
            .await
            .map_err(AppError::DatabaseError)?;
        rows.into_iter()
            .map(|r| {
                r.try_get_by_index::<Uuid>(0)
                    .map_err(AppError::DatabaseError)
            })
            .collect()
    }

    /// Gives claimed links back when the run could not start, so the next check tries again.
    pub async fn release_auto_sync_claims(
        &self,
        cooperative_ids: Vec<Uuid>,
        month: &str,
    ) -> AppResult<()> {
        mambu_branch_link::Entity::update_many()
            .col_expr(
                mambu_branch_link::Column::LastAutoSyncMonth,
                sea_orm::sea_query::Expr::value(Option::<String>::None),
            )
            .filter(mambu_branch_link::Column::CooperativeId.is_in(cooperative_ids))
            .filter(mambu_branch_link::Column::LastAutoSyncMonth.eq(month))
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(())
    }

    /// The newest sync result of each cooperative.
    pub async fn latest_items_for_cooperatives(
        &self,
        cooperative_ids: Vec<Uuid>,
    ) -> AppResult<HashMap<Uuid, mambu_sync_item::Model>> {
        let items = mambu_sync_item::Entity::find()
            .filter(mambu_sync_item::Column::CooperativeId.is_in(cooperative_ids))
            .order_by_desc(mambu_sync_item::Column::CreatedAt)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        let mut latest: HashMap<Uuid, mambu_sync_item::Model> = HashMap::new();
        for item in items {
            if let Some(coop) = item.cooperative_id {
                latest.entry(coop).or_insert(item);
            }
        }
        Ok(latest)
    }

    /// The sync result that made or last replaced a submission.
    pub async fn find_item_for_submission(
        &self,
        submission_id: Uuid,
    ) -> AppResult<Option<mambu_sync_item::Model>> {
        mambu_sync_item::Entity::find()
            .filter(mambu_sync_item::Column::SubmissionId.eq(submission_id))
            .order_by_desc(mambu_sync_item::Column::CreatedAt)
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }
}
