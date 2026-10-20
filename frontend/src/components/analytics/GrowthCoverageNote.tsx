import { Info } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { PeriodSeriesPoint } from "@/hooks/analytics/usePeriodSeries";

interface GrowthCoverageNoteProps {
  /** The newest point of the yearly series (the year shown). */
  point?: PeriodSeriesPoint;
  /** The point before it (the year it is compared with). */
  previous?: PeriodSeriesPoint;
}

/**
 * Explains which cooperatives the growth figures compare when some are new or
 * missing in one of the two years. Nothing when both years have the same ones.
 */
export function GrowthCoverageNote({ point, previous }: GrowthCoverageNoteProps) {
  const { t } = useTranslation();
  const comparison = point?.comparison;
  if (!point || !previous || !comparison) return null;
  const { new_cooperatives: added, missing_cooperatives: missing } = comparison;
  if (added.length === 0 && missing.length === 0) return null;

  return (
    <div
      role="note"
      data-testid="growth-coverage-note"
      className="flex items-start gap-2 rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground"
    >
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <p>
        {t("analytics.growthCoverage.compared", {
          count: comparison.cooperatives_compared,
          current: point.period_label,
          previous: previous.period_label,
        })}{" "}
        {added.length > 0 &&
          t("analytics.growthCoverage.added", {
            names: added.join(", "),
            previous: previous.period_label,
          })}{" "}
        {missing.length > 0 &&
          t("analytics.growthCoverage.missing", {
            names: missing.join(", "),
            current: point.period_label,
          })}
      </p>
    </div>
  );
}
