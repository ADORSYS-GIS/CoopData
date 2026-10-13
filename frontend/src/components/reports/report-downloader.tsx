import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Download, RefreshCw } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  isPreparing,
  useDownloadReport,
  usePrepareReport,
  useReportStatus,
  type ReportRef,
} from "@/hooks/reports/useReportExport";
import { normalizeAppLang } from "@/lib/contentLocalization";
import { nextDownloadStep } from "@/lib/reportDownloadPlan";
import { finishInBackground, type WatchMessages } from "@/services/reports/reportWatcher";

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

interface Waiting {
  lang: string;
  filename: string;
  messages: WatchMessages;
}

/**
 * One language picker and one Download button. A report that is not made yet is
 * prepared behind the button, which shows progress and then downloads by itself;
 * the user never has to "prepare" anything. Closing the window keeps the work
 * going and offers the file in a notification. Errors are deliberately generic.
 */
export function ReportDownloader({ reportRef, filename }: Props) {
  const { t, i18n } = useTranslation();
  const ownLanguage = normalizeAppLang(i18n.resolvedLanguage ?? i18n.language);
  const status = useReportStatus(reportRef);
  const prepare = usePrepareReport(reportRef);
  const download = useDownloadReport(reportRef);

  const [chosen, setChosen] = useState<string | null>(null);
  const [waiting, setWaiting] = useState<Waiting | null>(null);
  const [failed, setFailed] = useState(false);
  const requested = useRef(new Set<string>());

  const available = status.data?.available_languages ?? ["en"];
  const lang =
    chosen && available.includes(chosen)
      ? chosen
      : available.includes(ownLanguage)
        ? ownLanguage
        : "en";
  const languageName = (l: string) => LANGUAGE_NAMES[l] ?? l.toUpperCase();

  const messagesFor = (l: string): WatchMessages => ({
    ready: t("reportExport.status.readyToast", { language: languageName(l) }),
    failed: t("reportExport.status.failedToast"),
    download: t("reportExport.status.download"),
  });

  const fail = () => {
    setWaiting(null);
    setFailed(true);
  };

  // Moves a requested download forward each time the status changes.
  useEffect(() => {
    if (!waiting || !status.data || prepare.isPending) return;
    const step = nextDownloadStep(status.data, waiting.lang, false);
    if (step.kind === "download") {
      setWaiting(null);
      download.mutate({ lang: waiting.lang, filename: waiting.filename }, { onError: fail });
    } else if (step.kind === "failed") {
      fail();
    } else if (step.kind === "prepare" && !requested.current.has(step.lang)) {
      requested.current.add(step.lang);
      prepare.mutate({ lang: step.lang }, { onError: fail });
    }
    // `download.mutate` and `prepare.mutate` are stable; `fail` only sets state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status.data, waiting, prepare.isPending]);

  // Closing the window while a report is being prepared keeps the work going.
  const latest = useRef({ reportRef, waiting });
  useEffect(() => {
    latest.current = { reportRef, waiting };
  });
  useEffect(
    () => () => {
      const { reportRef: ref, waiting: pending } = latest.current;
      if (pending) finishInBackground(ref, pending.lang, pending.filename, pending.messages);
    },
    [],
  );

  if (status.isLoading) {
    return (
      <div className="flex gap-3" aria-label={t("reportExport.status.loading")}>
        <Skeleton className="h-10 flex-1 rounded-lg" />
        <Skeleton className="h-10 w-32 rounded-lg" />
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

  const busy = waiting !== null || download.isPending;
  const englishReady = status.data.languages.some((l) => l.lang === "en" && l.state === "ready");

  const onDownload = () => {
    if (!status.data) return;
    setFailed(false);
    const name = filename(lang);
    const step = nextDownloadStep(status.data, lang, true);
    if (step.kind === "download") {
      download.mutate({ lang, filename: name }, { onError: fail });
      return;
    }
    requested.current = new Set();
    setWaiting({ lang, filename: name, messages: messagesFor(lang) });
    if (step.kind === "prepare") {
      requested.current.add(step.lang);
      prepare.mutate({ lang: step.lang }, { onError: fail });
    }
  };

  return (
    <section
      className="space-y-3 rounded-xl border border-border bg-muted/20 p-4"
      aria-live="polite"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        {available.length > 1 && (
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("reportExport.status.language")}
            </span>
            <Select value={lang} onValueChange={setChosen} disabled={busy}>
              <SelectTrigger className="w-full bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[60]">
                {available.map((l) => (
                  <SelectItem key={l} value={l}>
                    {languageName(l)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
        )}
        <button
          type="button"
          onClick={onDownload}
          disabled={busy}
          className="press-feedback inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:cursor-progress disabled:opacity-80"
        >
          {busy ? <Spinner size="sm" /> : <Download className="size-4" aria-hidden />}
          {waiting ? t("reportExport.status.preparing") : t("reportExport.status.download")}
        </button>
      </div>

      {waiting && (
        <p className="text-xs text-muted-foreground">{t("reportExport.status.preparingHint")}</p>
      )}
      {failed && (
        <p role="alert" className="text-xs text-destructive">
          {t("reportExport.status.failed")}
        </p>
      )}

      {englishReady && (
        <div className="flex justify-end border-t border-border/60 pt-2">
          <button
            type="button"
            onClick={() => prepare.mutate({ lang: "en", regenerate: true }, { onError: fail })}
            disabled={busy || prepare.isPending || isPreparing(status.data)}
            title={t("reportExport.status.updateHint")}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RefreshCw className="size-3" aria-hidden />
            {t("reportExport.status.update")}
          </button>
        </div>
      )}
    </section>
  );
}
