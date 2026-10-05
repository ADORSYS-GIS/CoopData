//! Deterministic post-processing of LLM extraction output.
//!
//! The LLM is non-deterministic across runs and occasionally emits rows that
//! would corrupt analytics if stored verbatim: grand-total check rows, the
//! same total code more than once (which the pipeline would then sum), and
//! unlabeled subtotal rows left unmapped. This stage fixes those cases with
//! plain arithmetic against the chart of accounts, so results do not depend
//! on the model.

use std::collections::{HashMap, HashSet};

use crate::entities::chart_of_account;
use crate::entities::enums::AccountCategory;
use crate::services::ai_extraction::ExtractedLineItem;

const TOTAL_CODES: [(i32, AccountCategory); 3] = [
    (1999, AccountCategory::Assets),
    (2999, AccountCategory::Liabilities),
    (3999, AccountCategory::Equity),
];

const GENERIC_LABELS: [&str; 7] = [
    "",
    "total",
    "subtotal",
    "sub total",
    "sub-total",
    "unnamed",
    "(unnamed subtotal row)",
];

#[derive(Debug, Default)]
pub struct SanitizeReport {
    pub dropped_grand_totals: usize,
    pub dropped_section_subtotals: usize,
    pub collapsed_duplicate_totals: usize,
    pub inferred_totals: Vec<i32>,
    pub derived_totals: Vec<i32>,
    pub dropped_total_duplicates: usize,
    pub dropped_sum_subtotals: usize,
    pub dropped_unmatched_unlabeled: usize,
}

fn is_grand_total_label(label: &str) -> bool {
    let l = label.to_lowercase();
    [
        "equity & liabilities",
        "liabilities & equity",
        "liabilities and equity",
        "equity and liabilities",
    ]
    .iter()
    .any(|p| l.contains(p))
}

/// "Total Current Liabilities", "Total Non-Current Assets" and similar are
/// classification subtotals of the source document, not chart-of-accounts
/// line items. Stored under a regular code they double-count their own
/// components and trigger false sum-check failures.
fn is_section_subtotal_label(label: &str) -> bool {
    let l = label.trim().to_lowercase();
    l.starts_with("total")
        && (l.contains("current") || l.contains("non-current") || l.contains("non current"))
        && (l.contains("asset") || l.contains("liabilit"))
}

fn is_generic_label(label: &str) -> bool {
    let l = label.trim().to_lowercase();
    GENERIC_LABELS.contains(&l.as_str())
        || l.contains("unnamed")
        || l.contains("unlabeled")
        || l.contains("unlabelled")
        || !l.chars().any(|c| c.is_alphabetic())
}

fn tolerance(value: f64) -> f64 {
    (value.abs() * 0.0001).max(1.0)
}

pub fn sanitize(
    items: Vec<ExtractedLineItem>,
    coa: &[chart_of_account::Model],
) -> (Vec<ExtractedLineItem>, SanitizeReport) {
    let mut report = SanitizeReport::default();
    let by_code: HashMap<i32, &chart_of_account::Model> =
        coa.iter().map(|c| (c.account_code, c)).collect();

    let before = items.len();
    let items: Vec<ExtractedLineItem> = items
        .into_iter()
        .filter(|i| !is_grand_total_label(&i.raw_label))
        .collect();
    report.dropped_grand_totals = before - items.len();

    let before = items.len();
    let items: Vec<ExtractedLineItem> = items
        .into_iter()
        .filter(|i| {
            let mapped_to_line_item = i
                .account_code
                .is_some_and(|c| by_code.get(&c).is_some_and(|m| !m.is_total));
            !(mapped_to_line_item && is_section_subtotal_label(&i.raw_label))
        })
        .collect();
    report.dropped_section_subtotals = before - items.len();

    let mut items = collapse_duplicate_totals(items, &by_code, &mut report);
    infer_unlabeled_totals(&mut items, coa, &by_code, &mut report);
    derive_missing_total(&mut items, &by_code, &mut report);
    let items = drop_misfiled_totals(items, &by_code, &mut report);
    let items = drop_sum_subtotals(items, &by_code, &mut report);
    let items = drop_unmatched_unlabeled(items, &mut report);
    (items, report)
}

