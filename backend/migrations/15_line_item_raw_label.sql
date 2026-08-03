-- Migration 14: Add raw_label column to balance_sheet_line_items
-- Stores the exact text from the uploaded document as extracted by the LLM.
-- Needed for the human-review grid so cooperatives can see what the AI read.

BEGIN;

ALTER TABLE balance_sheet_line_items
    ADD COLUMN IF NOT EXISTS raw_label VARCHAR(500);

-- Backfill existing rows: use account_name as proxy for raw_label
UPDATE balance_sheet_line_items
SET raw_label = account_name
WHERE raw_label IS NULL;

COMMIT;
