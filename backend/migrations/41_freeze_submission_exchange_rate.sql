-- Migration 41: freeze the exchange rate on each submission at approval time.
-- Analytics for an approved submission convert at the rate stored here, so a
-- figure re-checked later against the uploaded documents converts identically.
-- Drafts (rate_to_usd IS NULL) keep using the current exchange_rates row.

ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS rate_to_usd NUMERIC(18, 6),
    ADD COLUMN IF NOT EXISTS rate_effective_date DATE,
    ADD COLUMN IF NOT EXISTS rate_source TEXT;

ALTER TABLE exchange_rates
    ADD COLUMN IF NOT EXISTS effective_date DATE NOT NULL DEFAULT CURRENT_DATE,
    ADD COLUMN IF NOT EXISTS source_note TEXT;

CREATE TABLE IF NOT EXISTS exchange_rate_history (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    currency_code  currency NOT NULL,
    rate_to_usd    NUMERIC(18, 6) NOT NULL CHECK (rate_to_usd > 0),
    effective_date DATE NOT NULL,
    source_note    TEXT,
    changed_by     UUID REFERENCES users(id),
    changed_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exchange_rate_history_currency
    ON exchange_rate_history (currency_code, changed_at DESC);

INSERT INTO exchange_rate_history (currency_code, rate_to_usd, effective_date, source_note, changed_by, changed_at)
SELECT er.currency_code, er.rate_to_usd, er.effective_date,
       COALESCE(er.source_note, 'Initial placeholder rate — not an official rate'),
       er.updated_by, er.updated_at
FROM exchange_rates er
WHERE NOT EXISTS (SELECT 1 FROM exchange_rate_history h WHERE h.currency_code = er.currency_code);

UPDATE submissions s
SET rate_to_usd = er.rate_to_usd,
    rate_effective_date = er.effective_date,
    rate_source = COALESCE(er.source_note, 'Backfilled with the rate in force when migration 41 ran')
FROM financial_statements fs
JOIN exchange_rates er ON er.currency_code = fs.currency
WHERE fs.submission_id = s.id
  AND s.status = 'approved'
  AND s.rate_to_usd IS NULL;
