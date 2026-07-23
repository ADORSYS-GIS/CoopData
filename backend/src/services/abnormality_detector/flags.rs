use rust_decimal::Decimal;

use super::calculations::{flag, get_val, get_zero, pct, sum_codes, FlagOutput, ValuesMap};

fn d(n: Decimal) -> String {
    format!("{:.2}", n)
}

pub fn check_missing_required(required: &[i32], values: &ValuesMap) -> Vec<FlagOutput> {
    let mut flags = Vec::new();
    for &code in required {
        if !values.contains_key(&code) {
            flags.push(flag(
                &format!("REQ-{}", code),
                "high",
                format!(
                    "Required account code {} is missing from the financial statement.",
                    code
                ),
                Some(code.to_string()),
            ));
        }
    }
    flags
}

fn get_or_compute(v: &ValuesMap, code: i32) -> Decimal {
    if let Some(val) = get_val(v, code) {
        return val;
    }
    match code {
        1100 => sum_codes(v, &[1101, 1102, 1103, 1104]),
        1200 => sum_codes(v, &[1201, 1202, 1203, 1204, 1205]),
        1250 => sum_codes(v, &[1251, 1252]),
        1300 => {
            let dep = get_zero(v, 1304);
            let dep_val = if dep > Decimal::ZERO { -dep } else { dep };
            sum_codes(v, &[1301, 1302, 1303, 1305]) + dep_val
        }
        2100 => sum_codes(v, &[2101, 2102, 2103]),
        2200 => sum_codes(v, &[2201, 2202]),
        2300 => sum_codes(v, &[2301, 2302, 2303]),
        3100 => sum_codes(v, &[3101, 3102]),
        3200 => sum_codes(v, &[3201, 3202, 3203]),
        3300 => sum_codes(v, &[3301, 3302]),
        _ => Decimal::ZERO,
    }
}

fn compute_equity(v: &ValuesMap) -> Decimal {
    get_val(v, 3999).unwrap_or_else(|| {
        get_or_compute(v, 3100) + get_or_compute(v, 3200) + get_or_compute(v, 3300)
    })
}

