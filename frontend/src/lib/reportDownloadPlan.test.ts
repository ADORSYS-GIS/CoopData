import { describe, expect, it } from "vitest";

import { nextDownloadStep } from "@/lib/reportDownloadPlan";
import type { ReportStatus } from "@/services/reports/reportExportApi";

const status = (languages: Record<string, "preparing" | "ready" | "failed">): ReportStatus => ({
  available_languages: ["en", "fr", "pt", "ss"],
  languages: Object.entries(languages).map(([lang, state]) => ({
    lang,
    state,
    updated_at: "2026-10-02T10:00:00Z",
  })),
});

describe("nextDownloadStep", () => {
  it("downloads a ready language straight away", () => {
    expect(nextDownloadStep(status({ en: "ready", ss: "ready" }), "ss", true)).toEqual({
      kind: "download",
    });
  });

  it("prepares a missing language once English is ready", () => {
    expect(nextDownloadStep(status({ en: "ready" }), "fr", true)).toEqual({
      kind: "prepare",
      lang: "fr",
    });
  });

  it("prepares English first when it is missing", () => {
    expect(nextDownloadStep(status({}), "ss", true)).toEqual({ kind: "prepare", lang: "en" });
  });

  it("waits while English or the language itself is being prepared", () => {
    expect(nextDownloadStep(status({ en: "preparing" }), "ss", false)).toEqual({ kind: "wait" });
    expect(nextDownloadStep(status({ en: "ready", ss: "preparing" }), "ss", false)).toEqual({
      kind: "wait",
    });
  });

  it("retries a failed preparation when the user asks again", () => {
    expect(nextDownloadStep(status({ en: "ready", fr: "failed" }), "fr", true)).toEqual({
      kind: "prepare",
      lang: "fr",
    });
    expect(nextDownloadStep(status({ en: "failed" }), "fr", true)).toEqual({
      kind: "prepare",
      lang: "en",
    });
  });

  it("stops waiting when a preparation fails", () => {
    expect(nextDownloadStep(status({ en: "ready", fr: "failed" }), "fr", false)).toEqual({
      kind: "failed",
    });
    expect(nextDownloadStep(status({ en: "failed" }), "fr", false)).toEqual({ kind: "failed" });
  });
});
