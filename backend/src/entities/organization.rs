use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "organizations")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub name: String,
    pub organization_type: String,
    pub registration_number: Option<String>,
    pub sector: Option<String>,
    pub region: Option<String>,
    pub contact_email: Option<String>,
    pub contact_phone: Option<String>,
    pub address: Option<String>,
    pub federation_id: Option<Uuid>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(has_many = "super::assessment::Entity")]
    Assessments,
    #[sea_orm(
        belongs_to = "super::organization::Entity",
        from = "Column::FederationId",
        to = "Column::Id",
        on_update = "Cascade",
        on_delete = "SetNull"
    )]
    Federation,
    #[sea_orm(has_many = "super::user::Entity")]
    Users,
}

impl ActiveModelBehavior for ActiveModel {}

impl Related<super::assessment::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Assessments.def()
    }
}

impl Related<Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Federation.def()
    }
}

impl Related<super::user::Entity> for Entity {
    fn to() -> RelationDef {
        Relation::Users.def()
    }
}