fn collapse_duplicate_totals(
    items: Vec<ExtractedLineItem>,
    by_code: &HashMap<i32, &chart_of_account::Model>,
    report: &mut SanitizeReport,
) -> Vec<ExtractedLineItem> {
    let mut best: HashMap<(i32, i16), usize> = HashMap::new();
    for (idx, item) in items.iter().enumerate() {
        let Some(code) = item.account_code else {
            continue;
        };
        if !by_code.get(&code).is_some_and(|c| c.is_total) || item.value.is_none() {
            continue;
        }
        best.entry((code, item.month))
            .and_modify(|cur| {
                if item.confidence > items[*cur].confidence {
                    *cur = idx;
                }
            })
            .or_insert(idx);
    }

    let mut out = Vec::with_capacity(items.len());
    for (idx, item) in items.into_iter().enumerate() {
        if let Some(code) = item.account_code {
            let is_total = by_code.get(&code).is_some_and(|c| c.is_total);
            if is_total && item.value.is_some() && best.get(&(code, item.month)) != Some(&idx) {
                report.collapsed_duplicate_totals += 1;
                continue;
            }
        }
        out.push(item);
    }
    out
}

fn ancestors(code: i32, by_code: &HashMap<i32, &chart_of_account::Model>) -> Vec<i32> {
    let mut out = Vec::new();
    let mut cur = by_code.get(&code).and_then(|c| c.parent_code);
    while let Some(p) = cur {
        if out.contains(&p) {
            break;
        }
        out.push(p);
        cur = by_code.get(&p).and_then(|c| c.parent_code);
    }
    out
}

/// Sum of the "leaf" mapped items of a category in one month: totals are
/// excluded, and so is any code that is an ancestor of another present code
/// (it is a subtotal of those children, counting both would double-count).
fn leaf_sum(
    items: &[ExtractedLineItem],
    month: i16,
    category: &AccountCategory,
    by_code: &HashMap<i32, &chart_of_account::Model>,
) -> Option<f64> {
    let present: Vec<(i32, f64)> = items
        .iter()
        .filter(|i| i.month == month)
        .filter_map(|i| Some((i.account_code?, i.value?)))
        .filter(|(code, _)| {
            by_code
                .get(code)
                .is_some_and(|c| !c.is_total && &c.account_category == category)
        })
        .collect();
    if present.is_empty() {
        return None;
    }
    let parents: HashSet<i32> = present
        .iter()
        .flat_map(|(code, _)| ancestors(*code, by_code))
        .collect();
    Some(
        present
            .iter()
            .filter(|(code, _)| !parents.contains(code))
            .map(|(_, v)| v)
            .sum(),
    )
}

fn infer_unlabeled_totals(
    items: &mut [ExtractedLineItem],
    _coa: &[chart_of_account::Model],
    by_code: &HashMap<i32, &chart_of_account::Model>,
    report: &mut SanitizeReport,
) {
    let months: HashSet<i16> = items.iter().map(|i| i.month).collect();
    for month in months {
        for (total_code, category) in TOTAL_CODES.iter() {
            let already = items.iter().any(|i| {
                i.month == month && i.account_code == Some(*total_code) && i.value.is_some()
            });
            if already {
                continue;
            }
            let Some(expected) = leaf_sum(items, month, category, by_code) else {
                continue;
            };

            let matches: Vec<usize> = items
                .iter()
                .enumerate()
                .filter(|(_, i)| {
                    i.month == month
                        && i.account_code.is_none()
                        && is_generic_label(&i.raw_label)
                        && i.value
                            .is_some_and(|v| (v - expected).abs() <= tolerance(expected))
                })
                .map(|(idx, _)| idx)
                .collect();

            if matches.len() == 1 {
                let target = &mut items[matches[0]];
                target.account_code = Some(*total_code);
                target.account_name = by_code.get(total_code).map(|c| c.account_name.clone());
                target.confidence = target.confidence.min(0.85);
                report.inferred_totals.push(*total_code);
            }
        }
    }
}

