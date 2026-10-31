-- Migration 66: one pending Mambu sync per cooperative, enforced by the database
-- so two requests (or two server instances) cannot start the same SACCO twice.

UPDATE mambu_sync_items
SET status = 'failed',
    error = 'Interrupted: the server stopped before this sync finished',
    updated_at = CURRENT_TIMESTAMP
WHERE status = 'pending';

CREATE UNIQUE INDEX IF NOT EXISTS uq_mambu_sync_items_pending
    ON mambu_sync_items (cooperative_id)
    WHERE status = 'pending';
