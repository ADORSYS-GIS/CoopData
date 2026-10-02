import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Languages, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  isPreparing,
  useDownloadReport,
  usePrepareReport,
  useReportStatus,
  type ReportRef,
  type ReportStatus,
} from "@/hooks/reports/useReportExport";
import { normalizeAppLang } from "@/lib/contentLocalization";
import { languageRows, settledLanguages } from "@/lib/reportReadiness";
import { ReportLanguageRow } from "./report-language-row";

/** Languages are named in their own language, so every reader finds theirs. */
const LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  fr: "Français",
  pt: "Português",
  ss: "SiSwati",
};

interface Props {
  reportRef: ReportRef;
  /** Download file name for one language. */
  filename: (lang: string) => string;
}

/**
 * Shows whether a report is ready, being prepared or failed, per language, and
 * offers the one action that makes sense for each: download, prepare, try again.
 * Errors are deliberately generic; the details are in the backend logs.
 */
export function ReportReadiness({ reportRef, filename }: Props) {
  const { t, i18n } = useTranslation();
  const ownLanguage = normalizeAppLang(i18n.resolvedLanguage ?? i18n.language);
  const status = useReportStatus(reportRef);
  const prepare = usePrepareReport(reportRef);
  const download = useDownloadReport(reportRef);
  const [pendingLang, setPendingLang] = useState<string | null>(null);
  const previous = useRef<ReportStatus | undefined>(undefined);

  // Tell the user when something they were waiting for finishes.
  useEffect(() => {
    if (!status.data) return;
    const { ready, failed } = settledLanguages(previous.current, status.data);
    ready.forEach((lang) =>
      toast.success(t("reportExport.status.readyToast", { language: LANGUAGE_NAMES[lang] })),
    );
    failed.forEach((lang) =>
      toast.error(t("reportExport.status.failedToast", { language: LANGUAGE_NAMES[lang] })),
    );
    previous.current = status.data;
  }, [status.data, t]);

  if (status.isLoading) {
    return (
      <div className="space-y-2" aria-label={t("reportExport.status.loading")}>
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </div>
    );
  }
  if (status.isError || !status.data) {
    return (
      <p role="alert" className="rounded-xl bg-destructive/5 px-4 py-3 text-xs text-destructive">
        {t("reportExport.status.unavailable")}
      </p>
    );
  }

  const rows = languageRows(status.data, ownLanguage);
  const [english, ...others] = rows;
  const englishReady = english?.state === "ready";

  const run = (lang: string, action: () => Promise<unknown>) => {
    setPendingLang(lang);
    action()
      .catch(() => toast.error(t("reportExport.status.actionFailed")))
      .finally(() => setPendingLang(null));
  };
  const onPrepare = (lang: string, regenerate = false) =>
    run(lang, () => prepare.mutateAsync({ lang, regenerate }));
  const onDownload = (lang: string) =>
    run(lang, () => download.mutateAsync({ lang, filename: filename(lang) }));

  const row = (r: (typeof rows)[number]) => (
    <ReportLanguageRow
      key={r.lang}
      name={LANGUAGE_NAMES[r.lang] ?? r.lang.toUpperCase()}
      state={r.state}
      isEnglish={r.lang === "en"}
      isOwnLanguage={r.lang === ownLanguage && r.lang !== "en"}
      pending={pendingLang === r.lang}
      onPrepare={() => onPrepare(r.lang)}
      onDownload={() => onDownload(r.lang)}
    />
  );

  return (
    <section className="space-y-4" aria-live="polite">
      {english && <ul>{row(english)}</ul>}

      {others.length > 0 && (
        <div className="space-y-2">
          <h4 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <Languages className="size-3.5" aria-hidden />
            {t("reportExport.status.otherLanguages")}
          </h4>
          {!englishReady && (
            <p className="text-xs text-muted-foreground">{t("reportExport.status.lockedHint")}</p>
          )}
          <ul className="space-y-2">{others.map(row)}</ul>
        </div>
      )}

      {englishReady && (
        <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {t("reportExport.status.updateHint")}
          </p>
          <button
            type="button"
            onClick={() => onPrepare("en", true)}
            disabled={pendingLang !== null || isPreparing(status.data)}
            className="press-feedback inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-foreground hover:bg-muted disabled:opacity-50"
          >
            {pendingLang === "en" && prepare.isPending ? (
              <Spinner size="sm" />
            ) : (
              <RefreshCw className="size-3.5" aria-hidden />
            )}
            {t("reportExport.status.update")}
          </button>
        </div>
      )}
    </section>
  );
}