/// Assets = Liabilities + Equity. When exactly one of the three grand totals
/// is missing for a period, it is derived from the other two rather than left
/// blank, so an unlabeled or unreadable subtotal row cannot block the
/// statement or corrupt analytics.
fn derive_missing_total(
    items: &mut Vec<ExtractedLineItem>,
    by_code: &HashMap<i32, &chart_of_account::Model>,
    report: &mut SanitizeReport,
) {
    let months: HashSet<i16> = items.iter().map(|i| i.month).collect();
    for month in months {
        let get = |code: i32| -> Option<f64> {
            items
                .iter()
                .find(|i| i.month == month && i.account_code == Some(code) && i.value.is_some())
                .and_then(|i| i.value)
        };
        let (assets, liabilities, equity) = (get(1999), get(2999), get(3999));
        let (code, value) = match (assets, liabilities, equity) {
            (Some(a), Some(l), None) => (3999, a - l),
            (Some(a), None, Some(e)) => (2999, a - e),
            (None, Some(l), Some(e)) => (1999, l + e),
            _ => continue,
        };
        items.push(ExtractedLineItem {
            account_code: Some(code),
            account_name: by_code.get(&code).map(|c| c.account_name.clone()),
            month,
            value: Some(value),
            confidence: 0.8,
            raw_label: "(derived from Assets = Liabilities + Equity)".into(),
        });
        report.derived_totals.push(code);
    }
}

/// A regular line item whose value equals its whole section's total, while
/// other line items exist in that section, is the section total misfiled
/// under a line-item code (the model merged a subtotal into a component).
fn drop_misfiled_totals(
    items: Vec<ExtractedLineItem>,
    by_code: &HashMap<i32, &chart_of_account::Model>,
    report: &mut SanitizeReport,
) -> Vec<ExtractedLineItem> {
    let total_value = |month: i16, code: i32| -> Option<f64> {
        items
            .iter()
            .find(|i| i.month == month && i.account_code == Some(code) && i.value.is_some())
            .and_then(|i| i.value)
    };
    let mut drop: HashSet<usize> = HashSet::new();
    for (total_code, category) in TOTAL_CODES.iter() {
        let months: HashSet<i16> = items.iter().map(|i| i.month).collect();
        for month in months {
            let Some(total) = total_value(month, *total_code) else {
                continue;
            };
            let members: Vec<usize> = items
                .iter()
                .enumerate()
                .filter(|(_, i)| {
                    i.month == month
                        && i.value.is_some()
                        && i.account_code.is_some_and(|c| {
                            by_code
                                .get(&c)
                                .is_some_and(|m| !m.is_total && &m.account_category == category)
                        })
                })
                .map(|(idx, _)| idx)
                .collect();
            for &idx in &members {
                let v = items[idx].value.unwrap_or(0.0);
                if members.len() >= 3 && (v - total).abs() <= tolerance(total) {
                    drop.insert(idx);
                }
            }
        }
    }
    report.dropped_total_duplicates = drop.len();
    items
        .into_iter()
        .enumerate()
        .filter(|(idx, _)| !drop.contains(idx))
        .map(|(_, i)| i)
        .collect()
}

/// A line item that equals the sum of two or three other line items of the
/// same section and period is a subtotal of them (e.g. "Current Liabilities"
/// = Borrowings + Accounts Payable). Keeping it under a regular code would
/// double-count its components.
fn drop_sum_subtotals(
    items: Vec<ExtractedLineItem>,
    by_code: &HashMap<i32, &chart_of_account::Model>,
    report: &mut SanitizeReport,
) -> Vec<ExtractedLineItem> {
    let candidates: Vec<(usize, i16, &AccountCategory, f64)> = items
        .iter()
        .enumerate()
        .filter_map(|(idx, i)| {
            let m = by_code.get(&i.account_code?)?;
            let v = i.value?;
            (!m.is_total && v.abs() >= 1.0).then_some((idx, i.month, &m.account_category, v))
        })
        .collect();

    let mut drop: HashSet<usize> = HashSet::new();
    for &(idx, month, cat, value) in &candidates {
        let others: Vec<f64> = candidates
            .iter()
            .filter(|(j, m, c, _)| *j != idx && *m == month && *c == cat)
            .map(|(_, _, _, v)| *v)
            .collect();
        let tol = tolerance(value);
        let mut found = false;
        for a in 0..others.len() {
            for b in (a + 1)..others.len() {
                if (others[a] + others[b] - value).abs() <= tol {
                    found = true;
                }
                for c in (b + 1)..others.len() {
                    if (others[a] + others[b] + others[c] - value).abs() <= tol {
                        found = true;
                    }
                }
            }
        }
        if found {
            drop.insert(idx);
        }
    }
    report.dropped_sum_subtotals = drop.len();
    items
        .into_iter()
        .enumerate()
        .filter(|(idx, _)| !drop.contains(idx))
        .map(|(_, i)| i)
        .collect()
}

