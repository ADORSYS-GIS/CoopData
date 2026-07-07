use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "users")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub keycloak_id: String,
    pub email: String,
    pub full_name: Option<String>,
    pub role: String,
    pub organization_id: Option<Uuid>,
    pub region: Option<String>,
    pub is_active: bool,
    pub last_login_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub federation_id: Option<Uuid>,
    pub apex_id: Option<Uuid>,
    pub cooperative_id: Option<Uuid>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::organization::Entity",
        from = "Column::OrganizationId",
        to = "super::organization::Column::Id",
        on_update = "Cascade",
        on_delete = "SetNull"
    )]
    Organization,
    #[sea_orm(
        belongs_to = "super::federation::Entity",
        from = "Column::FederationId",
        to = "super::federation::Column::Id",
        on_update = "Cascade",
        on_delete = "SetNull"
    )]
    Federation,
    #[sea_orm(
        belongs_to = "super::apex::Entity",
        from = "Column::ApexId",
        to = "super::apex::Column::Id",
        on_update = "Cascade",
        on_delete = "SetNull"
    )]
    Apex,
    #[sea_orm(
        belongs_to = "super::cooperative::Entity",
        from = "Column::CooperativeId",
        to = "super::cooperative::Column::Id",
        on_update = "Cascade",
        on_delete = "SetNull"
    )]
    Cooperative,
}

impl Related<super::organization::Entity> for Entity {
    fn to() -> sea_orm::RelationDef {
        Relation::Organization.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
