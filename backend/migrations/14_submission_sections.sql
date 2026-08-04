-- Submission sections tracking
-- Each submission has 5 sections: financial, members, savings, loans, fixed_deposits, farm_coop
-- Sections track per-section readiness before the whole submission can be submitted to apex

CREATE TABLE IF NOT EXISTS submission_sections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    section         VARCHAR(30) NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(submission_id, section),
    CONSTRAINT chk_submission_sections_section CHECK (section IN ('financial', 'members', 'savings', 'loans', 'fixed_deposits', 'farm_coop')),
    CONSTRAINT chk_submission_sections_status CHECK (status IN ('pending', 'in_progress', 'ready'))
);

-- In case table already existed without these check constraints, add them dynamically:
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'submission_sections') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_submission_sections_section') THEN
      ALTER TABLE submission_sections ADD CONSTRAINT chk_submission_sections_section CHECK (section IN ('financial', 'members', 'savings', 'loans', 'fixed_deposits', 'farm_coop'));
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_submission_sections_status') THEN
      ALTER TABLE submission_sections ADD CONSTRAINT chk_submission_sections_status CHECK (status IN ('pending', 'in_progress', 'ready'));
    END IF;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_submission_sections_submission_id ON submission_sections(submission_id);
