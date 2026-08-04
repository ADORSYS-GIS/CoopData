use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "apexes")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub keycloak_id: String,
    pub federation_id: Uuid,
    pub organization_keycloak_id: String,
    pub display_name: String,
    #[sea_orm(column_type = "Json")]
    pub metadata: Option<serde_json::Value>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::federation::Entity",
        from = "Column::FederationId",
        to = "super::federation::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Federation,
    #[sea_orm(has_many = "super::cooperative::Entity")]
    Cooperatives,
}

impl Related<super::federation::Entity> for Entity {
    fn to() -> sea_orm::RelationDef {
        Relation::Federation.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
