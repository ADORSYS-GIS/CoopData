-- Migration 61: fill the filing and last-review dates of existing submissions.
--
-- Until now no status change recorded submissions.submitted_at or
-- last_reviewed_at, so "Filed on" showed "—" everywhere. The repository now
-- records them; this restores them for earlier submissions from the review
-- trail: submitting writes a cooperative-tier comment, and every reviewer
-- decision writes a review at the reviewer's tier. Only empty dates on
-- submissions that left the draft state are filled, so it is safe to re-run.

UPDATE submissions s
SET submitted_at = r.filed_at
FROM (
    SELECT submission_id, MAX(created_at) AS filed_at
    FROM submission_reviews
    WHERE tier = 'cooperative' AND action = 'comment'
    GROUP BY submission_id
) r
WHERE s.id = r.submission_id
  AND s.submitted_at IS NULL
  AND s.status <> 'draft';

UPDATE submissions s
SET last_reviewed_at = r.reviewed_at
FROM (
    SELECT submission_id, MAX(created_at) AS reviewed_at
    FROM submission_reviews
    WHERE tier <> 'cooperative'
    GROUP BY submission_id
) r
WHERE s.id = r.submission_id
  AND s.last_reviewed_at IS NULL;
