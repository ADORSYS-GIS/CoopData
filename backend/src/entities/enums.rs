use sea_orm::{DeriveActiveEnum, EnumIter};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "eswatini_region")]
pub enum EswatiniRegion {
    #[sea_orm(string_value = "Hhohho")]
    Hhohho,
    #[sea_orm(string_value = "Lubombo")]
    Lubombo,
    #[sea_orm(string_value = "Manzini")]
    Manzini,
    #[sea_orm(string_value = "Shiselweni")]
    Shiselweni,
}

impl EswatiniRegion {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "Hhohho" => Some(Self::Hhohho),
            "Lubombo" => Some(Self::Lubombo),
            "Manzini" => Some(Self::Manzini),
            "Shiselweni" => Some(Self::Shiselweni),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Hhohho => "Hhohho",
            Self::Lubombo => "Lubombo",
            Self::Manzini => "Manzini",
            Self::Shiselweni => "Shiselweni",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "cooperative_type")]
pub enum CooperativeType {
    #[sea_orm(string_value = "sacco")]
    Sacco,
    #[sea_orm(string_value = "multipurpose")]
    Multipurpose,
    #[sea_orm(string_value = "farm")]
    Farm,
    #[sea_orm(string_value = "housing")]
    Housing,
    #[sea_orm(string_value = "transport")]
    Transport,
    #[sea_orm(string_value = "finance")]
    Finance,
    #[sea_orm(string_value = "other")]
    Other,
}

impl CooperativeType {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "sacco" => Some(Self::Sacco),
            "multipurpose" => Some(Self::Multipurpose),
            "farm" => Some(Self::Farm),
            "housing" => Some(Self::Housing),
            "transport" => Some(Self::Transport),
            "finance" => Some(Self::Finance),
            "other" => Some(Self::Other),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Sacco => "sacco",
            Self::Multipurpose => "multipurpose",
            Self::Farm => "farm",
            Self::Housing => "housing",
            Self::Transport => "transport",
            Self::Finance => "finance",
            Self::Other => "other",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "urban_rural")]
pub enum UrbanRural {
    #[sea_orm(string_value = "Urban")]
    Urban,
    #[sea_orm(string_value = "Rural")]
    Rural,
}

impl UrbanRural {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "Urban" => Some(Self::Urban),
            "Rural" => Some(Self::Rural),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Urban => "Urban",
            Self::Rural => "Rural",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "coop_status")]
pub enum CoopStatus {
    #[sea_orm(string_value = "Active")]
    Active,
    #[sea_orm(string_value = "Inactive")]
    Inactive,
    #[sea_orm(string_value = "Suspended")]
    Suspended,
}

impl CoopStatus {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "Active" => Some(Self::Active),
            "Inactive" => Some(Self::Inactive),
            "Suspended" => Some(Self::Suspended),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Active => "Active",
            Self::Inactive => "Inactive",
            Self::Suspended => "Suspended",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "accounting_year")]
pub enum AccountingYear {
    #[sea_orm(string_value = "calendar")]
    Calendar,
    #[sea_orm(string_value = "fiscal")]
    Fiscal,
}

impl AccountingYear {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "calendar" => Some(Self::Calendar),
            "fiscal" => Some(Self::Fiscal),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Calendar => "calendar",
            Self::Fiscal => "fiscal",
        }
    }
}