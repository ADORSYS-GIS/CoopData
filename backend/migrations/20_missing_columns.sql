-- Migration 20: Add missing columns that exist in entities but not in DB
-- Fixes: column chart_of_accounts.description does not exist (code 42703)
-- Fixes: column submission_reviews.target_tier does not exist (code 42703)

ALTER TABLE chart_of_accounts
    ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE submission_reviews
    ADD COLUMN IF NOT EXISTS target_tier review_tier;
