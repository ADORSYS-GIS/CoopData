import { describe, expect, it } from "vitest";

import { isPendingInvitation, summarizeInvitations } from "./invitation-summary";

const NOW = 1_800_000_000;
const DAY = 24 * 60 * 60;

const invitation = (status: string | null, createdDaysAgo = 1) => ({
  id: `${status}-${createdDaysAgo}`,
  email: "officer@example.com",
  email_sent: true,
  status,
  created_at: NOW - createdDaysAgo * DAY,
});

describe("summarizeInvitations", () => {
  it("counts accepted and pending invitations separately", () => {
    const summary = summarizeInvitations(
      [invitation("ACCEPTED"), invitation("PENDING"), invitation("EMAIL_VERIFIED")],
      NOW,
    );

    expect(summary).toMatchObject({ accepted: 1, pending: 2 });
  });

  it("makes the total the sum of accepted and pending", () => {
    const summary = summarizeInvitations(
      [invitation("ACCEPTED"), invitation("ACCEPTED"), invitation("PENDING")],
      NOW,
    );

    expect(summary.total).toBe(summary.accepted + summary.pending);
    expect(summary.total).toBe(3);
  });

  it("leaves expired invitations out of every figure", () => {
    const summary = summarizeInvitations([invitation("EXPIRED"), invitation("PENDING")], NOW);

    expect(summary).toEqual({ total: 1, pending: 1, accepted: 0, last30Days: 1 });
  });

  it("only counts invitations created in the last 30 days as recent", () => {
    const summary = summarizeInvitations(
      [invitation("PENDING", 5), invitation("ACCEPTED", 29), invitation("ACCEPTED", 45)],
      NOW,
    );

    expect(summary.last30Days).toBe(2);
  });

  it("returns zeros for an empty list", () => {
    expect(summarizeInvitations([], NOW)).toEqual({
      total: 0,
      pending: 0,
      accepted: 0,
      last30Days: 0,
    });
  });
});

describe("isPendingInvitation", () => {
  it("treats a missing status as pending", () => {
    expect(isPendingInvitation(invitation(null))).toBe(true);
  });
});
