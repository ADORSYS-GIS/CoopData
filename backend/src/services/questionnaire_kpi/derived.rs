//! Values derived from `Inputs`. `None` means "not reported".

use super::inputs::Inputs;

pub const LIQUIDITY_MINIMUM_PCT: f64 = 15.0;
pub const INSTITUTIONAL_CAPITAL_MINIMUM_PCT: f64 = 8.0;

#[derive(Debug, Clone, Default)]
pub struct Derived {
    pub registered: f64,
    pub active: f64,
    pub total_assets: Option<f64>,
    pub total_equity: Option<f64>,
    pub deposits: Option<f64>,
    pub deposit_accounts: Option<f64>,
    pub gross_loans: Option<f64>,
    pub loans_out_count: Option<f64>,
    pub loans_out_count_exact: bool,
    pub overdue_total: Option<f64>,
    pub overdue_gt_7: Option<f64>,
    pub overdue_gt_30: Option<f64>,
    pub overdue_gt_90: Option<f64>,
    pub overdue_30_90: Option<f64>,
    pub overdue_180_360: Option<f64>,
    pub buckets_exact: bool,
    pub liquid_assets: Option<f64>,
    pub earning_assets: Option<f64>,
    pub institutional_capital: Option<f64>,
    pub net_income: Option<f64>,
    pub projected_interest: Option<f64>,
}

fn pct(numerator: f64, denominator: f64) -> Option<f64> {
    (denominator.abs() > f64::EPSILON).then_some(numerator / denominator * 100.0)
}

pub fn ratio_pct(numerator: Option<f64>, denominator: Option<f64>) -> Option<f64> {
    pct(numerator?, denominator?)
}

impl Derived {
    pub fn from_inputs(i: &Inputs) -> Self {
        let mut d = Derived {
            registered: i.reg_m + i.reg_f,
            active: i.act_m + i.act_f,
            ..Derived::default()
        };

        d.total_assets = i
            .has_any(&["non_current_assets", "current_assets"])
            .then_some(i.non_current_assets + i.current_assets);

        d.total_equity = if i.has("total_equity") {
            Some(i.total_equity)
        } else if let Some(assets) = d.total_assets {
            let liabilities = if i.has("total_liabilities") {
                Some(i.total_liabilities)
            } else if i.has("current_liabilities") {
                Some(i.current_liabilities)
            } else {
                None
            };
            liabilities.map(|l| assets - l)
        } else {
            None
        };

        d.deposits = i
            .has_any(&["sav_val_m", "sav_val_f"])
            .then_some(i.sav_val_m + i.sav_val_f);
        d.deposit_accounts = i
            .has_any(&["sav_acc_m", "sav_acc_f"])
            .then_some(i.sav_acc_m + i.sav_acc_f);

        d.gross_loans = if i.has_any(&["out_val_m", "out_val_f"]) {
            Some(i.out_val_m + i.out_val_f)
        } else if i.has("owed_by_members") {
            Some(i.owed_by_members)
        } else {
            None
        };

        if i.has("loans_out_count") {
            d.loans_out_count = Some(i.loans_out_count);
            d.loans_out_count_exact = true;
        } else if i.has_any(&["loan_acc_m", "loan_acc_f"]) {
            d.loans_out_count = Some(i.loan_acc_m + i.loan_acc_f);
        }

        let exact_buckets = [
            "b_1_7",
            "b_8_30",
            "b_31_90",
            "b_91_180",
            "b_181_360",
            "b_over_360",
        ];
        if i.has_any(&exact_buckets) {
            d.buckets_exact = true;
            let gt_30 = i.b_31_90 + i.b_91_180 + i.b_181_360 + i.b_over_360;
            d.overdue_gt_30 = Some(gt_30);
            d.overdue_gt_7 = Some(gt_30 + i.b_8_30);
            d.overdue_total = Some(gt_30 + i.b_8_30 + i.b_1_7);
            d.overdue_gt_90 = Some(i.b_91_180 + i.b_181_360 + i.b_over_360);
            d.overdue_30_90 = Some(i.b_31_90);
            d.overdue_180_360 = Some(i.b_181_360);
        } else if i.has_any(&["delinq_0_30", "delinq_31_365"]) {
            d.overdue_gt_30 = Some(i.delinq_31_365);
            d.overdue_total = Some(i.delinq_0_30 + i.delinq_31_365);
        }

        d.liquid_assets = i
            .has_any(&["cash_on_hand", "cash_at_bank", "bank_investment"])
            .then_some(i.cash_on_hand + i.cash_at_bank + i.bank_investment);

        d.earning_assets = d
            .gross_loans
            .map(|loans| loans + i.bank_investment + i.share_investment + i.other_investments);

        d.institutional_capital = i
            .has_any(&["retained_earnings", "statutory_reserves", "donations"])
            .then_some(i.retained_earnings + i.statutory_reserves + i.donations);

        d.net_income = if i.has("net_income") {
            Some(i.net_income)
        } else if i.has_any(&["income", "expenditure"]) {
            Some(i.income - i.expenditure)
        } else {
            None
        };

        if let Some(loans) = d.gross_loans {
            if i.weight_out > f64::EPSILON
                && i.has_any(&["avg_interest_rate", "avg_loan_term_months"])
            {
                let rate = i.rate_weighted / i.weight_out;
                let term = i.term_weighted / i.weight_out;
                let total_method =
                    i.interest_method_flat_weight + i.interest_method_reducing_weight;
                let reducing_share = if total_method > f64::EPSILON {
                    i.interest_method_reducing_weight / total_method
                } else {
                    0.0
                };
                let method_factor = 1.0 - 0.5 * reducing_share;
                d.projected_interest = Some(loans * rate / 100.0 * term * method_factor);
            }
        }
        d
    }

    pub fn par_pct(&self, overdue: Option<f64>) -> Option<f64> {
        ratio_pct(overdue, self.gross_loans)
    }

    pub fn liquidity_ratio_pct(&self) -> Option<f64> {
        ratio_pct(self.liquid_assets, self.deposits)
    }

    pub fn institutional_capital_ratio_pct(&self) -> Option<f64> {
        ratio_pct(self.institutional_capital, self.total_assets)
    }
}
