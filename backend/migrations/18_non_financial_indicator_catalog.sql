-- Migration 18: Non-Financial Indicator Catalog & Entries
-- Source: backend/src/entities/non_financial_indicator_catalog.rs
-- Source: backend/src/entities/non_financial_indicator_entry.rs

-- ── Enum: Indicator Data Type ─────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE indicator_data_type AS ENUM ('number', 'text', 'boolean');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Table: Non-Financial Indicator Catalog ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS non_financial_indicator_catalog (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    indicator_name  VARCHAR(100) NOT NULL,
    display_name    VARCHAR(255) NOT NULL,
    description     TEXT,
    data_type       indicator_data_type NOT NULL,
    coop_type       VARCHAR(50),
    is_required     BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (indicator_name)
);

-- ── Table: Non-Financial Indicator Entries (per-submission values) ─────────────
CREATE TABLE IF NOT EXISTS non_financial_indicator_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    catalog_id      UUID NOT NULL REFERENCES non_financial_indicator_catalog(id) ON DELETE RESTRICT,
    value_numeric   NUMERIC(15,2),
    value_text      TEXT,
    value_boolean   BOOLEAN,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_indicator_entries_submission
    ON non_financial_indicator_entries(submission_id);
CREATE INDEX IF NOT EXISTS idx_indicator_entries_catalog
    ON non_financial_indicator_entries(catalog_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_indicator_entries_unique
    ON non_financial_indicator_entries(submission_id, catalog_id);
