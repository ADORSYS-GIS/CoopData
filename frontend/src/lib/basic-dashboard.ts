import { formatNative, formatUsd } from "@/lib/currency";
import {
  INDICATOR_KEYS,
  type DashboardScope,
  type GenderCount,
  type ShareRow,
  type IndicatorGroup,
  type IndicatorValue,
  type SeriesPoint,
} from "@/types/basic-dashboard";

export type DeltaTone = "good" | "bad" | "neutral";
export type CellTone = "good" | "warn" | "bad" | "neutral";

export const NOT_REPORTED_DASH = "—";

const HIGHER_IS_WORSE_KEYS = new Set([
  "inactive_members",
  "loans_in_arrears_count",
  "total_overdrafts",
  "borrowed_funds_ratio",
  "liquidity_gap_pct",
  "operating_expense_ratio_pct",
]);

export const GROUP_ORDER: IndicatorGroup[] = [
  "membership",
  "savings",
  "loans",
  "risk",
  "liquidity",
  "structure",
  "capital",
  "profitability",
  "governance",
];

export const HEADLINE_KEYS = [
  "registered_members",
  "total_assets",
  "total_deposits",
  "gross_loan_portfolio",
  "par_gt_30_pct",
  "liquidity_ratio_pct",
  "institutional_capital_ratio_pct",
  "net_income",
];

export const isNotReported = (indicator: IndicatorValue): boolean =>
  indicator.status === "not_reported" || indicator.value === null;

export const higherIsWorse = (indicator: IndicatorValue): boolean =>
  indicator.group === "risk" || HIGHER_IS_WORSE_KEYS.has(indicator.key);

const formatCount = (value: number): string =>
  new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(Math.round(value));

const formatPercent = (value: number): string => `${value.toFixed(Math.abs(value) >= 10 ? 1 : 2)}%`;

export const formatMoneyValue = (value: number, currency: string): string =>
  currency === "USD" ? formatUsd(value, 0) : formatNative(value, currency).replace(/\.00$/, "");

export const formatIndicatorValue = (
  indicator: IndicatorValue,
  scope: Pick<DashboardScope, "currency">,
): string => {
  if (isNotReported(indicator) || indicator.value === null) return NOT_REPORTED_DASH;
  const { value, unit } = indicator;
  if (unit === "count") return formatCount(value);
  if (unit === "currency") return formatMoneyValue(value, scope.currency);
  if (unit === "percent") return formatPercent(value);
  return value.toFixed(2);
};

export const formatDelta = (changePct: number | null): string | null => {
  if (changePct === null || !Number.isFinite(changePct)) return null;
  const sign = changePct > 0 ? "+" : "";
  return `${sign}${changePct.toFixed(1)}%`;
};

export const deltaTone = (indicator: IndicatorValue): DeltaTone => {
  const change = indicator.change_pct;
  if (change === null || !Number.isFinite(change) || change === 0) return "neutral";
  const up = change > 0;
  if (higherIsWorse(indicator)) return up ? "bad" : "good";
  return up ? "good" : "bad";
};

export const deltaDirection = (changePct: number | null): "up" | "down" | "flat" => {
  if (changePct === null || !Number.isFinite(changePct) || changePct === 0) return "flat";
  return changePct > 0 ? "up" : "down";
};

export const groupIndicators = (
  indicators: IndicatorValue[],
): Record<IndicatorGroup, IndicatorValue[]> => {
  const result = Object.fromEntries(GROUP_ORDER.map((g) => [g, [] as IndicatorValue[]])) as Record<
    IndicatorGroup,
    IndicatorValue[]
  >;
  for (const indicator of indicators) {
    (result[indicator.group] ?? (result[indicator.group] = [])).push(indicator);
  }
  for (const group of GROUP_ORDER) {
    const order = INDICATOR_KEYS[group];
    result[group].sort((a, b) => {
      const ia = order.indexOf(a.key);
      const ib = order.indexOf(b.key);
      return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib);
    });
  }
  return result;
};

export const indicatorByKey = (
  indicators: IndicatorValue[],
  key: string,
): IndicatorValue | undefined => indicators.find((i) => i.key === key);

export type ChartRow = { label: string } & Record<string, number | string | null>;

export const seriesToChartData = (points: SeriesPoint[] | undefined, keys: string[]): ChartRow[] =>
  (points ?? []).map((point) => {
    const row: ChartRow = { label: point.period_label };
    for (const key of keys) {
      const value = point.values[key];
      row[key] = typeof value === "number" && Number.isFinite(value) ? value : null;
    }
    return row;
  });

export const hasSeriesData = (points: SeriesPoint[] | undefined, keys: string[]): boolean =>
  (points ?? []).some((point) =>
    keys.some((key) => {
      const value = point.values[key];
      return typeof value === "number" && Number.isFinite(value);
    }),
  );

export const compactNumber = (value: number): string => {
  const abs = Math.abs(value);
  if (abs >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(Math.round(value));
};

export const rateNote = (scope: DashboardScope): string | null =>
  scope.currency === "USD" && scope.rate_to_usd
    ? `1 USD = ${scope.rate_to_usd} ${scope.native_currency}`
    : null;

export type RankingKey =
  | "name"
  | "total_members"
  | "total_assets"
  | "total_deposits"
  | "gross_loans"
  | "par_gt_30_pct"
  | "liquidity_ratio_pct"
  | "institutional_capital_ratio_pct"
  | "net_income";

export const sortRows = <T extends object>(
  rows: T[],
  key: keyof T,
  direction: "asc" | "desc",
): T[] => {
  const factor = direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const va = a[key];
    const vb = b[key];
    if (va === null || va === undefined) return vb === null || vb === undefined ? 0 : 1;
    if (vb === null || vb === undefined) return -1;
    if (typeof va === "string" && typeof vb === "string") return va.localeCompare(vb) * factor;
    return ((va as number) - (vb as number)) * factor;
  });
};

export const parTone = (value: number | null): CellTone => {
  if (value === null) return "neutral";
  if (value <= 5) return "good";
  if (value <= 10) return "warn";
  return "bad";
};

export const minimumTone = (value: number | null, minimum: number): CellTone => {
  if (value === null) return "neutral";
  return value >= minimum ? "good" : "bad";
};

export const toneClass = (tone: CellTone | DeltaTone): string => {
  if (tone === "good") return "text-success";
  if (tone === "warn") return "text-warning";
  if (tone === "bad") return "text-destructive";
  return "text-muted-foreground";
};

export const humanizeKey = (key: string): string =>
  key
    .replace(/_pct$/, " %")
    .replace(/_/g, " ")
    .replace(/^\w/, (c) => c.toUpperCase());

export const currencyPrefix = (currency: string): string => (currency === "USD" ? "$" : "");

export const womenSharePct = (counts: GenderCount): number | null => {
  const total = counts.male + counts.female;
  return total > 0 ? (counts.female / total) * 100 : null;
};

export interface DonutSlice {
  name: string;
  value: number;
  share_pct: number;
}

export const topShares = (rows: ShareRow[], max: number, otherLabel: string): DonutSlice[] => {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  if (sorted.length <= max)
    return sorted.map((r) => ({ name: r.name, value: r.value, share_pct: r.share_pct }));
  const head = sorted.slice(0, max - 1);
  const tail = sorted.slice(max - 1);
  return [
    ...head.map((r) => ({ name: r.name, value: r.value, share_pct: r.share_pct })),
    {
      name: otherLabel,
      value: tail.reduce((sum, r) => sum + r.value, 0),
      share_pct: tail.reduce((sum, r) => sum + r.share_pct, 0),
    },
  ];
};
