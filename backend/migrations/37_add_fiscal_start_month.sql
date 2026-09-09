-- Add fiscal_start_month to submissions.
-- The month (1-12) in which the fiscal year / Q1 begins. Defaults to 1 (January).
ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS fiscal_start_month INTEGER NOT NULL DEFAULT 1;
