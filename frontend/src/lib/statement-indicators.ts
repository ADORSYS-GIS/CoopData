export interface StatementPoint {
  assets: number;
  loans: number;
  liquid_assets: number;
  savings: number;
  liabilities: number;
  equity: number;
  total_income: number;
  total_expenses: number;
  net_income: number;
  arrears_1_30: number;
  arrears_31_60: number;
  arrears_61_90: number;
  non_performing: number;
  provisions: number;
  borrowings: number;
  share_capital: number;
  reserves: number;
  statutory_reserve: number;
  retained_earnings: number;
  financial_income: number;
  financial_expenses: number;
}

export type IndicatorGroup =
  "profitability" | "loanQuality" | "liquidity" | "structure" | "capital";

export type IndicatorUnit = "usd" | "pct" | "pct2";

export interface StatementIndicator {
  key: string;
  group: IndicatorGroup;
  unit: IndicatorUnit;
  /** null when the figure cannot be computed: nothing reported, or a zero denominator. */
  value: number | null;
  /** Relative change for money, percentage points for ratios. null without a comparable value. */
  change: number | null;
  higherIsBetter: boolean | null;
}

export const LIQUIDITY_MINIMUM_PCT = 15;
export const INSTITUTIONAL_CAPITAL_MINIMUM_PCT = 8;

const ratio = (part: number, whole: number): number | null =>
  whole > 0 ? (part / whole) * 100 : null;

const arrears30 = (p: StatementPoint): number =>
  p.arrears_31_60 + p.arrears_61_90 + p.non_performing;

const institutionalCapital = (p: StatementPoint): number => p.reserves + p.retained_earnings;

interface Definition {
  key: string;
  group: IndicatorGroup;
  unit: IndicatorUnit;
  higherIsBetter: boolean | null;
  compute: (p: StatementPoint) => number | null;
}

