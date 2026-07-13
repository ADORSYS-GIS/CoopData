-- Submission sections tracking
-- Each submission has 5 sections: financial, members, savings, loans, fixed_deposits
-- Sections track per-section readiness before the whole submission can be submitted to apex

CREATE TABLE IF NOT EXISTS submission_sections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    section         VARCHAR(30) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(submission_id, section)
);

-- Valid section names: financial, members, savings, loans, fixed_deposits
-- Valid statuses: pending, in_progress, ready

CREATE INDEX IF NOT EXISTS idx_submission_sections_submission_id ON submission_sections(submission_id);

-- Down
DROP TABLE IF EXISTS submission_sections;