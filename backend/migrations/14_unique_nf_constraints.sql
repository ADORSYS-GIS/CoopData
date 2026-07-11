-- Migration 14: Add unique constraints for non-financial data upsert
ALTER TABLE savings_accounts ADD CONSTRAINT uq_savings_account_coop_id UNIQUE (cooperative_id, savings_account_id);
ALTER TABLE loans ADD CONSTRAINT uq_loans_coop_id UNIQUE (cooperative_id, loan_id);
ALTER TABLE fixed_deposits ADD CONSTRAINT uq_fd_coop_id UNIQUE (cooperative_id, fixed_deposit_id);
