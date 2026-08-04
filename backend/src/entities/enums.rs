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
use utoipa::ToSchema;

#[derive(
    Debug, Clone, PartialEq, Eq, Hash, EnumIter, DeriveActiveEnum, Serialize, Deserialize, ToSchema,
)]
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

#[derive(
    Debug, Clone, PartialEq, Eq, Hash, EnumIter, DeriveActiveEnum, Serialize, Deserialize, ToSchema,
)]
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

#[derive(
    Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize, ToSchema,
)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "cooperative_sector")]
pub enum CooperativeSector {
    #[sea_orm(string_value = "agriculture")]
    Agriculture,
    #[sea_orm(string_value = "finance")]
    Finance,
    #[sea_orm(string_value = "housing")]
    Housing,
    #[sea_orm(string_value = "transport")]
    Transport,
    #[sea_orm(string_value = "manufacturing")]
    Manufacturing,
    #[sea_orm(string_value = "other")]
    Other,
}

impl CooperativeSector {
    pub fn parse(s: &str) -> Option<Self> {
        match s.to_lowercase().as_str() {
            "agriculture" => Some(Self::Agriculture),
            "finance" | "financial" => Some(Self::Finance),
            "housing" => Some(Self::Housing),
            "transport" => Some(Self::Transport),
            "manufacturing" => Some(Self::Manufacturing),
            "other" => Some(Self::Other),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Agriculture => "agriculture",
            Self::Finance => "finance",
            Self::Housing => "housing",
            Self::Transport => "transport",
            Self::Manufacturing => "manufacturing",
            Self::Other => "other",
        }
    }
}

#[derive(
    Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize, ToSchema,
)]
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

#[derive(
    Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize, ToSchema,
)]
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

#[derive(
    Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize, ToSchema,
)]
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

#[derive(
    Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize, Default,
)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "currency")]
pub enum Currency {
    #[default]
    #[sea_orm(string_value = "SZL")]
    Szl,
    #[sea_orm(string_value = "USD")]
    Usd,
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

#[derive(
    Debug,
    Clone,
    PartialEq,
    Eq,
    EnumIter,
    DeriveActiveEnum,
    Serialize,
    Deserialize,
    utoipa::ToSchema,
)]
#[sea_orm(
    rs_type = "String",
    db_type = "Enum",
    enum_name = "indicator_data_type"
)]
pub enum IndicatorDataType {
    #[sea_orm(string_value = "number")]
    Number,
    #[sea_orm(string_value = "text")]
    Text,
    #[sea_orm(string_value = "boolean")]
    Boolean,
}

impl IndicatorDataType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Number => "number",
            Self::Text => "text",
            Self::Boolean => "boolean",
        }
    }

    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "number" => Some(Self::Number),
            "text" => Some(Self::Text),
            "boolean" => Some(Self::Boolean),
            _ => None,
        }
    }
}

#[derive(
    Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize, ToSchema,
)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "member_status")]
pub enum MemberStatus {
    #[sea_orm(string_value = "Active")]
    Active,
    #[sea_orm(string_value = "Dormant")]
    Dormant,
    #[sea_orm(string_value = "Exited")]
    Exited,
}

impl MemberStatus {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "Active" => Some(Self::Active),
            "Dormant" => Some(Self::Dormant),
            "Exited" => Some(Self::Exited),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Active => "Active",
            Self::Dormant => "Dormant",
            Self::Exited => "Exited",
        }
    }
}

#[derive(
    Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize, ToSchema,
)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "gender")]
pub enum Gender {
    #[sea_orm(string_value = "Male")]
    Male,
    #[sea_orm(string_value = "Female")]
    Female,
    #[sea_orm(string_value = "Other")]
    Other,
}

impl Gender {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "Male" => Some(Self::Male),
            "Female" => Some(Self::Female),
            "Other" => Some(Self::Other),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Male => "Male",
            Self::Female => "Female",
            Self::Other => "Other",
        }
    }
}

