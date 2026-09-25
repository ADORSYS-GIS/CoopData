import type { CoopKpiRow } from "@/hooks/analytics/useNationalOverview";
import { isReportedKpi } from "@/lib/kpi-reported";

export type RadarAxis = "liquidity" | "assetQuality" | "earnings" | "capital" | "efficiency";

export interface RadarSpoke {
  axis: RadarAxis;
  /** Consolidated ratio in percent, null when no cooperative reports it. */
  ratio: number | null;
  /** 0 to 100, higher is healthier. */
  score: number | null;
}

interface AxisSpec {
  axis: RadarAxis;
  kpi: string;
  weight: "total_assets" | "gross_loan_portfolio";
  fullScale: number;
  lowerIsBetter: boolean;
}

const SPECS: AxisSpec[] = [
  {
    axis: "liquidity",
    kpi: "liquid_funds_ratio",
    weight: "total_assets",
    fullScale: 30,
    lowerIsBetter: false,
  },
  {
    axis: "assetQuality",
    kpi: "npl_ratio",
    weight: "gross_loan_portfolio",
    fullScale: 10,
    lowerIsBetter: true,
  },
  { axis: "earnings", kpi: "roa", weight: "total_assets", fullScale: 5, lowerIsBetter: false },
  {
    axis: "capital",
    kpi: "capital_adequacy_ratio",
    weight: "total_assets",
    fullScale: 15,
    lowerIsBetter: false,
  },
  {
    axis: "efficiency",
    kpi: "operating_expense_ratio",
    weight: "total_assets",
    fullScale: 10,
    lowerIsBetter: true,
  },
];

const clamp = (value: number): number => Math.min(Math.max(value, 0), 100);

/**
 * One consolidated ratio per axis. Each ratio is weighted by its own
 * denominator (assets or loan book), which reproduces the ratio of the summed
 * figures instead of a plain average of cooperative ratios. Cooperatives that
 * did not report a ratio are left out of that axis.
 */
export const buildNetworkRadar = (coops: readonly CoopKpiRow[]): RadarSpoke[] =>
  SPECS.map((spec) => {
    let weighted = 0;
    let weights = 0;
    for (const coop of coops) {
      const kpi = coop.kpis[spec.kpi];
      const weight = coop.kpis[spec.weight]?.value ?? 0;
      if (!coop.has_data || !isReportedKpi(kpi) || weight <= 0) continue;
      weighted += kpi.value * weight;
      weights += weight;
    }
    if (weights === 0) return { axis: spec.axis, ratio: null, score: null };
    const ratio = weighted / weights;
    const share = (ratio / spec.fullScale) * 100;
    return { axis: spec.axis, ratio, score: clamp(spec.lowerIsBetter ? 100 - share : share) };
  });
