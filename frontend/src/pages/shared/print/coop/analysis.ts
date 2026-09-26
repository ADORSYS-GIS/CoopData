import type { KpiItemResponse } from "@/hooks/submissions/useCooperativeKpis";
import {
  buildStatement,
  changePct,
  fmtInt,
  fmtPct,
  kpiOf,
  type Statement,
} from "@/pages/shared/print/coop/data";
import type { ReportDataProps } from "@/pages/shared/print/components/types";
import type { StatusTone } from "@/pages/shared/print/tpl/TplParts";

export interface ScoreRow {
  group: string;
  key: string;
  label: string;
  formula: string;
  bench: string;
  current: number | null;
  prior: number | null;
  tone: StatusTone;
  info?: boolean;
}

interface Def {
  group: string;
  key: string;
  label: string;
  formula: string;
  bench: string;
  /** Threshold for "meets"; `max` means lower is better. */
  good?: number;
  watch?: number;
  dir?: "max" | "min";
}

const DEFS: Def[] = [
  {
    group: "Protection & asset quality",
    key: "par30",
    label: "PAR >30 days",
    formula: "Loans overdue >30 days / gross loans",
    bench: "≤ 5%",
    good: 5,
    watch: 10,
    dir: "max",
  },
  {
    group: "Protection & asset quality",
    key: "par90",
    label: "PAR >90 days",
    formula: "Loans overdue >90 days / gross loans",
    bench: "≤ 2%",
    good: 2,
    watch: 5,
    dir: "max",
  },
  {
    group: "Protection & asset quality",
    key: "npl_ratio",
    label: "Non-performing loans",
    formula: "Loans >90 days / gross loans",
    bench: "≤ 2%",
    good: 2,
    watch: 5,
    dir: "max",
  },
  {
    group: "Protection & asset quality",
    key: "loan_loss_coverage",
    label: "Loan-loss coverage",
    formula: "Provisions / loans overdue >30 days",
    bench: "100%",
    good: 100,
    watch: 80,
    dir: "min",
  },
  {
    group: "Capital structure",
    key: "capital_adequacy_ratio",
    label: "Capital adequacy",
    formula: "Total equity / total assets",
    bench: "≥ 10%",
    good: 10,
    watch: 8,
    dir: "min",
  },
  {
    group: "Capital structure",
    key: "deposits_to_loans",
    label: "Savings to loans",
    formula: "Member savings / gross loans",
    bench: "—",
  },
  {
    group: "Rates of return & costs",
    key: "roa",
    label: "Return on assets",
    formula: "Net surplus / total assets",
    bench: "≥ 3%",
    good: 3,
    watch: 1,
    dir: "min",
  },
  {
    group: "Rates of return & costs",
    key: "roe",
    label: "Return on equity",
    formula: "Net surplus / total equity",
    bench: "≥ 8%",
    good: 8,
    watch: 4,
    dir: "min",
  },
  {
    group: "Rates of return & costs",
    key: "operating_expense_ratio",
    label: "Operating expense ratio",
    formula: "Operating expenses / total assets",
    bench: "≤ 5%",
    good: 5,
    watch: 8,
    dir: "max",
  },
  {
    group: "Rates of return & costs",
    key: "operational_self_sufficiency",
    label: "Operational self-sufficiency",
    formula: "Total income / total expenses",
    bench: "≥ 110%",
    good: 110,
    watch: 100,
    dir: "min",
  },
  {
    group: "Rates of return & costs",
    key: "net_interest_margin",
    label: "Net interest margin",
    formula: "(Interest income − interest expense) / total assets",
    bench: "—",
  },
  {
    group: "Liquidity",
    key: "liquid_funds_ratio",
    label: "Liquid assets / total assets",
    formula: "Liquid assets / total assets",
    bench: "≥ 15%",
    good: 15,
    watch: 10,
    dir: "min",
  },
];

const toneOf = (def: Def, value: number | null, status?: string): StatusTone => {
  if (value === null) return "na";
  if (def.good === undefined || def.watch === undefined || !def.dir) return "na";
  if (status === "green") return "ok";
  if (status === "amber") return "warn";
  if (status === "red") return "bad";
  if (def.dir === "max") return value <= def.good ? "ok" : value <= def.watch ? "warn" : "bad";
  return value >= def.good ? "ok" : value >= def.watch ? "warn" : "bad";
};

export interface CoopAnalysis {
  props: ReportDataProps;
  statement: Statement;
  year: number;
  reported: boolean;
  scorecard: ScoreRow[];
  growth: { label: string; current: number | null }[];
  ref: string;
  validation: ValidationItem[];
  footnote: (key: string) => string | undefined;
}

export interface ValidationItem {
  ref: string;
  key: string;
  item: string;
  system: string;
  used: string;
  note: string;
}

