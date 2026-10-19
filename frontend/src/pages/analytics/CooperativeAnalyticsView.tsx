import { isReportedKpi } from "@/lib/kpi-reported";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { IndicatorSearch } from "@/components/analytics/basic/IndicatorSearch";
import { FlatCard as Card } from "@/components/analytics/national/FlatCard";
import { buildKpiCards } from "@/components/analytics/national/kpiCards";
import { NationalMetricSections } from "@/components/analytics/national/NationalMetricSections";
import { buildStatementGroups } from "@/components/analytics/national/statementMetrics";
import { buildMetricGroups } from "@/components/analytics/national/metrics";
import { PanelSkeleton } from "@/components/ui/skeletons";
import { Skeleton } from "@/components/ui/skeleton";
import { usePeriodSeries } from "@/hooks/analytics/usePeriodSeries";
import { useNfStatistics } from "@/hooks/analytics/useNfStatistics";
import { useCooperativeKpis } from "@/hooks/submissions/useCooperativeKpis";
import { useAnalyticsYear } from "@/hooks/submissions/useLatestSubmission";
import { YearPendingNotice } from "@/components/submissions/YearPendingNotice";
import { useUserRole } from "@/lib/auth";
import { CooperativeCharts } from "./CooperativeCharts";
import type { AnalyticsFilterValues } from "./analyticsTypes";

interface Props {
  filterValues: AnalyticsFilterValues;
}

function KpiSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <PanelSkeleton />
        <PanelSkeleton />
      </div>
    </div>
  );
}

export function CooperativeAnalyticsView({ filterValues }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const reportingYear = Number(filterValues.year);
  const isCooperative = useUserRole() === "cooperative";

  const { submission: latest, pending } = useAnalyticsYear(
    reportingYear,
    filterValues.cooperativeId,
  );
  const hasApproved = !!latest;
  const scope = { reportingYear, cooperativeId: latest?.cooperative_id };
  const seriesQuery = {
    ...scope,
    periodType: filterValues.periodType,
    periodValue: filterValues.periodValue,
  };

  const { data: kpisData, isLoading: kpisLoading } = useCooperativeKpis(
    latest?.id,
    undefined,
    "year",
  );
  const { data: nfStats } = useNfStatistics(isCooperative, scope, hasApproved);

  const kpiMap = useMemo(
    () =>
      Object.fromEntries(
        (kpisData?.kpis ?? []).filter((k) => isReportedKpi(k)).map((k) => [k.name, k.value]),
      ),
    [kpisData],
  );
  const headline = useMemo(() => buildKpiCards(kpisData?.kpis ?? [], t), [kpisData, t]);
  const { data: series } = usePeriodSeries(seriesQuery, hasApproved);
  const groups = useMemo(
    () => [
      ...(nfStats ? buildMetricGroups(nfStats, t) : []),
      ...buildStatementGroups(series?.points ?? [], t),
    ],
    [nfStats, series, t],
  );
  if (!latest && pending) {
    return <YearPendingNotice pending={pending} />;
  }
  if (!latest) {
    return (
      <Card
        title={t("cooperativeAnalytics.noSubmissionTitle")}
        info={t("cooperativeAnalytics.noSubmissionInfo")}
      >
        <p className="text-sm text-muted-foreground">
          {t("cooperativeAnalytics.noSubmissionDesc")}
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <IndicatorSearch value={query} onChange={setQuery} />
      {kpisLoading && <KpiSkeleton />}
      <NationalMetricSections
        headline={headline}
        groups={groups}
        query={query}
        noResults={t("basicDashboard.search.noResults", { query })}
        chartsSlot={
          <CooperativeCharts
            kpiMap={kpiMap}
            hasKpis={!!kpisData}
            nfStats={nfStats}
            points={series?.points}
            seriesQuery={seriesQuery}
          />
        }
      />
    </div>
  );
}
