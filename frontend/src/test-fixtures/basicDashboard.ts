import type { BasicDashboardResponse, IndicatorValue, SeriesPoint } from "@/types/basic-dashboard";

export const makeIndicator = (overrides: Partial<IndicatorValue> = {}): IndicatorValue => ({
  key: "avg_savings_per_depositor",
  group: "savings",
  value: 1000,
  unit: "currency",
  status: "computed",
  previous: null,
  change_pct: null,
  formula: "savings_value / savings_accounts",
  sources: ["savings_value_male", "savings_accounts_male"],
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
  values: { active_members_pct: value, ...extra },
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
    currency: "SZL",
    native_currency: "SZL",
    rate_to_zar: 18.5,
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
      key: "loan_recovery_rate_pct",
      group: "risk",
      unit: "percent",
      value: null,
      status: "not_reported",
    }),
    makeIndicator({
      key: "meetings_held_count",
      group: "governance",
      unit: "count",
      value: 6992,
    }),
  ],
  series: {
    membership: [
      point("Q1 2025", 2025, 71),
      point("Q4 2025", 2025, 74),
      point("Q1 2026", 2026, 78),
    ],
    risk: [
      point("Q1 2025", 2025, 0, { par_gt_30_pct: 5.3 }),
      point("Q1 2026", 2026, 0, { par_gt_30_pct: 2.94 }),
    ],
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
  balances: {
    total_assets: 1_200_000,
    gross_loans: 800_000,
    member_deposits: 500_000,
    net_surplus: 45_000,
    par_30_pct: 6.25,
    capital_ratio_pct: 12.5,
    overdue_gt_30: 50_000,
    overdue_gt_90: 20_000,
  },
  cooperatives: [
    {
      cooperative_id: "a",
      name: "SNAT",
      region: "Manzini",
      sector: "Finance",
      total_members: 3000,
      active_members_pct: 80,
      women_members_pct: 40,
      par_gt_30_pct: 3,
      total_operating_margin_pct: 12,
      monetary_reserve_coverage_pct: null,
    },
    {
      cooperative_id: "b",
      name: "Bunye",
      region: null,
      sector: null,
      total_members: 2000,
      active_members_pct: 80,
      women_members_pct: 40,
      par_gt_30_pct: null,
      total_operating_margin_pct: 12,
      monetary_reserve_coverage_pct: null,
    },
  ],
};
