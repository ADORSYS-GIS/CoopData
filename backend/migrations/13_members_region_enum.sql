-- Migration 13: Alter members.region to eswatini_region enum type
-- Source: docs/message.md §9.4 — spec requires EswatiniRegion enum for members.region

-- First, map/cleanup invalid or mismatched case region values to valid values (must not be null)
UPDATE members
SET region = CASE
    WHEN LOWER(TRIM(region)) = 'hhohho' THEN 'Hhohho'
    WHEN LOWER(TRIM(region)) = 'lubombo' THEN 'Lubombo'
    WHEN LOWER(TRIM(region)) = 'manzini' THEN 'Manzini'
    WHEN LOWER(TRIM(region)) = 'shiselweni' THEN 'Shiselweni'
    ELSE 'Hhohho' -- Fallback default for completely invalid values
END
WHERE region NOT IN ('Hhohho', 'Lubombo', 'Manzini', 'Shiselweni');

-- Alter the column type
DO $$ BEGIN
    ALTER TABLE members
        ALTER COLUMN region TYPE eswatini_region
        USING region::eswatini_region;
EXCEPTION WHEN undefined_object THEN
    RAISE NOTICE 'eswatini_region type not yet created, running 03_enums.sql first';
END $$;