/// Unlabeled rows that matched no total cannot be mapped to any account and
/// cannot be reviewed by a person either (there is nothing to read), so they
/// are dropped instead of blocking the submission indefinitely.
fn drop_unmatched_unlabeled(
    items: Vec<ExtractedLineItem>,
    report: &mut SanitizeReport,
) -> Vec<ExtractedLineItem> {
    let before = items.len();
    let kept: Vec<ExtractedLineItem> = items
        .into_iter()
        .filter(|i| !(i.account_code.is_none() && is_generic_label(&i.raw_label)))
        .collect();
    report.dropped_unmatched_unlabeled = before - kept.len();
    kept
}

#[cfg(test)]
mod tests {
    use super::*;

    fn coa_row(
        code: i32,
        cat: AccountCategory,
        parent: Option<i32>,
        total: bool,
    ) -> chart_of_account::Model {
        chart_of_account::Model {
            account_code: code,
            account_name: format!("ACC {code}"),
            account_category: cat,
            account_subcategory: None,
            is_total: total,
            is_section_header: false,
            parent_code: parent,
            formula: None,
            display_order: code,
            baseline_active: true,
            description: None,
        }
    }

    fn coa() -> Vec<chart_of_account::Model> {
        use AccountCategory::*;
        vec![
            coa_row(1999, Assets, None, true),
            coa_row(2100, Liabilities, None, false),
            coa_row(2101, Liabilities, Some(2100), false),
            coa_row(2200, Liabilities, None, false),
            coa_row(2301, Liabilities, Some(2300), false),
            coa_row(2300, Liabilities, None, false),
            coa_row(2999, Liabilities, None, true),
            coa_row(3101, Equity, Some(3100), false),
            coa_row(3999, Equity, None, true),
        ]
    }

    fn it(code: Option<i32>, value: f64, conf: f64, label: &str) -> ExtractedLineItem {
        ExtractedLineItem {
            account_code: code,
            account_name: None,
            month: 0,
            value: Some(value),
            confidence: conf,
            raw_label: label.into(),
        }
    }

    #[test]
    fn drops_grand_total_check_rows() {
        let items = vec![
            it(Some(1999), 100.0, 0.9, "Total Assets"),
            it(Some(3999), 100.0, 0.9, "Total Equity & Liabilities"),
        ];
        let (out, report) = sanitize(items, &coa());
        assert_eq!(out.len(), 1);
        assert_eq!(report.dropped_grand_totals, 1);
    }