const validate = (
  statement: Statement,
  props: ReportDataProps,
  kpis: readonly KpiItemResponse[],
): ValidationItem[] => {
  const items: ValidationItem[] = [];
  const add = (item: Omit<ValidationItem, "ref">) =>
    items.push({ ...item, ref: `A${items.length + 1}` });
  const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(1, Math.abs(b) * 0.005);
  const { totals, reported, assets, equity } = statement;

  const sumAssets = assets.reduce((s, l) => s + (l.current ?? 0), 0);
  if (
    reported.assets.current !== undefined &&
    assets.length > 0 &&
    !near(sumAssets, reported.assets.current)
  ) {
    add({
      key: "assets",
      item: "Total assets",
      system: fmtInt(reported.assets.current),
      used: fmtInt(reported.assets.current),
      note: `Listed asset lines sum to ${fmtInt(sumAssets)} (difference ${fmtInt(reported.assets.current - sumAssets)}). The reported total is used.`,
    });
  }
  const sumEquity = equity.reduce((s, l) => s + (l.current ?? 0), 0);
  if (
    reported.equity.current !== undefined &&
    equity.length > 0 &&
    !near(sumEquity, reported.equity.current)
  ) {
    add({
      key: "equity",
      item: "Total equity",
      system: fmtInt(reported.equity.current),
      used: fmtInt(reported.equity.current),
      note: `Listed equity lines sum to ${fmtInt(sumEquity)} (difference ${fmtInt(reported.equity.current - sumEquity)}). The reported total is used.`,
    });
  }
  if (
    totals.assets.current > 0 &&
    !near(totals.liabilities.current + totals.equity.current, totals.assets.current)
  ) {
    add({
      key: "balance",
      item: "Balance sheet",
      system: `${fmtInt(totals.assets.current)} vs ${fmtInt(totals.liabilities.current + totals.equity.current)}`,
      used: "Not adjusted",
      note: "Total assets do not equal total liabilities plus equity. The statement does not balance and should be corrected by the cooperative.",
    });
  }
  const surplusFromLines = totals.income.current - Math.abs(totals.expenses.current);
  if (
    reported.surplus.current !== undefined &&
    (totals.income.current !== 0 || totals.expenses.current !== 0) &&
    !near(surplusFromLines, reported.surplus.current)
  ) {
    add({
      key: "surplus",
      item: "Net surplus",
      system: fmtInt(reported.surplus.current),
      used: fmtInt(reported.surplus.current),
      note: `Income minus expenditure gives ${fmtInt(surplusFromLines)}. The reported net surplus is used.`,
    });
  }
  const par30 = kpiOf(kpis, "par30")?.value ?? 0;
  const arrears = props.portfolioData.categories
    .filter((c) => /arrear|overdue|non-perf|npl/i.test(c.category))
    .reduce((sum, c) => sum + c.count, 0);
  if (par30 === 0 && arrears > 0) {
    add({
      key: "par30",
      item: "PAR >30 days",
      system: "0.0%",
      used: "Unverified",
      note: `${arrears} loans are recorded in arrears in the loan register, but the general ledger reports no overdue balance. The two sources are inconsistent.`,
    });
  }
  const members = props.membershipData;
  const byStatus = (members.active_members ?? 0) + (members.inactive_members ?? 0);
  const byGender = (members.male_members ?? 0) + (members.female_members ?? 0);
  if (byStatus > 0 && byGender > 0 && byStatus !== byGender) {
    add({
      key: "members",
      item: "Member counts",
      system: `${fmtInt(byGender)} by gender / ${fmtInt(byStatus)} by status`,
      used: fmtInt(byStatus),
      note: "Member totals differ between the gender and the status breakdowns. The status total is used.",
    });
  }
  return items;
};

export const analyseCoop = (props: ReportDataProps): CoopAnalysis => {
  const statement = buildStatement(props.lineItemsData);
  const kpis = props.kpisData.kpis;
  const priorKpis = props.kpisData.prior_year_kpis;
  const assetsKpi = kpiOf(kpis, "total_assets")?.value ?? statement.totals.assets.current;
  const reported = assetsKpi > 0;

  const scorecard = DEFS.map((def): ScoreRow => {
    const now = kpiOf(kpis, def.key);
    const before = kpiOf(priorKpis, def.key);
    const value = reported && now ? now.value : null;
    return {
      group: def.group,
      key: def.key,
      label: def.label,
      formula: def.formula,
      bench: def.bench,
      current: value,
      prior: before ? before.value : null,
      tone: toneOf(def, value, now?.status),
      info: def.good === undefined,
    };
  });

  const growthOf = (label: string, key: "assets"): { label: string; current: number | null } => ({
    label,
    current: changePct(statement.totals[key].current, statement.totals[key].prior),
  });
  const loansNow = kpiOf(kpis, "gross_loan_portfolio")?.value;
  const loansBefore = kpiOf(priorKpis, "gross_loan_portfolio")?.value;
  const savingsNow = kpiOf(kpis, "total_member_deposits")?.value;
  const savingsBefore = kpiOf(priorKpis, "total_member_deposits")?.value;
  const growth = [
    growthOf("Asset growth", "assets"),
    {
      label: "Loan growth",
      current: loansNow !== undefined ? changePct(loansNow, loansBefore) : null,
    },
    {
      label: "Savings growth",
      current: savingsNow !== undefined ? changePct(savingsNow, savingsBefore) : null,
    },
  ];

  const validation = validate(statement, props, kpis);
  const refByKey = new Map(validation.map((v) => [v.key, v.ref]));
  if (refByKey.has("par30")) {
    for (const row of scorecard) {
      if (["par30", "par90", "npl_ratio"].includes(row.key)) row.tone = "na";
    }
  }

  return {
    props,
    statement,
    year: props.submission.reporting_year,
    reported,
    scorecard,
    growth,
    ref: `SUB-${props.submission.reporting_year}-${props.submissionId.slice(0, 5).toUpperCase()}`,
    validation,
    footnote: (key) => refByKey.get(key),
  };
};

export const pctText = fmtPct;
