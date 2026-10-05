-- 2024-xx-xx_create_legal_policies.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE legal_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Index for fast lookup of latest version per slug
CREATE UNIQUE INDEX idx_legal_policies_slug_version ON legal_policies (slug, version DESC);
