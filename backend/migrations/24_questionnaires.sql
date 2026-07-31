-- Migration 24: Questionnaire Ingestion Tables
-- Creates: questionnaire_responses table, alters cooperatives and submissions tables

-- ── Extend cooperatives with tier ──────────────────────────────────────────
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS tier VARCHAR(30) NOT NULL DEFAULT 'standard';

-- ── Extend submissions with submission_method ──────────────────────────────
ALTER TABLE submissions ADD COLUMN IF NOT EXISTS submission_method VARCHAR(30) NOT NULL DEFAULT 'manual_grid';

-- ── questionnaire_responses ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS questionnaire_responses (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id      UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    cooperative_id     UUID NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
    questionnaire_type VARCHAR(50) NOT NULL, -- 'financial' or 'non_financial'
    reporting_year     INT NOT NULL,
    answers            JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_submission_questionnaire UNIQUE (submission_id),
    CONSTRAINT unique_coop_year_questionnaire UNIQUE (cooperative_id, reporting_year)
);
