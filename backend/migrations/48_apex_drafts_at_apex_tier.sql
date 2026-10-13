-- Migration 48: apex-created drafts start at the apex tier.
--
-- An apex that creates a submission on behalf of a cooperative holds the draft
-- itself until it delegates it. Drafts created before this rule were stamped
-- with current_tier = 'cooperative', so the apex could never delegate them
-- ("Only submissions currently at the Apex tier can be delegated").
--
-- Only drafts that were never handed over are moved: a draft with a review
-- targeting the cooperative was delegated on purpose and stays where it is.
-- Idempotent: re-running it matches no rows.

UPDATE submissions s
SET current_tier = 'apex'
WHERE s.created_by_role = 'apex'
  AND s.status = 'draft'
  AND s.current_tier = 'cooperative'
  AND NOT EXISTS (
      SELECT 1
      FROM submission_reviews r
      WHERE r.submission_id = s.id
        AND r.target_tier = 'cooperative'
  );
