use crate::entities::{questionnaire_template, QuestionnaireTemplateColumn};
use crate::error::{AppError, AppResult};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, Set,
};
use uuid::Uuid;

#[derive(Clone)]
pub struct QuestionnaireTemplateRepository {
    db: DatabaseConnection,
}

impl QuestionnaireTemplateRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_all(&self) -> AppResult<Vec<questionnaire_template::Model>> {
        questionnaire_template::Entity::find()
            .order_by_desc(QuestionnaireTemplateColumn::UpdatedAt)
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_by_id(&self, id: Uuid) -> AppResult<Option<questionnaire_template::Model>> {
        questionnaire_template::Entity::find_by_id(id)
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn find_active(
        &self,
        questionnaire_type: &str,
    ) -> AppResult<Option<questionnaire_template::Model>> {
        questionnaire_template::Entity::find()
            .filter(QuestionnaireTemplateColumn::QuestionnaireType.eq(questionnaire_type))
            .filter(QuestionnaireTemplateColumn::IsActive.eq(true))
            .one(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn create(
        &self,
        questionnaire_type: String,
        label: String,
        sections: serde_json::Value,
        created_by: Option<Uuid>,
    ) -> AppResult<questionnaire_template::Model> {
        // Compute next version number
        let existing = questionnaire_template::Entity::find()
            .filter(QuestionnaireTemplateColumn::QuestionnaireType.eq(&questionnaire_type))
            .all(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        let next_version = existing.iter().map(|t| t.version).max().unwrap_or(0) + 1;

        let active = questionnaire_template::ActiveModel {
            id: Set(Uuid::new_v4()),
            questionnaire_type: Set(questionnaire_type),
            version: Set(next_version),
            label: Set(label),
            sections: Set(sections),
            is_active: Set(false),
            created_by: Set(created_by),
            created_at: Set(chrono::Utc::now()),
            updated_at: Set(chrono::Utc::now()),
        };
        active
            .insert(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn update(
        &self,
        id: Uuid,
        label: Option<String>,
        sections: Option<serde_json::Value>,
    ) -> AppResult<questionnaire_template::Model> {
        let existing = self
            .find_by_id(id)
            .await?
            .ok_or_else(|| AppError::NotFound("Questionnaire template not found".into()))?;

        let mut active: questionnaire_template::ActiveModel = existing.into();
        if let Some(l) = label {
            active.label = Set(l);
        }
        if let Some(s) = sections {
            active.sections = Set(s);
        }
        active.updated_at = Set(chrono::Utc::now());
        active
            .update(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    /// Activate a template — deactivates any previously active template of the same type first.
    pub async fn activate(&self, id: Uuid) -> AppResult<questionnaire_template::Model> {
        let template = self
            .find_by_id(id)
            .await?
            .ok_or_else(|| AppError::NotFound("Questionnaire template not found".into()))?;

        // Deactivate current active template of this type
        if let Some(current_active) = self.find_active(&template.questionnaire_type).await? {
            if current_active.id != id {
                let mut a: questionnaire_template::ActiveModel = current_active.into();
                a.is_active = Set(false);
                a.updated_at = Set(chrono::Utc::now());
                a.update(&self.db).await.map_err(AppError::DatabaseError)?;
            }
        }

        // Activate the requested template
        let mut active: questionnaire_template::ActiveModel = template.into();
        active.is_active = Set(true);
        active.updated_at = Set(chrono::Utc::now());
        active
            .update(&self.db)
            .await
            .map_err(AppError::DatabaseError)
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<()> {
        let existing = self
            .find_by_id(id)
            .await?
            .ok_or_else(|| AppError::NotFound("Questionnaire template not found".into()))?;

        if existing.is_active {
            return Err(AppError::BadRequest(
                "Cannot delete an active template.".into(),
            ));
        }

        questionnaire_template::Entity::delete_by_id(id)
            .exec(&self.db)
            .await
            .map_err(AppError::DatabaseError)?;
        Ok(())
    }
}
