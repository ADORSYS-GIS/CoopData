import { FileText, X } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ReportRef } from "@/hooks/reports/useReportExport";
import { ReportDownloader } from "./report-downloader";

interface Props {
  title: string;
  subtitle?: string;
  reportRef: ReportRef;
  filename: (lang: string) => string;
  onClose: () => void;
}

/** A dialog showing one report's readiness per language, with its downloads. */
export function ReportDownloadDialog({ title, subtitle, reportRef, filename, onClose }: Props) {
  const { t } = useTranslation();

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-download-title"
    >
      <div onClick={onClose} className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-surface shadow-[var(--shadow-elev-3)]">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-8 shrink-0 place-items-center rounded-xl bg-accent/10">
              <FileText className="size-4 text-accent" aria-hidden />
            </div>
            <div className="min-w-0">
              <h3
                id="report-download-title"
                className="truncate font-heading text-base font-bold text-foreground"
              >
                {title}
              </h3>
              {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("reportExport.close")}
            className="press-feedback rounded-lg p-1.5 text-muted-foreground hover:bg-muted"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5">
          <ReportDownloader reportRef={reportRef} filename={filename} />
        </div>
      </div>
    </div>
  );
}
