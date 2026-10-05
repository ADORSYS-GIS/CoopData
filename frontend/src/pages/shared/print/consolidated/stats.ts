import type { CoopKpiRow, NationalOverviewResponse } from "@/hooks/analytics/useNationalOverview";

export type Tier = "Apex" | "Federation" | "Ministry";
export type Tone = "ok" | "warn" | "bad" | "na";

export interface Totals {
  assets: number;
  loans: number;
  deposits: number;
  equity: number;
  surplus: number;
  members: number;
}

export const sumKpi = (coops: readonly CoopKpiRow[], name: string): number =>
  coops.reduce((total, coop) => total + (coop.kpis?.[name]?.value ?? 0), 0);

export const sumMembers = (coops: readonly CoopKpiRow[]): number =>
  coops.reduce((total, coop) => total + (coop.non_financial?.total_members ?? 0), 0);

export const totalsOf = (coops: readonly CoopKpiRow[]): Totals => ({
  assets: sumKpi(coops, "total_assets"),
  loans: sumKpi(coops, "gross_loan_portfolio"),
  deposits: sumKpi(coops, "total_member_deposits"),
  equity: sumKpi(coops, "total_equity"),
  surplus: sumKpi(coops, "net_surplus"),
  members: sumMembers(coops),
});

/** Simple average across the cooperatives that reported the KPI. */
export const avgKpi = (coops: readonly CoopKpiRow[], name: string): number | null => {
  const values = coops
    .filter((coop) => coop.has_data && coop.kpis?.[name] !== undefined)
    .map((coop) => coop.kpis[name]?.value ?? 0);
  return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null;
};

export interface Change {
  text: string;
  tone: "up" | "down" | "flat";
}

/** Relative change; `null` when there is no prior figure to compare with. */
export const changeOf = (current: number, prior: number | null | undefined): Change | null => {
  if (!prior) return null;
  const pct = ((current - prior) / Math.abs(prior)) * 100;
  return {
    text: `${pct > 0 ? "+" : ""}${pct.toFixed(1)}%`,
    tone: pct > 0 ? "up" : pct < 0 ? "down" : "flat",
  };
};

/** Percentage-point change for ratios. */
export const pointChange = (current: number | null, prior: number | null): Change | null => {
  if (current === null || prior === null) return null;
  const diff = current - prior;
  return {
    text: `${diff > 0 ? "+" : ""}${diff.toFixed(1)} pp`,
    tone: diff > 0 ? "up" : diff < 0 ? "down" : "flat",
  };
};

export const money = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} m`;
  if (abs >= 10_000) return `${(value / 1_000).toFixed(0)} k`;
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
};

export const percent = (value: number | null | undefined, digits = 1): string =>
  value === null || value === undefined || Number.isNaN(value) ? "—" : `${value.toFixed(digits)}%`;

export const integer = (value: number): string =>
  value.toLocaleString("en-US", { maximumFractionDigits: 0 });

interface Benchmark {
  label: string;
  good: number;
  watch: number;
  /** `max`: lower is better; `min`: higher is better. */
  direction: "max" | "min";
}

export const BENCHMARKS: Record<string, Benchmark> = {
  par30: { label: "≤ 5%", good: 5, watch: 10, direction: "max" },
  capital_adequacy_ratio: { label: "≥ 10%", good: 10, watch: 8, direction: "min" },
  roa: { label: "≥ 3%", good: 3, watch: 1, direction: "min" },
  roe: { label: "≥ 8%", good: 8, watch: 4, direction: "min" },
  operating_expense_ratio: { label: "≤ 5%", good: 5, watch: 8, direction: "max" },
  loan_loss_coverage: { label: "≥ 100%", good: 100, watch: 80, direction: "min" },
};

export const toneOf = (name: string, value: number | null | undefined): Tone => {
  const benchmark = BENCHMARKS[name];
  if (!benchmark || value === null || value === undefined || Number.isNaN(value)) return "na";
  if (benchmark.direction === "max") {
    return value <= benchmark.good ? "ok" : value <= benchmark.watch ? "warn" : "bad";
  }
  return value >= benchmark.good ? "ok" : value >= benchmark.watch ? "warn" : "bad";
};

export const TONE_LABEL: Record<Tone, string> = {
  ok: "Meets",
  warn: "Watch",
  bad: "Breach",
  na: "Not reported",
};

export const filingCounts = (data: NationalOverviewResponse) => {
  const filed = data.cooperatives.filter((coop) => coop.has_data).length;
  const total = data.total_cooperatives || data.cooperatives.length;
  return {
    filed,
    total,
    notFiled: Math.max(0, total - filed),
    rate: total > 0 ? (filed / total) * 100 : 0,
  };
};

export const groupBy = <T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> => {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
};

export const chunk = <T>(items: readonly T[], size: number): T[][] => {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size)
    pages.push(items.slice(index, index + size));
  return pages;
};

export const TIER_TITLE: Record<Tier, string> = {
  Apex: "Apex Consolidated Report",
  Federation: "Federation Consolidated Report",
  Ministry: "National Consolidated Report",
};
