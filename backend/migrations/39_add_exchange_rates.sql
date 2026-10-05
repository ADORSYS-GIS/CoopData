-- Migration 39: Exchange rates for USD-normalized analytics display
-- Fixed, admin-configurable rates (not live FX) — analytics dashboards
-- convert every native-currency figure to USD using these before display,
-- while the original native amount + currency stay available (via the
-- source financial_statements.currency / balance_sheet_line_items) for
-- audit trace-back to the uploaded document.

CREATE TABLE IF NOT EXISTS exchange_rates (
    currency_code   currency PRIMARY KEY,
    rate_to_usd     NUMERIC(18, 6) NOT NULL CHECK (rate_to_usd > 0),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID REFERENCES users(id)
);

-- Seed identity rate for USD, and a placeholder SZL rate that MUST be
-- confirmed/updated by an administrator — it is not a live/authoritative
-- market rate. The admin exchange-rate settings page surfaces
-- updated_at/updated_by prominently for exactly this reason.
INSERT INTO exchange_rates (currency_code, rate_to_usd)
VALUES ('USD', 1.0), ('SZL', 18.5)
ON CONFLICT (currency_code) DO NOTHING;
