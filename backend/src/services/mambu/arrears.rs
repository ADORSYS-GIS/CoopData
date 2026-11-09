//! Loan arrears buckets of the statement (1202 to 1205), taken from the loan list.
//!
//! Mambu books every loan on its portfolio accounts, whatever its arrears, so the ledger
//! shows all loans as performing. The loan list knows the days in arrears of each loan,
//! but only as at the time of the sync, so the split is made for the current month only.

use rust_decimal::Decimal;

use crate::entities::enums::{DpdCategory, LoanStatus};
use crate::services::mambu::mapper::LedgerLine;
use crate::services::nf_excel_parser::LoanRecord;

const PERFORMING: i32 = 1201;
const NON_PERFORMING: i32 = 1205;
const BUCKETS: [(i32, DpdCategory); 4] = [
    (1202, DpdCategory::Days1To30),
    (1203, DpdCategory::Days31To60),
    (1204, DpdCategory::Days61To90),
    (NON_PERFORMING, DpdCategory::Days91Plus),
];

fn value_of(lines: &[LedgerLine], code: i32) -> Decimal {
    lines
        .iter()
        .find(|l| l.account_code == code)
        .map(|l| l.value)
        .unwrap_or_default()
}

fn set(lines: &mut Vec<LedgerLine>, code: i32, value: Decimal) {
    match lines.iter_mut().find(|l| l.account_code == code) {
        Some(line) => line.value = value,
        None if !value.is_zero() => lines.push(LedgerLine {
            account_code: code,
            value,
        }),
        None => {}
    }
}

/// Moves the principal of loans in arrears from the performing portfolio to its arrears
/// bucket. The loans past 90 days go to non-performing loans, which keep what the Mambu
/// ledger already classed there. The portfolio total does not change. Returns the amount
/// moved.
pub fn split_arrears(lines: &mut Vec<LedgerLine>, loans: &[LoanRecord]) -> Decimal {
    let performing = value_of(lines, PERFORMING);
    if performing <= Decimal::ZERO {
        return Decimal::ZERO;
    }
    let bucket_total = |category: &DpdCategory| -> Decimal {
        loans
            .iter()
            .filter(|l| {
                l.loan_status == LoanStatus::Arrears && l.days_past_due_category == *category
            })
            .map(|l| l.balance)
            .sum()
    };
    let mut additions: Vec<(i32, Decimal)> = Vec::new();
    for (code, category) in &BUCKETS {
        let mut amount = bucket_total(category);
        if *code == NON_PERFORMING {
            amount = (amount - value_of(lines, NON_PERFORMING)).max(Decimal::ZERO);
        }
        if amount > Decimal::ZERO {
            additions.push((*code, amount));
        }
    }
    let wanted: Decimal = additions.iter().map(|(_, a)| *a).sum();
    if wanted.is_zero() {
        return Decimal::ZERO;
    }
    let ratio = if wanted > performing {
        performing / wanted
    } else {
        Decimal::ONE
    };
    let mut moved = Decimal::ZERO;
    for (code, amount) in additions {
        let amount = (amount * ratio).round_dp(2);
        moved += amount;
        let current = value_of(lines, code);
        set(lines, code, current + amount);
    }
    set(lines, PERFORMING, performing - moved);
    moved
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::nf_excel_parser::LoanRecord;
    use rust_decimal::Decimal;

    fn loan(category: DpdCategory, status: LoanStatus, balance: i64) -> LoanRecord {
        LoanRecord {
            member_business_id: "M".into(),
            loan_id: "L".into(),
            loan_product_type: "Quick".into(),
            loan_start_date: chrono::NaiveDate::from_ymd_opt(2026, 1, 1).unwrap(),
            loan_maturity_date: chrono::NaiveDate::from_ymd_opt(2027, 1, 1).unwrap(),
            loan_status: status,
            borrower_type: "Individual".into(),
            youth_borrower_flag: false,
            women_borrower_flag: false,
            rural_borrower_flag: false,
            repayment_regularity: "Irregular".into(),
            days_past_due_category: category,
            missed_installments_count: 0,
            restructured_loan_flag: false,
            number_of_restructurings: 0,
            early_settlement_flag: false,
            multiple_loans_flag: false,
            large_borrower_flag: false,
            interest_rate: Decimal::ZERO,
            balance: Decimal::from(balance),
            loan_amount: Decimal::from(balance),
        }
    }

    fn line(code: i32, value: i64) -> LedgerLine {
        LedgerLine {
            account_code: code,
            value: Decimal::from(value),
        }
    }

    fn get(lines: &[LedgerLine], code: i32) -> Decimal {
        value_of(lines, code)
    }

    #[test]
    fn arrears_move_out_of_the_performing_portfolio_and_the_total_stays() {
        let mut lines = vec![line(1201, 1000), line(1205, 20)];
        let loans = vec![
            loan(DpdCategory::Zero, LoanStatus::Performing, 500),
            loan(DpdCategory::Days1To30, LoanStatus::Arrears, 300),
            loan(DpdCategory::Days31To60, LoanStatus::Arrears, 100),
            loan(DpdCategory::Days91Plus, LoanStatus::Arrears, 70),
        ];
        let before: Decimal = lines.iter().map(|l| l.value).sum();

        let moved = split_arrears(&mut lines, &loans);

        assert_eq!(get(&lines, 1202), Decimal::from(300));
        assert_eq!(get(&lines, 1203), Decimal::from(100));
        assert_eq!(
            get(&lines, 1205),
            Decimal::from(70),
            "ledger 20 plus 50 more"
        );
        assert_eq!(moved, Decimal::from(450));
        assert_eq!(get(&lines, 1201), Decimal::from(550));
        let after: Decimal = lines.iter().map(|l| l.value).sum();
        assert_eq!(before, after);
    }

    #[test]
    fn the_move_is_capped_by_the_performing_portfolio() {
        let mut lines = vec![line(1201, 100)];
        let loans = vec![loan(DpdCategory::Days1To30, LoanStatus::Arrears, 500)];
        split_arrears(&mut lines, &loans);
        assert_eq!(get(&lines, 1201), Decimal::ZERO);
        assert_eq!(get(&lines, 1202), Decimal::from(100));
    }

    #[test]
    fn nothing_changes_without_arrears_or_without_a_portfolio() {
        let mut lines = vec![line(1201, 100)];
        assert_eq!(split_arrears(&mut lines, &[]), Decimal::ZERO);
        assert_eq!(lines.len(), 1);
        let mut empty: Vec<LedgerLine> = Vec::new();
        let loans = vec![loan(DpdCategory::Days1To30, LoanStatus::Arrears, 5)];
        assert_eq!(split_arrears(&mut empty, &loans), Decimal::ZERO);
    }
}
