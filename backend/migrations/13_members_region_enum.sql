-- Migration 13: Alter members.region to eswatini_region enum type
-- Source: docs/message.md §9.4 — spec requires EswatiniRegion enum for members.region
-- Migration 12 only altered cooperatives.region; this extends to members.region

ALTER TABLE members
    ALTER COLUMN region TYPE eswatini_region
    USING region::eswatini_region;