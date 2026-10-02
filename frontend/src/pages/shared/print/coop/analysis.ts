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
import { localizePercent, tr } from "@/pages/shared/print/tpl/i18n";

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

type GroupId = "protection" | "capital" | "returns" | "liquidity";

interface Def {
  group: GroupId;
  key: string;
  bench: string;
  /** Threshold for "meets"; `max` means lower is better. */
  good?: number;
  watch?: number;
  dir?: "max" | "min";
}

const DEFS: Def[] = [
  {
    group: "protection",
    key: "par30",
    bench: "≤ 5%",
    good: 5,
    watch: 10,
    dir: "max",
  },
  {
    group: "protection",
    key: "par90",
    bench: "≤ 2%",
    good: 2,
    watch: 5,
    dir: "max",
  },
  {
    group: "protection",
    key: "npl_ratio",
    bench: "≤ 2%",
    good: 2,
    watch: 5,
    dir: "max",
  },
  {
    group: "protection",
    key: "loan_loss_coverage",
    bench: "100%",
    good: 100,
    watch: 80,
    dir: "min",
  },
  {
    group: "capital",
    key: "capital_adequacy_ratio",
    bench: "≥ 10%",
    good: 10,
    watch: 8,
    dir: "min",
  },
  {
    group: "capital",
    key: "deposits_to_loans",
    bench: "—",
  },
  {
    group: "returns",
    key: "roa",
    bench: "≥ 3%",
    good: 3,
    watch: 1,
    dir: "min",
  },
  {
    group: "returns",
    key: "roe",
    bench: "≥ 8%",
    good: 8,
    watch: 4,
    dir: "min",
  },
  {
    group: "returns",
    key: "operating_expense_ratio",
    bench: "≤ 5%",
    good: 5,
    watch: 8,
    dir: "max",
  },
  {
    group: "returns",
    key: "operational_self_sufficiency",
    bench: "≥ 110%",
    good: 110,
    watch: 100,
    dir: "min",
  },
  {
    group: "returns",
    key: "net_interest_margin",
    bench: "—",
  },
  {
    group: "liquidity",
    key: "liquid_funds_ratio",
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
      item: tr("coop.validation.total_assets"),
      system: fmtInt(reported.assets.current),
      used: fmtInt(reported.assets.current),
      note: tr("coop.validation.assets_note", {
        sum: fmtInt(sumAssets),
        diff: fmtInt(reported.assets.current - sumAssets),
      }),
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
      item: tr("coop.validation.total_equity"),
      system: fmtInt(reported.equity.current),
      used: fmtInt(reported.equity.current),
      note: tr("coop.validation.equity_note", {
        sum: fmtInt(sumEquity),
        diff: fmtInt(reported.equity.current - sumEquity),
      }),
    });
  }
  if (
    totals.assets.current > 0 &&
    !near(totals.liabilities.current + totals.equity.current, totals.assets.current)
  ) {
    add({
      key: "balance",
      item: tr("coop.validation.balance_sheet"),
      system: tr("coop.validation.balance_system", {
        assets: fmtInt(totals.assets.current),
        funding: fmtInt(totals.liabilities.current + totals.equity.current),
      }),
      used: tr("coop.validation.not_adjusted"),
      note: tr("coop.validation.balance_note"),
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
      item: tr("coop.validation.net_surplus"),
      system: fmtInt(reported.surplus.current),
      used: fmtInt(reported.surplus.current),
      note: tr("coop.validation.surplus_note", { value: fmtInt(surplusFromLines) }),
    });
  }
  const par30 = kpiOf(kpis, "par30")?.value ?? 0;
  const arrears = props.portfolioData.categories
    .filter((c) => /arrear|overdue|non-perf|npl/i.test(c.category))
    .reduce((sum, c) => sum + c.count, 0);
  if (par30 === 0 && arrears > 0) {
    add({
      key: "par30",
      item: tr("coop.validation.par30"),
      system: fmtPct(0),
      used: tr("coop.validation.unverified"),
      note: tr("coop.validation.par30_note", { count: arrears }),
    });
  }
  const members = props.membershipData;
  const byStatus = (members.active_members ?? 0) + (members.inactive_members ?? 0);
  const byGender = (members.male_members ?? 0) + (members.female_members ?? 0);
  if (byStatus > 0 && byGender > 0 && byStatus !== byGender) {
    add({
      key: "members",
      item: tr("coop.validation.member_counts"),
      system: tr("coop.validation.members_system", {
        gender: fmtInt(byGender),
        status: fmtInt(byStatus),
      }),
      used: fmtInt(byStatus),
      note: tr("coop.validation.members_note"),
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
      group: tr(`coop.groups.${def.group}`),
      key: def.key,
      label: tr(`coop.ratios.${def.key}.label`),
      formula: tr(`coop.ratios.${def.key}.formula`),
      bench: localizePercent(def.bench),
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
    growthOf(tr("coop.growth.assets"), "assets"),
    {
      label: tr("coop.growth.loans"),
      current: loansNow !== undefined ? changePct(loansNow, loansBefore) : null,
    },
    {
      label: tr("coop.growth.savings"),
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
