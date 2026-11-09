-- Migration 64: deleting a cooperative removes everything filed under it.
--
-- submissions, kpi_records, questionnaire_responses and farm_coop already
-- cascade from a cooperative. The seven tables below pointed at it with
-- NO ACTION. Because a cooperative's submissions cascade to the same rows,
-- PostgreSQL could still see them when it checked the NO ACTION key, and it
-- refused the whole delete. Deleting a SACCO (or the apex or federation above
-- it) therefore failed in the database after Keycloak had already been cleaned.
-- Cascading here lets the delete complete and keeps nothing behind.
-- Safe to re-run.

ALTER TABLE financial_statements
    DROP CONSTRAINT IF EXISTS financial_statements_cooperative_id_fkey;
ALTER TABLE financial_statements
    ADD CONSTRAINT financial_statements_cooperative_id_fkey
    FOREIGN KEY (cooperative_id) REFERENCES cooperatives(id) ON DELETE CASCADE;

ALTER TABLE members
    DROP CONSTRAINT IF EXISTS members_cooperative_id_fkey;
ALTER TABLE members
    ADD CONSTRAINT members_cooperative_id_fkey
    FOREIGN KEY (cooperative_id) REFERENCES cooperatives(id) ON DELETE CASCADE;

ALTER TABLE savings_accounts
    DROP CONSTRAINT IF EXISTS savings_accounts_cooperative_id_fkey;
ALTER TABLE savings_accounts
    ADD CONSTRAINT savings_accounts_cooperative_id_fkey
    FOREIGN KEY (cooperative_id) REFERENCES cooperatives(id) ON DELETE CASCADE;

ALTER TABLE loans
    DROP CONSTRAINT IF EXISTS loans_cooperative_id_fkey;
ALTER TABLE loans
    ADD CONSTRAINT loans_cooperative_id_fkey
    FOREIGN KEY (cooperative_id) REFERENCES cooperatives(id) ON DELETE CASCADE;

ALTER TABLE fixed_deposits
    DROP CONSTRAINT IF EXISTS fixed_deposits_cooperative_id_fkey;
ALTER TABLE fixed_deposits
    ADD CONSTRAINT fixed_deposits_cooperative_id_fkey
    FOREIGN KEY (cooperative_id) REFERENCES cooperatives(id) ON DELETE CASCADE;

ALTER TABLE computed_kpis
    DROP CONSTRAINT IF EXISTS computed_kpis_cooperative_id_fkey;
ALTER TABLE computed_kpis
    ADD CONSTRAINT computed_kpis_cooperative_id_fkey
    FOREIGN KEY (cooperative_id) REFERENCES cooperatives(id) ON DELETE CASCADE;

ALTER TABLE abnormality_flags
    DROP CONSTRAINT IF EXISTS abnormality_flags_cooperative_id_fkey;
ALTER TABLE abnormality_flags
    ADD CONSTRAINT abnormality_flags_cooperative_id_fkey
    FOREIGN KEY (cooperative_id) REFERENCES cooperatives(id) ON DELETE CASCADE;
