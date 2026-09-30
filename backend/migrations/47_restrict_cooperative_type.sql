-- Migration 47: restrict cooperative_type to sacco / multipurpose only.
-- Cooperative creation now only offers these two types. Existing rows of the
-- dropped types are remapped rather than deleted: 'finance' -> 'sacco' (it is
-- a financial-services variant of SACCO); 'farm', 'housing', 'transport',
-- 'other' -> 'multipurpose' (diverse-activity cooperatives). Idempotent.

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_type t
        JOIN pg_enum e ON e.enumtypid = t.oid
        WHERE t.typname = 'cooperative_type' AND e.enumlabel IN
            ('farm', 'housing', 'transport', 'finance', 'other')
    ) THEN
        -- ── 1. Remap cooperatives.institution_type ───────────────────────────
        UPDATE cooperatives
        SET institution_type = 'sacco'::cooperative_type
        WHERE institution_type::text = 'finance';

        UPDATE cooperatives
        SET institution_type = 'multipurpose'::cooperative_type
        WHERE institution_type::text IN ('farm', 'housing', 'transport', 'other');

        -- ── 2. chart_of_accounts_coop_types is a flat/uniform seed (identical
        --      is_required/is_active per account across every type) — the
        --      dropped-type rows are redundant duplicates of the sacco /
        --      multipurpose rows, so they are simply removed. ─────────────────
        DELETE FROM chart_of_accounts_coop_types
        WHERE cooperative_type::text IN ('farm', 'housing', 'transport', 'finance', 'other');

        -- ── 3. Narrow the enum: rename, recreate with 2 values, retype columns ─
        ALTER TYPE cooperative_type RENAME TO cooperative_type_old;

        CREATE TYPE cooperative_type AS ENUM ('sacco', 'multipurpose');

        ALTER TABLE cooperatives
            ALTER COLUMN institution_type TYPE cooperative_type
            USING institution_type::text::cooperative_type;

        ALTER TABLE chart_of_accounts_coop_types
            ALTER COLUMN cooperative_type TYPE cooperative_type
            USING cooperative_type::text::cooperative_type;

        DROP TYPE cooperative_type_old;
    END IF;
END $$;
