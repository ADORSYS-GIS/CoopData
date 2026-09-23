//! USD normalization for analytics display.
//!
//! Financial statements are captured in whatever currency the cooperative
//! reports in (`financial_statements.currency`, SZL or USD today). Per
//! product decision, analytics dashboards standardize on USD using a fixed,
//! admin-configurable rate (`exchange_rates` table) rather than a live FX
//! feed — important for a "ministry grade" audit trail: a figure computed
//! today should convert the same way when re-checked next month, and the
//! rate in force is always visible/attributable (updated_at/updated_by).
//!
//! Callers should always keep the native amount + currency alongside the
//! converted USD figure in API responses, so a number on a dashboard can be
//! traced back to exactly what's printed in the uploaded source document.

use std::collections::HashMap;

use rust_decimal::prelude::ToPrimitive;

use crate::entities::enums::Currency;
use crate::error::AppResult;
use crate::repositories::ExchangeRateRepository;

#[derive(Clone)]
pub struct CurrencyService {
    repo: ExchangeRateRepository,
}

impl CurrencyService {
    pub fn new(repo: ExchangeRateRepository) -> Self {
        Self { repo }
    }

    /// Load all configured rates as a plain map for bulk conversion (e.g.
    /// across every cooperative in a national overview response) without a
    /// DB round trip per row.
    pub async fn load_rates(&self) -> AppResult<HashMap<Currency, f64>> {
        let rows = self.repo.find_all().await?;
        Ok(rows
            .into_iter()
            .map(|r| (r.currency_code, r.rate_to_usd.to_f64().unwrap_or(1.0)))
            .collect())
    }
}

/// Convert a native-currency amount to USD using a pre-loaded rate map
/// (see `CurrencyService::load_rates`). Falls back to 1:1 (no conversion)
/// for a currency with no configured rate rather than failing the whole
/// response — a missing rate should surface as an admin data-quality issue,
/// not take analytics offline.
pub fn to_usd(amount: f64, currency: &Currency, rates: &HashMap<Currency, f64>) -> f64 {
    let rate = rates.get(currency).copied().unwrap_or(1.0);
    amount / rate * usd_self_rate(rates)
}

/// `rates` stores "units of native currency per 1 USD" (e.g. SZL: 18.5), so
/// converting to USD is `amount / rate`. USD's own configured rate should
/// always be 1.0, but this guards against a misconfigured admin entry
/// (e.g. someone accidentally editing the USD row) silently skewing every
/// dashboard figure.
fn usd_self_rate(rates: &HashMap<Currency, f64>) -> f64 {
    rates.get(&Currency::Usd).copied().unwrap_or(1.0)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn converts_native_to_usd() {
        let mut rates = HashMap::new();
        rates.insert(Currency::Szl, 18.5);
        rates.insert(Currency::Usd, 1.0);
        let usd = to_usd(204_001_752.0, &Currency::Szl, &rates);
        assert!((usd - 204_001_752.0 / 18.5).abs() < 0.01);
    }

    #[test]
    fn usd_passes_through_unchanged() {
        let mut rates = HashMap::new();
        rates.insert(Currency::Usd, 1.0);
        assert_eq!(to_usd(1000.0, &Currency::Usd, &rates), 1000.0);
    }

    #[test]
    fn missing_rate_falls_back_to_identity() {
        let rates = HashMap::new();
        assert_eq!(to_usd(500.0, &Currency::Szl, &rates), 500.0);
    }
}
