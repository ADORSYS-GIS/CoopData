import type { BasicDashboardResponse, IndicatorValue, SeriesPoint } from "@/types/basic-dashboard";

export const makeIndicator = (overrides: Partial<IndicatorValue> = {}): IndicatorValue => ({
  key: "gross_loan_portfolio",
  group: "loans",
  value: 1000,
  unit: "currency",
  status: "computed",
  previous: null,
  change_pct: null,
  formula: "outstanding_value_male + outstanding_value_female",
  sources: ["outstanding_value_male", "outstanding_value_female"],
  note: null,
  ...overrides,
});

const point = (
  label: string,
  year: number,
  value: number,
  extra: Record<string, number> = {},
): SeriesPoint => ({
  period_label: label,
  reporting_year: year,
  period_type: "QUARTERLY",
  period_value: label.slice(0, 2),
  values: { total_assets: value, ...extra },
});

export const basicDashboardFixture: BasicDashboardResponse = {
  scope: {
    level: "consolidated",
    cooperatives_reporting: 3,
    cooperatives_in_scope: 4,
    reporting_year: 2026,
    period_type: "QUARTERLY",
    period_value: "Q1",
    period_label: "Q1 2026",
    currency: "USD",
    native_currency: "SZL",
    rate_to_usd: 18.5,
    available_periods: [
      { reporting_year: 2026, period_type: "QUARTERLY", period_value: "Q1", label: "Q1 2026" },
      { reporting_year: 2025, period_type: "QUARTERLY", period_value: "Q4", label: "Q4 2025" },
    ],
  },
  thresholds: { liquidity_minimum_pct: 15, institutional_capital_minimum_pct: 8 },
  indicators: [
    makeIndicator(),
    makeIndicator({
      key: "par_gt_30_pct",
      group: "risk",
      unit: "percent",
      value: 2.94,
      previous: 4.19,
      change_pct: -29.8,
    }),
    makeIndicator({
      key: "par_gt_90_pct",
      group: "risk",
      unit: "percent",
      value: null,
      status: "not_reported",
    }),
    makeIndicator({
      key: "registered_members",
      group: "membership",
      unit: "count",
      value: 6992,
    }),
  ],
  series: {
    asset_evolution: [
      point("Q1 2025", 2025, 3130874),
      point("Q4 2025", 2025, 3348330),
      point("Q1 2026", 2026, 3485818),
    ],
    par_trend: [
      point("Q1 2025", 2025, 0, { par_gt_30_pct: 5.3 }),
      point("Q1 2026", 2026, 0, { par_gt_30_pct: 2.94 }),
    ],
  },
  market_share: {
    by_assets: [
      { cooperative_id: "a", name: "SNAT", value: 100, share_pct: 60 },
      { cooperative_id: "b", name: "Bunye", value: 66, share_pct: 40 },
    ],
    by_loans: [],
  },
  demographics: {
    registered: { male: 100, female: 50 },
    active: { male: 80, female: 40 },
    age: { age_18_25: 10, age_26_35: 20, age_36_60: 30, age_61_plus: 5 },
    board: { male: 3, female: 2 },
    executive: { male: 2, female: 1 },
    credit_committee: { male: 1, female: 1 },
    savings_accounts: { male: 90, female: 45 },
    loan_accounts: { male: 60, female: 30 },
  },
  cooperatives: [
    {
      cooperative_id: "a",
      name: "SNAT",
      region: "Manzini",
      sector: "Finance",
      total_members: 3000,
      total_assets: 1000,
      total_deposits: 700,
      gross_loans: 600,
      par_gt_30_pct: 3,
      liquidity_ratio_pct: 12,
      institutional_capital_ratio_pct: 14,
      net_income: 50,
    },
    {
      cooperative_id: "b",
      name: "Bunye",
      region: null,
      sector: null,
      total_members: 2000,
      total_assets: 660,
      total_deposits: 400,
      gross_loans: 300,
      par_gt_30_pct: null,
      liquidity_ratio_pct: null,
      institutional_capital_ratio_pct: null,
      net_income: -10,
    },
  ],
};
