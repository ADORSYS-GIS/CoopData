use crate::entities::{savings_account, SavingsAccountColumn};
use crate::error::{AppError, AppResult};
use sea_orm::sea_query::OnConflict;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter,
    QueryOrder,
};
use uuid::Uuid;

#[derive(Clone)]
pub struct SavingsAccountRepository {
    db: DatabaseConnection,
}

impl SavingsAccountRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<savings_account::Model>> {
        savings_account::Entity::find_by_id(id)
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
    ) -> AppResult<(Vec<savings_account::Model>, u64)> {
        let mut query = savings_account::Entity::find()
            .filter(SavingsAccountColumn::CooperativeId.eq(cooperative_id));
        if let Some(sub_id) = submission_id {
            query = query.filter(SavingsAccountColumn::SubmissionId.eq(sub_id));
        }
        let paginator = query
            .order_by_desc(SavingsAccountColumn::CreatedAt)
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
        model: savings_account::ActiveModel,
    ) -> AppResult<savings_account::Model> {
        model.insert(&self.db).await.map_err(|e| {
            if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                AppError::Conflict("Savings account already exists".into())
            } else {
                AppError::DatabaseError(e)
            }
        })
    }

    pub async fn update(
        &self,
        model: savings_account::ActiveModel,
    ) -> AppResult<savings_account::Model> {
        model.update(&self.db).await.map_err(|e| {
            if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                AppError::Conflict("Savings account with this ID already exists".into())
            } else {
                AppError::DatabaseError(e)
            }
        })
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<()> {
        savings_account::Entity::delete_by_id(id)
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
        let result = savings_account::Entity::delete_many()
            .filter(SavingsAccountColumn::CooperativeId.eq(cooperative_id))
            .filter(SavingsAccountColumn::SubmissionId.eq(submission_id))
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(result.rows_affected)
    }

    pub async fn bulk_upsert(&self, models: Vec<savings_account::ActiveModel>) -> AppResult<u64> {
        if models.is_empty() {
            return Ok(0);
        }
        let count = models.len() as u64;
        savings_account::Entity::insert_many(models)
            .on_conflict(
                OnConflict::columns([
                    SavingsAccountColumn::CooperativeId,
                    SavingsAccountColumn::SavingsAccountId,
                ])
                .update_columns([
                    SavingsAccountColumn::SubmissionId,
                    SavingsAccountColumn::MemberId,
                    SavingsAccountColumn::AccountType,
                    SavingsAccountColumn::AccountOpeningDate,
                    SavingsAccountColumn::AccountStatus,
                    SavingsAccountColumn::ContributionFrequency,
                    SavingsAccountColumn::LastContributionDate,
                    SavingsAccountColumn::NumberOfContributions,
                    SavingsAccountColumn::BalanceTrend,
                    SavingsAccountColumn::ZeroBalanceFlag,
                    SavingsAccountColumn::WithdrawalFrequencyCategory,
                    SavingsAccountColumn::EmergencyWithdrawalsFlag,
                    SavingsAccountColumn::InterestRate,
                    SavingsAccountColumn::Balance,
                ])
                .to_owned(),
            )
            .exec(&self.db)
            .await
            .map(|_| count)
            .map_err(|e| {
                if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                    AppError::Conflict("Duplicate savings account during bulk upsert".into())
                } else {
                    AppError::DatabaseError(e)
                }
            })
    }
}
