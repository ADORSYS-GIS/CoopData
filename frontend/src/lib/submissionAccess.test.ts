import { describe, expect, it } from "vitest";

import { canEdit, submissionAccess, type AccessReview } from "@/lib/submissionAccess";

const draft = (tier: string, editedBy: string | null, name: string | null = null) => ({
  status: "draft",
  current_tier: tier,
  edited_by: editedBy,
  edited_by_name: name,
});

const delegation: AccessReview = {
  tier: "apex",
  action: "return",
  comment: "Please complete the loans",
  target_tier: "cooperative",
  created_at: "2026-10-01T10:00:00Z",
};

const reclaim: AccessReview = {
  tier: "apex",
  action: "comment",
  comment: "Reclaimed by apex: Deadline tomorrow, we will finish it",
  target_tier: null,
  created_at: "2026-10-01T12:00:00Z",
};

describe("submissionAccess", () => {
  it("lets the assigned editor edit", () => {
    const access = submissionAccess(draft("cooperative", "u1"), "cooperative", "u1");

    expect(access).toEqual({ kind: "editing" });
    expect(canEdit(access)).toBe(true);
  });

  it("offers an unclaimed draft at the user's own tier", () => {
    const access = submissionAccess(draft("cooperative", null), "cooperative", "u1");

    expect(access).toEqual({ kind: "waiting" });
    expect(canEdit(access)).toBe(true);
  });

  it("shows a colleague who holds the draft", () => {
    const access = submissionAccess(draft("cooperative", "u2", "Ben"), "cooperative", "u1");

    expect(access).toEqual({ kind: "colleague", name: "Ben" });
    expect(canEdit(access)).toBe(false);
  });

  it("tells the cooperative who reclaimed it, when and why", () => {
    const access = submissionAccess(draft("apex", "a1", "Apex Officer"), "cooperative", "u1", [
      delegation,
      reclaim,
    ]);

    expect(access).toEqual({
      kind: "reclaimed",
      name: "Apex Officer",
      at: "2026-10-01T12:00:00Z",
      comment: "Deadline tomorrow, we will finish it",
    });
  });

  it("treats an apex draft that was never handed over as being prepared by the apex", () => {
    const access = submissionAccess(draft("apex", "a1", "Apex Officer"), "cooperative", "u1", []);

    expect(access).toEqual({ kind: "withApex", name: "Apex Officer" });
  });

  it("uses the latest handover when the draft went back and forth", () => {
    const redelegated = { ...delegation, created_at: "2026-10-01T13:00:00Z" };

    const access = submissionAccess(draft("apex", "a1"), "cooperative", "u1", [
      reclaim,
      redelegated,
    ]);

    expect(access.kind).toBe("withApex");
  });

  it("shows the apex that the draft is with the cooperative", () => {
    const access = submissionAccess(draft("cooperative", "u1", "Ann"), "apex", "a1");

    expect(access).toEqual({ kind: "withCooperative", name: "Ann" });
  });

  it("is silent for submitted work and for reviewers", () => {
    expect(
      submissionAccess({ ...draft("apex", null), status: "submitted" }, "cooperative", "u1"),
    ).toEqual({ kind: "none" });
    expect(submissionAccess(draft("apex", null), "ministry", "m1")).toEqual({ kind: "none" });
  });
});
