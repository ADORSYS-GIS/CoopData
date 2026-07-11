use chrono::{DateTime, Utc};
use sea_orm::entity::prelude::*;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Clone, Debug, PartialEq, Eq, DeriveEntityModel, Serialize, Deserialize, ToSchema)]
#[sea_orm(table_name = "farm_coop")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub cooperative_id: Uuid,
    #[sea_orm(nullable)]
    pub submission_id: Option<Uuid>,
    pub cooperative_type: String,
    pub primary_activities: String,
    #[sea_orm(nullable)]
    pub year_of_establishment: Option<i32>,
    pub operational_status: String,
    pub active_producer_flag: bool,
    pub production_type: String,
    pub participation_frequency: String,
    pub delivery_compliance: String,
    pub production_cycle_type: String,
    pub use_of_production_planning: bool,
    pub use_of_shared_inputs: bool,
    pub quality_compliance_flag: bool,
    pub market_channel_type: String,
    pub formal_offtake_agreement: bool,
    pub buyer_concentration_flag: bool,
    pub price_predictability_category: String,
    pub access_to_storage: bool,
    pub access_to_processing_facilities: bool,
    pub transport_coordination: String,
    pub climate_exposure_type: String,
    pub irrigation_access: bool,
    pub climate_mitigation_practices: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {
    #[sea_orm(
        belongs_to = "super::cooperative::Entity",
        from = "Column::CooperativeId",
        to = "super::cooperative::Column::Id",
        on_update = "Cascade",
        on_delete = "Cascade"
    )]
    Cooperative,
}

impl Related<super::cooperative::Entity> for Entity {
    fn to() -> sea_orm::RelationDef {
        Relation::Cooperative.def()
    }
}

impl ActiveModelBehavior for ActiveModel {}
