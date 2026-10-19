import { Hourglass } from "lucide-react";
import { useTranslation } from "react-i18next";

import { YearPeriodPills } from "@/components/submissions/YearPeriodPills";
import type { YearProgress } from "@/lib/period-rules";

interface YearPendingNoticeProps {
  /** The year that is not complete yet. */
  pending: YearProgress;
  /** The complete year shown instead, if any. */
  shownYear?: number;
  /** The user picked this year (a filter): suggest another one instead. */
  chosenYear?: boolean;
}

/**
 * Tells the user a year is left out until every period of it is approved, and
 * where each period stands.
 */
export function YearPendingNotice({ pending, shownYear, chosenYear }: YearPendingNoticeProps) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      data-testid="year-pending-notice"
      className="flex flex-col gap-3 rounded-xl border border-info/30 bg-info/5 px-4 py-3 text-sm sm:flex-row sm:items-center"
    >
      <Hourglass className="size-4 shrink-0 text-info" aria-hidden="true" />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-semibold text-foreground">
          {t("reportingYears.pendingTitle", { year: pending.year })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("reportingYears.pendingBody", {
            approved: pending.approved,
            expected: pending.expected,
          })}{" "}
          {shownYear !== undefined
            ? t("reportingYears.showingYear", { year: shownYear })
            : chosenYear
              ? t("reportingYears.chooseAnotherYear")
              : t("reportingYears.noCompleteYear")}
        </p>
      </div>
      <div className="shrink-0">
        <YearPeriodPills progress={pending} />
      </div>
    </div>
  );
}
