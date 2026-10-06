-- Migration 50: Versioned legal policies (Terms, Privacy, Cookies, ...).
--
-- Each published version of a policy is a new row; earlier versions are never
-- changed. The text comes from frontend/public/locales/{lang}/legal/*.md and is
-- published with scripts/publish-legal.py, which writes the seeding migrations.
-- Idempotent, so databases that ran the earlier, mis-numbered version of this
-- migration accept it again unchanged.

CREATE TABLE IF NOT EXISTS legal_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id UUID NOT NULL,
    slug TEXT NOT NULL,
    title_en TEXT NOT NULL,
    title_fr TEXT NOT NULL,
    content_en TEXT NOT NULL,
    content_fr TEXT NOT NULL,
    version INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One row per policy version; also serves the "latest version per slug" lookup.
CREATE UNIQUE INDEX IF NOT EXISTS idx_legal_policies_slug_version
    ON legal_policies (slug, version DESC);
