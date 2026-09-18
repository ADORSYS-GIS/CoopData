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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::entities::enums::AccountCategory;

    fn coa(code: i32, name: &str, formula: Option<&str>) -> chart_of_account::Model {
        chart_of_account::Model {
            account_code: code,
            account_name: name.to_string(),
            account_category: AccountCategory::Assets,
            account_subcategory: None,
            is_total: false,
            is_section_header: false,
            parent_code: None,
            formula: formula.map(|f| f.to_string()),
            display_order: 0,
            baseline_active: true,
            description: None,
        }
    }

    fn values(pairs: &[(i32, i64)]) -> ValuesMap {
        pairs.iter().map(|(c, v)| (*c, Decimal::from(*v))).collect()
    }

    #[test]
    fn sum_check_passes_when_children_match_parent() {
        let coa = vec![coa(1999, "Total Assets", Some("1101+1102"))];
        let v = values(&[(1999, 300), (1101, 100), (1102, 200)]);
        assert!(run_sum_checks(&coa, &v).is_empty());
    }

    #[test]
    fn sum_check_within_tolerance_pct_passes() {
        let coa = vec![coa(1999, "Total Assets", Some("1101+1102"))];
        let v = values(&[(1999, 310), (1101, 100), (1102, 200)]);
        assert!(run_sum_checks(&coa, &v).is_empty());
    }

    #[test]
    fn sum_check_fails_beyond_tolerance() {
        let coa = vec![coa(1999, "Total Assets", Some("1101+1102"))];
        let v = values(&[(1999, 500), (1101, 100), (1102, 200)]);
        let flags = run_sum_checks(&coa, &v);
        assert_eq!(flags.len(), 1);
        assert_eq!(flags[0].rule_id, "SUM-1999");
        assert_eq!(flags[0].severity, "medium");
        assert_eq!(flags[0].field_ref, Some("1999".to_string()));
    }

    #[test]
    fn sum_check_prefers_signed_comparison_when_it_fits() {
        let coa = vec![coa(1300, "Fixed Assets", Some("1301-1304"))];
        let v = values(&[(1300, 800), (1301, 1000), (1304, 200)]);
        assert!(run_sum_checks(&coa, &v).is_empty());
    }

    #[test]
    fn sum_check_partial_when_some_children_missing() {
        let coa = vec![coa(1999, "Total Assets", Some("1101+1102+1103"))];
        let v = values(&[(1999, 500), (1101, 100), (1102, 200)]);
        let flags = run_sum_checks(&coa, &v);
        assert_eq!(flags.len(), 1);
        assert!(flags[0].message.contains("partial check"));
    }

    #[test]
    fn sum_check_skips_parent_missing_from_values() {
        let coa = vec![coa(1999, "Total Assets", Some("1101+1102"))];
        let v = values(&[(1101, 100), (1102, 200)]);
        assert!(run_sum_checks(&coa, &v).is_empty());
    }

    #[test]
    fn sum_check_skips_when_no_children_present() {
        let coa = vec![coa(1999, "Total Assets", Some("1101+1102"))];
        let v = values(&[(1999, 100)]);
        assert!(run_sum_checks(&coa, &v).is_empty());
    }

    #[test]
    fn entries_without_formula_are_ignored() {
        let coa = vec![coa(1999, "Total Assets", None)];
        let v = values(&[(1999, 500), (1101, 100), (1102, 200)]);
        assert!(run_sum_checks(&coa, &v).is_empty());
    }

    #[test]
    fn multiple_coa_entries_produce_multiple_flags() {
        let coa = vec![
            coa(1999, "Total Assets", Some("1101+1102")),
            coa(2999, "Total Liabilities", Some("2101+2102")),
        ];
        let v = values(&[
            (1999, 500),
            (1101, 100),
            (1102, 200),
            (2999, 900),
            (2101, 100),
            (2102, 200),
        ]);
        let flags = run_sum_checks(&coa, &v);
        assert_eq!(flags.len(), 2);
        assert_eq!(flags[0].rule_id, "SUM-1999");
        assert_eq!(flags[1].rule_id, "SUM-2999");
    }
}
