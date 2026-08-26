-- Migration 31: Apex-Initiated Submissions
-- Adds attribution and exclusive-editor columns to submissions table.

-- Create enum type for created_by_role
DO $$ BEGIN
    CREATE TYPE submission_created_by_role AS ENUM ('cooperative', 'apex');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add attribution and ownership columns to submissions
ALTER TABLE submissions
    ADD COLUMN IF NOT EXISTS created_by_role submission_created_by_role NOT NULL DEFAULT 'cooperative',
    ADD COLUMN IF NOT EXISTS created_by_user_id UUID NULL,
    ADD COLUMN IF NOT EXISTS created_by_name TEXT NULL,
    ADD COLUMN IF NOT EXISTS edited_by UUID NULL,
    ADD COLUMN IF NOT EXISTS edited_by_name TEXT NULL;

-- Index for dashboard queries (who is currently editing)
CREATE INDEX IF NOT EXISTS idx_submissions_edited_by
    ON submissions (edited_by)
    WHERE status = 'draft';

-- Index for "one submission per coop per year" lookup (reinforces existing UNIQUE constraint)
CREATE INDEX IF NOT EXISTS idx_submissions_coop_year
    ON submissions (cooperative_id, reporting_year);
