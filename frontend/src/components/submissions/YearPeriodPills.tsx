import { useTranslation } from "react-i18next";

import { periodDisplayName, type PeriodState, type YearProgress } from "@/lib/period-rules";

const PILL_STYLES: Record<PeriodState, string> = {
  approved: "border-success/30 bg-success/15 text-success",
  in_review:
    "border-amber-400/50 bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
  draft: "border-info/30 bg-info/10 text-info",
  missing: "border-dashed border-border bg-transparent text-muted-foreground",
};

interface YearPeriodPillsProps {
  progress: YearProgress;
}

/** One pill per period of the year, coloured by where that period stands. */
export function YearPeriodPills({ progress }: YearPeriodPillsProps) {
  const { t } = useTranslation();

  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={t("reportingYears.periodsLabel")}>
      {progress.periods.map(({ period, state }) => {
        const name = periodDisplayName(progress, period);
        const stateLabel = t(`reportingYears.state.${state}`);
        return (
          <li
            key={period}
            title={`${name}: ${stateLabel}`}
            aria-label={`${name}: ${stateLabel}`}
            data-state={state}
            className={`rounded-md border px-2 py-0.5 text-xs font-semibold tabular-nums ${PILL_STYLES[state]}`}
          >
            {name}
          </li>
        );
      })}
    </ul>
  );
}

/** Colour key for the period pills. */
export function YearPeriodLegend() {
  const { t } = useTranslation();
  const states: PeriodState[] = ["approved", "in_review", "draft", "missing"];

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      {states.map((state) => (
        <span key={state} className="inline-flex items-center gap-1.5">
          <span className={`inline-block size-3 rounded-sm border ${PILL_STYLES[state]}`} />
          {t(`reportingYears.state.${state}`)}
        </span>
      ))}
    </div>
  );
}
