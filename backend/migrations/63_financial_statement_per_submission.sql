-- Migration 63: one financial statement per submission, not per year.
--
-- A cooperative that reports by quarters, halves or months files one financial
-- statement per period, so several statements share a reporting year. The
-- original one-statement-per-year key (08_financial_statements.sql) made the
-- second period of a year fail to save. Each submission keeps at most one
-- statement instead (a new upload or manual entry replaces the previous one).
-- Safe to re-run.

ALTER TABLE financial_statements
    DROP CONSTRAINT IF EXISTS financial_statements_cooperative_id_reporting_year_key;

CREATE UNIQUE INDEX IF NOT EXISTS uk_financial_statements_submission
    ON financial_statements (submission_id);
