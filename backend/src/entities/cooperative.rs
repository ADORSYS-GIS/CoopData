use chrono::{DateTime, NaiveDate, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use super::enums::{AccountingYear, CoopStatus, CooperativeType, EswatiniRegion, UrbanRural};

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "cooperatives")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub keycloak_id: String,
    pub apex_id: Uuid,
    pub display_name: String,
    #[sea_orm(nullable)]
    pub keycloak_group_id: Option<Uuid>,
    #[sea_orm(nullable)]
    pub apex_group_id: Option<Uuid>,
    #[sea_orm(nullable)]
    pub federation_org_id: Option<Uuid>,
    pub name: String,
    #[sea_orm(nullable)]
    pub institution_type: Option<CooperativeType>,
    #[sea_orm(nullable)]
    pub reg_no: Option<String>,
    #[sea_orm(nullable)]
    pub tin: Option<String>,
    #[sea_orm(nullable)]
    pub address: Option<String>,
    #[sea_orm(nullable)]
    pub georeference: Option<String>,
    #[sea_orm(nullable)]
    pub region: Option<EswatiniRegion>,
    #[sea_orm(nullable)]
    pub geographic_classif: Option<UrbanRural>,
    #[sea_orm(nullable)]
    pub phone: Option<String>,
    #[sea_orm(nullable)]
    pub sector: Option<String>,
    #[sea_orm(nullable)]
    pub responsible_financial: Option<Uuid>,
    #[sea_orm(nullable)]
    pub responsible_non_financial: Option<Uuid>,
    pub status: CoopStatus,
    #[sea_orm(nullable)]
    pub registered_on: Option<NaiveDate>,
    pub accounting_year: AccountingYear,
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