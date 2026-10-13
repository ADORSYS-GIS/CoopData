export type DashboardLevel = "individual" | "consolidated";
export type IndicatorUnit = "count" | "currency" | "percent" | "ratio";
export type IndicatorStatus = "computed" | "approximate" | "not_reported";
export type IndicatorGroup =
  | "membership"
  | "savings"
  | "risk"
  | "capital"
  | "profitability"
  | "governance"
  | "training"
  | "coa";

export interface PeriodOption {
  reporting_year: number;
  period_type: string;
  period_value: string;
  label: string;
}

export interface DashboardScope {
  level: DashboardLevel;
  cooperatives_reporting: number;
  cooperatives_in_scope: number;
  reporting_year: number | null;
  period_type: string | null;
  period_value: string | null;
  period_label: string;
  currency: string;
  native_currency: string;
  rate_to_zar: number | null;
  available_periods: PeriodOption[];
}

export interface DashboardThresholds {
  liquidity_minimum_pct: number;
  institutional_capital_minimum_pct: number;
}

export interface IndicatorValue {
  key: string;
  group: IndicatorGroup;
  value: number | null;
  unit: IndicatorUnit;
  status: IndicatorStatus;
  previous: number | null;
  change_pct: number | null;
  formula: string;
  sources: string[];
  note: string | null;
}

export interface SeriesPoint {
  period_label: string;
  reporting_year: number;
  period_type: string;
  period_value: string;
  values: Record<string, number>;
}

/** Series are keyed by indicator group; each point maps indicator keys to values. */
export type SeriesKey = IndicatorGroup;

export interface GenderCount {
  male: number;
  female: number;
}

export interface AgeBands {
  age_18_25: number;
  age_26_35: number;
  age_36_60: number;
  age_61_plus: number;
}

export interface Demographics {
  registered: GenderCount;
  active: GenderCount;
  age: AgeBands;
  board: GenderCount;
  executive: GenderCount;
  credit_committee: GenderCount;
  savings_accounts: GenderCount;
  loan_accounts: GenderCount;
}

export interface CooperativeRow {
  cooperative_id: string;
  name: string;
  region: string | null;
  sector: string | null;
  total_members: number;
  active_members_pct: number | null;
  women_members_pct: number | null;
  par_gt_30_pct: number | null;
  total_operating_margin_pct: number | null;
  monetary_reserve_coverage_pct: number | null;
}

export interface BasicDashboardResponse {
  scope: DashboardScope;
  thresholds: DashboardThresholds;
  indicators: IndicatorValue[];
  series: Partial<Record<SeriesKey, SeriesPoint[]>>;
  demographics: Demographics;
  cooperatives: CooperativeRow[];
}

export interface BasicDashboardParams {
  reportingYear?: number;
  periodType?: string;
  periodValue?: string;
  region?: string;
  sector?: string;
  cooperativeId?: string;
  federationId?: string;
  apexId?: string;
}

/** Every indicator key the backend can return, in display order per group. */
export const INDICATOR_KEYS: Record<IndicatorGroup, string[]> = {
  membership: [
    "active_members_pct",
    "women_members_pct",
    "youth_members_pct",
    "female_active_members_pct",
  ],
  governance: ["board_women_pct", "agm_attendance_pct", "meetings_held_count"],
  training: [
    "staff_training_coverage_pct",
    "member_training_coverage_pct",
    "leadership_training_coverage_pct",
  ],
  profitability: [
    "main_activity_operating_margin_pct",
    "total_operating_margin_pct",
    "member_economic_benefit_ratio_pct",
  ],
  savings: [
    "savings_account_penetration_pct",
    "avg_savings_per_depositor",
    "avg_savings_per_depositor_male",
    "avg_savings_per_depositor_female",
  ],
  risk: ["par_gt_30_pct", "delinquent_loan_account_rate_pct", "loan_recovery_rate_pct"],
  capital: ["monetary_reserve_coverage_pct"],
  coa: [
    "operating_profit_margin_pct",
    "net_profit_margin_pct",
    "coa_return_on_assets_pct",
    "coa_return_on_equity_pct",
    "current_ratio",
    "debt_to_equity_ratio",
    "working_capital",
    "days_sales_outstanding",
    "inventory_turnover",
    "operating_cash_flow_ratio",
    "activity_concentration_risk_pct",
    "dscr",
    "cash_liquidity_coverage",
    "interest_coverage",
  ],
};
