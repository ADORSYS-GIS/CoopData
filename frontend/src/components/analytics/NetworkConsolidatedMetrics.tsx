import React, { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { IndicatorSearch } from "@/components/analytics/basic/IndicatorSearch";
import { NationalCharts } from "@/components/analytics/national/NationalCharts";
import { NationalMetricSections } from "@/components/analytics/national/NationalMetricSections";
import { buildStatementGroups } from "@/components/analytics/national/statementMetrics";
import { buildHeadlineMetrics, buildMetricGroups } from "@/components/analytics/national/metrics";
import { usePeriodSeries, type PeriodSeriesQuery } from "@/hooks/analytics/usePeriodSeries";
import type { MonthlyTrendResponse } from "@/hooks/analytics/useMonthlyTrend";
import type { NfStatisticsResponse } from "@/hooks/analytics/useNfStatistics";
import { describeRate } from "@/lib/currency";

export interface NetworkConsolidatedMetricsProps {
  nfStats?: NfStatisticsResponse;
  networkTrend?: Pick<MonthlyTrendResponse, "months" | "rates_used">;
  totalCooperatives: number;
  cooperativesWithData: number;
  totalApexes?: number;
  seriesQuery: PeriodSeriesQuery;
}

export const NetworkConsolidatedMetrics: React.FC<NetworkConsolidatedMetricsProps> = ({
  nfStats,
  networkTrend,
  totalCooperatives,
  cooperativesWithData,
  seriesQuery,
}) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");

  const { data: series } = usePeriodSeries(seriesQuery);
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
  const searching = query.trim().length > 0;

  return (
    <div className="space-y-6">
      <IndicatorSearch value={query} onChange={setQuery} />
      <NationalMetricSections
        headline={headline}
        groups={groups}
        query={query}
        noResults={t("basicDashboard.search.noResults", { query })}
      />
      {!searching && (networkTrend?.rates_used ?? []).length > 0 && (
        <p className="text-[11px] text-muted-foreground">
          {(networkTrend?.rates_used ?? []).map(describeRate).join(" · ")}
        </p>
      )}
      {!searching && (
        <NationalCharts nfStats={nfStats} networkTrend={networkTrend} seriesQuery={seriesQuery} />
      )}
    </div>
  );
};
