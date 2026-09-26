import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ALL,
  periodOptions,
  periodTypeOptions,
  type BasicFilterState,
} from "@/lib/basic-dashboard-filters";
import { YearPickerFilter } from "@/components/shared/YearPickerFilter";
import type { PeriodOption } from "@/types/basic-dashboard";

export interface CooperativeOption {
  id: string;
  name: string;
}

interface BasicFilterBarProps {
  state: BasicFilterState;
  onChange: (patch: Partial<BasicFilterState>) => void;
  onClear: () => void;
  availablePeriods: PeriodOption[];
  cooperatives: CooperativeOption[];
  regions: string[];
  sectors: string[];
  showScopeFilters: boolean;
}

export interface FilterSelectProps {
  label: string;
  disabled?: boolean;
  value: string;
  onValueChange: (value: string) => void;
  options: { value: string; label: string }[];
}

export function FilterSelect({
  label,
  value,
  onValueChange,
  options,
  disabled = false,
}: FilterSelectProps) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-bold">
      <span className="whitespace-nowrap uppercase text-muted-foreground">{label}:</span>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          aria-label={label}
          className="h-auto border-none bg-transparent p-0 font-bold shadow-none focus:ring-0 [&>svg]:opacity-50"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value} className="font-bold">
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function BasicFilterBar({
  state,
  onChange,
  onClear,
  availablePeriods,
  cooperatives,
  regions,
  sectors,
  showScopeFilters,
}: BasicFilterBarProps) {
  const { t } = useTranslation();
  const f = (key: string) => t(`basicDashboard.filters.${key}`);
  const latest = { value: ALL, label: f("allPeriods") };

  const typeLabel = (type: string): string =>
    ({
      YEARLY: f("yearly"),
      SEMI_ANNUAL: f("semiAnnual"),
      QUARTERLY: f("quarterly"),
      MONTHLY: f("monthly"),
    })[type] ?? type;

  const filtered = state.year !== ALL || state.periodType !== ALL || state.periodValue !== ALL;

  return (
    <div className="flex flex-wrap items-center gap-3">
      <YearPickerFilter
        label={f("year")}
        value={state.year}
        onValueChange={(year) => onChange({ year, periodValue: ALL })}
        latestValue={ALL}
        latestLabel={latest.label}
      />
      <FilterSelect
        label={f("periodType")}
        value={state.periodType}
        onValueChange={(periodType) => onChange({ periodType, periodValue: ALL })}
        options={[
          latest,
          ...periodTypeOptions(availablePeriods).map((p) => ({ value: p, label: typeLabel(p) })),
        ]}
      />
      <FilterSelect
        label={f("period")}
        value={state.periodValue}
        onValueChange={(periodValue) => onChange({ periodValue })}
        options={[
          latest,
          ...periodOptions(availablePeriods, state.year, state.periodType).map((p) => ({
            value: p.period_value,
            label: p.label,
          })),
        ]}
      />
      {showScopeFilters && (
        <>
          <FilterSelect
            label={f("region")}
            value={state.region}
            onValueChange={(region) => onChange({ region })}
            options={[
              { value: ALL, label: f("allRegions") },
              ...regions.map((r) => ({
                value: r,
                label: t(`basicDashboard.filters.regions.${r}`, { defaultValue: r }),
              })),
            ]}
          />
          <FilterSelect
            label={f("sector")}
            value={state.sector}
            onValueChange={(sector) => onChange({ sector })}
            options={[
              { value: ALL, label: f("allSectors") },
              ...sectors.map((s) => ({
                value: s,
                label: t(`basicDashboard.filters.sectors.${s}`, { defaultValue: s }),
              })),
            ]}
          />
          {cooperatives.length > 0 && (
            <FilterSelect
              label={f("cooperative")}
              value={state.cooperativeId}
              onValueChange={(cooperativeId) => onChange({ cooperativeId })}
              options={[
                { value: ALL, label: f("allCooperatives") },
                ...cooperatives.map((c) => ({ value: c.id, label: c.name })),
              ]}
            />
          )}
        </>
      )}
      <div
        className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5 text-xs font-bold"
        role="group"
        aria-label={f("currency")}
      >
        {(["usd", "native"] as const).map((currency) => (
          <button
            key={currency}
            type="button"
            onClick={() => onChange({ currency })}
            aria-pressed={state.currency === currency}
            className={`rounded-md px-2.5 py-1 ${
              state.currency === currency
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground"
            }`}
          >
            {f(currency)}
          </button>
        ))}
      </div>
      {(filtered ||
        state.region !== ALL ||
        state.sector !== ALL ||
        state.cooperativeId !== ALL) && (
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
