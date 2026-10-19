import type { IndicatorValue, SeriesPoint } from "@/types/basic-dashboard";
import type { QuestionnaireNarratives } from "@/types/questionnaire-report";
import { isNotReported } from "@/lib/basic-dashboard";

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

/** The submission's reference, or a code built from its year and id when it has none. */
export const reportCode = (
  year: number | null,
  submissionId: string,
  reference?: string | null,
): string => reference || `SUB-${year ?? "----"}-${submissionId.slice(0, 5).toUpperCase()}`;

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
