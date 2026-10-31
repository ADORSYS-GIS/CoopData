use serde::Deserialize;
use serde_json::Value;

/// Allow-list of the Mambu fields CoopData reads. Anything not declared here
/// (names, ID numbers, phones, bank accounts, nominees, ...) is dropped by serde
/// at deserialisation and never reaches the mapper, the database or the logs.

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MambuAddress {
    pub region: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MambuBranch {
    pub encoded_key: String,
    pub id: String,
    pub name: String,
    pub state: Option<String>,
    #[serde(default)]
    pub addresses: Vec<MambuAddress>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct ClientAdl {
    #[serde(rename = "RG")]
    pub region: Option<String>,
    #[serde(rename = "dateJoined")]
    pub date_joined: Option<String>,
    #[serde(rename = "dateResignedDeceased")]
    pub date_resigned_deceased: Option<String>,
    pub mcat: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MambuClient {
    pub encoded_key: String,
    pub id: String,
    pub state: Option<String>,
    pub activation_date: Option<String>,
    pub closed_date: Option<String>,
    pub birth_date: Option<String>,
    pub gender: Option<String>,
    pub assigned_branch_key: Option<String>,
    #[serde(rename = "_ADL")]
    pub adl: Option<ClientAdl>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DepositBalances {
    #[serde(default)]
    pub total_balance: f64,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InterestRateSettings {
    pub interest_rate: Option<f64>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DepositInterestSettings {
    pub interest_rate_settings: Option<InterestRateSettings>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct CentreOfDeduction {
    #[serde(rename = "monthlyContribution")]
    pub monthly_contribution: Option<Value>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MambuDeposit {
    pub encoded_key: String,
    pub name: Option<String>,
    pub account_type: Option<String>,
    pub account_state: Option<String>,
    pub account_holder_key: Option<String>,
    pub activation_date: Option<String>,
    pub closed_date: Option<String>,
    pub maturity_date: Option<String>,
    pub product_type_key: Option<String>,
    #[serde(default)]
    pub balances: DepositBalances,
    pub interest_settings: Option<DepositInterestSettings>,
    #[serde(rename = "_centreOfDeduction")]
    pub centre_of_deduction: Option<CentreOfDeduction>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoanBalances {
    #[serde(default)]
    pub principal_balance: f64,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoanInterestSettings {
    pub interest_rate: Option<f64>,
    pub interest_charge_frequency: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisbursementDetails {
    pub disbursement_date: Option<String>,
    pub first_repayment_date: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleSettings {
    pub repayment_installments: Option<i64>,
    pub repayment_period_count: Option<i64>,
    pub repayment_period_unit: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
pub struct LoanInfo {
    pub loanp: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MambuLoan {
    pub encoded_key: String,
    pub loan_name: Option<String>,
    pub account_state: Option<String>,
    pub account_sub_state: Option<String>,
    pub account_holder_key: Option<String>,
    pub account_holder_type: Option<String>,
    #[serde(default)]
    pub loan_amount: f64,
    #[serde(default)]
    pub balances: LoanBalances,
    pub interest_settings: Option<LoanInterestSettings>,
    pub disbursement_details: Option<DisbursementDetails>,
    pub schedule_settings: Option<ScheduleSettings>,
    pub days_in_arrears: Option<i64>,
    pub product_type_key: Option<String>,
    pub closed_date: Option<String>,
    #[serde(rename = "_LINFO")]
    pub loan_info: Option<LoanInfo>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportCurrency {
    pub currency_code: Option<String>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportGlAccount {
    pub gl_code: String,
    pub name: Option<String>,
    #[serde(rename = "type")]
    pub account_type: String,
    pub usage: Option<String>,
    pub currency: Option<ReportCurrency>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportAmounts {
    #[serde(default)]
    pub opening_balance: f64,
    #[serde(default)]
    pub debits: f64,
    #[serde(default)]
    pub credits: f64,
    #[serde(default)]
    pub closing_balance: f64,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportItem {
    pub gl_account: ReportGlAccount,
    #[serde(default)]
    pub amounts: ReportAmounts,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MambuReport {
    pub report_key: Option<String>,
    pub status: Option<String>,
    #[serde(default)]
    pub items: Vec<ReportItem>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaturityPeriod {
    pub max_value: Option<i64>,
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MaturitySettings {
    pub maturity_period: Option<MaturityPeriod>,
    pub maturity_period_unit: Option<String>,
}

impl MaturitySettings {
    /// The product's maturity period in whole months, when it defines one.
    pub fn months(&self) -> Option<u32> {
        let value = self
            .maturity_period
            .as_ref()?
            .max_value
            .filter(|v| *v > 0)?;
        let months = match self.maturity_period_unit.as_deref().unwrap_or("MONTHS") {
            "DAYS" => value / 30,
            "WEEKS" => value * 7 / 30,
            "YEARS" => value * 12,
            _ => value,
        };
        u32::try_from(months).ok().filter(|m| *m > 0)
    }
}

#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MambuProduct {
    pub id: String,
    pub encoded_key: Option<String>,
    pub name: Option<String>,
    #[serde(rename = "type")]
    pub product_type: Option<String>,
    pub maturity_settings: Option<MaturitySettings>,
}
