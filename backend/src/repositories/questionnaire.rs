use crate::entities::{questionnaire_response, QuestionnaireResponseColumn};
use crate::error::{AppError, AppResult};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter,
};
use uuid::Uuid;

#[derive(Clone)]
pub struct QuestionnaireRepository {
    db: DatabaseConnection,
}

impl QuestionnaireRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_submission(
        &self,
        submission_id: Uuid,
    ) -> AppResult<Option<questionnaire_response::Model>> {
        questionnaire_response::Entity::find()
            .filter(QuestionnaireResponseColumn::SubmissionId.eq(submission_id))
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_submission_and_type(
        &self,
        submission_id: Uuid,
        questionnaire_type: &str,
    ) -> AppResult<Option<questionnaire_response::Model>> {
        questionnaire_response::Entity::find()
            .filter(QuestionnaireResponseColumn::SubmissionId.eq(submission_id))
            .filter(QuestionnaireResponseColumn::QuestionnaireType.eq(questionnaire_type))
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_cooperative_and_year(
        &self,
        cooperative_id: Uuid,
        reporting_year: i32,
    ) -> AppResult<Option<questionnaire_response::Model>> {
        questionnaire_response::Entity::find()
            .filter(QuestionnaireResponseColumn::CooperativeId.eq(cooperative_id))
            .filter(QuestionnaireResponseColumn::ReportingYear.eq(reporting_year))
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn save_response(
        &self,
        submission_id: Uuid,
        cooperative_id: Uuid,
        questionnaire_type: String,
        reporting_year: i32,
        answers: serde_json::Value,
    ) -> AppResult<questionnaire_response::Model> {
        use sea_orm::Set;
        use crate::entities::questionnaire_response::ActiveModel;

        if let Some(existing) = self.find_by_submission_and_type(submission_id, &questionnaire_type).await? {
            let mut active: ActiveModel = existing.into();
            active.answers = Set(answers);
            active.updated_at = Set(chrono::Utc::now());
            active.update(&self.db).await.map_err(AppError::DatabaseError)
        } else {
            let active = ActiveModel {
                id: Set(Uuid::new_v4()),
                submission_id: Set(submission_id),
                cooperative_id: Set(cooperative_id),
                questionnaire_type: Set(questionnaire_type),
                reporting_year: Set(reporting_year),
                answers: Set(answers),
                created_at: Set(chrono::Utc::now()),
                updated_at: Set(chrono::Utc::now()),
            };
            active.insert(&self.db).await.map_err(AppError::DatabaseError)
        }
    }

    pub async fn delete_by_submission(&self, submission_id: Uuid) -> AppResult<u64> {
        let result = questionnaire_response::Entity::delete_many()
            .filter(QuestionnaireResponseColumn::SubmissionId.eq(submission_id))
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(result.rows_affected)
    }

    pub async fn find_responses_with_filters(
        &self,
        reporting_year: Option<i32>,
        questionnaire_type: Option<String>,
        region: Option<String>,
        sector: Option<String>,
        cooperative_id: Option<Uuid>,
    ) -> AppResult<Vec<(questionnaire_response::Model, crate::entities::cooperative::Model)>> {
        let mut query = questionnaire_response::Entity::find()
            .find_also_related(crate::entities::cooperative::Entity);

        if let Some(year) = reporting_year {
            query = query.filter(QuestionnaireResponseColumn::ReportingYear.eq(year));
        }
        if let Some(q_type) = questionnaire_type {
            query = query.filter(QuestionnaireResponseColumn::QuestionnaireType.eq(q_type));
        }
        if let Some(coop_id) = cooperative_id {
            query = query.filter(QuestionnaireResponseColumn::CooperativeId.eq(coop_id));
        }

        let results = query.all(&self.db).await.map_err(AppError::DatabaseError)?;

        let filtered: Vec<(questionnaire_response::Model, crate::entities::cooperative::Model)> = results
            .into_iter()
            .filter_map(|(resp, opt_coop)| {
                if let Some(coop) = opt_coop {
                    let region_match = match &region {
                        Some(r) => coop.region.as_ref().map(|reg| reg.as_str() == r).unwrap_or(false),
                        None => true,
                    };
                    let sector_match = match &sector {
                        Some(s) => coop.sector.as_ref().map(|sec| sec == s).unwrap_or(false),
                        None => true,
                    };
                    if region_match && sector_match {
                        Some((resp, coop))
                    } else {
                        None
                    }
                } else {
                    None
                }
            })
            .collect();

        Ok(filtered)
    }
}
