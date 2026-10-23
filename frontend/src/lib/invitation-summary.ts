import type { components } from "@/openapi-client/api";

type Invitation = components["schemas"]["InvitationResponse"];

const PENDING_STATUSES = new Set(["PENDING", "EMAIL_VERIFIED"]);
const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;

/** Awaiting email verification or org acceptance. A missing status is treated as pending. */
export const isPendingInvitation = (invitation: Invitation): boolean =>
  PENDING_STATUSES.has(invitation.status ?? "PENDING");

/** The invited user has joined the organisation. */
export const isAcceptedInvitation = (invitation: Invitation): boolean =>
  invitation.status === "ACCEPTED";

export interface InvitationSummary {
  readonly total: number;
  readonly pending: number;
  readonly accepted: number;
  readonly last30Days: number;
}

/**
 * Counts for the invitation stat cards. `total` is accepted + pending, so expired or
 * otherwise inactive invitations are left out of every figure.
 */
export const summarizeInvitations = (
  invitations: readonly Invitation[],
  nowInSeconds: number = Date.now() / 1000,
): InvitationSummary => {
  const active = invitations.filter((i) => isPendingInvitation(i) || isAcceptedInvitation(i));
  const pending = active.filter(isPendingInvitation).length;
  const accepted = active.filter(isAcceptedInvitation).length;
  const last30Days = active.filter(
    (i) => i.created_at != null && nowInSeconds - i.created_at <= THIRTY_DAYS_IN_SECONDS,
  ).length;

  return { total: pending + accepted, pending, accepted, last30Days };
};
