-- Migration 06: Submission Envelope Tables
-- Source: docs/architecture.md §6.4, §6.5, §6.7
-- Creates: submissions, submission_reviews, uploaded_files, extraction_jobs

-- ── submissions ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS submissions (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reference          VARCHAR(20) UNIQUE,
    cooperative_id    UUID NOT NULL REFERENCES cooperatives(id) ON DELETE CASCADE,
    reporting_year    INT NOT NULL,
    status            submission_status NOT NULL DEFAULT 'draft',
    current_tier      review_tier NOT NULL DEFAULT 'cooperative',
    submitted_by      UUID,
    submitted_at      TIMESTAMPTZ,
    last_reviewed_by  UUID,
    last_reviewed_at  TIMESTAMPTZ,
    rejection_reason  TEXT,
    priority          VARCHAR(20) NOT NULL DEFAULT 'Routine',
    metadata          JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (cooperative_id, reporting_year)
);

-- ── submission_reviews ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS submission_reviews (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    tier            review_tier NOT NULL,
    reviewer_id     UUID,
    action          review_action NOT NULL,
    comment         TEXT,
    target_tier     review_tier,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── uploaded_files ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS uploaded_files (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    original_name   VARCHAR(255) NOT NULL,
    mime_type       VARCHAR(100),
    storage_key     TEXT NOT NULL,
    size_bytes      BIGINT,
    uploaded_by     UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── extraction_jobs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS extraction_jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    submission_id   UUID NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
    source_file_id  UUID NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    engine          VARCHAR(30),
    raw_text        TEXT,
    extracted_json  JSONB,
    confidence      NUMERIC(4,3),
    error_message   TEXT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);