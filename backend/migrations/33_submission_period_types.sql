-- Migration 33: Dynamic Financial Submission Period Types
-- Adds period_type and period_value to submissions and assessments tables.

-- Create enum type for period_type (Postgres 13+ IF NOT EXISTS syntax)
CREATE TYPE IF NOT EXISTS period_type_enum AS ENUM ('YEARLY', 'QUARTERLY', 'MONTHLY', 'SEMI_ANNUAL');

-- Add period columns to submissions
ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS period_type period_type_enum NOT NULL DEFAULT 'YEARLY',
    ADD COLUMN IF NOT EXISTS period_value VARCHAR(20) NOT NULL DEFAULT '';

-- Add period columns to assessments
ALTER TABLE assessments
    ADD COLUMN IF NOT EXISTS period_type period_type_enum NOT NULL DEFAULT 'YEARLY',
    ADD COLUMN IF NOT EXISTS period_value VARCHAR(20) NOT NULL DEFAULT '';

-- Backfill period_value for existing rows with reporting_year / fiscal_year
UPDATE submissions 
SET period_value = reporting_year::text 
WHERE period_value = '' OR period_value IS NULL;

UPDATE assessments 
SET period_value = fiscal_year::text 
WHERE period_value = '' OR period_value IS NULL;

-- Unique constraint for submissions: ONE submission per cooperative per period (year + type + value)
CREATE UNIQUE INDEX IF NOT EXISTS uk_submissions_coop_period
    ON submissions (cooperative_id, reporting_year, period_type, period_value);

-- Unique constraint for assessments: ONE assessment per organization per period
CREATE UNIQUE INDEX IF NOT EXISTS uk_assessments_org_period
    ON assessments (organization_id, fiscal_year, period_type, period_value);
