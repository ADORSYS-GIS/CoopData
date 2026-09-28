-- Migration 44: switch the analytics/report display currency from USD to ZAR.
--
-- SZL (Eswatini Lilangeni) is pegged 1:1 to ZAR (South African Rand) under the
-- Common Monetary Area agreement, so the correct SZL:ZAR rate is 1.0 — not
-- the ~18.5 SZL:USD placeholder rate this replaces. Every configured and
-- frozen rate is reset to that 1:1 peg so past and future figures compute
-- and display the same way, in Rand, with no USD left anywhere in the
-- system.

ALTER TYPE currency RENAME VALUE 'USD' TO 'ZAR';

ALTER TABLE exchange_rates RENAME COLUMN rate_to_usd TO rate_to_zar;
ALTER TABLE exchange_rates
    RENAME CONSTRAINT exchange_rates_rate_to_usd_check TO exchange_rates_rate_to_zar_check;

ALTER TABLE exchange_rate_history RENAME COLUMN rate_to_usd TO rate_to_zar;
ALTER TABLE exchange_rate_history
    RENAME CONSTRAINT exchange_rate_history_rate_to_usd_check TO exchange_rate_history_rate_to_zar_check;

ALTER TABLE submissions RENAME COLUMN rate_to_usd TO rate_to_zar;

-- Re-set both configured rates to the correct 1:1 peg.
UPDATE exchange_rates
SET rate_to_zar = 1.0,
    source_note = 'SZL is pegged 1:1 to ZAR under the Common Monetary Area agreement',
    updated_at = now();

INSERT INTO exchange_rate_history (currency_code, rate_to_zar, effective_date, source_note, changed_at)
SELECT currency_code, 1.0, CURRENT_DATE,
       'Display currency switched from USD to ZAR; SZL is pegged 1:1 to ZAR',
       now()
FROM exchange_rates;

-- Re-freeze every already-approved submission's rate at the new 1:1 peg so
-- historical reports and future ones agree.
UPDATE submissions
SET rate_to_zar = 1.0,
    rate_effective_date = CURRENT_DATE,
    rate_source = 'Re-frozen at 1.0 when the display currency moved from USD to ZAR (SZL:ZAR peg)'
WHERE status = 'approved'
  AND rate_to_zar IS NOT NULL;
