use crate::entities::kpi_record;
use crate::error::AppResult;
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use uuid::Uuid;

#[derive(Clone)]
pub struct KpiRecordRepository {
    db: DatabaseConnection,
}

impl KpiRecordRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn create_many(&self, records: Vec<kpi_record::ActiveModel>) -> AppResult<()> {
        if records.is_empty() {
            return Ok(());
        }
        kpi_record::Entity::insert_many(records)
            .exec(&self.db)
            .await?;
        Ok(())
    }

    pub async fn delete_by_submission(&self, submission_id: Uuid) -> AppResult<u64> {
        let res = kpi_record::Entity::delete_many()
            .filter(kpi_record::Column::SubmissionId.eq(submission_id))
            .exec(&self.db)
            .await?;
        Ok(res.rows_affected)
    }

    pub async fn find_by_submission(
        &self,
        submission_id: Uuid,
    ) -> AppResult<Vec<kpi_record::Model>> {
        let records = kpi_record::Entity::find()
            .filter(kpi_record::Column::SubmissionId.eq(submission_id))
            .all(&self.db)
            .await?;
        Ok(records)
    }

    pub async fn find_by_submission_ids(
        &self,
        submission_ids: Vec<Uuid>,
    ) -> AppResult<Vec<kpi_record::Model>> {
        if submission_ids.is_empty() {
            return Ok(vec![]);
        }
        let records = kpi_record::Entity::find()
            .filter(kpi_record::Column::SubmissionId.is_in(submission_ids))
            .all(&self.db)
            .await?;
        Ok(records)
    }

    pub async fn find_by_cooperative_id(
        &self,
        cooperative_id: Uuid,
    ) -> AppResult<Vec<kpi_record::Model>> {
        let records = kpi_record::Entity::find()
            .filter(kpi_record::Column::CooperativeId.eq(cooperative_id))
            .all(&self.db)
            .await?;
        Ok(records)
    }

    pub async fn find_by_cooperative_ids(
        &self,
        cooperative_ids: Vec<Uuid>,
    ) -> AppResult<Vec<kpi_record::Model>> {
        if cooperative_ids.is_empty() {
            return Ok(vec![]);
        }
        let records = kpi_record::Entity::find()
            .filter(kpi_record::Column::CooperativeId.is_in(cooperative_ids))
            .all(&self.db)
            .await?;
        Ok(records)
    }
}
