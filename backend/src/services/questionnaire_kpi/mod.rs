//! Regulator-style KPI engine for questionnaire (basic tier) cooperatives.
//!
//! Pure functions only: raw answers in, indicators / series out. The HTTP
//! handler owns scoping, currency conversion and period selection.

mod coa;
mod derived;
mod indicators;
mod inputs;
mod year;

#[cfg(test)]
mod tests;

pub use coa::{build as build_coa_indicators, CoaBalances};
pub use derived::{ratio_pct, Derived, INSTITUTIONAL_CAPITAL_MINIMUM_PCT, LIQUIDITY_MINIMUM_PCT};
pub use indicators::{build as build_indicators, with_previous};
pub use inputs::{merge_answers, Inputs};
pub use year::merge_period_answers;
