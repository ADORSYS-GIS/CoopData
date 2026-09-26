export type DashboardLevel = "individual" | "consolidated";
export type IndicatorUnit = "count" | "currency" | "percent" | "ratio";
export type IndicatorStatus = "computed" | "approximate" | "not_reported";
export type IndicatorGroup =
  | "membership"
  | "savings"
  | "loans"
  | "risk"
  | "liquidity"
  | "structure"
  | "capital"
  | "profitability"
  | "governance";

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
  rate_to_usd: number | null;
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

export type SeriesKey =
  | "asset_evolution"
  | "savings_trend"
  | "loan_portfolio"
  | "par_trend"
  | "liquidity"
  | "financial_structure"
  | "profitability"
  | "institutional_capital";

export interface ShareRow {
  cooperative_id: string;
  name: string;
  value: number;
  share_pct: number;
}

export interface MarketShare {
  by_assets: ShareRow[];
  by_loans: ShareRow[];
}

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
  total_assets: number | null;
  total_deposits: number | null;
  gross_loans: number | null;
  par_gt_30_pct: number | null;
  liquidity_ratio_pct: number | null;
  institutional_capital_ratio_pct: number | null;
  net_income: number | null;
}

export interface BasicDashboardResponse {
  scope: DashboardScope;
  thresholds: DashboardThresholds;
  indicators: IndicatorValue[];
  series: Partial<Record<SeriesKey, SeriesPoint[]>>;
  market_share: MarketShare | null;
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
  currency?: "usd" | "native";
}

/** Every indicator key the backend can return, in display order per group. */
export const INDICATOR_KEYS: Record<IndicatorGroup, string[]> = {
  membership: [
    "registered_members",
    "active_members",
    "inactive_members",
    "active_members_pct",
    "women_members_pct",
    "youth_members_pct",
    "number_of_groups",
  ],
  savings: ["total_deposits", "deposit_accounts", "avg_savings_per_account"],
  loans: [
    "gross_loan_portfolio",
    "loans_outstanding_count",
    "avg_loan_balance",
    "total_disbursed_active",
    "loans_awaiting_approval",
    "loans_in_arrears_count",
    "projected_interest_earnings",
    "female_borrowers_pct",
    "total_overdrafts",
  ],
  risk: [
    "par_gt_7_pct",
    "par_gt_30_pct",
    "par_gt_90_pct",
    "par_30_90_pct",
    "par_180_360_pct",
    "portfolio_at_risk_pct",
    "value_at_risk",
    "var_gt_7",
    "var_gt_30",
    "var_gt_90",
    "interest_in_suspense",
    "interest_payable",
    "written_off_loans",
  ],
  liquidity: ["liquid_assets", "liquidity_ratio_pct", "liquidity_minimum_pct", "liquidity_gap_pct"],
  structure: [
    "total_assets",
    "earning_asset_ratio",
    "member_savings_ratio",
    "member_share_ratio",
    "borrowed_funds_ratio",
    "loans_to_savings_ratio",
  ],
  capital: [
    "institutional_capital",
    "institutional_capital_ratio_pct",
    "institutional_capital_minimum_pct",
    "institutional_capital_excess_pct",
    "total_equity",
    "share_capital",
    "retained_earnings",
    "statutory_reserves",
  ],
  profitability: [
    "total_income",
    "total_expenditure",
    "net_income",
    "return_on_assets_pct",
    "operating_expense_ratio_pct",
  ],
  governance: [
    "board_women_pct",
    "executive_women_pct",
    "credit_committee_women_pct",
    "agm_attendance_pct",
  ],
};
