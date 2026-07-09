-- Migration 11: Remaining Indexes
-- Source: docs/architecture.md §6.11
-- Indexes for financial_statements, balance_sheet_line_items, non-financial, KPI, flags, audit

-- ── Financial statements indexes ──────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_fs_coop_period ON financial_statements(cooperative_id, reporting_year);

-- ── Balance sheet line items indexes ───────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_bsli_stmt            ON balance_sheet_line_items(financial_statement_id);
CREATE INDEX IF NOT EXISTS idx_bsli_cat             ON balance_sheet_line_items(account_category);
CREATE INDEX IF NOT EXISTS idx_bsli_code            ON balance_sheet_line_items(account_code);
CREATE INDEX IF NOT EXISTS idx_bsli_month           ON balance_sheet_line_items(financial_statement_id, month);
CREATE INDEX IF NOT EXISTS idx_bsli_stmt_cat        ON balance_sheet_line_items(financial_statement_id, account_category);
CREATE INDEX IF NOT EXISTS idx_bsli_stmt_code_month ON balance_sheet_line_items(financial_statement_id, account_code, month);

-- ── Non-financial indexes ──────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_members_coop     ON members(cooperative_id);
CREATE INDEX IF NOT EXISTS idx_savings_coop     ON savings_accounts(cooperative_id);
CREATE INDEX IF NOT EXISTS idx_savings_member   ON savings_accounts(member_id);
CREATE INDEX IF NOT EXISTS idx_loans_coop       ON loans(cooperative_id);
CREATE INDEX IF NOT EXISTS idx_loans_member     ON loans(member_id);
CREATE INDEX IF NOT EXISTS idx_loans_status     ON loans(loan_status);
CREATE INDEX IF NOT EXISTS idx_fd_coop          ON fixed_deposits(cooperative_id);

-- ── KPI indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_kpi_coop_period  ON computed_kpis(cooperative_id, reporting_period);
CREATE INDEX IF NOT EXISTS idx_kpi_name         ON computed_kpis(kpi_name);

-- ── Abnormality flags indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_flags_sub        ON abnormality_flags(submission_id);

-- ── Audit logs indexes (supplement existing) ───────────────────────────────────
-- audit_logs uses resource_type/resource_keycloak_id (see migration 02)
CREATE INDEX IF NOT EXISTS idx_audit_entity     ON audit_logs(resource_type, resource_keycloak_id);
CREATE INDEX IF NOT EXISTS idx_audit_date       ON audit_logs(created_at);