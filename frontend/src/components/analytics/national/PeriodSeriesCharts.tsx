import { useMemo } from "react";

import { ProfitabilityChart } from "@/components/analytics/basic/ProfitabilityChart";
import { StructureChart } from "@/components/analytics/basic/StructureChart";
import { usePeriodSeries, type PeriodSeriesQuery } from "@/hooks/analytics/usePeriodSeries";
import { toProfitabilitySeries, toStructureSeries } from "@/lib/period-series";

/**
 * Financial structure and profitability per period. The periods use the
 * frequency chosen in the filters: years for yearly, quarters for quarterly.
 */
export function PeriodSeriesCharts({ query }: { query: PeriodSeriesQuery }) {
  const { data } = usePeriodSeries(query);
  const points = useMemo(() => data?.points ?? [], [data]);
  const structure = useMemo(() => toStructureSeries(points), [points]);
  const profitability = useMemo(() => toProfitabilitySeries(points), [points]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <StructureChart points={structure} />
      <ProfitabilityChart points={profitability} currency="USD" />
    </div>
  );
}
