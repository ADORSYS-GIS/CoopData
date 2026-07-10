use rust_decimal::Decimal;
use uuid::Uuid;

use crate::entities::abnormality_flag::ActiveModel as FlagModel;
use crate::entities::balance_sheet_line_item::Model as LineItem;
use crate::entities::chart_of_account::Model as CoaEntry;
use crate::error::AppResult;
use crate::repositories::{AbnormalityFlagRepository, BalanceSheetLineItemRepository};
use sea_orm::Set;

pub struct AbnormalityDetector {
    pub line_item_repo: BalanceSheetLineItemRepository,
    pub flag_repo: AbnormalityFlagRepository,
}

impl AbnormalityDetector {
    pub fn new(
        line_item_repo: BalanceSheetLineItemRepository,
        flag_repo: AbnormalityFlagRepository,
    ) -> Self {
        Self {
            line_item_repo,
            flag_repo,
        }
    }

    pub async fn run(
        &self,
        submission_id: Uuid,
        cooperative_id: Uuid,
        financial_statement_id: Uuid,
        coa: &[CoaEntry],
    ) -> AppResult<(Vec<serde_json::Value>, Vec<serde_json::Value>)> {
        let line_items = self
            .line_item_repo
            .find_by_financial_statement(financial_statement_id)
            .await?;

        // Clear previous flags for this submission
        self.flag_repo.delete_by_submission(submission_id).await?;

        let mut errors: Vec<serde_json::Value> = vec![];
        let mut warnings: Vec<serde_json::Value> = vec![];
        let mut flag_models: Vec<FlagModel> = vec![];

        let val_of = |code: i32| -> Decimal {
            line_items
                .iter()
                .filter(|li| li.account_code == Some(code) && li.month == 0)
                .filter_map(|li| li.value)
                .fold(Decimal::ZERO, |acc, v| acc + v)
        };

        let tolerance = Decimal::new(1, 0); // ±1.00

        // ── 1. Balance identity: Assets = Liabilities + Equity ─────────────
        let assets = val_of(1999);
        let liabilities = val_of(2999);
        let equity = val_of(3999);
        let diff = (assets - liabilities - equity).abs();
        if diff > tolerance
            && (assets != Decimal::ZERO || liabilities != Decimal::ZERO || equity != Decimal::ZERO)
        {
            let msg =
                format!("Assets ({assets}) ≠ Liabilities ({liabilities}) + Equity ({equity})");
            errors.push(
                serde_json::json!({"rule":"BALANCE_UNBALANCED","message":msg,"severity":"error"}),
            );
            flag_models.push(make_flag(
                submission_id,
                cooperative_id,
                "BALANCE_UNBALANCED",
                "error",
                &msg,
                None,
            ));
        }

        // ── 2. Roll-up reconciliation for formula accounts ──────────────────
        for coa_entry in coa.iter().filter(|c| c.formula.is_some()) {
            let formula = coa_entry.formula.as_deref().unwrap_or("");

            // Extract the component codes from the formula
            let formula_codes = parse_formula_codes(formula);

            // Only validate formula if ALL component codes exist as line items.
            // If any code is missing from the extracted items, the formula can't be
            // reliably checked — it's a missing-extraction issue, not a real mismatch.
            let all_codes_present = formula_codes.iter().all(|&c| {
                line_items
                    .iter()
                    .any(|li| li.account_code == Some(c) && li.month == 0)
            });

            if !all_codes_present {
                continue;
            }

            if let Some(expected) = compute_formula(formula, &line_items) {
                let stored = val_of(coa_entry.account_code);
                if stored != Decimal::ZERO && (stored - expected).abs() > tolerance {
                    let msg = format!(
                        "Account {} ({}) stored={stored} but formula {formula} computes {expected}",
                        coa_entry.account_code, coa_entry.account_name
                    );
                    errors.push(serde_json::json!({"rule":"TOTAL_MISMATCH","message":msg,"severity":"error","field_ref":coa_entry.account_code.to_string()}));
                    flag_models.push(make_flag(
                        submission_id,
                        cooperative_id,
                        "TOTAL_MISMATCH",
                        "error",
                        &msg,
                        Some(&coa_entry.account_code.to_string()),
                    ));
                }
            }
        }

        // ── 3. Low extraction confidence ────────────────────────────────────
        let low_conf: Vec<&LineItem> = line_items
            .iter()
            .filter(|li| {
                li.ai_confidence
                    .map(|c| c < Decimal::new(6, 1))
                    .unwrap_or(false)
            })
            .collect();
        if !low_conf.is_empty() {
            let msg = format!(
                "{} line item(s) have AI confidence below 0.6",
                low_conf.len()
            );
            warnings.push(serde_json::json!({"rule":"LOW_EXTRACTION_CONFIDENCE","message":msg,"severity":"warning"}));
            flag_models.push(make_flag(
                submission_id,
                cooperative_id,
                "LOW_EXTRACTION_CONFIDENCE",
                "warning",
                &msg,
                None,
            ));
        }

        // ── 5. Portfolio sanity: loans ≤ total assets ───────────────────────
        let loans: Decimal = [1201i32, 1202, 1203, 1204, 1205]
            .iter()
            .map(|&c| val_of(c))
            .fold(Decimal::ZERO, |a, v| a + v);
        if assets > Decimal::ZERO && loans > assets {
            let msg = format!("Total loans ({loans}) exceed total assets ({assets})");
            warnings.push(
                serde_json::json!({"rule":"PORTFOLIO_OVER_100","message":msg,"severity":"warning"}),
            );
            flag_models.push(make_flag(
                submission_id,
                cooperative_id,
                "PORTFOLIO_OVER_100",
                "warning",
                &msg,
                None,
            ));
        }

        self.flag_repo.bulk_create(flag_models).await?;
        Ok((errors, warnings))
    }
}

