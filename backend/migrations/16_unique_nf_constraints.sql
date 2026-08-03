-- Clean up duplicate rows before creating unique constraints to prevent migration failures
DELETE FROM savings_accounts a
USING savings_accounts b
WHERE a.cooperative_id = b.cooperative_id
  AND a.savings_account_id = b.savings_account_id
  AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id < b.id));

DELETE FROM loans a
USING loans b
WHERE a.cooperative_id = b.cooperative_id
  AND a.loan_id = b.loan_id
  AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id < b.id));

DELETE FROM fixed_deposits a
USING fixed_deposits b
WHERE a.cooperative_id = b.cooperative_id
  AND a.fixed_deposit_id = b.fixed_deposit_id
  AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.id < b.id));

ALTER TABLE savings_accounts ADD CONSTRAINT savings_accounts_cooperative_id_savings_account_id_unique UNIQUE (cooperative_id, savings_account_id);
ALTER TABLE loans ADD CONSTRAINT loans_cooperative_id_loan_id_unique UNIQUE (cooperative_id, loan_id);
ALTER TABLE fixed_deposits ADD CONSTRAINT fixed_deposits_cooperative_id_fixed_deposit_id_unique UNIQUE (cooperative_id, fixed_deposit_id);
