-- Migration 67: a Mambu sync run may cover a whole year (month 0), which creates one
-- "Full 12 Mo" return per SACCO instead of a single month.

ALTER TABLE mambu_sync_runs DROP CONSTRAINT IF EXISTS mambu_sync_runs_month_check;
ALTER TABLE mambu_sync_runs
    ADD CONSTRAINT mambu_sync_runs_month_check CHECK (month BETWEEN 0 AND 12);
