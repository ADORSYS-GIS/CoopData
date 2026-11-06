-- Migration 68: closed months of the Mambu general ledger, added up per account, so a
-- sync only reads the recent months from Mambu after the first one.

CREATE TABLE IF NOT EXISTS mambu_ledger_cache (
    mambu_branch_id VARCHAR(64) PRIMARY KEY,
    cached_through DATE NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mambu_ledger_months (
    mambu_branch_id VARCHAR(64) NOT NULL,
    month_start DATE NOT NULL,
    gl_code VARCHAR(64) NOT NULL,
    account_type VARCHAR(16) NOT NULL,
    account_name TEXT,
    debit NUMERIC(20, 2) NOT NULL,
    credit NUMERIC(20, 2) NOT NULL,
    PRIMARY KEY (mambu_branch_id, month_start, gl_code)
);
