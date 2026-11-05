//! Section subtotals and totals of the statement (1100 Liquid assets, 1999 Total assets,
//! 6999 Net surplus and so on), worked out from the formulas of the chart of accounts.
//! An Excel import carries them; a Mambu ledger only has detail accounts, and the
//! statement checks need them.

use std::collections::HashMap;

use rust_decimal::Decimal;

use crate::entities::chart_of_account;
use crate::services::mambu::mapper::LedgerLine;

/// Terms of a formula such as `1101+1102-1304`, as (sign, account code).
fn terms(formula: &str) -> Vec<(i8, i32)> {
    let mut out = Vec::new();
    let mut sign = 1i8;
    let mut number = String::new();
    let flush = |sign: i8, number: &mut String, out: &mut Vec<(i8, i32)>| {
        if let Ok(code) = number.trim().parse::<i32>() {
            out.push((sign, code));
        }
        number.clear();
    };
    for ch in formula.chars() {
        match ch {
            '+' | '-' => {
                flush(sign, &mut number, &mut out);
                sign = if ch == '-' { -1 } else { 1 };
            }
            c if c.is_ascii_digit() => number.push(c),
            _ => {}
        }
    }
    flush(sign, &mut number, &mut out);
    out
}

fn evaluate(formula: &str, values: &HashMap<i32, Decimal>) -> Decimal {
    terms(formula)
        .into_iter()
        .map(|(sign, code)| values.get(&code).copied().unwrap_or_default() * Decimal::from(sign))
        .sum()
}

/// The lines of a month with the section subtotals and totals added. Nothing is added
/// to an empty month. A line that is already there is kept as it is.
pub fn with_totals(
    lines: &[LedgerLine],
    coa: &HashMap<i32, chart_of_account::Model>,
) -> Vec<LedgerLine> {
    let mut out = lines.to_vec();
    if lines.is_empty() {
        return out;
    }
    let mut values: HashMap<i32, Decimal> =
        lines.iter().map(|l| (l.account_code, l.value)).collect();
    let mut codes: Vec<i32> = coa
        .values()
        .filter(|a| a.formula.is_some() && (a.is_section_header || a.is_total))
        .map(|a| a.account_code)
        .collect();
    // Subtotals first, then totals; the net surplus follows the income and expense totals.
    codes.sort_by_key(|c| (coa[c].is_total, *c));
    for code in codes {
        if values.contains_key(&code) {
            continue;
        }
        let account = &coa[&code];
        let value = evaluate(account.formula.as_deref().unwrap_or(""), &values);
        if value.is_zero() && !account.is_total {
            continue;
        }
        values.insert(code, value);
        out.push(LedgerLine {
            account_code: code,
            value,
        });
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entities::enums::AccountCategory;

    fn account(code: i32, header: bool, total: bool, formula: &str) -> chart_of_account::Model {
        chart_of_account::Model {
            account_code: code,
            account_name: format!("A{code}"),
            account_category: AccountCategory::Assets,
            account_subcategory: None,
            is_total: total,
            is_section_header: header,
            parent_code: None,
            formula: Some(formula.to_string()),
            display_order: 0,
            baseline_active: true,
            description: None,
        }
    }

    fn line(code: i32, value: i64) -> LedgerLine {
        LedgerLine {
            account_code: code,
            value: Decimal::from(value),
        }
    }

    fn coa() -> HashMap<i32, chart_of_account::Model> {
        [
            account(1100, true, false, "1101+1102"),
            account(1250, true, false, "1251"),
            account(1999, false, true, "1100-1250"),
            account(4999, false, true, "4101"),
            account(5999, false, true, "5101"),
            account(6999, false, true, "4999-5999"),
        ]
        .into_iter()
        .map(|a| (a.account_code, a))
        .collect()
    }

    fn value(lines: &[LedgerLine], code: i32) -> Option<Decimal> {
        lines
            .iter()
            .find(|l| l.account_code == code)
            .map(|l| l.value)
    }

    #[test]
    fn formulas_are_read_with_their_signs() {
        assert_eq!(
            terms("1101+1102-1304+1305"),
            vec![(1, 1101), (1, 1102), (-1, 1304), (1, 1305)]
        );
    }

    #[test]
    fn subtotals_and_totals_are_added_in_order() {
        let lines = vec![
            line(1101, 100),
            line(1102, 50),
            line(1251, 20),
            line(4101, 70),
            line(5101, 30),
        ];
        let all = with_totals(&lines, &coa());
        assert_eq!(value(&all, 1100), Some(Decimal::from(150)));
        assert_eq!(value(&all, 1250), Some(Decimal::from(20)));
        assert_eq!(value(&all, 1999), Some(Decimal::from(130)));
        assert_eq!(value(&all, 6999), Some(Decimal::from(40)));
    }

    #[test]
    fn an_empty_month_stays_empty_and_existing_lines_are_kept() {
        assert!(with_totals(&[], &coa()).is_empty());
        let lines = vec![line(1101, 100), line(1999, 5)];
        assert_eq!(
            value(&with_totals(&lines, &coa()), 1999),
            Some(Decimal::from(5))
        );
    }
}
