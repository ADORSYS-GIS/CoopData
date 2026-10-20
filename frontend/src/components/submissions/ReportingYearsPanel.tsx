import { CheckCircle2, Hourglass } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/app-shell";
import { YearPeriodLegend, YearPeriodPills } from "@/components/submissions/YearPeriodPills";
import {
  FREQUENCY_LABEL_KEYS,
  yearProgress,
  type YearProgressSubmission,
} from "@/lib/period-rules";

interface ReportingYearsPanelProps {
  /** Submissions of one cooperative. */
  submissions: YearProgressSubmission[];
}

/**
 * Where each reporting year stands. A year is used in dashboards, analytics and
 * reports only once every period of its frequency is approved.
 */
export function ReportingYearsPanel({ submissions }: ReportingYearsPanelProps) {
  const { t } = useTranslation();
  const years = useMemo(() => yearProgress(submissions), [submissions]);

  if (years.length === 0) return null;

  return (
    <Card
      title={t("reportingYears.title")}
      subtitle={t("reportingYears.subtitle")}
      action={<YearPeriodLegend />}
    >
      <ul className="divide-y divide-border">
        {years.map((progress) => (
          <li
            key={`${progress.cooperativeId}-${progress.year}`}
            className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center"
            data-testid={`reporting-year-${progress.year}`}
          >
            <div className="w-40 shrink-0">
              <p className="text-base font-bold text-foreground tabular-nums">{progress.year}</p>
              <p className="text-xs text-muted-foreground">
                {t(FREQUENCY_LABEL_KEYS[progress.periodType])}
              </p>
            </div>
            <div className="min-w-0 flex-1">
              <YearPeriodPills progress={progress} />
            </div>
            <div className="shrink-0 sm:text-right">
              {progress.complete ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                  <CheckCircle2 className="size-3.5" />
                  {t("reportingYears.counted")}
                </span>
              ) : (
                <div className="flex flex-col gap-0.5 sm:items-end">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 dark:bg-amber-500/15 dark:text-amber-200">
                    <Hourglass className="size-3.5" />
                    {t("reportingYears.approvedOf", {
                      approved: progress.approved,
                      expected: progress.expected,
                    })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t("reportingYears.notCounted")}
                  </span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
