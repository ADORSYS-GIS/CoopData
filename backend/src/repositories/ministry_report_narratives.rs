use crate::entities::ministry_report_narratives;
use crate::error::{AppError, AppResult};
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};

#[derive(Clone)]
pub struct MinistryReportNarrativesRepository {
    db: DatabaseConnection,
}

impl MinistryReportNarrativesRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_by_year(
        &self,
        year: i32,
    ) -> AppResult<Option<ministry_report_narratives::Model>> {
        ministry_report_narratives::Entity::find()
            .filter(ministry_report_narratives::Column::ReportingYear.eq(year))
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn upsert_narratives(
        &self,
        year: i32,
        narratives_json: serde_json::Value,
    ) -> AppResult<ministry_report_narratives::Model> {
        let existing = self.find_by_year(year).await?;
        let now = chrono::Utc::now();

        match existing {
            Some(model) => {
                let mut active: ministry_report_narratives::ActiveModel = model.into();
                active.narratives_json = Set(narratives_json);
                active.updated_at = Set(now);
                active.update(&self.db).await.map_err(Into::into)
            }
            None => {
                let active = ministry_report_narratives::ActiveModel {
                    reporting_year: Set(year),
                    narratives_json: Set(narratives_json),
                    created_at: Set(now),
                    updated_at: Set(now),
                };
                active.insert(&self.db).await.map_err(Into::into)
            }
        }
    }
}
