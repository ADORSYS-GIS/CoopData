-- Migration 64: Mambu synchronisation (Ministry-triggered)

ALTER TYPE urban_rural ADD VALUE IF NOT EXISTS 'Unknown';
ALTER TYPE submission_created_by_role ADD VALUE IF NOT EXISTS 'ministry';

CREATE TABLE IF NOT EXISTS mambu_branch_links (
    cooperative_id UUID PRIMARY KEY REFERENCES cooperatives(id) ON DELETE CASCADE,
    mambu_branch_id VARCHAR(64) NOT NULL UNIQUE,
    linked_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mambu_account_mappings (
    mambu_gl_code VARCHAR(64) PRIMARY KEY,
    coop_account_code INTEGER NOT NULL REFERENCES chart_of_accounts(account_code),
    sign SMALLINT NOT NULL DEFAULT 1 CHECK (sign IN (-1, 1)),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS mambu_product_mappings (
    mambu_product_id VARCHAR(64) NOT NULL,
    product_kind VARCHAR(16) NOT NULL CHECK (product_kind IN ('deposit', 'loan')),
    mapped_type VARCHAR(32) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (mambu_product_id, product_kind)
);

CREATE TABLE IF NOT EXISTS mambu_sync_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporting_year INTEGER NOT NULL,
    month SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
    status VARCHAR(16) NOT NULL DEFAULT 'running',
    started_by VARCHAR(255),
    total_saccos INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    finished_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_mambu_sync_runs_started ON mambu_sync_runs(started_at DESC);

CREATE TABLE IF NOT EXISTS mambu_sync_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES mambu_sync_runs(id) ON DELETE CASCADE,
    cooperative_id UUID REFERENCES cooperatives(id) ON DELETE SET NULL,
    mambu_branch_id VARCHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL DEFAULT 'pending',
    submission_id UUID,
    members INTEGER NOT NULL DEFAULT 0,
    savings_accounts INTEGER NOT NULL DEFAULT 0,
    loans INTEGER NOT NULL DEFAULT 0,
    fixed_deposits INTEGER NOT NULL DEFAULT 0,
    ledger_lines INTEGER NOT NULL DEFAULT 0,
    unmapped_ledger_accounts INTEGER NOT NULL DEFAULT 0,
    warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
    error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_mambu_sync_items_run ON mambu_sync_items(run_id);
