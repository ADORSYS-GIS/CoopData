-- Migration 69: automatic sync of linked SACCOs. A link takes part in the monthly
-- automatic sync unless the apex switches it off; the month of the last automatic run is
-- kept so two instances of the server never start the same month twice.

ALTER TABLE mambu_branch_links
    ADD COLUMN IF NOT EXISTS auto_sync BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE mambu_branch_links
    ADD COLUMN IF NOT EXISTS last_auto_sync_month VARCHAR(7);
