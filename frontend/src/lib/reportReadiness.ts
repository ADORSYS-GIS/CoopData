import type { ReportStatus } from "@/hooks/reports/useReportExport";
import type { RowState } from "@/components/reports/report-language-row";

export interface LanguageRow {
  lang: string;
  state: RowState;
}

/**
 * One row per language the report can be produced in, English first, then the
 * user's own language, then the rest. Other languages are translated from the
 * English report, so they stay locked until English is ready.
 */
export function languageRows(status: ReportStatus, ownLanguage: string): LanguageRow[] {
  const byLang = new Map(status.languages.map((l) => [l.lang, l.state]));
  const englishReady = byLang.get("en") === "ready";

  const rank = (lang: string) => (lang === "en" ? 0 : lang === ownLanguage ? 1 : 2);
  const ordered = [...status.available_languages].sort((a, b) => rank(a) - rank(b));

  return ordered.map((lang) => {
    const known = byLang.get(lang);
    if (known) return { lang, state: known };
    if (lang === "en" || englishReady) return { lang, state: "notPrepared" };
    return { lang, state: "locked" };
  });
}

/** Languages that became ready or failed between two status snapshots. */
export function settledLanguages(
  previous: ReportStatus | undefined,
  current: ReportStatus,
): { ready: string[]; failed: string[] } {
  const wasPreparing = new Set(
    previous?.languages.filter((l) => l.state === "preparing").map((l) => l.lang) ?? [],
  );
  const settled = current.languages.filter((l) => wasPreparing.has(l.lang));
  return {
    ready: settled.filter((l) => l.state === "ready").map((l) => l.lang),
    failed: settled.filter((l) => l.state === "failed").map((l) => l.lang),
  };
}
