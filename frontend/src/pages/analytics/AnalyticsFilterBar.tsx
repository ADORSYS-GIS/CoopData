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
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";

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
  const { t, replaceOrgTerms } = useOrganizationLabelsContext();

  const activeCount = Object.entries(filterValues).filter(
    ([k, v]) => k !== "year" && v !== "all",
  ).length;

  const currentYear = new Date().getFullYear();
  const yearOptions = [
    currentYear + 1,
    currentYear,
    currentYear - 1,
    currentYear - 2,
    currentYear - 3,
    currentYear - 4,
  ].map((y) => ({
    value: String(y),
    label: String(y),
  }));

  const otherFilters = filters.filter((f) => f.id !== "year");

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        {/* Year selector */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold">
          <Calendar className="size-3.5 text-primary" />
          <span className="text-muted-foreground uppercase whitespace-nowrap">
            {t("analyticsFilter.year")}:
          </span>
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

        {/* Period Frequency Selector */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold">
          <SlidersHorizontal className="size-3.5 text-primary" />
          <span className="text-muted-foreground uppercase whitespace-nowrap">Frequency:</span>
          <Select
            value={filterValues.periodType || "YEARLY"}
            onValueChange={(v) => {
              onFilterChange("periodType", v);
              onFilterChange("periodValue", "all");
            }}
          >
            <SelectTrigger className="h-auto border-none bg-transparent p-0 font-bold shadow-none focus:ring-0 [&>svg]:opacity-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="YEARLY" className="font-bold">
                Yearly (Annual)
              </SelectItem>
              <SelectItem value="QUARTERLY" className="font-bold">
                Quarterly
              </SelectItem>
              <SelectItem value="MONTHLY" className="font-bold">
                Monthly
              </SelectItem>
              <SelectItem value="SEMI_ANNUAL" className="font-bold">
                Semi-Annual
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Period Value Selector */}
        {filterValues.periodType && filterValues.periodType !== "YEARLY" && (
          <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold animate-in fade-in duration-150">
            <span className="text-muted-foreground uppercase whitespace-nowrap">Period:</span>
            <Select
              value={filterValues.periodValue || "all"}
              onValueChange={(v) => onFilterChange("periodValue", v)}
            >
              <SelectTrigger className="h-auto border-none bg-transparent p-0 font-bold shadow-none focus:ring-0 [&>svg]:opacity-50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="font-bold">
                  All Periods
                </SelectItem>
                {filterValues.periodType === "QUARTERLY" && (
                  <>
                    <SelectItem value="Q1" className="font-bold">
                      Q1
                    </SelectItem>
                    <SelectItem value="Q2" className="font-bold">
                      Q2
                    </SelectItem>
                    <SelectItem value="Q3" className="font-bold">
                      Q3
                    </SelectItem>
                    <SelectItem value="Q4" className="font-bold">
                      Q4
                    </SelectItem>
                  </>
                )}
                {filterValues.periodType === "MONTHLY" && (
                  <>
                    <SelectItem value="FULL_YEAR" className="font-bold">
                      Full 12 Mo
                    </SelectItem>
                    <SelectItem value="01" className="font-bold">
                      January (01)
                    </SelectItem>
                    <SelectItem value="02" className="font-bold">
                      February (02)
                    </SelectItem>
                    <SelectItem value="03" className="font-bold">
                      March (03)
                    </SelectItem>
                    <SelectItem value="04" className="font-bold">
                      April (04)
                    </SelectItem>
                    <SelectItem value="05" className="font-bold">
                      May (05)
                    </SelectItem>
                    <SelectItem value="06" className="font-bold">
                      June (06)
                    </SelectItem>
                    <SelectItem value="07" className="font-bold">
                      July (07)
                    </SelectItem>
                    <SelectItem value="08" className="font-bold">
                      August (08)
                    </SelectItem>
                    <SelectItem value="09" className="font-bold">
                      September (09)
                    </SelectItem>
                    <SelectItem value="10" className="font-bold">
                      October (10)
                    </SelectItem>
                    <SelectItem value="11" className="font-bold">
                      November (11)
                    </SelectItem>
                    <SelectItem value="12" className="font-bold">
                      December (12)
                    </SelectItem>
                  </>
                )}
                {filterValues.periodType === "SEMI_ANNUAL" && (
                  <>
                    <SelectItem value="H1" className="font-bold">
                      H1 (Jan–Jun)
                    </SelectItem>
                    <SelectItem value="H2" className="font-bold">
                      H2 (Jul–Dec)
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

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
            {t("analyticsFilter.filters")}
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
              <span className="text-[10px] uppercase tracking-wider opacity-60">
                {replaceOrgTerms(filter?.label || "")}:
              </span>
              {replaceOrgTerms(option.label)}
              <button
                onClick={() => onFilterChange(key, "all")}
                className="hover:bg-primary/20 rounded-full p-0.5"
              >
                <X className="size-3" />
              </button>
            </span>
          );
        })}

        {activeCount > 0 && (
          <button
            onClick={onClear}
            className="text-xs font-bold text-muted-foreground hover:text-foreground hover:underline"
          >
            {t("analyticsFilter.clearAll")}
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
              <span className="font-heading font-bold text-sm">
                {t("analyticsFilter.filterAnalytics")}
              </span>
            </div>
            <button
              onClick={() => setShowFilters(false)}
              className="rounded-lg p-1 hover:bg-muted text-muted-foreground"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {otherFilters.map((filter) => {
              const sk = stateKey(filter.id);
              return (
                <div key={filter.id}>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                    {replaceOrgTerms(filter.label)}
                  </label>
                  <select
                    value={filterValues[sk] || "all"}
                    onChange={(e) => onFilterChange(sk, e.target.value)}
                    disabled={filter.disabled}
                    className={`w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring transition-all ${filter.disabled ? "opacity-50 cursor-not-allowed" : ""}`}
                  >
                    {filter.options.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {replaceOrgTerms(opt.label)}
                      </option>
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
