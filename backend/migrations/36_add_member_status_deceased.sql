-- Add 'Deceased' to the member_status enum.
-- Idempotent: only adds the value if it does not already exist.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_enum
        WHERE enumlabel = 'Deceased'
          AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'member_status')
    ) THEN
        ALTER TYPE member_status ADD VALUE 'Deceased';
    END IF;
END $$;
