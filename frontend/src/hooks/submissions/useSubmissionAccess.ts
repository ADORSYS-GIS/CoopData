import { useEffect, useMemo, useRef, useState } from "react";

import {
  submissionAccess,
  type AccessReview,
  type AccessSubmission,
  type SubmissionAccess,
} from "@/lib/submissionAccess";
import { onEditAccessLost } from "@/services/shared/editAccessEvents";

/** Access was taken away while the page was open. */
export interface LostAccess {
  /** The backend's explanation when a save was refused, if that is how we found out. */
  serverMessage: string | null;
}

/** States in which the user could edit. */
const EDITABLE: ReadonlySet<SubmissionAccess["kind"]> = new Set(["editing", "waiting"]);

/** Losses the user did not cause: someone else took the draft. */
const INVOLUNTARY: ReadonlySet<SubmissionAccess["kind"]> = new Set([
  "reclaimed",
  "withApex",
  "colleague",
]);

/**
 * Who holds the submission for the current user, and whether that changed under them.
 * `lost` is set when editing access ends because someone else took the draft (for
 * example an Apex reclaim), either seen on a refresh or reported by a refused save.
 */
export const useSubmissionAccess = (
  submission: AccessSubmission | null | undefined,
  role: string | null | undefined,
  userId: string | null | undefined,
  reviews: readonly AccessReview[] | undefined,
  refresh: () => void,
  refreshReviews: () => void,
) => {
  const access = useMemo(
    () => submissionAccess(submission, role, userId, reviews ?? []),
    [submission, role, userId, reviews],
  );
  const [lost, setLost] = useState<LostAccess | null>(null);

  // Ownership moved: reload the history so a reclaim shows who, when and why.
  const holder = `${submission?.current_tier ?? ""}:${submission?.edited_by ?? ""}`;
  const previousHolder = useRef(holder);
  useEffect(() => {
    if (previousHolder.current !== holder) {
      previousHolder.current = holder;
      refreshReviews();
    }
  }, [holder, refreshReviews]);

  // Editing → someone else holds it, noticed on a refresh.
  const previousKind = useRef<SubmissionAccess["kind"] | null>(null);
  useEffect(() => {
    const before = previousKind.current;
    previousKind.current = access.kind;
    if (before && EDITABLE.has(before) && INVOLUNTARY.has(access.kind)) {
      setLost((current) => current ?? { serverMessage: null });
    }
  }, [access.kind]);

  // A save was refused because this user no longer holds the draft.
  useEffect(
    () =>
      onEditAccessLost(({ message }) => {
        refresh();
        setLost((current) => current ?? { serverMessage: message || null });
      }),
    [refresh],
  );

  return { access, lost, dismissLost: () => setLost(null) };
};
