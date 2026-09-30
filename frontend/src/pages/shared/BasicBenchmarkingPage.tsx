import React, { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { BasicCooperativeComparison } from "@/components/analytics/BasicCooperativeComparison";
import { YearPickerFilter } from "@/components/shared/YearPickerFilter";
import { BarChart3 } from "lucide-react";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import { useBasicDashboard } from "@/hooks/analytics/useBasicDashboard";
import { LATEST } from "@/lib/analytics-filters";

export const BasicBenchmarkingPage: React.FC = () => {
  const { t } = useOrganizationLabelsContext();
  const currentYear = new Date().getFullYear();

  // Every year that has questionnaire data in the caller's scope, so the page
  // can default to the latest one instead of the current calendar year (which
  // is usually empty, showing "No Benchmarking Data" until the user picks a
  // year by hand). The year picker itself opens the same paged grid, back to
  // 2000, used everywhere else in Analytics.
  const { data: dashboard } = useBasicDashboard({}, true);
  const dataYears = useMemo(
    () => (dashboard?.scope.available_periods ?? []).map((p) => p.reporting_year),
    [dashboard],
  );
  const latestDataYear = dataYears.length > 0 ? Math.max(...dataYears) : currentYear;

  const [year, setYear] = useState<string>(LATEST);
  const selectedYear = year === LATEST ? latestDataYear : Number(year);

  return (
    <AppShell
      title={t("basicBenchmarking.pageTitle")}
      subtitle={t("basicBenchmarking.pageSubtitle")}
    >
      <div className="space-y-6">
        {/* Top filter bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <BarChart3 className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t("basicBenchmarking.slicers")}
              </h3>
              <p className="text-xs text-slate-500">{t("basicBenchmarking.slicersDesc")}</p>
            </div>
          </div>

          <YearPickerFilter
            label={t("basicBenchmarking.reportingYear")}
            value={year}
            onValueChange={setYear}
            latestValue={LATEST}
            latestLabel={t("basicDashboard.filters.allPeriods")}
            currentYear={currentYear}
          />
        </div>

        {/* Basic Benchmarking Comparison Widget */}
        <BasicCooperativeComparison reportingYear={selectedYear} />
      </div>
    </AppShell>
  );
};
