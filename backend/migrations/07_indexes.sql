-- Migration 07: Indexes
-- Source: docs/architecture.md §6.11
-- Creates indexes for cooperatives, submissions, chart_of_accounts, and related tables

-- ── Cooperatives indexes ─────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_coop_region   ON cooperatives(region);
CREATE INDEX IF NOT EXISTS idx_coop_sector    ON cooperatives(sector);
CREATE INDEX IF NOT EXISTS idx_coop_apex      ON cooperatives(apex_id);
CREATE INDEX IF NOT EXISTS idx_coop_status    ON cooperatives(status);

-- ── Submissions indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_sub_coop     ON submissions(cooperative_id);
CREATE INDEX IF NOT EXISTS idx_sub_status   ON submissions(status);
CREATE INDEX IF NOT EXISTS idx_sub_tier     ON submissions(current_tier);
CREATE INDEX IF NOT EXISTS idx_sub_period   ON submissions(cooperative_id, reporting_year);

-- ── Submission reviews indexes ───────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_review_sub   ON submission_reviews(submission_id);
CREATE INDEX IF NOT EXISTS idx_review_tier ON submission_reviews(tier);

-- ── Uploaded files indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_uf_sub   ON uploaded_files(submission_id);

-- ── Extraction jobs indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_ej_sub     ON extraction_jobs(submission_id);
CREATE INDEX IF NOT EXISTS idx_ej_file    ON extraction_jobs(source_file_id);
CREATE INDEX IF NOT EXISTS idx_ej_status  ON extraction_jobs(status);

-- ── Chart of accounts indexes ─────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_coa_coop_type ON chart_of_accounts_coop_types(cooperative_type);
CREATE INDEX IF NOT EXISTS idx_coa_category  ON chart_of_accounts(account_category);
CREATE INDEX IF NOT EXISTS idx_coa_parent    ON chart_of_accounts(parent_code);

-- ── Account aliases indexes ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_aliases_label ON account_aliases(alias_label);

-- ── Audit logs indexes (supplement existing from migration 02) ────────────────
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_logs(resource_type, resource_keycloak_id);