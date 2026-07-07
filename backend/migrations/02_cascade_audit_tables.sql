-- Migration 02: Cascade Audit Tables
-- Creates: federations, apexes, cooperatives, audit_logs
-- Alters: users (adds federation_id, apex_id, cooperative_id FK columns)
-- Indexes: keycloak_id columns for fast lookups in cascade deletion

-- ── Federations table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS federations (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keycloak_id     TEXT NOT NULL UNIQUE,
    display_name    TEXT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_federations_keycloak_id ON federations(keycloak_id);

-- ── Apexes table ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS apexes (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keycloak_id              TEXT NOT NULL UNIQUE,
    federation_id            UUID NOT NULL REFERENCES federations(id) ON DELETE CASCADE,
    organization_keycloak_id TEXT NOT NULL,
    display_name             TEXT NOT NULL,
    created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_apexes_keycloak_id ON apexes(keycloak_id);
CREATE INDEX IF NOT EXISTS idx_apexes_federation_id ON apexes(federation_id);

-- ── Cooperatives table ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cooperatives (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    keycloak_id  TEXT NOT NULL UNIQUE,
    apex_id      UUID NOT NULL REFERENCES apexes(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cooperatives_keycloak_id ON cooperatives(keycloak_id);
CREATE INDEX IF NOT EXISTS idx_cooperatives_apex_id ON cooperatives(apex_id);

-- ── Audit logs table ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS audit_logs (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_keycloak_id     TEXT NOT NULL,
    actor_id              UUID REFERENCES users(id) ON DELETE SET NULL,
    action                TEXT NOT NULL,
    resource_type         TEXT NOT NULL,
    resource_keycloak_id  TEXT,
    details               JSONB,
    ip_address            TEXT,
    user_agent            TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_keycloak_id ON audit_logs(actor_keycloak_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ── Alter users table: add FK columns ─────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS federation_id UUID REFERENCES federations(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS apex_id UUID REFERENCES apexes(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS cooperative_id UUID REFERENCES cooperatives(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_users_federation_id ON users(federation_id);
CREATE INDEX IF NOT EXISTS idx_users_apex_id ON users(apex_id);
CREATE INDEX IF NOT EXISTS idx_users_cooperative_id ON users(cooperative_id);