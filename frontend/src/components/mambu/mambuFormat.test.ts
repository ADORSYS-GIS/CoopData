import { describe, it, expect } from "vitest";
import {
  WHOLE_YEAR,
  cooperativeState,
  itemTone,
  periodLabel,
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
});
