use crate::entities::{member, MemberColumn};
use crate::error::{AppError, AppResult};
use sea_orm::sea_query::OnConflict;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter,
    QueryOrder,
};
use uuid::Uuid;

#[derive(Clone)]
pub struct MemberRepository {
    db: DatabaseConnection,
}

impl MemberRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<member::Model>> {
        member::Entity::find_by_id(id)
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
    ) -> AppResult<(Vec<member::Model>, u64)> {
        let mut query =
            member::Entity::find().filter(MemberColumn::CooperativeId.eq(cooperative_id));
        if let Some(sub_id) = submission_id {
            query = query.filter(MemberColumn::SubmissionId.eq(sub_id));
        }
        let paginator = query
            .order_by_desc(MemberColumn::CreatedAt)
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

    pub async fn create(&self, model: member::ActiveModel) -> AppResult<member::Model> {
        model.insert(&self.db).await.map_err(|e| {
            if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                AppError::Conflict("Member already exists".into())
            } else {
                AppError::DatabaseError(e)
            }
        })
    }

    pub async fn update(&self, model: member::ActiveModel) -> AppResult<member::Model> {
        model.update(&self.db).await.map_err(|e| {
            if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                AppError::Conflict("Member with this member_id already exists".into())
            } else {
                AppError::DatabaseError(e)
            }
        })
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<()> {
        member::Entity::delete_by_id(id)
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(())
    }

    pub async fn count_by_cooperative(&self, cooperative_id: Uuid) -> AppResult<u64> {
        member::Entity::find()
            .filter(MemberColumn::CooperativeId.eq(cooperative_id))
            .count(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn bulk_upsert(&self, models: Vec<member::ActiveModel>) -> AppResult<u64> {
        if models.is_empty() {
            return Ok(0);
        }
        let mut deduped: std::collections::HashMap<String, member::ActiveModel> =
            std::collections::HashMap::new();
        for model in models {
            let key = format!("{:?}-{:?}", model.cooperative_id, model.member_id);
            deduped.insert(key, model);
        }
        let models: Vec<_> = deduped.into_values().collect();
        let count = models.len() as u64;
        member::Entity::insert_many(models)
            .on_conflict(
                OnConflict::columns([MemberColumn::CooperativeId, MemberColumn::MemberId])
                    .update_columns([
                        MemberColumn::JoinDate,
                        MemberColumn::Status,
                        MemberColumn::ExitDate,
                        MemberColumn::Gender,
                        MemberColumn::AgeGroup,
                        MemberColumn::Region,
                        MemberColumn::UrbanRural,
                        MemberColumn::AgmAttendance,
                        MemberColumn::LeadershipRole,
                        MemberColumn::VotingExercised,
                        MemberColumn::SubmissionId,
                    ])
                    .to_owned(),
            )
            .exec(&self.db)
            .await
            .map(|_| count)
            .map_err(|e| {
                if e.to_string().contains("duplicate") || e.to_string().contains("unique") {
                    AppError::Conflict("Duplicate member during bulk upsert".into())
                } else {
                    AppError::DatabaseError(e)
                }
            })
    }

    pub async fn delete_by_cooperative_and_submission(
        &self,
        cooperative_id: Uuid,
        submission_id: Uuid,
    ) -> AppResult<u64> {
        let result = member::Entity::delete_many()
            .filter(MemberColumn::CooperativeId.eq(cooperative_id))
            .filter(MemberColumn::SubmissionId.eq(submission_id))
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(result.rows_affected)
    }

    pub async fn delete_by_cooperative(&self, cooperative_id: Uuid) -> AppResult<u64> {
        let result = member::Entity::delete_many()
            .filter(MemberColumn::CooperativeId.eq(cooperative_id))
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(result.rows_affected)
    }

    pub async fn find_by_cooperative_and_member_id(
        &self,
        cooperative_id: Uuid,
        member_id: &str,
    ) -> AppResult<Option<member::Model>> {
        member::Entity::find()
            .filter(MemberColumn::CooperativeId.eq(cooperative_id))
            .filter(MemberColumn::MemberId.eq(member_id))
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }
}
