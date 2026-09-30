-- Migration 46: remove the exchange-rate feature entirely.
--
-- Per product decision, the platform uses only the native currency (SZL) and
-- never converts a figure. The exchange-rate tables and the per-submission
-- frozen-rate columns are no longer referenced by any code, so they are
-- dropped rather than left dormant.

ALTER TABLE submissions
    DROP COLUMN IF EXISTS rate_to_zar,
    DROP COLUMN IF EXISTS rate_effective_date,
    DROP COLUMN IF EXISTS rate_source;

DROP TABLE IF EXISTS exchange_rate_history;
DROP TABLE IF EXISTS exchange_rates;
