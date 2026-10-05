import type { PeriodSeriesPoint } from "@/hooks/analytics/usePeriodSeries";
import type { CoopKpiRow, NationalOverviewResponse } from "@/hooks/analytics/useNationalOverview";
import {
  avgKpi,
  changeOf,
  filingCounts,
  groupBy,
  sumKpi,
  toneOf,
  totalsOf,
  type Change,
  type Tier,
  type Tone,
  type Totals,
} from "@/pages/shared/print/consolidated/stats";

export interface ConsInput {
  tier: Tier;
  entityName: string;
  year: number;
  data: NationalOverviewResponse;
  priorData?: NationalOverviewResponse;
  /** Statement totals per year for the scope, oldest first. */
  trend?: readonly PeriodSeriesPoint[];
  /** AI executive narrative; replaces the generated paragraph when present. */
  narrative?: string | null;
}

export interface Bench {
  /** Text shown in the Benchmark column. */
  label: string;
  tone: (value: number | null) => Tone;
}

const rangeTone =
  (low: number, high: number) =>
  (value: number | null): Tone =>
    value === null ? "na" : value >= low && value <= high ? "ok" : "warn";

export const RATIO_META: Record<
  string,
  { area: string; label: string; formula: string; bench: string }
> = {
  par30: {
    area: "Asset quality",
    label: "Portfolio at risk >30 days",
    formula: "Loans overdue >30 days / gross loans",
    bench: "≤ 5%",
  },
  capital_adequacy_ratio: {
    area: "Capital",
    label: "Capital adequacy",
    formula: "Total equity / total assets",
    bench: "≥ 10%",
  },
  roa: {
    area: "Earnings",
    label: "Return on assets",
    formula: "Net surplus / total assets",
    bench: "≥ 3%",
  },
  roe: {
    area: "Earnings",
    label: "Return on equity",
    formula: "Net surplus / total equity",
    bench: "≥ 8%",
  },
  operating_expense_ratio: {
    area: "Efficiency",
    label: "Operating expense ratio",
    formula: "Operating expenses / total assets",
    bench: "≤ 5%",
  },
  loan_loss_coverage: {
    area: "Provisioning",
    label: "Loan-loss coverage",
    formula: "Provisions / loans overdue",
    bench: "100%",
  },
};

export const RATIO_KEYS = Object.keys(RATIO_META);

export interface RatioRow {
  key: string;
  area: string;
  label: string;
  formula: string;
  bench: string;
  avgNow: number | null;
  avgPrior: number | null;
  aggNow: number | null;
  tone: Tone;
}

const weighted = (coops: readonly CoopKpiRow[], key: string, weightKey: string): number | null => {
  let sum = 0;
  let weight = 0;
  for (const coop of coops) {
    const value = coop.kpis?.[key]?.value;
    const w = coop.kpis?.[weightKey]?.value ?? 0;
    if (coop.has_data && value !== undefined && w > 0) {
      sum += value * w;
      weight += w;
    }
  }
  return weight > 0 ? sum / weight : null;
};

const aggregate = (coops: readonly CoopKpiRow[], key: string): number | null => {
  const totals = totalsOf(coops.filter((c) => c.has_data));
  const ratio = (a: number, b: number) => (b > 0 ? (a / b) * 100 : null);
  switch (key) {
    case "capital_adequacy_ratio":
      return ratio(totals.equity, totals.assets);
    case "roa":
      return ratio(totals.surplus, totals.assets);
    case "roe":
      return ratio(totals.surplus, totals.equity);
    case "par30":
      return weighted(coops, "par30", "gross_loan_portfolio");
    case "operating_expense_ratio":
      return weighted(coops, "operating_expense_ratio", "total_assets");
    default:
      return null;
  }
};

export interface Analysis {
  input: ConsInput;
  coops: CoopKpiRow[];
  filed: CoopKpiRow[];
  prior: CoopKpiRow[] | null;
  now: Totals;
  before: Totals | null;
  filing: ReturnType<typeof filingCounts>;
  ratios: RatioRow[];
  apexes: { name: string; coops: CoopKpiRow[]; filed: CoopKpiRow[] }[];
  priorApexes: Map<string, CoopKpiRow[]>;
  changes: Record<keyof Totals, Change | null>;
}

export const analyse = (input: ConsInput): Analysis => {
  const { data, priorData } = input;
  const coops = data.cooperatives ?? [];
  const filed = coops.filter((c) => c.has_data);
  const prior = priorData ? priorData.cooperatives.filter((c) => c.has_data) : null;
  const now = totalsOf(filed);
  const before = prior && prior.length > 0 ? totalsOf(prior) : null;

  const ratios = RATIO_KEYS.map((key): RatioRow => {
    const meta = RATIO_META[key];
    const avgNow = avgKpi(coops, key);
    return {
      key,
      ...meta,
      avgNow,
      avgPrior: prior ? avgKpi(prior, key) : null,
      aggNow: aggregate(coops, key),
      tone: toneOf(key, avgNow),
    };
  });

  const groups = groupBy(coops, (c) => c.apex_name || "Unaffiliated");
  const priorGroups = prior ? groupBy(prior, (c) => c.apex_name || "Unaffiliated") : new Map();

  const change = (a: number, b: number | undefined) => (before ? changeOf(a, b) : null);
  return {
    input,
    coops,
    filed,
    prior,
    now,
    before,
    filing: filingCounts(data),
    ratios,
    apexes: [...groups].map(([name, members]) => ({
      name,
      coops: members,
      filed: members.filter((c) => c.has_data),
    })),
    priorApexes: priorGroups,
    changes: {
      assets: change(now.assets, before?.assets),
      loans: change(now.loans, before?.loans),
      deposits: change(now.deposits, before?.deposits),
      equity: change(now.equity, before?.equity),
      surplus: change(now.surplus, before?.surplus),
      members: change(now.members, before?.members),
    },
  };
};

export const netLoans = (coops: readonly CoopKpiRow[]): number =>
  sumKpi(coops, "net_loan_portfolio");

export const BENCH: Record<string, Bench> = {
  nlpAssets: { label: "70–80%", tone: rangeTone(70, 80) },
  depositsAssets: { label: "70–80%", tone: rangeTone(70, 80) },
  selfSufficiency: {
    label: "≥ 110%",
    tone: (v) => (v === null ? "na" : v >= 110 ? "ok" : v >= 100 ? "warn" : "bad"),
  },
  liquidity: {
    label: "≥ 15%",
    tone: (v) => (v === null ? "na" : v >= 15 ? "ok" : v >= 10 ? "warn" : "bad"),
  },
};
