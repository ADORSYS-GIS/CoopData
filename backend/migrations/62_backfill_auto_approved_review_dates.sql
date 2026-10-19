-- Migration 62: review date of submissions an apex approved on submit.
--
-- An apex submitting its own draft approves it in the same step. Migration 61
-- ran before such approvals recorded last_reviewed_at; this fills it from the
-- apex's approval in the review trail. Only empty dates are filled.

UPDATE submissions s
SET last_reviewed_at = r.reviewed_at
FROM (
    SELECT submission_id, MAX(created_at) AS reviewed_at
    FROM submission_reviews
    WHERE tier <> 'cooperative'
    GROUP BY submission_id
) r
WHERE s.id = r.submission_id
  AND s.last_reviewed_at IS NULL
  AND s.status <> 'draft';
