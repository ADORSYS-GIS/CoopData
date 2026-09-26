import type { IndicatorValue, SeriesPoint } from "@/types/basic-dashboard";
import type { QuestionnaireNarratives } from "@/types/questionnaire-report";
import { isNotReported } from "@/lib/basic-dashboard";

/** The 25 indicators of the regulator "Indicators" panel, in display order. */
export const PANEL_INDICATOR_KEYS = [
  "active_members",
  "inactive_members",
  "number_of_groups",
  "loans_awaiting_approval",
  "total_deposits",
  "total_overdrafts",
  "gross_loan_portfolio",
  "avg_loan_balance",
  "total_disbursed_active",
  "projected_interest_earnings",
  "par_gt_30_pct",
  "par_gt_90_pct",
  "par_30_90_pct",
  "par_180_360_pct",
  "portfolio_at_risk_pct",
  "value_at_risk",
  "var_gt_7",
  "var_gt_30",
  "var_gt_90",
  "deposit_accounts",
  "interest_in_suspense",
  "interest_payable",
  "loans_in_arrears_count",
  "loans_outstanding_count",
  "female_borrowers_pct",
] as const;

/** Overdue-bucket rows of the portfolio quality table: [indicator key, value key]. */
export const OVERDUE_BUCKETS: ReadonlyArray<{ rate: string; amount: string; label: string }> = [
  { rate: "par_gt_7_pct", amount: "var_gt_7", label: "gt7" },
  { rate: "par_gt_30_pct", amount: "var_gt_30", label: "gt30" },
  { rate: "par_30_90_pct", amount: "", label: "d30to90" },
  { rate: "par_gt_90_pct", amount: "var_gt_90", label: "gt90" },
  { rate: "par_180_360_pct", amount: "", label: "d180to360" },
  { rate: "portfolio_at_risk_pct", amount: "value_at_risk", label: "total" },
];

/** Picks indicators by key, keeping the requested order and skipping unknown keys. */
export const pickIndicators = (
  indicators: IndicatorValue[],
  keys: readonly string[],
): IndicatorValue[] =>
  keys
    .map((key) => indicators.find((i) => i.key === key))
    .filter((i): i is IndicatorValue => i !== undefined);

/** Indicators the reader must treat with care: estimated or missing. */
export const methodologyIndicators = (indicators: IndicatorValue[]): IndicatorValue[] =>
  indicators.filter((i) => i.status === "approximate" || isNotReported(i));

export const reportedShare = (
  indicators: IndicatorValue[],
): { reported: number; total: number } => {
  const total = indicators.length;
  const reported = indicators.filter((i) => !isNotReported(i)).length;
  return { reported, total };
};

export const hasHistory = (points: SeriesPoint[] | undefined): boolean => (points?.length ?? 0) > 1;

/** Returns the narrative text only when it has content, so fallbacks render otherwise. */
export const narrativeText = (
  narratives: QuestionnaireNarratives | null | undefined,
  key: keyof QuestionnaireNarratives,
): string | undefined => {
  const text = narratives?.[key]?.trim();
  return text ? text : undefined;
};

export const reportCode = (year: number | null, submissionId: string): string =>
  `SUB-${year ?? "----"}-${submissionId.slice(0, 5).toUpperCase()}`;

const SERIES_LABEL_KEYS: Record<string, string> = {
  maintained_pct: "maintained",
  minimum_pct: "minimum",
  gap_pct: "gap",
  ratio_pct: "capital",
  excess_pct: "excess",
  earning_asset_ratio: "earning",
  member_savings_ratio: "memberSavings",
  member_share_ratio: "memberShares",
  borrowed_funds_ratio: "borrowed",
  par_gt_30_pct: "par30",
  par_gt_90_pct: "par90",
  portfolio_at_risk_pct: "portfolioAtRisk",
  net_income: "netIncome",
};

/** Translation key suffix (under basicDashboard.charts.series) for a series value name. */
export const seriesLabelKey = (valueName: string): string =>
  SERIES_LABEL_KEYS[valueName] ?? valueName;