pub fn run_critical_flags(v: &ValuesMap) -> Vec<FlagOutput> {
    let mut f = Vec::new();
    let total_equity = compute_equity(v);

    if let (Some(a), Some(l)) = (get_val(v, 1999), get_val(v, 2999)) {
        let e = if get_val(v, 3999).is_some() {
            get_zero(v, 3999)
        } else {
            total_equity
        };
        if e > Decimal::ZERO {
            let diff = (a - (l + e)).abs();
            let tol = (a.abs() * Decimal::new(5, 2)).max(Decimal::from(500));
            if diff > tol {
                f.push(flag("CRIT-001", "high",
                    format!("Accounting equation does not balance. Assets ({}) ≠ Liabilities ({}) + Equity ({}).", d(a), d(l), d(e)),
                    Some("1999".into())));
            }
        }
    }

    if let Some(a) = get_val(v, 1999) {
        let calc = get_or_compute(v, 1100)
            + get_or_compute(v, 1200)
            + get_or_compute(v, 1250)
            + get_or_compute(v, 1300);
        let tol = (a.abs() * Decimal::new(5, 2)).max(Decimal::from(500));
        if (a - calc).abs() > tol {
            f.push(flag(
                "CRIT-002",
                "medium",
                format!(
                    "Total Assets ({}) does not match sum of asset sub-categories ({}).",
                    d(a),
                    d(calc)
                ),
                Some("1999".into()),
            ));
        }
    }

    if let Some(l) = get_val(v, 2999) {
        let calc = get_or_compute(v, 2100) + get_or_compute(v, 2200) + get_or_compute(v, 2300);
        let tol = (l.abs() * Decimal::new(5, 2)).max(Decimal::from(500));
        if (l - calc).abs() > tol {
            f.push(flag(
                "CRIT-003",
                "medium",
                format!(
                    "Total Liabilities ({}) does not match sum of liability sub-categories ({}).",
                    d(l),
                    d(calc)
                ),
                Some("2999".into()),
            ));
        }
    }

    if let Some(e) = get_val(v, 3999) {
        let calc = get_or_compute(v, 3100) + get_or_compute(v, 3200) + get_or_compute(v, 3300);
        let tol = (e.abs() * Decimal::new(5, 2)).max(Decimal::from(500));
        if (e - calc).abs() > tol {
            f.push(flag(
                "CRIT-004",
                "medium",
                format!(
                    "Total Equity ({}) does not match sum of equity sub-categories ({}).",
                    d(e),
                    d(calc)
                ),
                Some("3999".into()),
            ));
        }
    }

    if let Some(a) = get_val(v, 1999) {
        if a < Decimal::ZERO {
            f.push(flag(
                "CRIT-005",
                "critical",
                "Total Assets is negative. This is impossible.".into(),
                Some("1999".into()),
            ));
        }
        if a == Decimal::ZERO {
            f.push(flag(
                "CRIT-007",
                "critical",
                "Total Assets is zero. This appears to be an empty or invalid financial statement."
                    .into(),
                Some("1999".into()),
            ));
        }
    } else {
        f.push(flag(
            "CRIT-008",
            "critical",
            "Total Assets is missing. This is a required field.".into(),
            Some("1999".into()),
        ));
    }

    if let Some(e) = get_val(v, 3999) {
        if e < Decimal::ZERO {
            f.push(flag(
                "CRIT-006",
                "critical",
                "Total Equity is negative. The cooperative is technically insolvent.".into(),
                Some("3999".into()),
            ));
        }
    } else {
        let computed = compute_equity(v);
        if computed > Decimal::ZERO {
            f.push(flag(
                "CRIT-010",
                "medium",
                "Total Equity (3999) is not explicitly provided. Computed from sub-components."
                    .into(),
                Some("3999".into()),
            ));
        } else if computed == Decimal::ZERO {
            f.push(flag(
                "CRIT-010",
                "medium",
                "Total Equity is missing and could not be computed from sub-components.".into(),
                Some("3999".into()),
            ));
        } else {
            f.push(flag("CRIT-006", "critical", "Total Equity is negative (computed from sub-components). The cooperative may be insolvent.".into(), Some("3999".into())));
        }
    }

    if get_val(v, 2999).is_none() {
        f.push(flag(
            "CRIT-009",
            "critical",
            "Total Liabilities is missing. This is a required field.".into(),
            Some("2999".into()),
        ));
    }

    f
}

