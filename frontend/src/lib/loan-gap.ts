import type { CoopKpiRow } from "@/hooks/analytics/useNationalOverview";
import { isReportedKpi } from "@/lib/kpi-reported";

export interface LoanGapTotals {
  totalGLP: number;
  par30Pct: number;
  provisionsPct: number;
}

/**
 * Portfolio-level PAR 30 and provision coverage. Ratios are weighted, never
 * averaged: PAR 30 by each cooperative's loan book, coverage by its overdue
 * balance, so a small cooperative cannot pull the national figure around.
 */
export const aggregateLoanGap = (coops: readonly CoopKpiRow[]): LoanGapTotals => {
  let totalGLP = 0;
  let par30Weighted = 0;
  let par30Book = 0;
  let overdueTotal = 0;
  let coveredTotal = 0;

  for (const coop of coops) {
    const glp = coop.kpis["gross_loan_portfolio"]?.value ?? 0;
    const par30 = isReportedKpi(coop.kpis["par30"]) ? coop.kpis["par30"].value : undefined;
    const coverage = isReportedKpi(coop.kpis["loan_loss_coverage"])
      ? coop.kpis["loan_loss_coverage"].value
      : undefined;
    totalGLP += glp;

    if (par30 === undefined || glp <= 0) continue;
    par30Weighted += glp * par30;
    par30Book += glp;

    const overdue = glp * (par30 / 100);
    if (coverage !== undefined && overdue > 0) {
      overdueTotal += overdue;
      coveredTotal += overdue * (coverage / 100);
    }
  }

  return {
    totalGLP,
    par30Pct: par30Book > 0 ? par30Weighted / par30Book : 0,
    provisionsPct: overdueTotal > 0 ? (coveredTotal / overdueTotal) * 100 : 0,
  };
};
