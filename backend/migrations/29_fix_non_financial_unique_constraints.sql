-- Migration 29: Fix non-financial unique constraints to allow historical data per submission
-- Drop old cooperative-wide unique constraints:
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_cooperative_id_member_id_key;
ALTER TABLE loans DROP CONSTRAINT IF EXISTS uq_loans_coop_id;
ALTER TABLE savings_accounts DROP CONSTRAINT IF EXISTS uq_savings_account_coop_id;
ALTER TABLE fixed_deposits DROP CONSTRAINT IF EXISTS uq_fd_coop_id;

-- Add new submission-scoped unique constraints:
ALTER TABLE members ADD CONSTRAINT unique_submission_member UNIQUE (submission_id, member_id);
ALTER TABLE loans ADD CONSTRAINT unique_submission_loan UNIQUE (submission_id, loan_id);
ALTER TABLE savings_accounts ADD CONSTRAINT unique_submission_savings UNIQUE (submission_id, savings_account_id);
ALTER TABLE fixed_deposits ADD CONSTRAINT unique_submission_fd UNIQUE (submission_id, fixed_deposit_id);
