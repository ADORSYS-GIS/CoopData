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

pub fn flag(rule_id: &str, severity: &str, message: String, field_ref: Option<String>) -> FlagOutput {
    FlagOutput {
        rule_id: rule_id.to_string(),
        severity: severity.to_string(),
        message,
        field_ref,
    }
}

pub type ValuesMap = HashMap<i32, Decimal>;

pub fn build_values_map(line_items: &[balance_sheet_line_item::Model]) -> ValuesMap {
    let mut map: ValuesMap = HashMap::new();
    for item in line_items {
        if let (Some(code), Some(val)) = (item.account_code, item.value) {
            *map.entry(code).or_default() += val;
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
            if *pos { val } else { -val }
        })
        .sum()
}

pub fn sum_children(v: &ValuesMap, codes: &[(i32, bool)]) -> Decimal {
    codes
        .iter()
        .map(|(c, _)| get_zero(v, *c))
        .sum()
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