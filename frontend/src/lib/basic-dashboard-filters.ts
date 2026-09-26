import type { BasicDashboardParams, PeriodOption } from "@/types/basic-dashboard";

export const ALL = "all";

export interface BasicFilterState {
  year: string;
  periodType: string;
  periodValue: string;
  region: string;
  sector: string;
  cooperativeId: string;
  currency: "usd" | "native";
}

export const DEFAULT_FILTERS: BasicFilterState = {
  year: ALL,
  periodType: ALL,
  periodValue: ALL,
  region: ALL,
  sector: ALL,
  cooperativeId: ALL,
  currency: "usd",
};

export const REGIONS = ["Hhohho", "Lubombo", "Manzini", "Shiselweni"];
export const SECTORS = ["Agriculture", "Finance", "Housing", "Transport", "Manufacturing"];

const unique = <T>(values: T[]): T[] => Array.from(new Set(values));

export const EARLIEST_YEAR = 2000;

/**
 * Every year from the earliest supported one to next year, plus any year that
 * already has data, so an older year can always be chosen.
 */
export const yearOptions = (
  periods: PeriodOption[],
  currentYear: number = new Date().getFullYear(),
): string[] => {
  const range = Array.from(
    { length: currentYear + 1 - EARLIEST_YEAR + 1 },
    (_, index) => currentYear + 1 - index,
  );
  return unique([...range, ...periods.map((p) => p.reporting_year)])
    .sort((a, b) => b - a)
    .map(String);
};

export const periodTypeOptions = (periods: PeriodOption[]): string[] =>
  unique(periods.map((p) => p.period_type));

export const periodOptions = (
  periods: PeriodOption[],
  year: string,
  periodType: string,
): PeriodOption[] =>
  periods.filter(
    (p) =>
      (year === ALL || String(p.reporting_year) === year) &&
      (periodType === ALL || p.period_type === periodType),
  );

export const filtersToParams = (state: BasicFilterState): BasicDashboardParams => {
  const params: BasicDashboardParams = { currency: state.currency };
  if (state.year !== ALL) params.reportingYear = Number(state.year);
  if (state.periodType !== ALL) params.periodType = state.periodType;
  if (state.periodValue !== ALL) params.periodValue = state.periodValue;
  if (state.region !== ALL) params.region = state.region;
  if (state.sector !== ALL) params.sector = state.sector;
  if (state.cooperativeId !== ALL) params.cooperativeId = state.cooperativeId;
  return params;
};
