import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Lock,
  RotateCcw,
  FilePlus2,
} from "lucide-react";
import { useTranslation } from "react-i18next";

import { Spinner } from "@/components/ui/spinner";

/** What a user can do with one language of a report right now. */
export type RowState = "ready" | "preparing" | "failed" | "notPrepared" | "locked";

interface Props {
  name: string;
  state: RowState;
  /** English is generated from the data; other languages are translated from it. */
  isEnglish: boolean;
  isOwnLanguage: boolean;
  /** An action of this row is in flight (request sent, waiting for the server). */
  pending: boolean;
  onPrepare: () => void;
  onDownload: () => void;
}

const TONE: Record<RowState, string> = {
  ready: "border-success/25 bg-success/5",
  preparing: "border-accent/30 bg-accent/5",
  failed: "border-destructive/25 bg-destructive/5",
  notPrepared: "border-border bg-surface",
  locked: "border-dashed border-border bg-muted/20",
};

const ICON = {
  ready: <CheckCircle2 className="size-4 text-success" aria-hidden />,
  preparing: <Spinner size="sm" />,
  failed: <AlertTriangle className="size-4 text-destructive" aria-hidden />,
  notPrepared: <Clock className="size-4 text-muted-foreground" aria-hidden />,
  locked: <Lock className="size-4 text-muted-foreground/70" aria-hidden />,
} satisfies Record<RowState, React.ReactNode>;

/** One language of a report: its state and the single action that makes sense for it. */
export function ReportLanguageRow({
  name,
  state,
  isEnglish,
  isOwnLanguage,
  pending,
  onPrepare,
  onDownload,
}: Props) {
  const { t } = useTranslation();

  const description = {
    ready: t("reportExport.status.ready"),
    preparing: isEnglish
      ? t("reportExport.status.preparingEnglish")
      : t("reportExport.status.translating"),
    failed: t("reportExport.status.failed"),
    notPrepared: isEnglish
      ? t("reportExport.status.notPreparedEnglish")
      : t("reportExport.status.notPrepared"),
    locked: t("reportExport.status.locked"),
  }[state];

  const button =
    "press-feedback inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors disabled:opacity-50";

  return (
    <li
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${TONE[state]}`}
      aria-busy={state === "preparing"}
    >
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-background/80 ring-1 ring-border/60">
        {ICON[state]}
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
          {name}
          {isOwnLanguage && (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent">
              {t("reportExport.status.yourLanguage")}
            </span>
          )}
        </p>
        <p
          className={`text-xs leading-relaxed ${state === "failed" ? "text-destructive" : "text-muted-foreground"}`}
          role={state === "failed" ? "alert" : undefined}
        >
          {description}
        </p>
      </div>

      {state === "ready" && (
        <button
          type="button"
          onClick={onDownload}
          disabled={pending}
          className={`${button} bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm`}
        >
          {pending ? <Spinner size="sm" /> : <Download className="size-3.5" aria-hidden />}
          {t("reportExport.status.download")}
        </button>
      )}
      {state === "notPrepared" && (
        <button
          type="button"
          onClick={onPrepare}
          disabled={pending}
          className={`${button} border border-accent/40 bg-accent/10 text-accent hover:bg-accent/15`}
        >
          {pending ? <Spinner size="sm" /> : <FilePlus2 className="size-3.5" aria-hidden />}
          {t("reportExport.status.prepare")}
        </button>
      )}
      {state === "failed" && (
        <button
          type="button"
          onClick={onPrepare}
          disabled={pending}
          className={`${button} border border-border bg-background text-foreground hover:bg-muted`}
        >
          {pending ? <Spinner size="sm" /> : <RotateCcw className="size-3.5" aria-hidden />}
          {t("reportExport.status.tryAgain")}
        </button>
      )}
    </li>
  );
}
