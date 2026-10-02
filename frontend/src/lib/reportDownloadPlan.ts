import type { ReportStatus } from "@/services/reports/reportExportApi";

/** What to do next to get a report downloaded in one language. */
export type DownloadStep =
  | { kind: "download" }
  | { kind: "prepare"; lang: string }
  | { kind: "wait" }
  | { kind: "failed" };

const ENGLISH = "en";

/**
 * Decides the next step towards downloading `lang`. Other languages are translated
 * from the English report, so English is prepared first when it is missing.
 *
 * `retry` is true when the user just asked: a failed preparation is started again.
 * While the page waits on its own (`retry` false), a failure ends the wait.
 */
export function nextDownloadStep(
  status: ReportStatus,
  lang: string,
  retry: boolean,
): DownloadStep {
  const stateOf = (l: string) => status.languages.find((s) => s.lang === l)?.state;
  const requested = stateOf(lang);

  if (requested === "ready") return { kind: "download" };
  if (requested === "preparing") return { kind: "wait" };
  if (requested === "failed" && !retry) return { kind: "failed" };

  if (lang === ENGLISH) return { kind: "prepare", lang };

  switch (stateOf(ENGLISH)) {
    case "ready":
      return { kind: "prepare", lang };
    case "preparing":
      return { kind: "wait" };
    case "failed":
      return retry ? { kind: "prepare", lang: ENGLISH } : { kind: "failed" };
    default:
      return { kind: "prepare", lang: ENGLISH };
  }
}
