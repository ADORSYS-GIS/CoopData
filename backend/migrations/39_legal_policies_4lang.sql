-- Migration 39: Extend legal_policies to support 4 languages (en, fr, pt, ss)
ALTER TABLE legal_policies
    ADD COLUMN IF NOT EXISTS title_pt TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS title_ss TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS content_pt TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS content_ss TEXT NOT NULL DEFAULT '';
