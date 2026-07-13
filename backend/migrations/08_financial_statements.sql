-- Migration 08: Financial Statements & Balance Sheet Line Items
-- Source: docs/architecture.md §6.6b, docs/databse-shema.md §8.5

CREATE TABLE IF NOT EXISTS financial_statements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id     UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  cooperative_id    UUID NOT NULL REFERENCES cooperatives(id),
  reporting_year    INTEGER NOT NULL,
  accounting_year   accounting_year NOT NULL DEFAULT 'calendar',
  currency          currency NOT NULL DEFAULT 'SZL',
  is_validated      BOOLEAN NOT NULL DEFAULT false,
  validation_errors JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cooperative_id, reporting_year)
);

CREATE TABLE IF NOT EXISTS balance_sheet_line_items (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  financial_statement_id  UUID NOT NULL REFERENCES financial_statements(id) ON DELETE CASCADE,
  account_code            INTEGER,
  account_name            VARCHAR(255) NOT NULL,
  account_category        account_category NOT NULL,
  account_subcategory     VARCHAR(100),
  month                   SMALLINT NOT NULL,
  value                   NUMERIC(15,2),
  ai_confidence           NUMERIC(4,3),
  ai_flagged              BOOLEAN NOT NULL DEFAULT false,
  manually_edited         BOOLEAN NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);