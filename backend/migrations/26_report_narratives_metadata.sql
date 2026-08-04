-- Migration 24: Add metadata to apexes/federations + ministry report narratives cache
-- Purpose: Store AI-generated narratives for apex/federation/ministry tiers

-- Add metadata JSONB column to apexes
ALTER TABLE apexes ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Add metadata JSONB column to federations
ALTER TABLE federations ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Ministry has no entity table; use a dedicated cache table keyed by year
CREATE TABLE IF NOT EXISTS ministry_report_narratives (
    reporting_year   INT PRIMARY KEY,
    narratives_json  JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
