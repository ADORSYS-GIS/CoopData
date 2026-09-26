//! Raw questionnaire values, parsed from a cooperative's `answers` JSON.
//!
//! Every field remembers whether the respondent actually provided it, so the
//! KPI layer can tell "not reported" from a genuine zero.

use std::collections::HashSet;

use serde_json::Value;

fn number(value: &Value) -> Option<f64> {
    value.as_f64().or_else(|| {
        value
            .as_str()
            .and_then(|s| s.trim().replace(',', "").parse().ok())
    })
}

/// Value of the first alias present in `answers`.
fn first(answers: &Value, keys: &[&'static str]) -> Option<(f64, &'static str)> {
    keys.iter()
        .find_map(|k| answers.get(*k).and_then(number).map(|n| (n, *k)))
}

/// Sum of every alias present in `answers` (used for male + female fields).
fn sum(answers: &Value, keys: &[&'static str]) -> Option<(f64, &'static str)> {
    let mut total = None;
    let mut first_key = None;
    for k in keys {
        if let Some(n) = answers.get(*k).and_then(number) {
            total = Some(total.unwrap_or(0.0) + n);
            first_key.get_or_insert(*k);
        }
    }
    total.zip(first_key)
}

/// Sum of the split fields (all keys but the last) when any is present, else the
/// last key, the aggregate. The two forms describe the same members.
fn split(answers: &Value, keys: &[&'static str]) -> Option<(f64, &'static str)> {
    let (aggregate, parts) = keys.split_last()?;
    sum(answers, parts).or_else(|| sum(answers, &[*aggregate]))
}

macro_rules! inputs {
    ($( $field:ident : $mode:ident [$($key:literal),+] $(, money = $money:tt)? );+ $(;)?) => {
        #[derive(Debug, Clone, Default)]
        pub struct Inputs {
            $( pub $field: f64, )+
            pub provided: HashSet<&'static str>,
            pub interest_method_flat_weight: f64,
            pub interest_method_reducing_weight: f64,
            /// Sum of (monthly interest rate % x outstanding balance).
            pub rate_weighted: f64,
            /// Sum of (loan term in months x outstanding balance).
            pub term_weighted: f64,
            /// Outstanding balance the two weighted sums refer to.
            pub weight_out: f64,
        }

        impl Inputs {
            pub fn from_answers(answers: &Value) -> Self {
                let mut out = Inputs::default();
                $(
                    if let Some((v, _)) = $mode(answers, &[$($key),+]) {
                        out.$field = v;
                        out.provided.insert(stringify!($field));
                    }
                )+
                let weight = out.out_val_m + out.out_val_f;
                out.weight_out = weight;
                if let Some(rate) = answers.get("avg_interest_rate").and_then(number) {
                    out.rate_weighted = rate * weight;
                    out.provided.insert("avg_interest_rate");
                }
                if let Some(term) = answers.get("avg_loan_term_months").and_then(number) {
                    out.term_weighted = term * weight;
                    out.provided.insert("avg_loan_term_months");
                }
                let method = answers
                    .get("interest_rate_method")
                    .and_then(Value::as_str)
                    .unwrap_or("")
                    .to_lowercase();
                if method.contains("reduc") || method.contains("declin") {
                    out.interest_method_reducing_weight = weight;
                } else {
                    out.interest_method_flat_weight = weight;
                }
                out
            }

            /// Adds another cooperative's values (consolidation).
            pub fn add(&mut self, other: &Inputs) {
                $( self.$field += other.$field; )+
                self.provided.extend(other.provided.iter().copied());
                self.interest_method_flat_weight += other.interest_method_flat_weight;
                self.interest_method_reducing_weight += other.interest_method_reducing_weight;
                self.rate_weighted += other.rate_weighted;
                self.term_weighted += other.term_weighted;
                self.weight_out += other.weight_out;
            }

            /// Multiplies every monetary field by `factor` (currency conversion).
            pub fn scale_money(&mut self, factor: f64) {
                $( $( let _ = $money; self.$field *= factor; )? )+
                self.interest_method_flat_weight *= factor;
                self.interest_method_reducing_weight *= factor;
                self.rate_weighted *= factor;
                self.term_weighted *= factor;
                self.weight_out *= factor;
            }

            pub fn has(&self, field: &'static str) -> bool {
                self.provided.contains(field)
            }

            pub fn has_any(&self, fields: &[&'static str]) -> bool {
                fields.iter().any(|f| self.provided.contains(f))
            }
        }
    };
}

inputs! {
    // membership
    reg_m: sum ["registered_members_male", "total_registered_male", "registered_male"];
    reg_f: sum ["registered_members_female", "total_registered_female", "registered_female"];
    act_m: sum ["active_members_male", "total_active_male", "active_male"];
    act_f: sum ["active_members_female", "total_active_female", "active_female"];
    age_18_25: split ["age_18_25_male", "age_18_25_female", "registered_members_18_25"];
    age_26_35: split ["age_26_35_male", "age_26_35_female", "registered_members_26_35"];
    age_36_60: split ["age_36_60_male", "age_36_60_female", "registered_members_36_60"];
    age_61_plus: split ["age_61plus_male", "age_61plus_female", "registered_members_61plus"];
    groups: first ["number_of_groups"];
    // savings
    sav_acc_m: first ["savings_accounts_male"];
    sav_acc_f: first ["savings_accounts_female"];
    sav_val_m: first ["savings_value_male", "savings_male"], money = true;
    sav_val_f: first ["savings_value_female", "savings_female"], money = true;
    // loans
    loan_acc_m: first ["loans_issued_male"];
    loan_acc_f: first ["loans_issued_female"];
    out_val_m: first ["outstanding_value_male", "loans_male"], money = true;
    out_val_f: first ["outstanding_value_female", "loans_female"], money = true;
    owed_by_members: first ["amount_owed_by_members"], money = true;
    loans_out_count: first ["loans_outstanding_count"];
    loans_arrears_count: first ["loans_in_arrears_count"];
    loans_awaiting: first ["loans_awaiting_approval"];
    female_borrowers: first ["female_borrowers_count"];
    total_disbursed: first ["total_disbursed_active"], money = true;
    b_1_7: first ["par_1_7_value"], money = true;
    b_8_30: first ["par_8_30_value"], money = true;
    b_31_90: first ["par_31_90_value"], money = true;
    b_91_180: first ["par_91_180_value"], money = true;
    b_181_360: first ["par_181_360_value"], money = true;
    b_over_360: first ["par_over_360_value"], money = true;
    delinq_0_30: first ["delinquent_value_0_30"], money = true;
    delinq_31_365: first ["delinquent_value_31_365"], money = true;
    written_off: first ["written_off_loans"], money = true;
    interest_suspense: first ["interest_in_suspense"], money = true;
    interest_payable: first ["interest_payable"], money = true;
    overdrafts: first ["total_overdrafts"], money = true;
    // liquidity and investments
    cash_on_hand: first ["cash_on_hand"], money = true;
    cash_at_bank: first ["cash_at_bank_current"], money = true;
    bank_investment: first ["bank_investment"], money = true;
    share_investment: first ["share_investment"], money = true;
    other_investments: first ["other_investments"], money = true;
    // capital
    share_capital: first ["total_share_capital", "share_capital"], money = true;
    borrowed: first ["borrowed_funds_total", "borrowed_funds"], money = true;
    donations: first ["donations_grants"], money = true;
    statutory_reserves: first ["accumulated_statutory_reserves", "accumulated_book_reserves"], money = true;
    retained_earnings: first ["retained_earnings"], money = true;
    total_equity: first ["total_equity"], money = true;
    // performance and balance sheet summary
    income: first ["current_total_income", "total_income"], money = true;
    expenditure: first ["current_total_expenditure", "total_expenditure"], money = true;
    net_income: first ["current_net_income", "net_income"], money = true;
    last_income: first ["last_total_income"], money = true;
    last_expenditure: first ["last_total_expenditure"], money = true;
    non_current_assets: first ["non_current_assets"], money = true;
    current_assets: first ["total_current_assets"], money = true;
    current_liabilities: first ["current_liabilities"], money = true;
    total_liabilities: first ["total_liabilities"], money = true;
    // governance
    board_m: first ["board_male"];
    board_f: first ["board_female"];
    exec_m: first ["exec_male"];
    exec_f: first ["exec_female"];
    credit_m: first ["credit_committee_male"];
    credit_f: first ["credit_committee_female"];
    agm_m: first ["agm_attendance_male"];
    agm_f: first ["agm_attendance_female"];
}

/// Financial answers win over non-financial ones for the same key.
pub fn merge_answers(financial: Option<&Value>, non_financial: Option<&Value>) -> Value {
    let mut merged = serde_json::Map::new();
    for source in [non_financial, financial].into_iter().flatten() {
        if let Some(obj) = source.as_object() {
            for (k, v) in obj {
                merged.insert(k.clone(), v.clone());
            }
        }
    }
    Value::Object(merged)
}
