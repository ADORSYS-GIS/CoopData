import { describe, expect, it } from "vitest";

import type { ReportStatus } from "@/hooks/reports/useReportExport";
import { languageRows, settledLanguages } from "@/lib/reportReadiness";

const AT = "2026-10-02T10:00:00Z";
const ALL = ["en", "fr", "pt", "ss"];

const status = (
  languages: Record<string, "preparing" | "ready" | "failed">,
  available = ALL,
): ReportStatus => ({
  available_languages: available,
  languages: Object.entries(languages).map(([lang, state]) => ({ lang, state, updated_at: AT })),
});

describe("languageRows", () => {
  it("locks other languages while English is being prepared", () => {
    const rows = languageRows(status({ en: "preparing" }), "fr");

    expect(rows).toEqual([
      { lang: "en", state: "preparing" },
      { lang: "fr", state: "locked" },
      { lang: "pt", state: "locked" },
      { lang: "ss", state: "locked" },
    ]);
  });

  it("offers every language once English is ready, the user's own right after English", () => {
    const rows = languageRows(status({ en: "ready", pt: "failed", fr: "ready" }), "ss");

    expect(rows).toEqual([
      { lang: "en", state: "ready" },
      { lang: "ss", state: "notPrepared" },
      { lang: "fr", state: "ready" },
      { lang: "pt", state: "failed" },
    ]);
  });

  it("offers to prepare an English report that was never made", () => {
    const rows = languageRows(status({}), "en");

    expect(rows[0]).toEqual({ lang: "en", state: "notPrepared" });
    expect(rows.slice(1).every((r) => r.state === "locked")).toBe(true);
  });

  it("shows only English for English-only reports", () => {
    const rows = languageRows(status({ en: "ready" }, ["en"]), "fr");

    expect(rows).toEqual([{ lang: "en", state: "ready" }]);
  });
});

describe("settledLanguages", () => {
  it("reports languages that finished since the last snapshot", () => {
    const before = status({ en: "ready", fr: "preparing", ss: "preparing", pt: "ready" });
    const after = status({ en: "ready", fr: "ready", ss: "failed", pt: "ready" });

    expect(settledLanguages(before, after)).toEqual({ ready: ["fr"], failed: ["ss"] });
  });

  it("stays quiet on the first snapshot", () => {
    expect(settledLanguages(undefined, status({ en: "ready" }))).toEqual({
      ready: [],
      failed: [],
    });
  });
});