pub fn run_high_flags(v: &ValuesMap) -> Vec<FlagOutput> {
    let mut f = Vec::new();
    let gross_loans = sum_codes(v, &[1201, 1202, 1203, 1204, 1205]);
    let deposits = sum_codes(v, &[2101, 2102, 2103]);
    let liquid = sum_codes(v, &[1101, 1102, 1103, 1104]);
    let total_assets = get_zero(v, 1999);
    let total_equity = compute_equity(v);
    let total_liab = get_zero(v, 2999);
    let total_income = sum_codes(v, &[4101, 4102, 4201]);
    let op_exp = sum_codes(v, &[5201, 5202, 5203, 5204]);
    let _provisions = sum_codes(v, &[1251, 1252]);
    let npl = get_zero(v, 1205);
    let retained = get_zero(v, 3301) + get_zero(v, 3302);
    let surplus = get_zero(v, 6999);

    if let Some(r) = pct(npl, gross_loans) {
        if r > Decimal::from(10) {
            f.push(flag(
                "HIGH-001",
                "medium",
                format!(
                    "NPLs are {}% of the total loan portfolio. Exceeds 10% threshold.",
                    d(r)
                ),
                Some("1205".into()),
            ));
        }
    }

    if let Some(r) = pct(get_zero(v, 1204) + get_zero(v, 1205), gross_loans) {
        if r > Decimal::from(5) {
            f.push(flag(
                "HIGH-002",
                "medium",
                format!("PAR 90+ is {}%. Exceeds 5% threshold.", d(r)),
                Some("1204".into()),
            ));
        }
    }

    if let Some(r) = pct(sum_codes(v, &[1202, 1203, 1204, 1205]), gross_loans) {
        if r > Decimal::from(10) {
            f.push(flag(
                "HIGH-003",
                "medium",
                format!("PAR 30+ is {}%. Exceeds 10% threshold.", d(r)),
                Some("1202".into()),
            ));
        }
    }

    if npl > Decimal::ZERO {
        let provision_abs = get_zero(v, 1252).abs();
        if let Some(r) = pct(provision_abs, npl) {
            if r < Decimal::from(50) {
                f.push(flag(
                    "HIGH-004",
                    "medium",
                    format!(
                        "Specific provision covers only {}% of NPLs. Regulatory minimum is 50%.",
                        d(r)
                    ),
                    Some("1252".into()),
                ));
            }
        }
    }

    if get_zero(v, 1252) == Decimal::ZERO && npl > Decimal::ZERO {
        f.push(flag(
            "HIGH-005",
            "medium",
            format!(
                "NPLs ({}) exist but no specific loan loss provision.",
                d(npl)
            ),
            Some("1252".into()),
        ));
    }

    if gross_loans < Decimal::ZERO {
        f.push(flag(
            "HIGH-006",
            "medium",
            "Total loan portfolio is negative. This is impossible.".into(),
            Some("1200".into()),
        ));
    }

    if let Some(r) = pct(gross_loans, deposits) {
        if r > Decimal::from(120) {
            f.push(flag(
                "HIGH-007",
                "medium",
                format!(
                    "Loans significantly exceed member deposits (LDR {}%). High leverage risk.",
                    d(r)
                ),
                Some("1200".into()),
            ));
        } else if r > Decimal::from(100) {
            f.push(flag(
                "HIGH-007",
                "medium",
                format!(
                    "Loans slightly exceed member deposits (LDR {}%). Monitor leverage.",
                    d(r)
                ),
                Some("1200".into()),
            ));
        }
    }

    let short_term_liab =
        get_zero(v, 2100) + get_zero(v, 2201) + get_zero(v, 2301) + get_zero(v, 2302);
    if let Some(r) = pct(liquid, short_term_liab) {
        if r < Decimal::from(30) {
            f.push(flag(
                "HIGH-008",
                "medium",
                format!(
                    "Liquid assets cover only {}% of short-term liabilities. Liquidity concern.",
                    d(r)
                ),
                Some("1100".into()),
            ));
        } else if r < Decimal::from(50) {
            f.push(flag(
                "HIGH-008",
                "medium",
                format!(
                    "Liquid assets cover {}% of short-term liabilities. Below 50% target.",
                    d(r)
                ),
                Some("1100".into()),
            ));
        }
    }

    if total_assets > Decimal::ZERO {
        let cash = sum_codes(v, &[1101, 1102, 1103]);
        if let Some(r) = pct(cash, total_assets) {
            if r < Decimal::from(2) {
                f.push(flag(
                    "HIGH-009",
                    "medium",
                    format!("Cash is only {}% of total assets. Dangerously low.", d(r)),
                    Some("1101".into()),
                ));
            }
            if r > Decimal::from(30) {
                f.push(flag(
                    "HIGH-010",
                    "medium",
                    format!("Cash is {}% of total assets. Unusually high.", d(r)),
                    Some("1101".into()),
                ));
            }
        }
        if let Some(r) = pct(liquid, total_assets) {
            if r < Decimal::from(10) {
                f.push(flag(
                    "HIGH-011",
                    "medium",
                    format!(
                        "Liquid assets are only {}% of total assets. Below 10% minimum.",
                        d(r)
                    ),
                    Some("1100".into()),
                ));
            }
        }
        if let Some(r) = pct(total_equity, total_assets) {
            if r < Decimal::from(10) {
                f.push(flag(
                    "HIGH-013",
                    "medium",
                    format!(
                        "Equity is only {}% of total assets. Below 10% minimum.",
                        d(r)
                    ),
                    Some("3999".into()),
                ));
            }
        }
    }

    if gross_loans > Decimal::ZERO {
        if let Some(r) = pct(total_equity, gross_loans) {
            if r < Decimal::from(8) {
                f.push(flag(
                    "HIGH-012",
                    "medium",
                    format!("CAR is {}%. Regulatory minimum is 8%.", d(r)),
                    Some("3999".into()),
                ));
            }
        }
    }

    if total_equity > Decimal::ZERO {
        let d2e = total_liab / total_equity;
        if d2e > Decimal::from(3) {
            f.push(flag(
                "HIGH-014",
                "medium",
                format!("Debt-to-Equity ratio is {}. Exceeds 3:1 threshold.", d(d2e)),
                Some("2999".into()),
            ));
        }
    }

    if get_zero(v, 3201) == Decimal::ZERO {
        f.push(flag(
            "HIGH-015",
            "medium",
            "Statutory reserve is zero. May be a regulatory violation.".into(),
            Some("3201".into()),
        ));
    }

    if surplus < Decimal::ZERO {
        f.push(flag(
            "HIGH-016",
            "medium",
            format!("Operating loss of {}. Investigate causes.", d(surplus)),
            Some("6999".into()),
        ));
    }

    if total_assets > Decimal::ZERO {
        if let Some(r) = pct(retained, total_assets) {
            if r < Decimal::ZERO {
                f.push(flag(
                    "HIGH-017",
                    "medium",
                    format!("Negative ROA ({}%).", d(r)),
                    Some("3302".into()),
                ));
            } else if r < Decimal::ONE {
                f.push(flag(
                    "HIGH-019",
                    "medium",
                    format!("Low profitability: ROA is only {}%. Below 1%.", d(r)),
                    Some("3302".into()),
                ));
            }
        }
    }

    if total_equity > Decimal::ZERO {
        if let Some(r) = pct(retained, total_equity) {
            if r < Decimal::ZERO {
                f.push(flag(
                    "HIGH-018",
                    "medium",
                    format!("Negative ROE ({}%).", d(r)),
                    Some("3302".into()),
                ));
            }
        }
    }

    if total_income > Decimal::ZERO {
        if let Some(r) = pct(op_exp, total_income) {
            if r > Decimal::from(80) {
                f.push(flag(
                    "HIGH-020",
                    "medium",
                    format!(
                        "Operating expenses consume {}% of income. Above 80% threshold.",
                        d(r)
                    ),
                    Some("5201".into()),
                ));
            }
        }
    }

    // HIGH-021 to HIGH-025: missing critical fields with correct IDs
    if !v.contains_key(&1101) {
        f.push(flag(
            "HIGH-021",
            "medium",
            "Cash on Hand (1101) is missing. This is a critical field for cash management.".into(),
            Some("1101".into()),
        ));
    }
    if !v.contains_key(&1102) {
        f.push(flag(
            "HIGH-022",
            "medium",
            "Cash at Bank - Current Accounts (1102) is missing. This is a critical field.".into(),
            Some("1102".into()),
        ));
    }
    if !v.contains_key(&1201) {
        f.push(flag("HIGH-023", "medium", "Performing Loan Portfolio (1201) is missing. This is essential for credit risk analysis.".into(), Some("1201".into())));
    }
    if !v.contains_key(&2101) {
        f.push(flag(
            "HIGH-024",
            "medium",
            "Voluntary Savings (2101) is missing. This is essential for funding analysis.".into(),
            Some("2101".into()),
        ));
    }
    if !v.contains_key(&3101) {
        f.push(flag(
            "HIGH-025",
            "medium",
            "Permanent Share Capital (3101) is missing. This is essential for capital analysis."
                .into(),
            Some("3101".into()),
        ));
    }

    f
}

