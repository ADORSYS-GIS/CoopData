use crate::entities::{non_financial_indicator_entry, NonFinancialIndicatorEntryColumn};
use crate::error::{AppError, AppResult};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, ConnectionTrait, DatabaseConnection, EntityTrait, QueryFilter,
    Statement,
};
use uuid::Uuid;

#[derive(Clone)]
pub struct NonFinancialIndicatorEntryRepository {
    db: DatabaseConnection,
}

#[derive(Debug, serde::Serialize)]
pub struct ConsolidationRegionRow {
    pub region: String,
    pub total_sum: f64,
    pub average: f64,
    pub count: i64,
}

#[derive(Debug, serde::Serialize)]
pub struct ConsolidationCoopTypeRow {
    pub coop_type: String,
    pub total_sum: f64,
    pub average: f64,
    pub count: i64,
}

#[derive(Debug, serde::Serialize)]
pub struct ConsolidationMetrics {
    pub indicator_name: String,
    pub total_sum: f64,
    pub average: f64,
    pub count: i64,
    pub by_region: Vec<ConsolidationRegionRow>,
    pub by_coop_type: Vec<ConsolidationCoopTypeRow>,
}

impl NonFinancialIndicatorEntryRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_submission_id(
        &self,
        submission_id: Uuid,
    ) -> AppResult<Vec<non_financial_indicator_entry::Model>> {
        non_financial_indicator_entry::Entity::find()
            .filter(NonFinancialIndicatorEntryColumn::SubmissionId.eq(submission_id))
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn save_batch(
        &self,
        submission_id: Uuid,
        entries: Vec<non_financial_indicator_entry::ActiveModel>,
    ) -> AppResult<Vec<non_financial_indicator_entry::Model>> {
        let mut results = Vec::new();

        for mut active in entries {
            let catalog_id = *active.catalog_id.as_ref();

            let existing = non_financial_indicator_entry::Entity::find()
                .filter(NonFinancialIndicatorEntryColumn::SubmissionId.eq(submission_id))
                .filter(NonFinancialIndicatorEntryColumn::CatalogId.eq(catalog_id))
                .one(&self.db)
                .await
                .map_err(AppError::DatabaseError)?;

            let model = match existing {
                Some(ext) => {
                    let mut ext_active: non_financial_indicator_entry::ActiveModel = ext.into();
                    ext_active.value_numeric = active.value_numeric;
                    ext_active.value_text = active.value_text;
                    ext_active.value_boolean = active.value_boolean;
                    ext_active.updated_at =
                        sea_orm::ActiveValue::Set(chrono::Utc::now());
                    ext_active
                        .update(&self.db)
                        .await
                        .map_err(AppError::DatabaseError)?
                }
                None => {
                    active.submission_id = sea_orm::ActiveValue::Set(submission_id);
                    active.created_at = sea_orm::ActiveValue::Set(chrono::Utc::now());
                    active.updated_at = sea_orm::ActiveValue::Set(chrono::Utc::now());
                    active
                        .insert(&self.db)
                        .await
                        .map_err(AppError::DatabaseError)?
                }
            };
            results.push(model);
        }
        Ok(results)
    }

    pub async fn consolidate_metrics(
        &self,
        indicator_name: &str,
    ) -> AppResult<ConsolidationMetrics> {
        let backend = sea_orm::DatabaseBackend::Postgres;

        let overall_sql = "
            SELECT
                COALESCE(SUM(e.value_numeric), 0)::double precision,
                COALESCE(AVG(e.value_numeric), 0)::double precision,
                COUNT(e.id)::bigint
            FROM non_financial_indicator_entries e
            JOIN non_financial_indicator_catalog c ON e.catalog_id = c.id
            WHERE c.indicator_name = $1
        ";
        let row = self
            .db
            .query_one(Statement::from_sql_and_values(
                backend,
                overall_sql,
                [indicator_name.into()],
            ))
            .await
            .map_err(AppError::DatabaseError)?
            .ok_or_else(|| AppError::NotFound("No data for indicator".into()))?;

        let total_sum: f64 = row.try_get_by_index(0).map_err(AppError::DatabaseError)?;
        let average: f64 = row.try_get_by_index(1).map_err(AppError::DatabaseError)?;
        let count: i64 = row.try_get_by_index(2).map_err(AppError::DatabaseError)?;

        let region_sql = "
            SELECT
                coops.region::text,
                COALESCE(SUM(e.value_numeric), 0)::double precision,
                COALESCE(AVG(e.value_numeric), 0)::double precision,
                COUNT(e.id)::bigint
            FROM non_financial_indicator_entries e
            JOIN non_financial_indicator_catalog c ON e.catalog_id = c.id
            JOIN submissions sub ON e.submission_id = sub.id
            JOIN cooperatives coops ON sub.cooperative_id = coops.id
            WHERE c.indicator_name = $1
            GROUP BY coops.region
        ";
        let region_rows = self
            .db
            .query_all(Statement::from_sql_and_values(
                backend,
                region_sql,
                [indicator_name.into()],
            ))
            .await
            .map_err(AppError::DatabaseError)?;

        let mut by_region = Vec::new();
        for r in region_rows {
            by_region.push(ConsolidationRegionRow {
                region: r.try_get_by_index(0).map_err(AppError::DatabaseError)?,
                total_sum: r.try_get_by_index(1).map_err(AppError::DatabaseError)?,
                average: r.try_get_by_index(2).map_err(AppError::DatabaseError)?,
                count: r.try_get_by_index(3).map_err(AppError::DatabaseError)?,
            });
        }

        let type_sql = "
            SELECT
                coops.coop_type::text,
                COALESCE(SUM(e.value_numeric), 0)::double precision,
                COALESCE(AVG(e.value_numeric), 0)::double precision,
                COUNT(e.id)::bigint
            FROM non_financial_indicator_entries e
            JOIN non_financial_indicator_catalog c ON e.catalog_id = c.id
            JOIN submissions sub ON e.submission_id = sub.id
            JOIN cooperatives coops ON sub.cooperative_id = coops.id
            WHERE c.indicator_name = $1
            GROUP BY coops.coop_type
        ";
        let type_rows = self
            .db
            .query_all(Statement::from_sql_and_values(
                backend,
                type_sql,
                [indicator_name.into()],
            ))
            .await
            .map_err(AppError::DatabaseError)?;

        let mut by_coop_type = Vec::new();
        for r in type_rows {
            by_coop_type.push(ConsolidationCoopTypeRow {
                coop_type: r.try_get_by_index(0).map_err(AppError::DatabaseError)?,
                total_sum: r.try_get_by_index(1).map_err(AppError::DatabaseError)?,
                average: r.try_get_by_index(2).map_err(AppError::DatabaseError)?,
                count: r.try_get_by_index(3).map_err(AppError::DatabaseError)?,
            });
        }

        Ok(ConsolidationMetrics {
            indicator_name: indicator_name.to_string(),
            total_sum,
            average,
            count,
            by_region,
            by_coop_type,
        })
    }
}