fn make_flag(
    submission_id: Uuid,
    cooperative_id: Uuid,
    rule_id: &str,
    severity: &str,
    message: &str,
    field_ref: Option<&str>,
) -> FlagModel {
    FlagModel {
        id: Set(Uuid::new_v4()),
        submission_id: Set(submission_id),
        cooperative_id: Set(cooperative_id),
        rule_id: Set(rule_id.to_string()),
        severity: Set(severity.to_string()),
        message: Set(message.to_string()),
        field_ref: Set(field_ref.map(String::from)),
        created_at: Set(chrono::Utc::now()),
    }
}

/// Extract account codes from a formula string like "1101+1102-1250" → [1101, 1102, 1250]
fn parse_formula_codes(formula: &str) -> Vec<i32> {
    let mut codes = Vec::new();
    let mut current = String::new();
    for ch in formula.chars().chain(std::iter::once('+')) {
        if ch == '+' || ch == '-' {
            if let Ok(code) = current.trim().parse::<i32>() {
                codes.push(code);
            }
            current.clear();
        } else {
            current.push(ch);
        }
    }
    codes
}

/// Parse simple formula strings like "1101+1102-1250" and compute value from line_items.
fn compute_formula(formula: &str, items: &[LineItem]) -> Option<Decimal> {
    let val_of_items = |code: i32| -> Decimal {
        items
            .iter()
            .filter(|li| li.account_code == Some(code) && li.month == 0)
            .filter_map(|li| li.value)
            .fold(Decimal::ZERO, |acc, v| acc + v)
    };

    let mut result = Decimal::ZERO;
    let mut sign = 1i32;
    let mut current = String::new();

    for ch in formula.chars().chain(std::iter::once('+')) {
        if ch == '+' || ch == '-' {
            if let Ok(code) = current.trim().parse::<i32>() {
                let v = val_of_items(code);
                if sign > 0 {
                    result += v;
                } else {
                    result -= v;
                }
            }
            current.clear();
            sign = if ch == '-' { -1 } else { 1 };
        } else {
            current.push(ch);
        }
    }
    Some(result)
}
