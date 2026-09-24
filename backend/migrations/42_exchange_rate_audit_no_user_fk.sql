-- Rate changes are attributed to the Keycloak identity of the admin, which
-- is not necessarily a row in the local users table, so the foreign keys
-- made every rate update fail with a constraint violation.
ALTER TABLE exchange_rates DROP CONSTRAINT IF EXISTS exchange_rates_updated_by_fkey;
ALTER TABLE exchange_rate_history DROP CONSTRAINT IF EXISTS exchange_rate_history_changed_by_fkey;