#[derive(
    Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize, ToSchema,
)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "age_group")]
pub enum AgeGroup {
    #[sea_orm(string_value = "<18")]
    Under18,
    #[sea_orm(string_value = "18-35")]
    Between18And35,
    #[sea_orm(string_value = "36-50")]
    Between36And50,
    #[sea_orm(string_value = "50+")]
    Over50,
}

impl AgeGroup {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "<18" => Some(Self::Under18),
            "18-35" => Some(Self::Between18And35),
            "36-50" => Some(Self::Between36And50),
            "50+" => Some(Self::Over50),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Under18 => "<18",
            Self::Between18And35 => "18-35",
            Self::Between36And50 => "36-50",
            Self::Over50 => "50+",
        }
    }
}

#[derive(
    Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize, ToSchema,
)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "account_type")]
pub enum AccountType {
    #[sea_orm(string_value = "Voluntary")]
    Voluntary,
    #[sea_orm(string_value = "Mandatory")]
    Mandatory,
    #[sea_orm(string_value = "Fixed")]
    Fixed,
}

impl AccountType {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "Voluntary" => Some(Self::Voluntary),
            "Mandatory" => Some(Self::Mandatory),
            "Fixed" => Some(Self::Fixed),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Voluntary => "Voluntary",
            Self::Mandatory => "Mandatory",
            Self::Fixed => "Fixed",
        }
    }
}

#[derive(
    Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize, ToSchema,
)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "loan_status")]
pub enum LoanStatus {
    #[sea_orm(string_value = "Performing")]
    Performing,
    #[sea_orm(string_value = "Arrears")]
    Arrears,
    #[sea_orm(string_value = "Restructured")]
    Restructured,
    #[sea_orm(string_value = "WrittenOff")]
    WrittenOff,
}

impl LoanStatus {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "Performing" => Some(Self::Performing),
            "Arrears" => Some(Self::Arrears),
            "Restructured" => Some(Self::Restructured),
            "WrittenOff" => Some(Self::WrittenOff),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Performing => "Performing",
            Self::Arrears => "Arrears",
            Self::Restructured => "Restructured",
            Self::WrittenOff => "WrittenOff",
        }
    }
}

#[derive(
    Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize, ToSchema,
)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "dpd_category")]
pub enum DpdCategory {
    #[sea_orm(string_value = "0")]
    Zero,
    #[sea_orm(string_value = "1-30")]
    Days1To30,
    #[sea_orm(string_value = "31-60")]
    Days31To60,
    #[sea_orm(string_value = "61-90")]
    Days61To90,
    #[sea_orm(string_value = "91+")]
    Days91Plus,
}

impl DpdCategory {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "0" => Some(Self::Zero),
            "1-30" => Some(Self::Days1To30),
            "31-60" => Some(Self::Days31To60),
            "61-90" => Some(Self::Days61To90),
            "91+" => Some(Self::Days91Plus),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Zero => "0",
            Self::Days1To30 => "1-30",
            Self::Days31To60 => "31-60",
            Self::Days61To90 => "61-90",
            Self::Days91Plus => "91+",
        }
    }
}

#[derive(
    Debug, Clone, PartialEq, Eq, EnumIter, DeriveActiveEnum, Serialize, Deserialize, ToSchema,
)]
#[sea_orm(rs_type = "String", db_type = "Enum", enum_name = "fd_status")]
pub enum FdStatus {
    #[sea_orm(string_value = "Active")]
    Active,
    #[sea_orm(string_value = "Matured")]
    Matured,
    #[sea_orm(string_value = "Withdrawn")]
    Withdrawn,
    #[sea_orm(string_value = "RolledOver")]
    RolledOver,
}

impl FdStatus {
    pub fn parse(s: &str) -> Option<Self> {
        match s {
            "Active" => Some(Self::Active),
            "Matured" => Some(Self::Matured),
            "Withdrawn" => Some(Self::Withdrawn),
            "RolledOver" => Some(Self::RolledOver),
            _ => None,
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Self::Active => "Active",
            Self::Matured => "Matured",
            Self::Withdrawn => "Withdrawn",
            Self::RolledOver => "RolledOver",
        }
    }
}
