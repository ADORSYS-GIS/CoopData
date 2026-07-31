use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use uuid::Uuid;

use crate::entities::submission_section::{self, ActiveModel, Column, Entity};
use crate::error::{AppError, AppResult};

pub const SECTIONS: &[&str] = &[
    "financial",
    "members",
    "savings",
    "loans",
    "fixed_deposits",
    "farm_coop",
];
pub const VALID_STATUSES: &[&str] = &["pending", "in_progress", "ready"];

#[derive(Clone)]
pub struct SubmissionSectionRepository {
    db: DatabaseConnection,
}

impl SubmissionSectionRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_submission(
        &self,
        submission_id: Uuid,
    ) -> AppResult<Vec<submission_section::Model>> {
        Entity::find()
            .filter(Column::SubmissionId.eq(submission_id))
            .order_by_asc(Column::Section)
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_submission_ids(
        &self,
        submission_ids: Vec<Uuid>,
    ) -> AppResult<Vec<submission_section::Model>> {
        if submission_ids.is_empty() {
            return Ok(vec![]);
        }
        Entity::find()
            .filter(Column::SubmissionId.is_in(submission_ids))
            .order_by_asc(Column::Section)
            .all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn find_by_submission_and_section(
        &self,
        submission_id: Uuid,
        section: &str,
    ) -> AppResult<Option<submission_section::Model>> {
        Entity::find()
            .filter(Column::SubmissionId.eq(submission_id))
            .filter(Column::Section.eq(section))
            .one(&self.db)
            .await
            .map_err(Into::into)
    }

    pub async fn create_many(
        &self,
        models: Vec<ActiveModel>,
    ) -> AppResult<Vec<submission_section::Model>> {
        let mut results = Vec::with_capacity(models.len());
        for model in models {
            let m = model.insert(&self.db).await.map_err(AppError::from)?;
            results.push(m);
        }
        Ok(results)
    }

    pub async fn update_status(
        &self,
        id: Uuid,
        status: &str,
    ) -> AppResult<submission_section::Model> {
        let existing = Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(AppError::from)?
            .ok_or_else(|| AppError::NotFound("Submission section not found".into()))?;

        let mut active: ActiveModel = existing.into();
        active.status = Set(status.to_string());
        active.updated_at = Set(chrono::Utc::now());
        active.update(&self.db).await.map_err(Into::into)
    }

    pub async fn reset_to_in_progress(&self, submission_id: Uuid) -> AppResult<()> {
        // Only reset the financial section; non-financial sections stay ready
        let sections = Entity::find()
            .filter(Column::SubmissionId.eq(submission_id))
            .filter(Column::Section.eq("financial"))
            .all(&self.db)
            .await
            .map_err(AppError::from)?;

        for s in sections {
            let mut active: ActiveModel = s.into();
            active.status = Set("in_progress".to_string());
            active.updated_at = Set(chrono::Utc::now());
            active.update(&self.db).await.map_err(AppError::from)?;
        }

        Ok(())
    }

    pub fn new_section_models(submission_id: Uuid, submission_method: &str) -> Vec<ActiveModel> {
        let sections: Vec<String> = if submission_method == "questionnaire" {
            vec!["questionnaire".to_string()]
        } else {
            SECTIONS.iter().map(|s| s.to_string()).collect()
        };
        sections
            .iter()
            .map(|s| {
                let initial_status = "pending";
                ActiveModel {
                    id: Set(Uuid::new_v4()),
                    submission_id: Set(submission_id),
                    section: Set(s.to_string()),
                    status: Set(initial_status.to_string()),
                    created_at: Set(chrono::Utc::now()),
                    updated_at: Set(chrono::Utc::now()),
                }
            })
            .collect()
    }
}
