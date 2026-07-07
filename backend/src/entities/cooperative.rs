use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "cooperatives")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub keycloak_id: String,
    pub apex_id: Uuid,
    pub display_name: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::apex::Entity",
        from = "Column::ApexId",
        to = "super::apex::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Apex,
}

impl Related<super::apex::Entity> for Entity {
    fn to() -> sea_orm::RelationDef {
        Relation::Apex.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
