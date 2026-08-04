-- Migration 28: Fix questionnaire_responses unique constraints
-- The original constraints only allowed ONE questionnaire per submission / per coop-year.
-- We need to allow both 'financial' and 'non_financial' questionnaire types per submission.

-- Drop the over-restrictive constraints
ALTER TABLE questionnaire_responses
    DROP CONSTRAINT IF EXISTS unique_submission_questionnaire;

ALTER TABLE questionnaire_responses
    DROP CONSTRAINT IF EXISTS unique_coop_year_questionnaire;

-- Re-create them scoped to (submission_id, questionnaire_type)
-- so both 'financial' and 'non_financial' can coexist for the same submission.
ALTER TABLE questionnaire_responses
    ADD CONSTRAINT unique_submission_questionnaire_type
        UNIQUE (submission_id, questionnaire_type);

ALTER TABLE questionnaire_responses
    ADD CONSTRAINT unique_coop_year_questionnaire_type
        UNIQUE (cooperative_id, reporting_year, questionnaire_type);
