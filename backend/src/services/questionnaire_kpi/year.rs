//! Builds a full year of questionnaire answers from the answers of its periods
//! (quarters, halves or months), first period first.

use serde_json::{Map, Value};

use super::coa::GRID_KEYS;

/// Answers that measure what happened during the period; a year adds them up.
/// Every other answer (members, balances, capital, governance) is a year-end
/// figure and is taken from the last period.
const FLOW_KEYS: &[&str] = &[
    "current_total_income",
    "total_income",
    "current_total_expenditure",
    "total_expenditure",
    "current_net_income",
    "net_income",
    "main_activity_1_income",
    "main_activity_1_expenses",
    "main_activity_1_distrib_members",
    "main_activity_2_income",
    "main_activity_2_expenses",
    "main_activity_2_distrib_members",
    "other_activities_income",
    "other_activities_expenditure",
    "meetings_held_count",
];

fn number(v: &Value) -> Option<f64> {
    v.as_f64().or_else(|| {
        v.as_str()
            .and_then(|s| s.trim().replace(',', "").parse().ok())
    })
}

fn sum_of(periods: &[&Value], read: impl Fn(&Value) -> Option<&Value>) -> Option<f64> {
    let values: Vec<f64> = periods
        .iter()
        .filter_map(|p| read(p).and_then(number))
        .collect();
    (!values.is_empty()).then(|| values.iter().sum())
}

fn merge_grid(periods: &[&Value], grid_key: &str) -> Option<Value> {
    let grids: Vec<&Map<String, Value>> = periods
        .iter()
        .filter_map(|p| p.get(grid_key).and_then(Value::as_object))
        .collect();
    if grids.is_empty() {
        return None;
    }
    let mut codes: Vec<&String> = grids.iter().flat_map(|g| g.keys()).collect();
    codes.sort();
    codes.dedup();

    let mut merged = Map::new();
    for code in codes {
        let cells: Vec<&Value> = grids.iter().filter_map(|g| g.get(code)).collect();
        let (Some(first), Some(last)) = (cells.first(), cells.last()) else {
            continue;
        };
        let mut cell = last.as_object().cloned().unwrap_or_default();
        if let Some(opening) = first.get("openingBalance").and_then(number) {
            cell.insert("openingBalance".into(), Value::from(opening));
        }
        if let Some(movement) = sum_of(&cells, |c| c.get("annualMovement")) {
            cell.insert("annualMovement".into(), Value::from(movement));
        }
        if let Some(closing) = last.get("closingBalance").and_then(number) {
            cell.insert("closingBalance".into(), Value::from(closing));
        }
        merged.insert(code.clone(), Value::Object(cell));
    }
    Some(Value::Object(merged))
}

/// One year of answers from its periods' answers, first period first:
/// - flows (income, expenditure, activity results, meetings) are summed;
/// - the accounts grid keeps the first period's opening balance, sums the
///   movements and keeps the last period's closing balance;
/// - every other answer is the last period's.
pub fn merge_period_answers(periods: &[&Value]) -> Value {
    if periods.len() <= 1 {
        return periods.first().map(|p| (*p).clone()).unwrap_or(Value::Null);
    }
    let mut merged = Map::new();
    for period in periods {
        if let Some(obj) = period.as_object() {
            for (key, value) in obj {
                merged.insert(key.clone(), value.clone());
            }
        }
    }
    for key in FLOW_KEYS {
        if let Some(total) = sum_of(periods, |p| p.get(*key)) {
            merged.insert((*key).to_string(), Value::from(total));
        }
    }
    for grid_key in GRID_KEYS {
        if let Some(grid) = merge_grid(periods, grid_key) {
            merged.insert((*grid_key).to_string(), grid);
        }
    }
    Value::Object(merged)
}
