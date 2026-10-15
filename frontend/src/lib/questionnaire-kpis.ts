import type { KpiItemResponse } from "@/hooks/submissions/useCooperativeKpis";
import type { Balances } from "@/types/basic-dashboard";

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

const money = (name: string, value: number | null, currency: string): KpiItemResponse[] =>
  value === null
    ? []
    : [
        {
          name,
          value,
          unit: "currency",
          formatted: `${currency} ${compact.format(value)}`,
          description: "",
        },
      ];

const percent = (name: string, value: number | null): KpiItemResponse[] =>
  value === null
    ? []
    : [{ name, value, unit: "percent", formatted: `${value.toFixed(1)}%`, description: "" }];

/**
 * Turns the questionnaire's balances into the KPI shape the cooperative dashboard
 * already uses for financial statements, so both get the same boxes and charts.
 * Questions that were not answered produce no KPI (the box shows "—"), never a zero.
 * Questionnaire figures have no benchmarks.
 */
export function questionnaireKpis(
  balances: Balances | undefined,
  currency: string,
): KpiItemResponse[] {
  // Missing in responses from before balances existed (e.g. saved for offline use).
  if (!balances) return [];
  const { gross_loans, overdue_gt_90 } = balances;
  const par90 =
    gross_loans && gross_loans > 0 && overdue_gt_90 !== null
      ? (overdue_gt_90 / gross_loans) * 100
      : null;
  return [
    ...money("total_assets", balances.total_assets, currency),
    ...money("gross_loan_portfolio", gross_loans, currency),
    ...money("total_member_deposits", balances.member_deposits, currency),
    ...money("net_surplus", balances.net_surplus, currency),
    ...percent("par30", balances.par_30_pct),
    ...percent("par90", par90),
    ...percent("capital_ratio", balances.capital_ratio_pct),
  ];
}
