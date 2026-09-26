//! Named values that make up each dashboard chart, per period.

use std::collections::HashMap;

use super::derived::{
    ratio_pct, Derived, INSTITUTIONAL_CAPITAL_MINIMUM_PCT, LIQUIDITY_MINIMUM_PCT,
};
use super::inputs::Inputs;

/// Returns `series key -> (value name -> value)`; absent values are omitted.
pub fn series_values(i: &Inputs, d: &Derived) -> HashMap<&'static str, HashMap<&'static str, f64>> {
    let mut all: HashMap<&'static str, HashMap<&'static str, f64>> = HashMap::new();
    let mut put = |series: &'static str, name: &'static str, v: Option<f64>| {
        if let Some(v) = v.filter(|v| v.is_finite()) {
            all.entry(series).or_default().insert(name, v);
        }
    };

    put("asset_evolution", "total_assets", d.total_assets);
    put("savings_trend", "total_deposits", d.deposits);
    put("loan_portfolio", "gross_loans", d.gross_loans);

    put("par_trend", "par_gt_30_pct", d.par_pct(d.overdue_gt_30));
    put("par_trend", "par_gt_90_pct", d.par_pct(d.overdue_gt_90));
    put(
        "par_trend",
        "portfolio_at_risk_pct",
        d.par_pct(d.overdue_total),
    );

    let liq = d.liquidity_ratio_pct();
    if liq.is_some() {
        put("liquidity", "maintained_pct", liq);
        put("liquidity", "minimum_pct", Some(LIQUIDITY_MINIMUM_PCT));
        put(
            "liquidity",
            "gap_pct",
            liq.map(|v| LIQUIDITY_MINIMUM_PCT - v),
        );
    }

    put(
        "financial_structure",
        "earning_asset_ratio",
        ratio_pct(d.earning_assets, d.total_assets),
    );
    put(
        "financial_structure",
        "member_savings_ratio",
        ratio_pct(d.deposits, d.total_assets),
    );
    put(
        "financial_structure",
        "member_share_ratio",
        ratio_pct(
            i.has("share_capital").then_some(i.share_capital),
            d.total_assets,
        ),
    );
    put(
        "financial_structure",
        "borrowed_funds_ratio",
        ratio_pct(i.has("borrowed").then_some(i.borrowed), d.total_assets),
    );

    put("profitability", "net_income", d.net_income);

    let cap = d.institutional_capital_ratio_pct();
    if cap.is_some() {
        put("institutional_capital", "ratio_pct", cap);
        put(
            "institutional_capital",
            "minimum_pct",
            Some(INSTITUTIONAL_CAPITAL_MINIMUM_PCT),
        );
        put(
            "institutional_capital",
            "excess_pct",
            cap.map(|v| v - INSTITUTIONAL_CAPITAL_MINIMUM_PCT),
        );
    }
    all
}
