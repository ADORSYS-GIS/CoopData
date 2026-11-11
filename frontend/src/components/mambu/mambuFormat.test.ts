import { describe, it, expect } from "vitest";
import {
  WHOLE_YEAR,
  cooperativeState,
  itemTone,
  PHASE_LABELS,
  periodLabel,
  progressCount,
  runDuration,
  runTone,
  timeAgo,
} from "./mambuFormat";

describe("mambuFormat", () => {
  it("labels a period with the month name", () => {
    expect(periodLabel(2026, 9)).toBe("September 2026");
  });

  it("labels month 0 as the whole year", () => {
    expect(WHOLE_YEAR).toBe(0);
    expect(periodLabel(2025, WHOLE_YEAR)).toBe("Whole year 2025");
  });

  it("says where a cooperative stands", () => {
    const base = {
      mambu_branch_id: "ES0006",
      running: false,
      last_warning_count: 0,
      last_unmapped_accounts: 0,
    };
    expect(cooperativeState({ ...base, mambu_branch_id: null })).toBe("not_linked");
    expect(cooperativeState(base)).toBe("never");
    expect(cooperativeState({ ...base, running: true })).toBe("running");
    expect(cooperativeState({ ...base, last_status: "synced" })).toBe("synced");
    expect(cooperativeState({ ...base, last_status: "flagged" })).toBe("attention");
    expect(cooperativeState({ ...base, last_status: "synced", last_unmapped_accounts: 2 })).toBe(
      "attention",
    );
    expect(cooperativeState({ ...base, last_status: "failed" })).toBe("failed");
  });

  it("shows how long ago something happened", () => {
    const now = new Date("2026-11-04T12:00:00Z");
    expect(timeAgo("2026-11-04T11:59:40Z", now)).toBe("just now");
    expect(timeAgo("2026-11-04T11:55:00Z", now)).toBe("5 min ago");
    expect(timeAgo("2026-11-04T09:00:00Z", now)).toBe("3 h ago");
    expect(timeAgo("2026-11-01T12:00:00Z", now)).toBe("3 days ago");
    expect(timeAgo(null, now)).toBe("never");
  });

  it("maps item and run statuses to tones", () => {
    expect(itemTone("synced")).toBe("success");
    expect(itemTone("flagged")).toBe("warning");
    expect(itemTone("failed")).toBe("danger");
    expect(itemTone("skipped")).toBe("neutral");
    expect(runTone("running")).toBe("info");
    expect(runTone("completed")).toBe("success");
  });

  it("shows how far a read has come only when the total is known", () => {
    expect(progressCount(83770, 126350)).toBe(" · 83,770 of 126,350");
    expect(progressCount(0, 0)).toBe("");
  });

  it("has a label for every phase the backend reports", () => {
    for (const phase of [
      "waiting",
      "reading_members",
      "reading_ledger",
      "reading_deposits",
      "saving",
    ]) {
      expect(PHASE_LABELS[phase]).toBeTruthy();
    }
  });

  it("counts the ledger in months", () => {
    expect(progressCount(7, 11, "reading_ledger")).toBe(" · 7 of 11 months");
    expect(progressCount(7, 11, "reading_deposits")).toBe(" · 7 of 11");
  });

  it("says how long a run took", () => {
    const start = "2026-11-11T18:40:19Z";
    expect(runDuration(start, "2026-11-11T18:40:49Z")).toBe("30 s");
    expect(runDuration(start, "2026-11-11T18:45:31Z")).toBe("5 min 12 s");
    expect(runDuration(start, "2026-11-11T19:44:19Z")).toBe("1 h 4 min");
    expect(runDuration(start, null, new Date("2026-11-11T18:41:19Z"))).toBe("1 min 0 s");
  });
});
