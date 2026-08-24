use crate::entities::{fixed_deposit, FixedDepositColumn};
use crate::error::{AppError, AppResult};
use sea_orm::sea_query::OnConflict;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter,
    QueryOrder,
};
use uuid::Uuid;

#[derive(Clone)]
pub struct FixedDepositRepository {
    db: DatabaseConnection,
}

impl FixedDepositRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<fixed_deposit::Model>> {
        fixed_deposit::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_cooperative_id(
        &self,
        cooperative_id: Uuid,
        submission_id: Option<Uuid>,
        page: u64,
        page_size: u64,
    ) -> AppResult<(Vec<fixed_deposit::Model>, u64)> {
        let mut query = fixed_deposit::Entity::find()
            .filter(FixedDepositColumn::CooperativeId.eq(cooperative_id));
        if let Some(sub_id) = submission_id {
            query = query.filter(FixedDepositColumn::SubmissionId.eq(sub_id));
        }
        let paginator = query
            .order_by_desc(FixedDepositColumn::CreatedAt)
            .paginate(&self.db, page_size);
        let total = paginator
            .num_items()
            .await
            .map_err(AppError::DatabaseError)?;
        let rows = paginator
            .fetch_page(page.saturating_sub(1))
            .await
            .map_err(AppError::DatabaseError)?;
        Ok((rows, total))
    }

    pub async fn create(
        &self,
        model: fixed_deposit::ActiveModel,
    ) -> AppResult<fixed_deposit::Model> {
        model.insert(&self.db).await.map_err(|e| {
            if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                AppError::Conflict("Fixed deposit already exists".into())
            } else {
                AppError::DatabaseError(e)
            }
        })
    }

    pub async fn update(
        &self,
        model: fixed_deposit::ActiveModel,
    ) -> AppResult<fixed_deposit::Model> {
        model.update(&self.db).await.map_err(|e| {
            if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                AppError::Conflict("Fixed deposit with this ID already exists".into())
            } else {
                AppError::DatabaseError(e)
            }
        })
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<()> {
        fixed_deposit::Entity::delete_by_id(id)
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(())
    }

    pub async fn delete_by_cooperative_and_submission(
        &self,
        cooperative_id: Uuid,
        submission_id: Uuid,
    ) -> AppResult<u64> {
        let result = fixed_deposit::Entity::delete_many()
            .filter(FixedDepositColumn::CooperativeId.eq(cooperative_id))
            .filter(FixedDepositColumn::SubmissionId.eq(submission_id))
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(result.rows_affected)
    }

    pub async fn delete_by_cooperative(&self, cooperative_id: Uuid) -> AppResult<u64> {
        let result = fixed_deposit::Entity::delete_many()
            .filter(FixedDepositColumn::CooperativeId.eq(cooperative_id))
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(result.rows_affected)
    }

    pub async fn bulk_upsert(&self, models: Vec<fixed_deposit::ActiveModel>) -> AppResult<u64> {
        if models.is_empty() {
            return Ok(0);
        }
        let mut deduped: std::collections::HashMap<String, fixed_deposit::ActiveModel> =
            std::collections::HashMap::new();
        for model in models {
            use sea_orm::ActiveValue;
            let coop_key = match &model.cooperative_id {
                ActiveValue::Set(v) | ActiveValue::Unchanged(v) => v.to_string(),
                _ => continue,
            };
            let id_key = match &model.fixed_deposit_id {
                ActiveValue::Set(v) | ActiveValue::Unchanged(v) => v.clone(),
                _ => continue,
            };
            deduped.insert(format!("{}-{}", coop_key, id_key), model);
        }
        let models: Vec<_> = deduped.into_values().collect();
        let count = models.len() as u64;
        fixed_deposit::Entity::insert_many(models)
            .on_conflict(
                OnConflict::columns([
                    FixedDepositColumn::CooperativeId,
                    FixedDepositColumn::FixedDepositId,
                ])
                .update_columns([
                    FixedDepositColumn::SubmissionId,
                    FixedDepositColumn::MemberId,
                    FixedDepositColumn::DepositType,
                    FixedDepositColumn::StartDate,
                    FixedDepositColumn::MaturityDate,
                    FixedDepositColumn::Status,
                    FixedDepositColumn::TenureCategory,
                    FixedDepositColumn::OriginalTenureSelected,
                    FixedDepositColumn::EarlyWithdrawalFlag,
                    FixedDepositColumn::RolloverAtMaturityFlag,
                    FixedDepositColumn::NumberOfRenewals,
                    FixedDepositColumn::ChangeInTenureAtRenewal,
                    FixedDepositColumn::SingleDepositorDependencyFlag,
                    FixedDepositColumn::InterestRate,
                    FixedDepositColumn::Balance,
                ])
                .to_owned(),
            )
            .exec(&self.db)
            .await
            .map(|_| count)
            .map_err(|e| {
                tracing::error!(error = %e, "fixed_deposit bulk_upsert failed");
                AppError::DatabaseError(e)
            })
    }
}
