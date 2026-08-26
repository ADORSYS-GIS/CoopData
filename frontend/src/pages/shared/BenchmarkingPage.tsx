import React, { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { CooperativeComparison } from "@/components/analytics/CooperativeComparison";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Scale } from "lucide-react";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";

export const BenchmarkingPage: React.FC = () => {
  const { t } = useOrganizationLabelsContext();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));

  const yearOptions = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

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

          <div className="w-full sm:w-48">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
              {t("benchmarking.reportingYear")}
            </label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("benchmarking.selectYear")} />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={y}>
                    {t("benchmarking.calendarYear", { year: y })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Benchmarking Comparison Widget */}
        <CooperativeComparison reportingYear={Number(selectedYear)} />
      </div>
    </AppShell>
  );
};
