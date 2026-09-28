-- Migration 45: stop standardizing analytics onto a comparison currency.
--
-- Per product decision, the platform no longer converts any figure — every
-- amount is shown exactly as the cooperative reported it (SZL for every
-- statement on file). The frozen per-submission rate is no longer meaningful
-- (nothing reads it to scale a figure), so it is cleared rather than left at
-- the placeholder 1.0 from the previous ZAR-standardization attempt.
--
-- The exchange_rates / exchange_rate_history tables are left in place (the
-- admin settings page still reads them) in case a future decision
-- reintroduces conversion, but nothing computes a displayed figure from them
-- anymore.

UPDATE submissions
SET rate_to_zar = NULL,
    rate_effective_date = NULL,
    rate_source = NULL
WHERE rate_to_zar IS NOT NULL;
