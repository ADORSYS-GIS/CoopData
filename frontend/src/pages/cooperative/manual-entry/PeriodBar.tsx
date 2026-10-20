import { Calendar, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";

import { InfoTooltip } from "@/components/ui/info-tooltip";
import { MONTH_NAMES } from "@/lib/period-rules";

import { monthsCoveredLabel, periodMonths, periodShortLabel, type WizardPeriod } from "./period";

const FREQUENCY_KEYS = {
  YEARLY: "yearly",
  QUARTERLY: "quarterly",
  MONTHLY: "monthly",
  SEMI_ANNUAL: "semiAnnual",
} as const;

interface PeriodBarProps {
  period: WizardPeriod;
}

/**
 * The reporting period of the submission being entered. It is chosen when the
 * submission is created and shown here read-only.
 */
export function PeriodBar({ period }: PeriodBarProps) {
  const { t } = useTranslation();
  const months = periodMonths(period.periodType, period.periodValue, period.startMonth);
  const covered = monthsCoveredLabel(months);
  const short = periodShortLabel(period);
  const isFullYear = period.periodType === "MONTHLY" && !short;

  return (
    <div
      className="flex items-center gap-2 flex-wrap rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-2"
      data-testid="period-bar"
    >
      <Lock className="size-3.5 text-primary" aria-hidden="true" />
      <span className="text-sm font-bold text-primary">
        {t(`manualEntry.periodBar.${FREQUENCY_KEYS[period.periodType]}`, { year: period.year })}
      </span>
      {period.periodType !== "YEARLY" && (
        <>
          <span className="text-primary/40" aria-hidden="true">
            ·
          </span>
          <span className="text-sm font-bold text-foreground">
            {isFullYear
              ? t("manualEntry.periodBar.fullYear", { year: period.year })
              : `${short} ${period.year}`}
          </span>
        </>
      )}
      {covered && !isFullYear && (
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Calendar className="size-3.5" aria-hidden="true" />
          {covered}
        </span>
      )}
      {period.periodType !== "MONTHLY" && period.startMonth !== 1 && (
        <span className="text-xs text-muted-foreground">
          {t("manualEntry.periodBar.yearStarts", {
            month: MONTH_NAMES[period.startMonth - 1],
          })}
        </span>
      )}
      <InfoTooltip text={t("manualEntry.periodBar.fixedHint")} />
    </div>
  );
}
