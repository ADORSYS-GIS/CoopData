use crate::entities::{questionnaire_response, QuestionnaireResponseColumn};
use crate::error::{AppError, AppResult};
use sea_orm::{
    ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QuerySelect, RelationTrait,
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
        use crate::entities::questionnaire_response::ActiveModel;
        use sea_orm::{sea_query::OnConflict, Set};

        let now = chrono::Utc::now();

        // Use INSERT ... ON CONFLICT DO UPDATE to handle both first-save and re-save
        // atomically, avoiding race conditions from the find-then-insert pattern.
        // The conflict target matches the unique constraint added in migration 28:
        //   UNIQUE (submission_id, questionnaire_type)
        let active = ActiveModel {
            id: Set(Uuid::new_v4()),
            submission_id: Set(submission_id),
            cooperative_id: Set(cooperative_id),
            questionnaire_type: Set(questionnaire_type.clone()),
            reporting_year: Set(reporting_year),
            answers: Set(answers),
            created_at: Set(now),
            updated_at: Set(now),
        };

        questionnaire_response::Entity::insert(active)
            .on_conflict(
                OnConflict::columns([
                    questionnaire_response::Column::SubmissionId,
                    questionnaire_response::Column::QuestionnaireType,
                ])
                .update_columns([
                    questionnaire_response::Column::Answers,
                    questionnaire_response::Column::UpdatedAt,
                ])
                .to_owned(),
            )
            .exec_with_returning(&self.db)
            .await
            .map_err(AppError::DatabaseError)
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
        cooperative_ids: Option<Vec<Uuid>>,
    ) -> AppResult<
        Vec<(
            questionnaire_response::Model,
            crate::entities::cooperative::Model,
        )>,
    > {
        let mut query = questionnaire_response::Entity::find()
            .find_also_related(crate::entities::cooperative::Entity)
            .join(
                sea_orm::JoinType::InnerJoin,
                crate::entities::questionnaire_response::Relation::Submission.def(),
            )
            .filter(
                crate::entities::submission::Column::Status
                    .eq(crate::entities::enums::SubmissionStatus::Approved),
            );

        if let Some(year) = reporting_year {
            query = query.filter(QuestionnaireResponseColumn::ReportingYear.eq(year));
        }
        if let Some(q_type) = questionnaire_type {
            query = query.filter(QuestionnaireResponseColumn::QuestionnaireType.eq(q_type));
        }
        if let Some(coop_ids) = cooperative_ids {
            if coop_ids.is_empty() {
                return Ok(vec![]);
            }
            query = query.filter(QuestionnaireResponseColumn::CooperativeId.is_in(coop_ids));
        }
        if let Some(r) = region {
            // Only apply the region filter when the value parses to a valid
            // Eswatini region. An unrecognized value is ignored rather than
            // producing an impossible (never-matching) WHERE clause.
            if let Some(reg) = crate::entities::enums::EswatiniRegion::parse(&r) {
                query = query.filter(crate::entities::cooperative::Column::Region.eq(reg));
            }
        }
        if let Some(s) = sector {
            query = query.filter(crate::entities::cooperative::Column::Sector.eq(s));
        }

        let results = query.all(&self.db).await.map_err(AppError::DatabaseError)?;

        let filtered: Vec<(
            questionnaire_response::Model,
            crate::entities::cooperative::Model,
        )> = results
            .into_iter()
            .filter_map(|(resp, opt_coop)| opt_coop.map(|coop| (resp, coop)))
            .collect();

        Ok(filtered)
    }
}
