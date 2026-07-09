-- Migration 05: Extend cooperatives table with US2.1 profile fields
-- Source: docs/architecture.md §6.3
-- The cooperatives table was created as a stub in migration 02.
-- This migration ADDs the full profile columns required by US2.1.
-- Existing columns (keycloak_id, apex_id, display_name) are kept for backward compat.

-- ── Add profile columns ───────────────────────────────────────────────────────
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS keycloak_group_id     UUID;
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS apex_group_id         UUID;
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS federation_org_id    UUID;
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS name                 VARCHAR(255);
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS institution_type     cooperative_type;
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS reg_no               VARCHAR(30);
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS tin                  VARCHAR(20);
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS address              VARCHAR(255);
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS georeference         VARCHAR(100);
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS region              eswatini_region;
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS geographic_classif  urban_rural;
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS phone                VARCHAR(30);
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS sector              VARCHAR(50);
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS responsible_financial       UUID;
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS responsible_non_financial  UUID;
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS status               coop_status NOT NULL DEFAULT 'Active';
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS registered_on        DATE;
ALTER TABLE cooperatives ADD COLUMN IF NOT EXISTS accounting_year      accounting_year NOT NULL DEFAULT 'calendar';

-- ── Backfill name from display_name for existing rows ─────────────────────────
UPDATE cooperatives SET name = display_name WHERE name IS NULL AND display_name IS NOT NULL;

-- ── Make name NOT NULL after backfill ─────────────────────────────────────────
DO $$ BEGIN
    ALTER TABLE cooperatives ALTER COLUMN name SET NOT NULL;
EXCEPTION WHEN NOT_NULL_VIOLATION THEN
    RAISE NOTICE 'Skipping NOT NULL on name — existing NULL rows present';
END $$;

-- ── Unique constraints ───────────────────────────────────────────────────────
DO $$ BEGIN
    ALTER TABLE cooperatives ADD CONSTRAINT cooperatives_reg_no_unique UNIQUE (reg_no);
EXCEPTION WHEN duplicate_table THEN NULL;
             WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    ALTER TABLE cooperatives ADD CONSTRAINT cooperatives_keycloak_group_id_unique UNIQUE (keycloak_group_id);
EXCEPTION WHEN duplicate_table THEN NULL;
             WHEN duplicate_object THEN NULL; END $$;

-- ── FK: cooperatives.federation_org_id -> federations.id ──────────────────────
DO $$ BEGIN
    ALTER TABLE cooperatives
        ADD CONSTRAINT cooperatives_federation_org_id_fkey
        FOREIGN KEY (federation_org_id) REFERENCES federations(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;