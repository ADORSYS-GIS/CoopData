import { useState } from "react";
import { Filter, X, ChevronDown, ChevronUp, Calendar, SlidersHorizontal } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/app-shell";
import { DateRangePicker, type DateRange } from "@/components/analytics/date-range-picker";
import type { FilterConfig, AnalyticsFilterValues } from "./analyticsTypes";

interface Props {
  filters: FilterConfig[];
  filterValues: AnalyticsFilterValues;
  dateRange: DateRange;
  onFilterChange: (id: string, value: string) => void;
  onDateRangeChange: (range: DateRange) => void;
  onClear: () => void;
}

const stateKey = (filterId: string): keyof AnalyticsFilterValues =>
  filterId === "federation"
    ? "federationId"
    : filterId === "apex"
      ? "apexId"
      : filterId === "cooperative"
        ? "cooperativeId"
        : (filterId as keyof AnalyticsFilterValues);

export function AnalyticsFilterBar({
  filters,
  filterValues,
  dateRange,
  onFilterChange,
  onDateRangeChange,
  onClear,
}: Props) {
  const [showFilters, setShowFilters] = useState(false);

  const activeCount = Object.entries(filterValues).filter(
    ([k, v]) => k !== "year" && v !== "all",
  ).length;

  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear + 1, currentYear, currentYear - 1, currentYear - 2].map(
    (y) => ({ value: String(y), label: String(y) }),
  );

  const otherFilters = filters.filter((f) => f.id !== "year");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Year selector */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold">
          <Calendar className="size-3.5 text-primary" />
          <span className="text-muted-foreground uppercase whitespace-nowrap">Year:</span>
          <Select value={filterValues.year} onValueChange={(v) => onFilterChange("year", v)}>
            <SelectTrigger className="h-auto border-none bg-transparent p-0 font-bold shadow-none focus:ring-0 [&>svg]:opacity-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((o) => (
                <SelectItem key={o.value} value={o.value} className="font-bold">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Filters toggle */}
        {otherFilters.length > 0 && (
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`press-feedback inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-bold transition-all ${
              activeCount > 0
                ? "border-primary bg-primary/5 text-primary"
                : "border-border text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <Filter className="size-3.5" />
            Filters
            {activeCount > 0 && (
              <span className="size-4 rounded-full bg-primary text-primary-foreground text-[10px] grid place-items-center">
                {activeCount}
              </span>
            )}
            {showFilters ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
          </button>
        )}

        {/* Active filter chips */}
        {Object.entries(filterValues).map(([key, value]) => {
          if (key === "year" || value === "all") return null;
          const filter = otherFilters.find((f) => stateKey(f.id) === key);
          const option = filter?.options.find((o) => o.value === value);
          if (!option) return null;
          return (
            <span
              key={key}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 text-primary px-3 py-1 text-xs font-bold"
            >
              <span className="text-[10px] uppercase tracking-wider opacity-60">{filter?.label}:</span>
              {option.label}
              <button onClick={() => onFilterChange(key, "all")} className="hover:bg-primary/20 rounded-full p-0.5">
                <X className="size-3" />
              </button>
            </span>
          );
        })}

        {activeCount > 0 && (
          <button onClick={onClear} className="text-xs font-bold text-muted-foreground hover:text-foreground hover:underline">
            Clear all
          </button>
        )}

        <div className="flex-1" />
        <DateRangePicker value={dateRange} onChange={onDateRangeChange} />
      </div>

      {showFilters && otherFilters.length > 0 && (
        <Card className="border-primary/20 !p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="size-4 text-primary" />
              <span className="font-heading font-bold text-sm">Filter Analytics</span>
            </div>
            <button onClick={() => setShowFilters(false)} className="rounded-lg p-1 hover:bg-muted text-muted-foreground">
              <X className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherFilters.map((filter) => {
              const sk = stateKey(filter.id);
              return (
                <div key={filter.id}>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    {filter.label}
                  </label>
                  <select
                    value={filterValues[sk] || "all"}
                    onChange={(e) => onFilterChange(sk, e.target.value)}
                    disabled={filter.disabled}
                    className={`w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring transition-all ${filter.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {filter.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}
