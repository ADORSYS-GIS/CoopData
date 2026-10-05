use rust_decimal::Decimal;
use serde::Serialize;
use std::collections::HashMap;

use crate::entities::balance_sheet_line_item;

#[derive(Debug, Clone, Serialize)]
pub struct FlagOutput {
    pub rule_id: String,
    pub severity: String,
    pub message: String,
    pub field_ref: Option<String>,
}

pub fn flag(
    rule_id: &str,
    severity: &str,
    message: String,
    field_ref: Option<String>,
) -> FlagOutput {
    FlagOutput {
        rule_id: rule_id.to_string(),
        severity: severity.to_string(),
        message,
        field_ref,
    }
}

pub type ValuesMap = HashMap<i32, Decimal>;

pub fn build_values_map_for_month(
    line_items: &[balance_sheet_line_item::Model],
    month: i16,
) -> ValuesMap {
    let mut map: ValuesMap = HashMap::new();
    for item in line_items {
        if item.month == month {
            if let (Some(code), Some(val)) = (item.account_code, item.value) {
                *map.entry(code).or_default() += val;
            }
        }
    }
    map
}

pub fn build_presence_values_map(line_items: &[balance_sheet_line_item::Model]) -> ValuesMap {
    let mut map: ValuesMap = HashMap::new();
    for item in line_items {
        if let (Some(code), Some(val)) = (item.account_code, item.value) {
            map.insert(code, val);
        }
    }
    map
}

pub fn get_val(v: &ValuesMap, code: i32) -> Option<Decimal> {
    v.get(&code).copied()
}

pub fn get_zero(v: &ValuesMap, code: i32) -> Decimal {
    v.get(&code).copied().unwrap_or_default()
}

pub fn sum_codes(v: &ValuesMap, codes: &[i32]) -> Decimal {
    codes.iter().map(|c| get_zero(v, *c)).sum()
}

pub fn sum_signed(v: &ValuesMap, codes: &[(i32, bool)]) -> Decimal {
    codes
        .iter()
        .map(|(c, pos)| {
            let val = get_zero(v, *c);
            if *pos {
                val
            } else {
                -val
            }
        })
        .sum()
}

pub fn sum_children(v: &ValuesMap, codes: &[(i32, bool)]) -> Decimal {
    codes.iter().map(|(c, _)| get_zero(v, *c)).sum()
}

#[allow(dead_code)]
pub fn all_present(v: &ValuesMap, codes: &[i32]) -> bool {
    codes.iter().all(|c| v.contains_key(c))
}

pub fn any_present(v: &ValuesMap, codes: &[i32]) -> bool {
    codes.iter().any(|c| v.contains_key(c))
}

pub fn parse_formula(formula: &str) -> Vec<(i32, bool)> {
    let mut result = Vec::new();
    let mut current = String::new();
    let mut is_positive = true;
    for ch in formula.chars() {
        match ch {
            '+' => {
                if let Ok(code) = current.parse::<i32>() {
                    result.push((code, is_positive));
                }
                current.clear();
                is_positive = true;
            }
            '-' => {
                if let Ok(code) = current.parse::<i32>() {
                    result.push((code, is_positive));
                }
                current.clear();
                is_positive = false;
            }
            _ => current.push(ch),
        }
    }
    if let Ok(code) = current.parse::<i32>() {
        result.push((code, is_positive));
    }
    result
}

pub fn child_codes(children: &[(i32, bool)]) -> Vec<i32> {
    children.iter().map(|(c, _)| *c).collect()
}

