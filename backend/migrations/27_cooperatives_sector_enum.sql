-- Migration 27: Alter cooperatives.sector to cooperative_sector enum type

-- 1. Create the enum type if it does not exist
DO $$ BEGIN
    CREATE TYPE cooperative_sector AS ENUM (
        'agriculture',
        'finance',
        'housing',
        'transport',
        'manufacturing',
        'other'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Map and clean up existing VARCHAR values to lowercase enum equivalents
UPDATE cooperatives
SET sector = CASE
    WHEN LOWER(TRIM(sector)) IN ('financial', 'finance') THEN 'finance'
    WHEN LOWER(TRIM(sector)) IN ('agricultural', 'agriculture') THEN 'agriculture'
    WHEN LOWER(TRIM(sector)) = 'housing' THEN 'housing'
    WHEN LOWER(TRIM(sector)) = 'transport' THEN 'transport'
    WHEN LOWER(TRIM(sector)) = 'manufacturing' THEN 'manufacturing'
    ELSE 'other'
END
WHERE sector IS NOT NULL;

-- 3. Alter the column type on cooperatives table
ALTER TABLE cooperatives
    ALTER COLUMN sector TYPE cooperative_sector
    USING sector::cooperative_sector;
