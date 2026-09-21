-- Migration 38: Fix savings_accounts unique constraint to be per-member.
--
-- The previous constraint was UNIQUE (submission_id, savings_account_id). In
-- real imports savings_account_id is often the account TYPE (e.g. "Ordinary
-- Savings"), shared by every member, so only one row could ever be inserted
-- per submission. Make the key per-member so each member can hold one savings
-- account of a given type.

-- Remove any existing duplicates for the new key, keeping the most recent row.
DELETE FROM savings_accounts a
USING savings_accounts b
WHERE a.submission_id = b.submission_id
  AND a.member_id = b.member_id
  AND a.savings_account_id = b.savings_account_id
  AND a.created_at < b.created_at;

ALTER TABLE savings_accounts DROP CONSTRAINT IF EXISTS unique_submission_savings;
ALTER TABLE savings_accounts ADD CONSTRAINT unique_submission_member_savings
  UNIQUE (submission_id, member_id, savings_account_id);