pub fn pct(numerator: Decimal, denominator: Decimal) -> Option<Decimal> {
    if denominator.is_zero() {
        None
    } else {
        Some(numerator / denominator * Decimal::from(100))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rust_decimal_macros::dec;

    use crate::entities::balance_sheet_line_item;
    use crate::entities::enums::AccountCategory;

    fn line_item(
        code: Option<i32>,
        value: Option<Decimal>,
        month: i16,
    ) -> balance_sheet_line_item::Model {
        balance_sheet_line_item::Model {
            id: uuid::Uuid::new_v4(),
            financial_statement_id: uuid::Uuid::new_v4(),
            account_code: code,
            account_name: format!("Account {}", code.unwrap_or(0)),
            account_category: AccountCategory::Assets,
            account_subcategory: "current".to_string(),
            month,
            value,
            ai_confidence: None,
            ai_flagged: false,
            manually_edited: false,
            raw_label: None,
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        }
    }

    fn li(code: i32, value: i64, month: i16) -> balance_sheet_line_item::Model {
        line_item(Some(code), Some(Decimal::from(value)), month)
    }

    // ---- flag() ----

    #[test]
    fn flag_builds_output_with_all_fields() {
        let f = flag("X-1", "high", "msg".into(), Some("1101".into()));
        assert_eq!(f.rule_id, "X-1");
        assert_eq!(f.severity, "high");
        assert_eq!(f.message, "msg");
        assert_eq!(f.field_ref, Some("1101".to_string()));
    }

    #[test]
    fn flag_allows_null_field_ref() {
        let f = flag("X-1", "low", "msg".into(), None);
        assert_eq!(f.field_ref, None);
    }

    // ---- build_values_map_for_month ----

    #[test]
    fn build_values_map_for_month_keeps_only_matching_month() {
        let items = vec![li(1101, 100, 1), li(1102, 50, 1), li(1101, 999, 2)];
        let v = build_values_map_for_month(&items, 1);
        assert_eq!(v.get(&1101), Some(&dec!(100)));
        assert_eq!(v.get(&1102), Some(&dec!(50)));
        assert!(!v.contains_key(&2));
        assert_eq!(v.len(), 2);
    }

    #[test]
    fn build_values_map_for_month_accumulates_duplicate_codes() {
        let items = vec![li(1101, 100, 1), li(1101, 40, 1)];
        let v = build_values_map_for_month(&items, 1);
        assert_eq!(v.get(&1101), Some(&dec!(140)));
    }

    #[test]
    fn build_values_map_for_month_skips_null_code_and_value() {
        let items = vec![
            line_item(None, Some(dec!(10)), 1),
            line_item(Some(1101), None, 1),
        ];
        let v = build_values_map_for_month(&items, 1);
        assert!(v.is_empty());
    }

    // ---- build_presence_values_map ----

    #[test]
    fn build_presence_values_map_last_value_wins_regardless_of_month() {
        let items = vec![li(1101, 100, 1), li(1101, 300, 3)];
        let v = build_presence_values_map(&items);
        assert_eq!(v.get(&1101), Some(&dec!(300)));
    }

    #[test]
    fn build_presence_values_map_skips_null_code_and_value() {
        let items = vec![line_item(None, Some(dec!(10)), 1)];
        let v = build_presence_values_map(&items);
        assert!(v.is_empty());
    }

    // ---- get_val / get_zero ----

    #[test]
    fn get_val_returns_none_for_missing_code() {
        let v: ValuesMap = HashMap::new();
        assert_eq!(get_val(&v, 1101), None);
    }

    #[test]
    fn get_val_returns_stored_value() {
        let mut v = ValuesMap::new();
        v.insert(1101, dec!(42));
        assert_eq!(get_val(&v, 1101), Some(dec!(42)));
    }

    #[test]
    fn get_zero_defaults_to_zero_for_missing_code() {
        let v: ValuesMap = HashMap::new();
        assert_eq!(get_zero(&v, 9999), Decimal::ZERO);
    }

    #[test]
    fn get_zero_returns_stored_value() {
        let mut v = ValuesMap::new();
        v.insert(1101, dec!(-7));
        assert_eq!(get_zero(&v, 1101), dec!(-7));
    }

    // ---- sum_codes ----

    #[test]
    fn sum_codes_sums_present_codes_and_treats_missing_as_zero() {
        let mut v = ValuesMap::new();
        v.insert(1101, dec!(100));
        v.insert(1102, dec!(50));
        assert_eq!(sum_codes(&v, &[1101, 1102, 1103]), dec!(150));
    }

    #[test]
    fn sum_codes_of_empty_map_is_zero() {
        let v: ValuesMap = HashMap::new();
        assert_eq!(sum_codes(&v, &[1101, 1102]), Decimal::ZERO);
    }

    #[test]
    fn sum_codes_of_empty_code_list_is_zero() {
        let mut v = ValuesMap::new();
        v.insert(1101, dec!(100));
        assert_eq!(sum_codes(&v, &[]), Decimal::ZERO);
    }

    // ---- sum_signed ----

    #[test]
    fn sum_signed_negates_entries_marked_negative() {
        let mut v = ValuesMap::new();
        v.insert(1301, dec!(1000));
        v.insert(1304, dec!(200));
        let children = vec![(1301, true), (1304, false)];
        assert_eq!(sum_signed(&v, &children), dec!(800));
    }

    #[test]
    fn sum_signed_all_positive_behaves_like_plain_sum() {
        let mut v = ValuesMap::new();
        v.insert(1101, dec!(10));
        v.insert(1102, dec!(20));
        let children = vec![(1101, true), (1102, true)];
        assert_eq!(sum_signed(&v, &children), dec!(30));
    }

    // ---- sum_children ----

    #[test]
    fn sum_children_ignores_sign_and_treats_missing_as_zero() {
        let mut v = ValuesMap::new();
        v.insert(1301, dec!(1000));
        v.insert(1304, dec!(200));
        let children = vec![(1301, false), (1304, true), (9999, true)];
        assert_eq!(sum_children(&v, &children), dec!(1200));
    }

    // ---- all_present / any_present ----

    #[test]
    fn all_present_requires_every_code() {
        let mut v = ValuesMap::new();
        v.insert(1101, dec!(1));
        assert!(!all_present(&v, &[1101, 1102]));
        v.insert(1102, dec!(1));
        assert!(all_present(&v, &[1101, 1102]));
    }

    #[test]
    fn all_present_on_empty_code_list_is_true() {
        let v: ValuesMap = HashMap::new();
        assert!(all_present(&v, &[]));
    }

    #[test]
    fn any_present_true_when_at_least_one_exists() {
        let v: ValuesMap = HashMap::new();
        assert!(!any_present(&v, &[1101, 1102]));
        let mut v = ValuesMap::new();
        v.insert(1102, dec!(1));
        assert!(any_present(&v, &[1101, 1102]));
    }

    // ---- parse_formula ----

    #[test]
    fn parse_formula_plus_only() {
        assert_eq!(
            parse_formula("1101+1102+1103"),
            vec![(1101, true), (1102, true), (1103, true)]
        );
    }

    #[test]
    fn parse_formula_with_subtraction() {
        assert_eq!(
            parse_formula("1301+1302+1303+1305-1304"),
            vec![
                (1301, true),
                (1302, true),
                (1303, true),
                (1305, true),
                (1304, false)
            ]
        );
    }

    #[test]
    fn parse_formula_single_code() {
        assert_eq!(parse_formula("1999"), vec![(1999, true)]);
    }

    #[test]
    fn parse_formula_skips_garbage_segments() {
        assert_eq!(
            parse_formula("1101+abc+1102"),
            vec![(1101, true), (1102, true)]
        );
    }

    #[test]
    fn parse_formula_empty_string_yields_empty() {
        assert!(parse_formula("").is_empty());
    }

    #[test]
    fn parse_formula_leading_minus_applies_to_next_code() {
        assert_eq!(
            parse_formula("-1101+1102"),
            vec![(1101, false), (1102, true)]
        );
    }

    // ---- child_codes ----

    #[test]
    fn child_codes_extracts_codes_dropping_signs() {
        let children = vec![(1301, true), (1304, false)];
        assert_eq!(child_codes(&children), vec![1301, 1304]);
    }

    #[test]
    fn child_codes_empty_input() {
        assert!(child_codes(&[]).is_empty());
    }

    // ---- pct ----

    #[test]
    fn pct_computes_percentage() {
        assert_eq!(pct(dec!(5), dec!(100)), Some(dec!(5)));
        assert_eq!(pct(dec!(1), dec!(8)), Some(dec!(12.5)));
    }

    #[test]
    fn pct_zero_denominator_returns_none() {
        assert_eq!(pct(dec!(5), Decimal::ZERO), None);
    }

    #[test]
    fn pct_negative_numerator_is_preserved() {
        assert_eq!(pct(dec!(-25), dec!(100)), Some(dec!(-25)));
    }
}
