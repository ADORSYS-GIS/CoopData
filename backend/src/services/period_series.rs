use std::collections::{BTreeMap, HashMap};

use crate::entities::chart_of_account;
use crate::entities::enums::PeriodType;
use crate::services::coa_rollup;

pub const DEFAULT_PERIOD_LIMIT: usize = 8;
pub const MAX_PERIOD_LIMIT: usize = 12;

macro_rules! statement_totals_struct {
    ($($field:ident),+ $(,)?) => {
        #[derive(Debug, Clone, Copy, Default, PartialEq)]
        pub struct StatementTotals {
            $(pub $field: f64,)+
        }

        impl StatementTotals {
            pub fn add(&mut self, other: &StatementTotals) {
                $(self.$field += other.$field;)+
            }

            pub fn map(&self, convert: impl Fn(f64) -> f64) -> StatementTotals {
                StatementTotals {
                    $($field: convert(self.$field),)+
                }
            }
        }
    };
}

statement_totals_struct!(
    assets,
    loans,
    liquid_assets,
    savings,
    liabilities,
    equity,
    total_income,
    total_expenses,
    net_income,
    arrears_1_30,
    arrears_31_60,
    arrears_61_90,
    non_performing,
    provisions,
    borrowings,
    share_capital,
    reserves,
    statutory_reserve,
    retained_earnings,
    financial_income,
    other_income,
    financial_expenses,
    operating_expenses,
    credit_loss_expense,
);

/// Position of a period inside its year, or `None` for an invalid value.
pub fn period_index(period_type: PeriodType, value: &str) -> Option<u32> {
    let upper = value.trim().to_uppercase();
    match period_type {
        PeriodType::Yearly => Some(0),
        PeriodType::Quarterly => upper
            .strip_prefix('Q')?
            .parse()
            .ok()
            .filter(|q| (1..=4).contains(q)),
        PeriodType::SemiAnnual => upper
            .strip_prefix('H')?
            .parse()
            .ok()
            .filter(|h| (1..=2).contains(h)),
        PeriodType::Monthly => upper.parse().ok().filter(|m| (1..=12).contains(m)),
    }
}

pub fn period_label(period_type: PeriodType, year: i32, value: &str) -> String {
    const MONTHS: [&str; 12] = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ];
    match period_type {
        PeriodType::Yearly => year.to_string(),
        PeriodType::Monthly => match period_index(period_type, value) {
            Some(month) => format!("{} {year}", MONTHS[(month - 1) as usize]),
            None => format!("{value} {year}"),
        },
        _ => format!("{} {year}", value.to_uppercase()),
    }
}

/// Chronological key of a period; `None` when the value is not valid for the type.
pub fn period_key(period_type: PeriodType, year: i32, value: &str) -> Option<(i32, u32)> {
    period_index(period_type, value).map(|index| (year, index))
}

/// The last `limit` distinct periods up to and including `end`, oldest first.
/// With no `end`, the newest available period closes the series.
pub fn select_periods(
    available: &[(i32, u32)],
    end: Option<(i32, Option<u32>)>,
    limit: usize,
) -> Vec<(i32, u32)> {
    let mut sorted: Vec<(i32, u32)> = available.to_vec();
    sorted.sort_unstable();
    sorted.dedup();

    let upper = match end {
        None => sorted.last().copied(),
        Some((year, Some(index))) => Some((year, index)),
        Some((year, None)) => sorted.iter().rev().find(|(y, _)| *y == year).copied(),
    };
    let Some(upper) = upper else {
        return Vec::new();
    };

    let within: Vec<(i32, u32)> = sorted.into_iter().filter(|key| *key <= upper).collect();
    let skip = within
        .len()
        .saturating_sub(limit.clamp(1, MAX_PERIOD_LIMIT));
    within.into_iter().skip(skip).collect()
}

const FLOW_CODES: [i32; 8] = [4999, 5999, 6999, 4100, 4200, 5100, 5200, 5300];

/// Totals of one statement in its own currency. Balance-sheet figures come from
/// the latest month reported (an annual statement stores everything at month 0);
/// income and expense figures are summed over the months reported, or read from
/// month 0.
pub fn statement_totals(
    raw_by_month: &BTreeMap<i16, HashMap<i32, f64>>,
    coa: &[chart_of_account::Model],
) -> StatementTotals {
    let has_monthly = raw_by_month.keys().any(|m| *m > 0);
    let months: Vec<(&i16, &HashMap<i32, f64>)> = raw_by_month
        .iter()
        .filter(|(month, _)| !(has_monthly && **month == 0))
        .collect();
    let Some((_, latest)) = months.last() else {
        return StatementTotals::default();
    };

    let balance = coa_rollup::resolve(latest, coa);
    let mut flows = [0.0_f64; 8];
    for (_, raw) in &months {
        let resolved = coa_rollup::resolve(raw, coa);
        for (slot, code) in flows.iter_mut().zip(FLOW_CODES) {
            *slot += resolved.get(&code).copied().unwrap_or(0.0);
        }
    }
    let [total_income, total_expenses, reported_net, financial_income, other_income, financial_expenses, operating_expenses, credit_loss_expense] =
        flows;
    let net_income = if reported_net.abs() > 0.001 {
        reported_net
    } else {
        total_income - total_expenses
    };
    let at = |code: i32| balance.get(&code).copied().unwrap_or(0.0);

    StatementTotals {
        assets: at(1999),
        loans: at(1200),
        liquid_assets: at(1100),
        savings: at(2100),
        liabilities: at(2999),
        equity: at(3999),
        total_income,
        total_expenses,
        net_income,
        arrears_1_30: at(1202),
        arrears_31_60: at(1203),
        arrears_61_90: at(1204),
        non_performing: at(1205),
        provisions: at(1250),
        borrowings: at(2200),
        share_capital: at(3100),
        reserves: at(3200),
        statutory_reserve: at(3201),
        retained_earnings: at(3300),
        financial_income,
        other_income,
        financial_expenses,
        operating_expenses,
        credit_loss_expense,
    }
}

#[cfg(test)]
mod tests;