const DEFINITIONS: Definition[] = [
  {
    key: "totalIncome",
    group: "profitability",
    unit: "usd",
    higherIsBetter: true,
    compute: (p) => p.total_income,
  },
  {
    key: "totalExpenditure",
    group: "profitability",
    unit: "usd",
    higherIsBetter: false,
    compute: (p) => p.total_expenses,
  },
  {
    key: "netIncome",
    group: "profitability",
    unit: "usd",
    higherIsBetter: true,
    compute: (p) => p.net_income,
  },
  {
    key: "roa",
    group: "profitability",
    unit: "pct2",
    higherIsBetter: true,
    compute: (p) => (p.assets > 0 ? (p.net_income / p.assets) * 100 : null),
  },
  {
    key: "roe",
    group: "profitability",
    unit: "pct2",
    higherIsBetter: true,
    compute: (p) => (p.equity > 0 ? (p.net_income / p.equity) * 100 : null),
  },
  {
    key: "expensesToIncome",
    group: "profitability",
    unit: "pct",
    higherIsBetter: false,
    compute: (p) => ratio(p.total_expenses, p.total_income),
  },
  {
    key: "selfSufficiency",
    group: "profitability",
    unit: "pct",
    higherIsBetter: true,
    compute: (p) => ratio(p.total_income, p.total_expenses),
  },
  {
    key: "netInterestMargin",
    group: "profitability",
    unit: "pct2",
    higherIsBetter: true,
    compute: (p) =>
      p.assets > 0 ? ((p.financial_income - p.financial_expenses) / p.assets) * 100 : null,
  },

  {
    key: "grossLoans",
    group: "loanQuality",
    unit: "usd",
    higherIsBetter: null,
    compute: (p) => p.loans,
  },
  {
    key: "netLoans",
    group: "loanQuality",
    unit: "usd",
    higherIsBetter: null,
    compute: (p) => p.loans - p.provisions,
  },
  {
    key: "par30",
    group: "loanQuality",
    unit: "pct2",
    higherIsBetter: false,
    compute: (p) => ratio(arrears30(p), p.loans),
  },
  {
    key: "par60",
    group: "loanQuality",
    unit: "pct2",
    higherIsBetter: false,
    compute: (p) => ratio(p.arrears_61_90 + p.non_performing, p.loans),
  },
  {
    key: "par90",
    group: "loanQuality",
    unit: "pct2",
    higherIsBetter: false,
    compute: (p) => ratio(p.non_performing, p.loans),
  },
  {
    key: "valueAtRisk",
    group: "loanQuality",
    unit: "usd",
    higherIsBetter: false,
    compute: arrears30,
  },
  {
    key: "provisions",
    group: "loanQuality",
    unit: "usd",
    higherIsBetter: null,
    compute: (p) => p.provisions,
  },
  {
    key: "provisionCoverage",
    group: "loanQuality",
    unit: "pct",
    higherIsBetter: true,
    compute: (p) => ratio(p.provisions, arrears30(p)),
  },

  {
    key: "liquidAssets",
    group: "liquidity",
    unit: "usd",
    higherIsBetter: null,
    compute: (p) => p.liquid_assets,
  },
  {
    key: "liquidityToSavings",
    group: "liquidity",
    unit: "pct",
    higherIsBetter: true,
    compute: (p) => ratio(p.liquid_assets, p.savings),
  },
  {
    key: "liquidityGap",
    group: "liquidity",
    unit: "pct2",
    higherIsBetter: false,
    compute: (p) => {
      const r = ratio(p.liquid_assets, p.savings);
      return r === null ? null : LIQUIDITY_MINIMUM_PCT - r;
    },
  },

  {
    key: "totalAssets",
    group: "structure",
    unit: "usd",
    higherIsBetter: null,
    compute: (p) => p.assets,
  },
  {
    key: "earningAssetRatio",
    group: "structure",
    unit: "pct",
    higherIsBetter: true,
    compute: (p) => ratio(p.loans + p.liquid_assets, p.assets),
  },
  {
    key: "memberSavingsRatio",
    group: "structure",
    unit: "pct",
    higherIsBetter: null,
    compute: (p) => ratio(p.savings, p.assets),
  },
  {
    key: "memberShareRatio",
    group: "structure",
    unit: "pct",
    higherIsBetter: null,
    compute: (p) => ratio(p.share_capital, p.assets),
  },
  {
    key: "borrowedFundsRatio",
    group: "structure",
    unit: "pct2",
    higherIsBetter: null,
    compute: (p) => ratio(p.borrowings, p.assets),
  },
  {
    key: "loansToSavings",
    group: "structure",
    unit: "pct",
    higherIsBetter: null,
    compute: (p) => ratio(p.loans, p.savings),
  },

  {
    key: "institutionalCapital",
    group: "capital",
    unit: "usd",
    higherIsBetter: true,
    compute: institutionalCapital,
  },
  {
    key: "institutionalCapitalToAssets",
    group: "capital",
    unit: "pct",
    higherIsBetter: true,
    compute: (p) => ratio(institutionalCapital(p), p.assets),
  },
  {
    key: "capitalExcess",
    group: "capital",
    unit: "pct2",
    higherIsBetter: true,
    compute: (p) => {
      const r = ratio(institutionalCapital(p), p.assets);
      return r === null ? null : r - INSTITUTIONAL_CAPITAL_MINIMUM_PCT;
    },
  },
  {
    key: "totalEquity",
    group: "capital",
    unit: "usd",
    higherIsBetter: true,
    compute: (p) => p.equity,
  },
  {
    key: "shareCapital",
    group: "capital",
    unit: "usd",
    higherIsBetter: null,
    compute: (p) => p.share_capital,
  },
  {
    key: "retainedEarnings",
    group: "capital",
    unit: "usd",
    higherIsBetter: true,
    compute: (p) => p.retained_earnings,
  },
  {
    key: "statutoryReserve",
    group: "capital",
    unit: "usd",
    higherIsBetter: true,
    compute: (p) => p.statutory_reserve,
  },
];

export const INDICATOR_GROUPS: IndicatorGroup[] = [
  "profitability",
  "loanQuality",
  "liquidity",
  "structure",
  "capital",
];

const isReported = (p: StatementPoint | undefined): p is StatementPoint =>
  p !== undefined && (p.assets !== 0 || p.loans !== 0 || p.savings !== 0);

const changeOf = (
  unit: IndicatorUnit,
  now: number | null,
  before: number | null,
): number | null => {
  if (now === null || before === null) return null;
  if (unit !== "usd") return now - before;
  return before !== 0 ? ((now - before) / Math.abs(before)) * 100 : null;
};

/**
 * Statement-based indicators for one period, each compared with the previous
 * period of the same frequency. Ratios come from summed figures, never from an
 * average of cooperative ratios.
 */
export const buildStatementIndicators = (
  current: StatementPoint | undefined,
  previous?: StatementPoint,
): StatementIndicator[] =>
  DEFINITIONS.map((definition) => {
    const value = isReported(current) ? definition.compute(current) : null;
    const before = isReported(previous) ? definition.compute(previous) : null;
    return {
      key: definition.key,
      group: definition.group,
      unit: definition.unit,
      value,
      change: changeOf(definition.unit, value, before),
      higherIsBetter: definition.higherIsBetter,
    };
  });
