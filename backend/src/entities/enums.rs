use sea_orm::{DeriveActiveEnum, EnumIter};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "submission_status")]
pub enum SubmissionStatus {
    #[sea_orm(string_value = "draft")]
    Draft,
    #[sea_orm(string_value = "submitted")]
    Submitted,
    #[sea_orm(string_value = "in_review")]
    InReview,
    #[sea_orm(string_value = "approved")]
    Approved,
    #[sea_orm(string_value = "rejected")]
    Rejected,
    #[sea_orm(string_value = "returned")]
    Returned,
    #[sea_orm(string_value = "escalated")]
    Escalated,
    #[sea_orm(string_value = "withdrawn")]
    Withdrawn,
    #[sea_orm(string_value = "archived")]
    Archived,
    #[sea_orm(string_value = "synced")]
    Synced,
    #[sea_orm(string_value = "sync_failed")]
    SyncFailed,
    #[sea_orm(string_value = "needs_correction")]
    NeedsCorrection,
}

impl SubmissionStatus {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "draft" => Some(Self::Draft),
            "submitted" => Some(Self::Submitted),
            "in_review" => Some(Self::InReview),
            "approved" => Some(Self::Approved),
            "rejected" => Some(Self::Rejected),
            "returned" => Some(Self::Returned),
            "escalated" => Some(Self::Escalated),
            "withdrawn" => Some(Self::Withdrawn),
            "archived" => Some(Self::Archived),
            "synced" => Some(Self::Synced),
            "sync_failed" => Some(Self::SyncFailed),
            "needs_correction" => Some(Self::NeedsCorrection),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Draft => "draft",
            Self::Submitted => "submitted",
            Self::InReview => "in_review",
            Self::Approved => "approved",
            Self::Rejected => "rejected",
            Self::Returned => "returned",
            Self::Escalated => "escalated",
            Self::Withdrawn => "withdrawn",
            Self::Archived => "archived",
            Self::Synced => "synced",
            Self::SyncFailed => "sync_failed",
            Self::NeedsCorrection => "needs_correction",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "review_tier")]
pub enum ReviewTier {
    #[sea_orm(string_value = "cooperative")]
    Cooperative,
    #[sea_orm(string_value = "apex")]
    Apex,
    #[sea_orm(string_value = "federation")]
    Federation,
    #[sea_orm(string_value = "ministry")]
    Ministry,
}

impl ReviewTier {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "cooperative" => Some(Self::Cooperative),
            "apex" => Some(Self::Apex),
            "federation" => Some(Self::Federation),
            "ministry" => Some(Self::Ministry),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Cooperative => "cooperative",
            Self::Apex => "apex",
            Self::Federation => "federation",
            Self::Ministry => "ministry",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "review_action")]
pub enum ReviewAction {
    #[sea_orm(string_value = "approve")]
    Approve,
    #[sea_orm(string_value = "reject")]
    Reject,
    #[sea_orm(string_value = "return")]
    Return,
    #[sea_orm(string_value = "escalate")]
    Escalate,
    #[sea_orm(string_value = "comment")]
    Comment,
    #[sea_orm(string_value = "request_info")]
    RequestInfo,
}

impl ReviewAction {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "approve" => Some(Self::Approve),
            "reject" => Some(Self::Reject),
            "return" => Some(Self::Return),
            "escalate" => Some(Self::Escalate),
            "comment" => Some(Self::Comment),
            "request_info" => Some(Self::RequestInfo),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Approve => "approve",
            Self::Reject => "reject",
            Self::Return => "return",
            Self::Escalate => "escalate",
            Self::Comment => "comment",
            Self::RequestInfo => "request_info",
        }
    }
}

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

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "currency")]
pub enum Currency {
    #[sea_orm(string_value = "SZL")]
    Szl,
    #[sea_orm(string_value = "USD")]
    Usd,
}

impl Default for Currency {
    fn default() -> Self {
        Self::Szl
    }
}

#[derive(Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "account_category")]
pub enum AccountCategory {
    #[sea_orm(string_value = "assets")]
    Assets,
    #[sea_orm(string_value = "liabilities")]
    Liabilities,
    #[sea_orm(string_value = "equity")]
    Equity,
    #[sea_orm(string_value = "income")]
    Income,
    #[sea_orm(string_value = "expenses")]
    Expenses,
    #[sea_orm(string_value = "surplus")]
    Surplus,
}

impl AccountCategory {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Assets => "assets",
            Self::Liabilities => "liabilities",
            Self::Equity => "equity",
            Self::Income => "income",
            Self::Expenses => "expenses",
            Self::Surplus => "surplus",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "assets" => Some(Self::Assets),
            "liabilities" => Some(Self::Liabilities),
            "equity" => Some(Self::Equity),
            "income" => Some(Self::Income),
            "expenses" => Some(Self::Expenses),
            "surplus" => Some(Self::Surplus),
            _ => None,
        }
    }
}
