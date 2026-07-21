use crate::entities::custom_kpi;
use crate::error::AppResult;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use uuid::Uuid;

#[derive(Clone)]
pub struct CustomKpiRepository {
    db: DatabaseConnection,
}

impl CustomKpiRepository {
    pub fn new(db: DatabaseConnection) -> Self {
        Self { db }
    }

    pub async fn find_all(&self) -> AppResult<Vec<custom_kpi::Model>> {
        let kpis = custom_kpi::Entity::find().all(&self.db).await?;
        Ok(kpis)
    }

    pub async fn create(
        &self,
        name: String,
        description: Option<String>,
        formula: String,
        created_by: Option<Uuid>,
    ) -> AppResult<custom_kpi::Model> {
        let new_kpi = custom_kpi::ActiveModel {
            name: Set(name),
            description: Set(description),
            formula: Set(formula),
            created_by: Set(created_by),
            ..Default::default()
        };
        let res = new_kpi.insert(&self.db).await?;
        Ok(res)
    }

    pub async fn delete(&self, id: Uuid) -> AppResult<u64> {
        let res = custom_kpi::Entity::delete_many()
            .filter(custom_kpi::Column::Id.eq(id))
            .exec(&self.db)
            .await?;
        Ok(res.rows_affected)
    }
}
