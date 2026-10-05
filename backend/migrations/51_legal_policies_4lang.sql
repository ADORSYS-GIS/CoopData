-- Migration 51: Extend legal_policies to support 4 languages (en, fr, pt, ss)
-- and record the fingerprint of the published Markdown each version came from,
-- so publishing the same text twice never creates a new version.
ALTER TABLE legal_policies
    ADD COLUMN IF NOT EXISTS title_pt TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS title_ss TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS content_pt TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS content_ss TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS source_sha256 TEXT;
