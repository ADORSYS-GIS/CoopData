-- Migration 12: Alter region column from VARCHAR to eswatini_region enum
-- For existing databases where region was originally VARCHAR(50).
-- New databases get the correct type directly from migration 05.

-- First, remove any invalid region values (NULL is fine, column is nullable)
UPDATE cooperatives SET region = NULL WHERE region IS NOT NULL AND region NOT IN ('Hhohho', 'Lubombo', 'Manzini', 'Shiselweni');

-- Alter the column type
DO $$ BEGIN
    ALTER TABLE cooperatives
        ALTER COLUMN region TYPE eswatini_region
        USING region::eswatini_region;
EXCEPTION WHEN undefined_object THEN
    RAISE NOTICE 'eswatini_region type not yet created, running 03_enums.sql first';
END $$;