    #[test]
    fn drops_current_and_non_current_subtotals_mapped_to_line_items() {
        let items = vec![
            it(Some(2100), 35_140_195.0, 0.9, "Total Current Liabilities"),
            it(Some(2101), 204_001_752.0, 0.9, "Members savings"),
            it(Some(2200), 10.0, 0.9, "Total Non-Current Assets"),
        ];
        let (out, report) = sanitize(items, &coa());
        assert_eq!(report.dropped_section_subtotals, 2);
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].account_code, Some(2101));
    }

    #[test]
    fn derives_missing_total_liabilities_from_assets_minus_equity() {
        let items = vec![
            it(Some(1999), 5_383_818.0, 1.0, "Total Assets"),
            it(Some(3999), -1_786_066.0, 0.9, "Total Equity"),
            it(None, 5_386_982.0, 0.0, "(unlabeled subtotal)"),
        ];
        let (out, report) = sanitize(items, &coa());
        assert_eq!(report.derived_totals, vec![2999]);
        let derived = out.iter().find(|i| i.account_code == Some(2999)).unwrap();
        assert_eq!(derived.value, Some(7_169_884.0));
    }

    #[test]
    fn does_not_derive_when_two_totals_are_missing() {
        let items = vec![it(Some(1999), 100.0, 1.0, "Total Assets")];
        let (_, report) = sanitize(items, &coa());
        assert!(report.derived_totals.is_empty());
    }

    #[test]
    fn keeps_real_total_codes_even_with_total_label() {
        let items = vec![it(Some(2999), 5.0, 0.9, "Total Current Liabilities")];
        let (out, report) = sanitize(items, &coa());
        assert_eq!(out.len(), 1);
        assert_eq!(report.dropped_section_subtotals, 0);
    }

    #[test]
    fn collapses_duplicate_total_codes_keeping_highest_confidence() {
        let items = vec![
            it(Some(1999), 500.0, 0.6, "Total Assets"),
            it(Some(1999), 500.0, 0.95, "TOTAL ASSETS"),
        ];
        let (out, report) = sanitize(items, &coa());
        assert_eq!(out.len(), 1);
        assert_eq!(out[0].confidence, 0.95);
        assert_eq!(report.collapsed_duplicate_totals, 1);
    }

    #[test]
    fn infers_unlabeled_liability_subtotal_excluding_parent_subtotals() {
        let items = vec![
            it(Some(2100), 1_879_545.0, 0.9, "Current liabilities"),
            it(Some(2101), 5_290_339.0, 0.9, "Non-current members' savings"),
            it(Some(2200), 1_802_844.0, 0.9, "Borrowings"),
            it(Some(2301), 76_701.0, 0.9, "Accounts payable"),
            it(None, 7_169_884.0, 0.7, "(unnamed subtotal row)"),
        ];
        let (out, report) = sanitize(items, &coa());
        assert_eq!(report.inferred_totals, vec![2999]);
        let total = out.iter().find(|i| i.account_code == Some(2999)).unwrap();
        assert_eq!(total.value, Some(7_169_884.0));
    }

    #[test]
    fn treats_a_purely_numeric_label_as_unlabeled() {
        let items = vec![
            it(Some(2101), 5_290_339.0, 0.9, "Members savings"),
            it(Some(2200), 1_802_844.0, 0.9, "Borrowings"),
            it(Some(2301), 76_701.0, 0.9, "Accounts payable"),
            it(None, 7_169_884.0, 0.0, "7169884"),
        ];
        let (out, report) = sanitize(items, &coa());
        assert_eq!(report.inferred_totals, vec![2999]);
        assert_eq!(out[3].account_code, Some(2999));
    }

    #[test]
    fn drops_rows_labeled_unlabeled_subtotal_that_match_nothing() {
        let items = vec![
            it(Some(2101), 100.0, 0.9, "Savings"),
            it(None, 5_386_982.0, 0.0, "(unlabeled subtotal)"),
        ];
        let (out, report) = sanitize(items, &coa());
        assert_eq!(report.dropped_unmatched_unlabeled, 1);
        assert_eq!(out.len(), 1);
    }

    #[test]
    fn drops_unlabeled_rows_that_match_no_total() {
        let items = vec![
            it(Some(2101), 100.0, 0.9, "Savings"),
            it(None, 999.0, 0.7, ""),
        ];
        let (out, report) = sanitize(items, &coa());
        assert!(report.inferred_totals.is_empty());
        assert_eq!(report.dropped_unmatched_unlabeled, 1);
        assert_eq!(out.len(), 1);
    }

    #[test]
    fn drops_a_subtotal_that_equals_the_sum_of_other_items() {
        let items = vec![
            it(Some(2100), 1_879_545.0, 0.85, "Current liabilities"),
            it(Some(2101), 5_290_339.0, 0.7, "Members' savings"),
            it(Some(2200), 1_802_844.0, 0.85, "Borrowings"),
            it(Some(2301), 76_701.0, 1.0, "Accounts payable"),
        ];
        let (out, report) = sanitize(items, &coa());
        assert_eq!(report.dropped_sum_subtotals, 1);
        assert!(out.iter().all(|i| i.account_code != Some(2100)));
        assert!(out.iter().any(|i| i.account_code == Some(2101)));
    }

    #[test]
    fn drops_a_line_item_that_duplicates_its_section_total() {
        let items = vec![
            it(Some(1999), 5_383_818.0, 1.0, "Total Assets"),
            it(Some(3999), -1_786_066.0, 0.9, "Total Equity"),
            it(
                Some(2100),
                7_169_884.0,
                0.6,
                "Current Liabilities + Members' Savings",
            ),
            it(Some(2200), 1_802_844.0, 0.9, "Borrowings"),
            it(Some(2301), 76_701.0, 0.9, "Accounts payable"),
        ];
        let (out, report) = sanitize(items, &coa());
        assert_eq!(report.dropped_total_duplicates, 1);
        assert!(out.iter().all(|i| i.account_code != Some(2100)));
        assert!(out.iter().any(|i| i.account_code == Some(2999)));
    }

    #[test]
    fn does_not_infer_for_labeled_unmapped_rows() {
        let items = vec![
            it(Some(2101), 100.0, 0.9, "Savings"),
            it(None, 100.0, 0.7, "Some unrelated line"),
        ];
        let (out, _) = sanitize(items, &coa());
        assert_eq!(out[1].account_code, None);
    }
}
