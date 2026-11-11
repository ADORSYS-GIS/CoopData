-- Migration 70: make a Mambu sync that keeps being interrupted end instead of loop, and
-- show how far a running sync has come.
--
-- resume_count: how many times the server carried the run on after a restart. A run
--   that was interrupted too often (for example by running out of memory) is failed.
-- phase, records_read, records_total: what a SACCO's sync is doing now, so a slow sync
--   can be told from a stuck one.

ALTER TABLE mambu_sync_runs
    ADD COLUMN IF NOT EXISTS resume_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE mambu_sync_items
    ADD COLUMN IF NOT EXISTS phase VARCHAR(32),
    ADD COLUMN IF NOT EXISTS records_read INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS records_total INTEGER NOT NULL DEFAULT 0;