pub fn run_medium_flags(v: &ValuesMap) -> Vec<FlagOutput> {
    let mut f = Vec::new();
    let gross_loans = sum_codes(v, &[1201, 1202, 1203, 1204, 1205]);
    let deposits = sum_codes(v, &[2101, 2102, 2103]);
    let liquid = sum_codes(v, &[1101, 1102, 1103, 1104]);
    let total_assets = get_zero(v, 1999);
    let total_equity = compute_equity(v);
    let total_liab = get_zero(v, 2999);
    let total_income = sum_codes(v, &[4101, 4102, 4201]);
    let op_exp = sum_codes(v, &[5201, 5202, 5203, 5204]);
    let provisions = sum_codes(v, &[1251, 1252]).abs();
    let npl = get_zero(v, 1205);
    let retained = get_zero(v, 3301) + get_zero(v, 3302);

    if let Some(r) = pct(npl, gross_loans) {
        if r > Decimal::from(5) && r <= Decimal::from(10) {
            f.push(flag(
                "MED-001",
                "medium",
                format!(
                    "NPLs are {}% of portfolio. Above 5% target but below 10% alert.",
                    d(r)
                ),
                Some("1205".into()),
            ));
        }
    }

    if let Some(r) = pct(sum_codes(v, &[1202, 1203, 1204, 1205]), gross_loans) {
        if r > Decimal::from(5) && r <= Decimal::from(10) {
            f.push(flag(
                "MED-002",
                "medium",
                format!("PAR 30 is {}%. Elevated but not critical.", d(r)),
                Some("1202".into()),
            ));
        }
    }

    if let Some(r) = pct(get_zero(v, 1201), gross_loans) {
        if r < Decimal::from(85) {
            f.push(flag(
                "MED-003",
                "medium",
                format!("Only {}% of loans are performing. Target is 85%+.", d(r)),
                Some("1201".into()),
            ));
        }
    }

    if let Some(r) = pct(provisions, gross_loans) {
        if r < Decimal::from(5) {
            f.push(flag(
                "MED-004",
                "medium",
                format!("Total provisions are only {}% of gross loans.", d(r)),
                Some("1250".into()),
            ));
        }
    }

    let short_term_liab =
        get_zero(v, 2100) + get_zero(v, 2201) + get_zero(v, 2301) + get_zero(v, 2302);
    if let Some(r) = pct(liquid, short_term_liab) {
        if r < Decimal::from(100) && r >= Decimal::from(50) {
            f.push(flag(
                "MED-005",
                "medium",
                format!(
                    "Liquid assets cover {}% of short-term liabilities. Borderline.",
                    d(r)
                ),
                Some("1100".into()),
            ));
        }
    }

    if total_assets > Decimal::ZERO {
        let cash = sum_codes(v, &[1101, 1102, 1103]);
        if let Some(r) = pct(cash, total_assets) {
            if r < Decimal::from(5) && r >= Decimal::from(2) {
                f.push(flag(
                    "MED-006",
                    "medium",
                    format!("Cash is {}% of assets. Below 5% target.", d(r)),
                    Some("1101".into()),
                ));
            }
        }
        if let Some(r) = pct(deposits, total_assets) {
            if r < Decimal::from(50) {
                f.push(flag(
                    "MED-007",
                    "medium",
                    format!(
                        "Member deposits are only {}% of assets. Consider growing deposit base.",
                        d(r)
                    ),
                    Some("2100".into()),
                ));
            }
        }
        if let Some(r) = pct(total_equity, total_assets) {
            if r < Decimal::from(15) && r >= Decimal::from(10) {
                f.push(flag(
                    "MED-009",
                    "medium",
                    format!(
                        "Equity is {}% of assets. Above 10% minimum but below 15% target.",
                        d(r)
                    ),
                    Some("3999".into()),
                ));
            }
        }
    }

    if gross_loans > Decimal::ZERO {
        if let Some(r) = pct(total_equity, gross_loans) {
            if r < Decimal::from(10) && r >= Decimal::from(8) {
                f.push(flag(
                    "MED-008",
                    "medium",
                    format!("CAR is {}%. Above 8% minimum but below 10% target.", d(r)),
                    Some("3999".into()),
                ));
            }
        }
    }

    if total_equity > Decimal::ZERO {
        let d2e = total_liab / total_equity;
        if d2e > Decimal::from(2) && d2e <= Decimal::from(3) {
            f.push(flag(
                "MED-010",
                "medium",
                format!(
                    "Debt-to-Equity is {}. Above 2:1 target but below 3:1 alert.",
                    d(d2e)
                ),
                Some("2999".into()),
            ));
        }
    }

    if total_assets > Decimal::ZERO {
        if let Some(r) = pct(retained, total_assets) {
            if r >= Decimal::new(5, 1) && r < Decimal::ONE {
                f.push(flag(
                    "MED-011",
                    "medium",
                    format!("ROA is {}%. Below 1% target but not negative.", d(r)),
                    Some("3302".into()),
                ));
            }
        }
    }

    if total_equity > Decimal::ZERO {
        if let Some(r) = pct(retained, total_equity) {
            if r >= Decimal::from(3) && r < Decimal::from(5) {
                f.push(flag(
                    "MED-012",
                    "medium",
                    format!("ROE is {}%. Below 5% target.", d(r)),
                    Some("3302".into()),
                ));
            }
        }
    }

    if total_income > Decimal::ZERO {
        if let Some(r) = pct(op_exp, total_income) {
            if r > Decimal::from(70) && r <= Decimal::from(80) {
                f.push(flag(
                    "MED-013",
                    "medium",
                    format!(
                        "Operating expenses are {}% of income. Above 70% target.",
                        d(r)
                    ),
                    Some("5201".into()),
                ));
            }
        }
    }

    if get_zero(v, 1101) == Decimal::ZERO && v.contains_key(&1101) {
        f.push(flag(
            "MED-015",
            "medium",
            "Cash on Hand is zero. Unusual — please verify.".into(),
            Some("1101".into()),
        ));
    }

    // MED-018: implausible ratios (> 1000%)
    let checks: &[(&str, Decimal, &str)] = &[
        (
            "Loan-to-Deposit",
            if deposits > Decimal::ZERO {
                gross_loans / deposits * Decimal::from(100)
            } else {
                Decimal::ZERO
            },
            "1200",
        ),
        (
            "Equity-to-Assets",
            if total_assets > Decimal::ZERO {
                total_equity / total_assets * Decimal::from(100)
            } else {
                Decimal::ZERO
            },
            "3999",
        ),
    ];
    for (name, ratio, field) in checks {
        if *ratio > Decimal::from(1000) {
            f.push(flag(
                "MED-018",
                "medium",
                format!(
                    "{} ratio is {:.2}%. This seems implausible. Please verify the data.",
                    name, ratio
                ),
                Some((*field).to_string()),
            ));
        }
    }

    f
}

