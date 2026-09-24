//! Chart-of-accounts rollup — single source of truth for deriving
//! parent/aggregate account values from their children.
//!
//! `chart_of_accounts` already declares every aggregate code's formula
//! (e.g. account 1200 "Gross Loans" = `1201+1202+1203+1204+1205`), but
//! nothing evaluated it at runtime — `KpiEngine` hand-duplicated similar
//! logic for the Dashboard KPI cards only, and the comparative-statements
//! grids (Cooperative Manager Rankings, Portfolio Classification, Income
//! Statement, Financial Indicators) did exact-code lookups with no
//! fallback at all, so a document that only populated child codes rendered
//! blank for the parent. This module makes the DB-declared formulas the
//! one place that logic lives, for every consumer.

use std::collections::HashMap;

use crate::entities::chart_of_account;

/// Resolve every chart-of-accounts code's value from a raw (possibly
/// partial) map of directly-extracted values. For a code with a `formula`,
/// the direct extracted value wins when it's non-trivially non-zero
/// (matches the "prefer what was actually reported" behavior already used
/// elsewhere in this codebase); otherwise the formula is evaluated from its
/// (possibly also-derived) children.
pub fn resolve(raw: &HashMap<i32, f64>, coa: &[chart_of_account::Model]) -> HashMap<i32, f64> {
    let by_code: HashMap<i32, &chart_of_account::Model> =
        coa.iter().map(|c| (c.account_code, c)).collect();
    let mut resolved: HashMap<i32, f64> = raw.clone();
    for code in by_code.keys() {
        let mut visiting = Vec::new();
        resolve_code(*code, &by_code, &mut resolved, &mut visiting);
    }
    resolved
}

fn resolve_code(
    code: i32,
    by_code: &HashMap<i32, &chart_of_account::Model>,
    resolved: &mut HashMap<i32, f64>,
    visiting: &mut Vec<i32>,
) -> f64 {
    if let Some(v) = resolved.get(&code) {
        if v.abs() > 0.001 {
            return *v;
        }
    }
    if visiting.contains(&code) {
        // Malformed/cyclic formula in seed data — fall back to whatever raw
        // value (if any) rather than infinitely recursing.
        return resolved.get(&code).copied().unwrap_or(0.0);
    }
    let Some(formula) = by_code.get(&code).and_then(|m| m.formula.as_deref()) else {
        return resolved.get(&code).copied().unwrap_or(0.0);
    };

    visiting.push(code);
    let value = eval_additive_formula(formula, by_code, resolved, visiting);
    visiting.pop();

    resolved.insert(code, value);
    value
}

/// Formulas in `chart_of_accounts.formula` are always a plain `+`/`-`
/// separated list of account codes (e.g. `1100+1200-1250+1300`), never
/// parentheses or other operators — confirmed against every row seeded in
/// migrations/04_chart_of_accounts.sql.
fn eval_additive_formula(
    formula: &str,
    by_code: &HashMap<i32, &chart_of_account::Model>,
    resolved: &mut HashMap<i32, f64>,
    visiting: &mut Vec<i32>,
) -> f64 {
    let mut total = 0.0;
    let mut sign = 1.0;
    let mut term = String::new();

    let flush = |term: &mut String,
                 sign: f64,
                 total: &mut f64,
                 resolved: &mut HashMap<i32, f64>,
                 visiting: &mut Vec<i32>| {
        if term.is_empty() {
            return;
        }
        if let Ok(code) = term.parse::<i32>() {
            *total += sign * resolve_code(code, by_code, resolved, visiting);
        }
        term.clear();
    };

    for ch in formula.chars() {
        match ch {
            '+' => {
                flush(&mut term, sign, &mut total, resolved, visiting);
                sign = 1.0;
            }
            '-' => {
                flush(&mut term, sign, &mut total, resolved, visiting);
                sign = -1.0;
            }
            c if c.is_ascii_digit() => term.push(c),
            _ => {}
        }
    }
    flush(&mut term, sign, &mut total, resolved, visiting);

    total
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entities::enums::AccountCategory;

    fn coa_row(code: i32, formula: Option<&str>, parent: Option<i32>) -> chart_of_account::Model {
        chart_of_account::Model {
            account_code: code,
            account_name: format!("Account {code}"),
            account_category: AccountCategory::Assets,
            account_subcategory: None,
            is_total: formula.is_some(),
            is_section_header: false,
            parent_code: parent,
            formula: formula.map(|s| s.to_string()),
            display_order: code,
            baseline_active: true,
            description: None,
        }
    }

    #[test]
    fn derives_parent_from_children_when_parent_missing() {
        let coa = vec![
            coa_row(1200, Some("1201+1202+1203+1204+1205"), None),
            coa_row(1201, None, Some(1200)),
            coa_row(1202, None, Some(1200)),
            coa_row(1203, None, Some(1200)),
            coa_row(1204, None, Some(1200)),
            coa_row(1205, None, Some(1200)),
        ];
        let mut raw = HashMap::new();
        raw.insert(1201, 223_247_944.0); // only the child code was extracted
        let resolved = resolve(&raw, &coa);
        assert_eq!(resolved.get(&1200), Some(&223_247_944.0));
    }

    #[test]
    fn prefers_directly_reported_parent_over_children_sum() {
        let coa = vec![coa_row(1999, Some("1100+1200-1250+1300"), None)];
        let mut raw = HashMap::new();
        raw.insert(1999, 284_427_364.0);
        raw.insert(1100, 999.0); // should be ignored — parent already reported
        let resolved = resolve(&raw, &coa);
        assert_eq!(resolved.get(&1999), Some(&284_427_364.0));
    }

    #[test]
    fn handles_subtraction_terms() {
        let coa = vec![
            coa_row(4999, None, None),
            coa_row(5999, None, None),
            coa_row(6999, Some("4999-5999"), None),
        ];
        let mut raw = HashMap::new();
        raw.insert(4999, 100.0);
        raw.insert(5999, 40.0);
        let resolved = resolve(&raw, &coa);
        assert_eq!(resolved.get(&6999), Some(&60.0));
    }

    #[test]
    fn missing_data_resolves_to_zero_not_panic() {
        let coa = vec![coa_row(1200, Some("1201+1202"), None)];
        let resolved = resolve(&HashMap::new(), &coa);
        assert_eq!(resolved.get(&1200), Some(&0.0));
    }
}
