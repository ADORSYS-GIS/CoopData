import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import { YearPickerFilter } from "@/components/shared/YearPickerFilter";
import { FilterSelect } from "@/components/analytics/basic/BasicFilterBar";
import { periodOptions, periodTypeOptions } from "@/lib/basic-dashboard-filters";
import { LATEST } from "@/lib/analytics-filters";
import type { PeriodOption } from "@/types/basic-dashboard";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import type { AnalyticsFilterValues, FilterConfig } from "./analyticsTypes";

interface Props {
  filters: FilterConfig[];
  filterValues: AnalyticsFilterValues;
  periods: PeriodOption[];
  onFilterChange: (id: string, value: string) => void;
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

const ORDER = ["federation", "apex", "region", "sector", "cooperative"];
const byPosition = (a: FilterConfig, b: FilterConfig): number =>
  ORDER.indexOf(a.id) - ORDER.indexOf(b.id);

/**
 * Same inline filter pills as Basic Analytics: year, frequency and period
 * default to "Latest available", followed by the hierarchy filters the role can
 * use. Figures on this dashboard are always shown in USD.
 */
export function AnalyticsFilterBar({
  filters,
  filterValues,
  periods,
  onFilterChange,
  onClear,
}: Props) {
  const { t } = useTranslation();
  const { replaceOrgTerms } = useOrganizationLabelsContext();
  const f = (key: string) => t(`basicDashboard.filters.${key}`);
  const latest = { value: LATEST, label: f("allPeriods") };

  const typeLabel = (type: string): string =>
    ({
      YEARLY: f("yearly"),
      SEMI_ANNUAL: f("semiAnnual"),
      QUARTERLY: f("quarterly"),
      MONTHLY: f("monthly"),
    })[type] ?? type;

  const isFiltered = Object.values(filterValues).some((value) => value !== LATEST);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <YearPickerFilter
        label={f("year")}
        value={filterValues.year}
        onValueChange={(year) => {
          onFilterChange("year", year);
          onFilterChange("periodValue", LATEST);
        }}
        latestValue={LATEST}
        latestLabel={latest.label}
      />
      <FilterSelect
        label={f("periodType")}
        value={filterValues.periodType}
        onValueChange={(type) => {
          onFilterChange("periodType", type);
          onFilterChange("periodValue", LATEST);
        }}
        options={[
          latest,
          ...periodTypeOptions(periods).map((p) => ({ value: p, label: typeLabel(p) })),
        ]}
      />
      <FilterSelect
        label={f("period")}
        value={filterValues.periodValue}
        onValueChange={(value) => onFilterChange("periodValue", value)}
        options={[
          latest,
          ...periodOptions(periods, filterValues.year, filterValues.periodType).map((p) => ({
            value: p.period_value,
            label: p.label,
          })),
        ]}
      />
      {[...filters].sort(byPosition).map((filter) => {
        const key = stateKey(filter.id);
        return (
          <FilterSelect
            key={filter.id}
            label={replaceOrgTerms(filter.label)}
            value={filterValues[key] || LATEST}
            disabled={filter.disabled}
            onValueChange={(value) => onFilterChange(key, value)}
            options={filter.options.map((option) => ({
              value: option.value,
              label: replaceOrgTerms(option.label),
            }))}
          />
        );
      })}
      <div className="flex items-center rounded-lg border border-border bg-background p-0.5 text-xs font-bold">
        <span className="rounded-md bg-primary px-2.5 py-1 text-primary-foreground">
          {f("usd")}
        </span>
      </div>
      {isFiltered && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex items-center gap-1 text-xs font-bold text-muted-foreground hover:text-foreground hover:underline"
        >
          <X className="size-3" />
          {f("clear")}
        </button>
      )}
    </div>
  );
}
