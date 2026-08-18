import React, { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { BasicCooperativeComparison } from "@/components/analytics/BasicCooperativeComparison";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BarChart3 } from "lucide-react";
import { useTranslation } from "react-i18next";

export const BasicBenchmarkingPage: React.FC = () => {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));

  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

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

          <div className="w-full sm:w-48">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
              {t("basicBenchmarking.reportingYear")}
            </label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("basicBenchmarking.selectYear")} />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={y}>
                    {t("basicBenchmarking.calendarYear", { year: y })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Basic Benchmarking Comparison Widget */}
        <BasicCooperativeComparison reportingYear={Number(selectedYear)} />
      </div>
    </AppShell>
  );
};
