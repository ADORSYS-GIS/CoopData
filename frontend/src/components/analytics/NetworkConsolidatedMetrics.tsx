import React, { useMemo, useState } from "react";
import { Hourglass } from "lucide-react";
import { useTranslation } from "react-i18next";

import { IndicatorSearch } from "@/components/analytics/basic/IndicatorSearch";
import { GrowthCoverageNote } from "@/components/analytics/GrowthCoverageNote";
import { NationalCharts } from "@/components/analytics/national/NationalCharts";
import { NationalMetricSections } from "@/components/analytics/national/NationalMetricSections";
import { buildStatementGroups } from "@/components/analytics/national/statementMetrics";
import { buildHeadlineMetrics, buildMetricGroups } from "@/components/analytics/national/metrics";
import {
  usePeriodSeries,
  yearSeriesQuery,
  type PeriodSeriesQuery,
} from "@/hooks/analytics/usePeriodSeries";
import type { MonthlyTrendResponse } from "@/hooks/analytics/useMonthlyTrend";
import type { NfStatisticsResponse } from "@/hooks/analytics/useNfStatistics";
import { describeRate } from "@/lib/currency";

export interface NetworkConsolidatedMetricsProps {
  nfStats?: NfStatisticsResponse;
  networkTrend?: Pick<MonthlyTrendResponse, "months" | "rates_used">;
  totalCooperatives: number;
  cooperativesWithData: number;
  /** Cooperatives left out because their year is not complete yet. */
  cooperativesIncomplete?: number;
  totalApexes?: number;
  seriesQuery: PeriodSeriesQuery;
  /** Page-specific chart sections rendered alongside the network charts, before the other stat groups. */
  extraCharts?: React.ReactNode;
}

export const NetworkConsolidatedMetrics: React.FC<NetworkConsolidatedMetricsProps> = ({
  nfStats,
  networkTrend,
  totalCooperatives,
  cooperativesWithData,
  cooperativesIncomplete = 0,
  seriesQuery,
  extraCharts,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  // Cards compare whole years; the charts below follow the chosen frequency.
  const { data: series } = usePeriodSeries(yearSeriesQuery(seriesQuery));
  const groups = useMemo(
    () => [
      ...(nfStats ? buildMetricGroups(nfStats, t) : []),
      ...buildStatementGroups(series?.points ?? [], t),
    ],
    [nfStats, series, t],
  );
  const headline = useMemo(
    () =>
      nfStats
        ? buildHeadlineMetrics({
            nfStats,
            networkTrend,
            cooperativesWithData,
            totalCooperatives,
            t,
          })
        : [],
    [nfStats, networkTrend, cooperativesWithData, totalCooperatives, t],
  );
  const chartsSlot = (
    <>
      <NationalCharts nfStats={nfStats} seriesQuery={seriesQuery} />
      {(networkTrend?.rates_used ?? []).length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {(networkTrend?.rates_used ?? []).map(describeRate).join(" · ")}
        </p>
      )}
      {extraCharts}
    </>
  );

  return (
    <div className="space-y-6">
      {cooperativesIncomplete > 0 && (
        <p
          role="status"
          className="flex items-center gap-2 rounded-xl border border-info/30 bg-info/5 px-4 py-2.5 text-sm text-foreground"
        >
          <Hourglass className="size-4 shrink-0 text-info" aria-hidden="true" />
          {t("reportingYears.leftOut", { count: cooperativesIncomplete })}
        </p>
      )}
      <GrowthCoverageNote
        point={series?.points[series.points.length - 1]}
        previous={series?.points[series.points.length - 2]}
      />
      <IndicatorSearch value={query} onChange={setQuery} />
      <NationalMetricSections
        headline={headline}
        groups={groups}
        query={query}
        noResults={t("basicDashboard.search.noResults", { query })}
        chartsSlot={chartsSlot}
      />
    </div>
  );
};
