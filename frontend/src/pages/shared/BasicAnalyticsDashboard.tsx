import { CoopTypeScopeNotice } from "@/components/shared/CoopTypeScopeNotice";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppShell } from "@/components/app-shell";
import { MinistryStatsCards } from "@/components/analytics/MinistryStatsCards";
import { BasicFilterBar } from "@/components/analytics/basic/BasicFilterBar";
import { CollapsibleSection } from "@/components/analytics/national/CollapsibleSection";
import { CooperativeRankingTable } from "@/components/analytics/basic/CooperativeRankingTable";
import { DemographicsPanel } from "@/components/analytics/basic/DemographicsPanel";
import { IndicatorSearch } from "@/components/analytics/basic/IndicatorSearch";
import { HeadlineStrip } from "@/components/analytics/basic/HeadlineStrip";
import { IndicatorGroupSection } from "@/components/analytics/basic/IndicatorGroupSection";
import { ScopeHeader } from "@/components/analytics/basic/ScopeHeader";
import { GroupTrendChart } from "@/components/analytics/basic/GroupTrendChart";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/AuthContext";
import { useBasicDashboard } from "@/hooks/analytics/useBasicDashboard";
import { useCooperatives } from "@/hooks/cooperatives/useCooperatives";
import { useAnalyticsYear } from "@/hooks/submissions/useLatestSubmission";
import { YearPendingNotice } from "@/components/submissions/YearPendingNotice";
import {
  ALL,
  DEFAULT_FILTERS,
  REGIONS,
  SECTORS,
  filtersToParams,
  type BasicFilterState,
} from "@/lib/basic-dashboard-filters";
import { HEADLINE_KEYS, humanizeKey } from "@/lib/basic-dashboard";
import {
  INDICATOR_KEYS,
  type BasicDashboardResponse,
  type IndicatorGroup,
} from "@/types/basic-dashboard";

const TREND_CHARTS: { group: IndicatorGroup; keys: string[] }[] = [
  { group: "membership", keys: INDICATOR_KEYS.membership },
  { group: "governance", keys: ["board_women_pct", "agm_attendance_pct"] },
  { group: "training", keys: INDICATOR_KEYS.training },
  { group: "profitability", keys: INDICATOR_KEYS.profitability },
  { group: "risk", keys: INDICATOR_KEYS.risk },
  { group: "coa", keys: ["operating_profit_margin_pct", "net_profit_margin_pct"] },
];

function DashboardBody({ data, query }: { data: BasicDashboardResponse; query: string }) {
  const { t } = useTranslation();
  const { scope, series } = data;
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? data.indicators.filter((indicator) => {
        const label = t(`basicDashboard.indicators.${indicator.key}`, {
          defaultValue: humanizeKey(indicator.key),
        });
        return `${label} ${indicator.key}`.toLowerCase().includes(needle);
      })
    : [];

  return (
    <div className="space-y-8">
      <ScopeHeader scope={scope} />
      {scope.cooperatives_reporting === 0 ? (
        <div className="rounded-xl border border-dashed border-border py-16 text-center text-sm text-muted-foreground">
          {t("basicDashboard.empty")}
        </div>
      ) : needle ? (
        matches.length > 0 ? (
          <IndicatorGroupSection indicators={matches} scope={scope} />
        ) : (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {t("basicDashboard.search.noResults", { query })}
          </div>
        )
      ) : (
        <>
          <CollapsibleSection
            id="basic-headline"
            title={t("basicDashboard.sections.keyIndicators")}
            count={HEADLINE_KEYS.length}
          >
            <HeadlineStrip indicators={data.indicators} scope={scope} />
          </CollapsibleSection>

          <CollapsibleSection id="basic-trends" title={t("basicDashboard.sections.trends")}>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {TREND_CHARTS.map(({ group, keys }) => (
                <GroupTrendChart key={group} group={group} keys={keys} points={series[group]} />
              ))}
            </div>
          </CollapsibleSection>
          <CollapsibleSection id="basic-members" title={t("basicDashboard.sections.members")}>
            <div className="space-y-6">
              <DemographicsPanel demographics={data.demographics} />
            </div>
          </CollapsibleSection>
          <CollapsibleSection id="basic-ranking" title={t("basicDashboard.sections.ranking")}>
            <div className="space-y-6">
              <CooperativeRankingTable rows={data.cooperatives} />
            </div>
          </CollapsibleSection>

          <IndicatorGroupSection indicators={data.indicators} scope={scope} />
        </>
      )}
    </div>
  );
}

export function BasicAnalyticsDashboard() {
  const { t } = useTranslation();
  const { role } = useAuth();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<BasicFilterState>(DEFAULT_FILTERS);
  const isCooperative = role === "cooperative";

  const params = useMemo(() => filtersToParams(filters), [filters]);
  const { pending } = useAnalyticsYear(filters.year === ALL ? undefined : Number(filters.year));
  const { data, isLoading, error } = useBasicDashboard(params);
  const { data: cooperatives = [] } = useCooperatives();

  const statsParams = useMemo(
    () => ({
      reportingYear: params.reportingYear,
      region: params.region,
      sector: params.sector,
      cooperativeId: params.cooperativeId,
      institutionType: "multipurpose" as const,
    }),
    [params],
  );

  const cooperativeOptions = useMemo(
    () => cooperatives.map((c) => ({ id: c.id, name: c.name })),
    [cooperatives],
  );

  return (
    <AppShell
      title={t("basicDashboard.title")}
      subtitle={t("basicDashboard.subtitle")}
      actions={<CoopTypeScopeNotice page="basicAnalytics" />}
    >
      <div className="space-y-6">
        <BasicFilterBar
          state={filters}
          onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onClear={() => setFilters(DEFAULT_FILTERS)}
          availablePeriods={data?.scope?.available_periods ?? []}
          cooperatives={cooperativeOptions}
          regions={REGIONS}
          sectors={SECTORS}
          showScopeFilters={!isCooperative}
        />
        <MinistryStatsCards params={statsParams} enabled={role === "ministry"} />
        <IndicatorSearch value={query} onChange={setQuery} />
        {isCooperative && pending && (
          <YearPendingNotice pending={pending} chosenYear={filters.year !== ALL} />
        )}
        {isLoading ? (
          <div className="flex items-center justify-center py-32 text-muted-foreground">
            <Spinner size="md" className="mr-2" /> {t("basicDashboard.loading")}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            {t("basicDashboard.loadError", { error: String(error) })}
          </div>
        ) : data?.scope ? (
          <DashboardBody data={data} query={query} />
        ) : (
          <div className="py-16 text-center text-sm text-muted-foreground">
            {t("basicDashboard.empty")}
          </div>
        )}
      </div>
    </AppShell>
  );
}
