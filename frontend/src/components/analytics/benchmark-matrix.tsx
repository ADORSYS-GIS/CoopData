import React, { useMemo, useState } from "react";
import { HelpCircle, Search, TrendingUp, TrendingDown } from "lucide-react";
import { Card } from "@/components/app-shell";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  BenchmarkGroup,
  BenchmarkMatrixLabels,
  BenchmarkMetric,
  BenchmarkRow,
} from "@/components/analytics/benchmark-types";

interface BenchmarkMatrixProps {
  metrics: BenchmarkMetric[];
  groups: Record<string, BenchmarkGroup>;
  selectedCoop: BenchmarkRow;
  compareTargetName: string;
  getValue: (row: BenchmarkRow, metricKey: string) => number;
  getCompareValue: (metricKey: string) => number;
  selectedKpi: string;
  onSelectKpi: (key: string) => void;
  formatValue: (val: number, unit: string) => string;
  labels: BenchmarkMatrixLabels;
}

/**
 * The full metric-comparison matrix (search + group filter toolbar and the
 * grouped comparison table). Shared verbatim by the standard and basic
 * benchmarking widgets — the only differences come from the props.
 */
export function BenchmarkMatrix({
  metrics,
  groups,
  selectedCoop,
  compareTargetName,
  getValue,
  getCompareValue,
  selectedKpi,
  onSelectKpi,
  formatValue,
  labels,
}: BenchmarkMatrixProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);

  const filteredMetrics = useMemo(() => {
    return metrics.filter((metric) => {
      const matchesSearch =
        metric.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
        metric.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesGroup = activeGroupFilter === null || metric.group === activeGroupFilter;
      return matchesSearch && matchesGroup;
    });
  }, [searchQuery, activeGroupFilter, metrics]);

  return (
    <Card title={labels.title} subtitle={labels.subtitle}>
      {/* Search + Group Filter toolbar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 mb-4 w-full">
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
            <input
              type="text"
              placeholder={labels.searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-xs bg-slate-50/50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all text-slate-700 dark:text-slate-350"
            />
          </div>

          <Select
            value={activeGroupFilter || "all"}
            onValueChange={(val) => setActiveGroupFilter(val === "all" ? null : val)}
          >
            <SelectTrigger className="w-full sm:w-60 h-9 text-xs bg-slate-50/50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-350">
              <SelectValue placeholder={labels.allCategories(metrics.length)} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                {labels.allCategories(metrics.length)}
              </SelectItem>
              {Object.entries(groups).map(([key, group]) => {
                const count = metrics.filter((m) => m.group === key).length;
                return (
                  <SelectItem key={key} value={key} className="text-xs">
                    {group.label} ({count})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Group filter chips (clickable) */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveGroupFilter(null)}
            className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
              activeGroupFilter === null
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-primary/50"
            }`}
          >
            {labels.comparisonAll}
            <span
              className={`text-[10px] px-1 rounded ${
                activeGroupFilter === null
                  ? "bg-white/20 text-white"
                  : "bg-slate-200/50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400"
              }`}
            >
              {metrics.length}
            </span>
          </button>

          {Object.entries(groups).map(([key, group]) => {
            const count = metrics.filter((m) => m.group === key).length;
            const Icon = group.icon;
            const isActive = activeGroupFilter === key;
            return (
              <button
                key={key}
                onClick={() => setActiveGroupFilter(isActive ? null : key)}
                className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg border transition-all ${
                  isActive
                    ? "bg-primary text-white border-primary shadow-sm"
                    : "bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-primary/50"
                }`}
              >
                <Icon className="size-3" />
                <span>{group.label}</span>
                <span
                  className={`text-[10px] px-1 rounded ${
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-slate-200/50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-100 dark:border-slate-800/60 rounded-xl">
        <table className="w-full text-left text-xs border-collapse font-sans">
          <thead>
            <tr className="border-b border-slate-100 dark:border-slate-850 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-950/20">
              <th className="py-3 px-4">{labels.metricKpi}</th>
              <th className="py-3 px-4 text-right">{selectedCoop.name}</th>
              <th className="py-3 px-4 text-right">{compareTargetName}</th>
              <th className="py-3 px-4 text-right">{labels.variance}</th>
              <th className="py-3 px-4 text-center">{labels.status}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
            {Object.entries(groups).map(([groupKey, groupInfo]) => {
              const groupMetrics = filteredMetrics.filter((m) => m.group === groupKey);
              if (groupMetrics.length === 0) return null;

              const GroupIcon = groupInfo.icon;

              return (
                <React.Fragment key={groupKey}>
                  {/* Group Divider */}
                  <tr className="bg-slate-50/30 dark:bg-slate-950/10">
                    <td
                      colSpan={5}
                      className="py-2.5 px-4 font-bold text-[10px] uppercase tracking-wider text-slate-400 dark:text-slate-500"
                    >
                      <div className="flex items-center gap-1.5 font-sans">
                        <div className={`p-1 rounded ${groupInfo.colorClass}`}>
                          <GroupIcon className="size-3.5" />
                        </div>
                        {groupInfo.label}
                      </div>
                    </td>
                  </tr>

                  {groupMetrics.map((metric) => {
                    const coopVal = getValue(selectedCoop, metric.key);
                    const targetVal = getCompareValue(metric.key);
                    const diff = coopVal - targetVal;
                    const percentDiff = targetVal > 0 ? (diff / targetVal) * 100 : 0;

                    // Direction indicators — a lower value is better for e.g.
                    // expenditure, NPL, PAR, dormancy.
                    const isPositiveIndicator = !(metric.isLowerBetter ?? false);
                    const isBetter = isPositiveIndicator ? diff >= 0 : diff <= 0;

                    return (
                      <tr
                        key={metric.key}
                        className={`group hover:bg-slate-50/30 dark:hover:bg-slate-900/10 transition-colors ${
                          selectedKpi === metric.key
                            ? "bg-primary/5 dark:bg-primary/5 font-semibold"
                            : ""
                        }`}
                      >
                        <td className="py-3 px-4 text-slate-800 dark:text-slate-300">
                          <div className="flex items-center gap-1.5 font-sans">
                            <span
                              className="cursor-pointer hover:text-primary transition-colors flex items-center gap-1.5"
                              onClick={() => onSelectKpi(metric.key)}
                            >
                              {metric.label}
                            </span>
                            <div className="group relative">
                              <HelpCircle className="size-3 text-slate-300 dark:text-slate-650 hover:text-slate-500 cursor-help" />
                              <div className="pointer-events-none absolute left-0 bottom-full mb-1 w-64 rounded-lg bg-slate-950 p-2 text-[10px] text-white opacity-0 shadow-lg transition-all group-hover:opacity-100 z-50 leading-relaxed font-normal">
                                {metric.description}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right num text-slate-900 dark:text-white font-medium font-mono">
                          {formatValue(coopVal, metric.unit)}
                        </td>
                        <td className="py-3 px-4 text-right num text-slate-400 dark:text-slate-500 font-mono">
                          {formatValue(targetVal, metric.unit)}
                        </td>
                        <td
                          className={`py-3 px-4 text-right num font-semibold font-mono ${
                            diff === 0
                              ? "text-slate-450 dark:text-slate-500"
                              : isBetter
                                ? "text-success dark:text-success"
                                : "text-destructive dark:text-destructive"
                          }`}
                        >
                          {diff > 0 ? "+" : ""}
                          {metric.unit === "%"
                            ? `${diff.toFixed(2)}%`
                            : formatValue(diff, metric.unit)}
                          {targetVal > 0 && (
                            <span className="text-[10px] ml-1 opacity-70 font-normal">
                              ({diff > 0 ? "+" : ""}
                              {percentDiff.toFixed(1)}%)
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                              isBetter
                                ? "bg-success/10 dark:bg-success/20 text-success dark:text-success border border-success/20 dark:border-success/30/30"
                                : "bg-destructive/10 dark:bg-destructive/20 text-destructive dark:text-destructive border border-destructive/20 dark:border-destructive/30/30"
                            }`}
                          >
                            {isBetter ? (
                              <>
                                <TrendingUp className="size-2.5" /> {labels.legendHealthy}
                              </>
                            ) : (
                              <>
                                <TrendingDown className="size-2.5" /> {labels.legendWatch}
                              </>
                            )}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
