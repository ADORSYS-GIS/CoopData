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

export const BenchmarkingPage: React.FC = () => {
  const [selectedYear, setSelectedYear] = useState<string>("2023");

  const yearOptions = ["2023", "2024", "2025"];

  return (
    <AppShell
      title="Performance Benchmarking"
      subtitle="Compare cooperative performance against national averages and system-wide benchmarks"
    >
      <div className="space-y-6">
        {/* Top filter bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-4 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Scale className="size-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Benchmarking Slicers
              </h3>
              <p className="text-xs text-slate-500">
                Filter comparison data by reporting period
              </p>
            </div>
          </div>

          <div className="w-full sm:w-48">
            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1 block">
              Reporting Year
            </label>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select Year" />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y} Calendar Year
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
