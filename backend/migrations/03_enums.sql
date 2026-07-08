-- Migration 03: PostgreSQL Enum Types
-- Creates all 16 enum types used across the CoopData schema.
-- Source: docs/database-schema.md §4, docs/architecture.md §6

-- ── Submission lifecycle ─────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE submission_status AS ENUM (
        'draft', 'submitted', 'in_review', 'approved', 'rejected',
        'returned', 'escalated', 'withdrawn', 'archived',
        'synced', 'sync_failed', 'needs_correction'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE review_tier AS ENUM ('cooperative', 'apex', 'federation', 'ministry');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE review_action AS ENUM (
        'approve', 'reject', 'return', 'escalate', 'comment', 'request_info'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Chart of accounts ─────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE account_category AS ENUM (
        'assets', 'liabilities', 'equity', 'income', 'expenses', 'surplus'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Cooperative profile ───────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE cooperative_type AS ENUM (
        'sacco', 'multipurpose', 'farm', 'housing', 'transport', 'finance', 'other'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE accounting_year AS ENUM ('calendar', 'fiscal');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE coop_status AS ENUM ('Active', 'Inactive', 'Suspended');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE urban_rural AS ENUM ('Urban', 'Rural');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE eswatini_region AS ENUM ('Hhohho', 'Lubombo', 'Manzini', 'Shiselweni');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Currency ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE currency AS ENUM ('SZL', 'USD');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Member demographics ───────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE member_status AS ENUM ('Active', 'Dormant', 'Exited');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE gender AS ENUM ('Male', 'Female', 'Other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE age_group AS ENUM ('<18', '18-35', '36-50', '50+');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Savings accounts ──────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE account_type AS ENUM ('Voluntary', 'Mandatory', 'Fixed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Loans ─────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE loan_status AS ENUM (
        'Performing', 'Arrears', 'Restructured', 'WrittenOff'
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE dpd_category AS ENUM ('0', '1-30', '31-60', '61-90', '91+');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Fixed deposits ────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE fd_status AS ENUM ('Active', 'Matured', 'Withdrawn', 'RolledOver');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;