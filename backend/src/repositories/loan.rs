use crate::entities::{loan, LoanColumn};
use crate::error::{AppError, AppResult};
use sea_orm::sea_query::OnConflict;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter,
    QueryOrder,
};
use uuid::Uuid;

#[derive(Clone)]
pub struct LoanRepository {
    db: DatabaseConnection,
}

impl LoanRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<loan::Model>> {
        loan::Entity::find_by_id(id)
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
    ) -> AppResult<(Vec<loan::Model>, u64)> {
        let mut query = loan::Entity::find().filter(LoanColumn::CooperativeId.eq(cooperative_id));
        if let Some(sub_id) = submission_id {
            query = query.filter(LoanColumn::SubmissionId.eq(sub_id));
        }
        let paginator = query
            .order_by_desc(LoanColumn::CreatedAt)
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

    pub async fn create(&self, model: loan::ActiveModel) -> AppResult<loan::Model> {
        model.insert(&self.db).await.map_err(|e| {
            if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                AppError::Conflict("Loan already exists".into())
            } else {
                AppError::DatabaseError(e)
            }
        })
    }

    pub async fn update(&self, model: loan::ActiveModel) -> AppResult<loan::Model> {
        model.update(&self.db).await.map_err(|e| {
            if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                AppError::Conflict("Loan with this loan_id already exists".into())
            } else {
                AppError::DatabaseError(e)
            }
        })
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<()> {
        loan::Entity::delete_by_id(id)
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
        let result = loan::Entity::delete_many()
            .filter(LoanColumn::CooperativeId.eq(cooperative_id))
            .filter(LoanColumn::SubmissionId.eq(submission_id))
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(result.rows_affected)
    }

    pub async fn delete_by_cooperative(&self, cooperative_id: Uuid) -> AppResult<u64> {
        let result = loan::Entity::delete_many()
            .filter(LoanColumn::CooperativeId.eq(cooperative_id))
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(result.rows_affected)
    }

    pub async fn bulk_upsert(&self, models: Vec<loan::ActiveModel>) -> AppResult<u64> {
        if models.is_empty() {
            return Ok(0);
        }
        let mut deduped: std::collections::HashMap<String, loan::ActiveModel> =
            std::collections::HashMap::new();
        for model in models {
            use sea_orm::ActiveValue;
            let coop_key = match &model.cooperative_id {
                ActiveValue::Set(v) | ActiveValue::Unchanged(v) => v.to_string(),
                _ => continue,
            };
            let id_key = match &model.loan_id {
                ActiveValue::Set(v) | ActiveValue::Unchanged(v) => v.clone(),
                _ => continue,
            };
            deduped.insert(format!("{}-{}", coop_key, id_key), model);
        }
        let models: Vec<_> = deduped.into_values().collect();
        let count = models.len() as u64;
        loan::Entity::insert_many(models)
            .on_conflict(
                OnConflict::columns([LoanColumn::CooperativeId, LoanColumn::LoanId])
                    .update_columns([
                        LoanColumn::SubmissionId,
                        LoanColumn::MemberId,
                        LoanColumn::LoanProductType,
                        LoanColumn::LoanStartDate,
                        LoanColumn::LoanMaturityDate,
                        LoanColumn::LoanStatus,
                        LoanColumn::BorrowerType,
                        LoanColumn::YouthBorrowerFlag,
                        LoanColumn::WomenBorrowerFlag,
                        LoanColumn::RuralBorrowerFlag,
                        LoanColumn::RepaymentRegularity,
                        LoanColumn::DaysPastDueCategory,
                        LoanColumn::MissedInstallmentsCount,
                        LoanColumn::RestructuredLoanFlag,
                        LoanColumn::NumberOfRestructurings,
                        LoanColumn::EarlySettlementFlag,
                        LoanColumn::MultipleLoansFlag,
                        LoanColumn::LargeBorrowerFlag,
                        LoanColumn::InterestRate,
                        LoanColumn::Balance,
                        LoanColumn::LoanAmount,
                    ])
                    .to_owned(),
            )
            .exec(&self.db)
            .await
            .map(|_| count)
            .map_err(|e| {
                tracing::error!(error = %e, "loan bulk_upsert failed");
                AppError::DatabaseError(e)
            })
    }

    pub async fn get_portfolio_breakdown(
        &self,
        cooperative_id: Uuid,
    ) -> AppResult<Vec<crate::api::dto::submission::PortfolioCategoryDto>> {
        use sea_orm::{sea_query::Expr, FromQueryResult, QuerySelect};

        #[derive(FromQueryResult)]
        struct BreakdownRow {
            category: crate::entities::enums::DpdCategory,
            balance: Option<rust_decimal::Decimal>,
            count: i64,
        }

        let rows = loan::Entity::find()
            .filter(LoanColumn::CooperativeId.eq(cooperative_id))
            .select_only()
            .column_as(LoanColumn::DaysPastDueCategory, "category")
            .column_as(Expr::col(LoanColumn::Balance).sum(), "balance")
            .column_as(Expr::col(LoanColumn::Id).count(), "count")
            .group_by(LoanColumn::DaysPastDueCategory)
            .into_model::<BreakdownRow>()
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;

        use rust_decimal::prelude::ToPrimitive;
        Ok(rows
            .into_iter()
            .map(|r| crate::api::dto::submission::PortfolioCategoryDto {
                category: match r.category {
                    crate::entities::enums::DpdCategory::Zero => "Performing".to_string(),
                    crate::entities::enums::DpdCategory::Days1To30 => "Watch".to_string(),
                    crate::entities::enums::DpdCategory::Days31To60 => "Substandard".to_string(),
                    crate::entities::enums::DpdCategory::Days61To90 => "Doubtful".to_string(),
                    crate::entities::enums::DpdCategory::Days91Plus => "Loss".to_string(),
                },
                balance: r.balance.and_then(|d| d.to_f64()).unwrap_or(0.0),
                count: r.count,
            })
            .collect())
    }
}