pub fn run_low_flags(v: &ValuesMap) -> Vec<FlagOutput> {
    let mut f = Vec::new();

    // LOW-001: missing optional fields defaulted to 0
    for (code, name) in [
        (1103, "Cash at Bank (Savings)"),
        (1104, "Short-term Investments"),
        (1202, "Loans in Arrears 1-30 days"),
        (1203, "Loans in Arrears 31-60 days"),
        (1204, "Loans in Arrears 61-90 days"),
        (1305, "Intangible Assets"),
        (2202, "Long-term Borrowings"),
        (2303, "Deferred Income"),
        (3102, "Withdrawable Shares"),
        (3202, "General Reserve"),
        (3203, "Risk/Capital Adequacy Reserve"),
    ] {
        if !v.contains_key(&code) {
            f.push(flag(
                "LOW-001",
                "low",
                format!("{} ({}) was not provided. Defaulted to 0.", name, code),
                Some(code.to_string()),
            ));
        }
    }

    // LOW-005: all-clear — only fire if there are no other flags at all
    // (callers can suppress this if other flags exist — we emit it and let the caller filter)
    if v.is_empty() {
        f.push(flag(
            "LOW-005",
            "low",
            "No data found in the financial statement.".into(),
            None,
        ));
    }

    f
}

pub fn run_special_flags(v: &ValuesMap) -> Vec<FlagOutput> {
    let mut f = Vec::new();
    let liquid = sum_codes(v, &[1101, 1102, 1103, 1104]);
    let deposits = sum_codes(v, &[2101, 2102, 2103]);
    let gross_loans = sum_codes(v, &[1201, 1202, 1203, 1204, 1205]);
    let total_assets = get_zero(v, 1999);
    let total_income = sum_codes(v, &[4101, 4102, 4201]);
    let op_exp = sum_codes(v, &[5201, 5202, 5203, 5204]);
    let retained_earnings = get_zero(v, 3301);
    let current_surplus = get_zero(v, 3302);
    let _total_equity = compute_equity(v);
    let borrowings_st = get_zero(v, 2201);
    let borrowings_lt = get_zero(v, 2202);
    let interest_income = get_zero(v, 4101);
    let admin_costs = get_zero(v, 5202);

    if retained_earnings > Decimal::ZERO && current_surplus < Decimal::ZERO {
        f.push(flag(
            "SPEC-002",
            "medium",
            "Profit reversal: accumulated surplus but current year is loss-making.".into(),
            Some("3302".into()),
        ));
    }

    if retained_earnings < Decimal::ZERO && current_surplus > Decimal::ZERO {
        f.push(flag(
            "SPEC-003",
            "medium",
            "Recovery: current year surplus after previous accumulated losses.".into(),
            Some("3302".into()),
        ));
    }

    if deposits > Decimal::ZERO {
        if let Some(r) = pct(liquid, deposits) {
            if r < Decimal::from(30) && get_zero(v, 1205) > Decimal::ZERO {
                f.push(flag("SPEC-004", "medium", format!("Asset-liability mismatch: liquid assets cover only {}% of member deposits.", d(r)), Some("1100".into())));
            } else if r < Decimal::from(50) && get_zero(v, 1205) > Decimal::ZERO {
                f.push(flag(
                    "SPEC-004",
                    "medium",
                    format!(
                        "Liquid assets cover {}% of member deposits. Consider improving liquidity.",
                        d(r)
                    ),
                    Some("1100".into()),
                ));
            }
        }
    }

    let total_borrowings = borrowings_st + borrowings_lt;
    if total_borrowings > Decimal::ZERO {
        if let Some(r) = pct(borrowings_st, total_borrowings) {
            if r > Decimal::from(50) {
                f.push(flag(
                    "SPEC-005",
                    "medium",
                    format!(
                        "{}% of borrowings are short-term. Increases refinancing risk.",
                        d(r)
                    ),
                    Some("2201".into()),
                ));
            }
        }
    }

    if total_income > Decimal::ZERO {
        if let Some(r) = pct(interest_income, total_income) {
            if r < Decimal::from(60) {
                f.push(flag(
                    "SPEC-006",
                    "medium",
                    format!(
                        "Interest income is only {}% of total income. Review revenue composition.",
                        d(r)
                    ),
                    Some("4101".into()),
                ));
            }
        }
    }

    if op_exp > Decimal::ZERO {
        if let Some(r) = pct(admin_costs, op_exp) {
            if r > Decimal::from(40) {
                f.push(flag(
                    "SPEC-007",
                    "medium",
                    format!(
                        "Admin costs are {}% of operating expenses. Consider cost optimization.",
                        d(r)
                    ),
                    Some("5202".into()),
                ));
            }
        }
    }

    if retained_earnings < Decimal::ZERO {
        f.push(flag(
            "SPEC-008",
            "medium",
            format!(
                "Accumulated deficit of {}. Concern for long-term sustainability.",
                d(retained_earnings)
            ),
            Some("3301".into()),
        ));
    }

    if total_assets > Decimal::ZERO {
        if let Some(r) = pct(gross_loans, total_assets) {
            if r > Decimal::from(70) {
                f.push(flag(
                    "SPEC-009",
                    "medium",
                    format!(
                        "Loans represent {}% of total assets. High concentration risk.",
                        d(r)
                    ),
                    Some("1200".into()),
                ));
            }
        }
    }

    f
}
