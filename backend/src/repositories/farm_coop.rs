use crate::entities::{farm_coop, FarmCoopColumn};
use crate::error::{AppError, AppResult};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter,
    QueryOrder,
};
use uuid::Uuid;

#[derive(Clone)]
pub struct FarmCoopRepository {
    db: DatabaseConnection,
}

impl FarmCoopRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<farm_coop::Model>> {
        farm_coop::Entity::find_by_id(id)
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
    ) -> AppResult<(Vec<farm_coop::Model>, u64)> {
        let mut query = farm_coop::Entity::find()
            .filter(FarmCoopColumn::CooperativeId.eq(cooperative_id));
        if let Some(sub_id) = submission_id {
            query = query.filter(FarmCoopColumn::SubmissionId.eq(sub_id));
        }
        let paginator = query
            .order_by_desc(FarmCoopColumn::CreatedAt)
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

    pub async fn create(&self, model: farm_coop::ActiveModel) -> AppResult<farm_coop::Model> {
        model.insert(&self.db).await.map_err(AppError::DatabaseError)
    }

    pub async fn update(&self, model: farm_coop::ActiveModel) -> AppResult<farm_coop::Model> {
        model.update(&self.db).await.map_err(AppError::DatabaseError)
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<()> {
        farm_coop::Entity::delete_by_id(id)
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
        let result = farm_coop::Entity::delete_many()
            .filter(FarmCoopColumn::CooperativeId.eq(cooperative_id))
            .filter(FarmCoopColumn::SubmissionId.eq(submission_id))
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(result.rows_affected)
    }

    pub async fn bulk_insert(&self, models: Vec<farm_coop::ActiveModel>) -> AppResult<u64> {
        if models.is_empty() {
            return Ok(0);
        }
        let count = models.len() as u64;
        farm_coop::Entity::insert_many(models)
            .exec(&self.db)
            .await
            .map(|_| count)
            .map_err(AppError::DatabaseError)
    }
}
