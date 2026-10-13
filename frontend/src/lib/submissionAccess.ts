/**
 * Who holds a draft submission, seen from the current user.
 *
 * A draft has one holder at a time: the user in `edited_by`, or — while it waits to
 * be picked up — whoever works at `current_tier`. The Apex hands an Apex-created
 * draft to the cooperative with a delegation and takes it back with a reclaim; both
 * are recorded in the review history, which tells the cooperative when and why.
 */

export type AccessRole = "cooperative" | "apex";

export type SubmissionAccess =
  /** The current user holds the draft and can edit it. */
  | { kind: "editing" }
  /** Unclaimed at the user's tier; it is claimed automatically on opening. */
  | { kind: "waiting" }
  /** A colleague at the same tier is editing it. */
  | { kind: "colleague"; name: string | null }
  /** Cooperative view: the Apex took the draft back after delegating it. */
  | { kind: "reclaimed"; name: string | null; at: string | null; comment: string | null }
  /** Cooperative view: the Apex holds a draft it has not handed over. */
  | { kind: "withApex"; name: string | null }
  /** Apex view: the draft is with the cooperative after a delegation. */
  | { kind: "withCooperative"; name: string | null }
  /** Not a draft, or a role that never edits drafts. */
  | { kind: "none" };

export interface AccessSubmission {
  status: string;
  current_tier: string;
  edited_by?: string | null;
  edited_by_name?: string | null;
}

export interface AccessReview {
  tier: string;
  action: string;
  comment: string | null;
  target_tier?: string | null;
  created_at: string;
}

/** Prefix the backend writes on the review recorded for a reclaim. */
const RECLAIM_PREFIX = "Reclaimed by apex";

const isReclaim = (review: AccessReview): boolean =>
  review.tier === "apex" &&
  review.action === "comment" &&
  (review.comment ?? "").startsWith(RECLAIM_PREFIX);

const isDelegation = (review: AccessReview): boolean =>
  review.tier === "apex" && review.action === "return" && review.target_tier === "cooperative";

/** The Apex's own words when reclaiming ("Reclaimed by apex: <comment>"), if any. */
const reclaimComment = (review: AccessReview): string | null => {
  const rest = (review.comment ?? "").slice(RECLAIM_PREFIX.length).replace(/^:\s*/, "").trim();
  return rest || null;
};

/** Latest delegation or reclaim, newest first by timestamp. */
const lastHandover = (reviews: readonly AccessReview[]): AccessReview | undefined =>
  [...reviews]
    .filter((review) => isReclaim(review) || isDelegation(review))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];

export const submissionAccess = (
  submission: AccessSubmission | null | undefined,
  role: string | null | undefined,
  userId: string | null | undefined,
  reviews: readonly AccessReview[] = [],
): SubmissionAccess => {
  if (!submission || submission.status !== "draft") return { kind: "none" };
  if (role !== "cooperative" && role !== "apex") return { kind: "none" };

  const editor = submission.edited_by ?? null;
  const name = submission.edited_by_name ?? null;
  if (editor && editor === userId) return { kind: "editing" };

  if (submission.current_tier === role) {
    return editor ? { kind: "colleague", name } : { kind: "waiting" };
  }

  if (role === "cooperative" && submission.current_tier === "apex") {
    const handover = lastHandover(reviews);
    return handover && isReclaim(handover)
      ? { kind: "reclaimed", name, at: handover.created_at, comment: reclaimComment(handover) }
      : { kind: "withApex", name };
  }
  if (role === "apex" && submission.current_tier === "cooperative") {
    return { kind: "withCooperative", name };
  }
  return { kind: "none" };
};

/** True when the user may change the draft right now. */
export const canEdit = (access: SubmissionAccess): boolean =>
  access.kind === "editing" || access.kind === "waiting";

/** Date and time of a handover in the app language; unsupported locales (siSwati) fall back. */
export const handoverTime = (iso: string, language: string): string => {
  const date = new Date(iso);
  try {
    return date.toLocaleString(language, { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return date.toLocaleString();
  }
};
