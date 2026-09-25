//! Regulator-style KPI engine for questionnaire (basic tier) cooperatives.
//!
//! Pure functions only: raw answers in, indicators / series out. The HTTP
//! handler owns scoping, currency conversion and period selection.

mod derived;
mod indicators;
mod inputs;
mod series;

#[cfg(test)]
mod tests;

pub use derived::{ratio_pct, Derived, INSTITUTIONAL_CAPITAL_MINIMUM_PCT, LIQUIDITY_MINIMUM_PCT};
pub use indicators::{build as build_indicators, with_previous};
pub use inputs::{merge_answers, Inputs};
pub use series::series_values;
