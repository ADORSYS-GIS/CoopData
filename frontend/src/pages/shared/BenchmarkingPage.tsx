import React, { useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CooperativeComparison } from "@/components/analytics/CooperativeComparison";
import { YearPickerFilter } from "@/components/shared/YearPickerFilter";
import { Scale } from "lucide-react";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import { usePeriodOptions } from "@/hooks/analytics/usePeriodOptions";
import { useUserRole } from "@/lib/auth";
import { LATEST } from "@/lib/analytics-filters";

export const BenchmarkingPage: React.FC = () => {
  const { t } = useOrganizationLabelsContext();
  const currentYear = new Date().getFullYear();
  const role = useUserRole();

  // Same source of years as Analytics: reporting years with an approved
  // statement in the caller's scope, so the picker opens back to 2000 and
  // defaults to the latest year that actually has data.
  const periods = usePeriodOptions(role);
  const dataYears = useMemo(() => periods.map((p) => p.reporting_year), [periods]);
  const latestDataYear = dataYears.length > 0 ? Math.max(...dataYears) : currentYear;

  const [year, setYear] = useState<string>(LATEST);
  const selectedYear = year === LATEST ? latestDataYear : Number(year);

  return (
    <AppShell title={t("benchmarking.title")} subtitle={t("benchmarking.subtitle")}>
      <div className="space-y-6">
        {/* Top filter bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Scale className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t("benchmarking.slicers")}
              </h3>
              <p className="text-xs text-slate-500">{t("benchmarking.slicersDesc")}</p>
            </div>
          </div>

          <YearPickerFilter
            label={t("benchmarking.reportingYear")}
            value={year}
            onValueChange={setYear}
            latestValue={LATEST}
            latestLabel={t("basicDashboard.filters.allPeriods")}
            currentYear={currentYear}
          />
        </div>

        {/* Benchmarking Comparison Widget */}
        <CooperativeComparison reportingYear={selectedYear} />
      </div>
    </AppShell>
  );
};
