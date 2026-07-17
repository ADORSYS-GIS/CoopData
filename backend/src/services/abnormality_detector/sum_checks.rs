use rust_decimal::Decimal;

use crate::entities::chart_of_account;

use super::calculations::{
    any_present, child_codes, flag, get_val, parse_formula, sum_children, sum_signed, FlagOutput,
    ValuesMap,
};

fn tolerance_pct() -> Decimal {
    Decimal::new(5, 2)
}

pub fn run_sum_checks(coa: &[chart_of_account::Model], values: &ValuesMap) -> Vec<FlagOutput> {
    let mut flags = Vec::new();

    for entry in coa {
        if let Some(ref formula) = entry.formula {
            let children = parse_formula(formula);
            let child_codes = child_codes(&children);

            let parent_val = match get_val(values, entry.account_code) {
                Some(v) => v,
                None => continue,
            };

            if !any_present(values, &child_codes) {
                continue;
            }

            let all_children = child_codes.iter().all(|c| values.contains_key(c));

            let calculated_signed = sum_signed(values, &children);
            let calculated_unsigned = sum_children(values, &children);
            let diff_signed = (parent_val - calculated_signed).abs();
            let diff_unsigned = (parent_val - calculated_unsigned).abs();
            let (calculated, diff) = if diff_signed <= diff_unsigned {
                (calculated_signed, diff_signed)
            } else {
                (calculated_unsigned, diff_unsigned)
            };
            let tolerance = (parent_val.abs() * tolerance_pct()).max(Decimal::ONE);

            if diff > tolerance {
                let severity = "medium";
                let partial_note = if all_children {
                    String::new()
                } else {
                    format!(
                        " (partial check — not all child codes present: {:?})",
                        child_codes
                    )
                };
                let msg = format!(
                    "Sum check failed for {}: {} should be {} but components sum to {}{}",
                    entry.account_name, entry.account_code, parent_val, calculated, partial_note
                );
                flags.push(flag(
                    &format!("SUM-{}", entry.account_code),
                    severity,
                    msg,
                    Some(entry.account_code.to_string()),
                ));
            }
        }
    }

    flags
}
