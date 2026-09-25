import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

import { AppShell } from "@/components/app-shell";
import { BasicFilterBar } from "@/components/analytics/basic/BasicFilterBar";
import { CollapsibleSection } from "@/components/analytics/national/CollapsibleSection";
import { CapitalChart } from "@/components/analytics/basic/CapitalChart";
import { CHART_COLORS } from "@/components/analytics/basic/chart-config";
import { CooperativeRankingTable } from "@/components/analytics/basic/CooperativeRankingTable";
import { DemographicsPanel } from "@/components/analytics/basic/DemographicsPanel";
import { IndicatorSearch } from "@/components/analytics/basic/IndicatorSearch";
import { HeadlineStrip } from "@/components/analytics/basic/HeadlineStrip";
import { IndicatorGroupSection } from "@/components/analytics/basic/IndicatorGroupSection";
import { LiquidityChart } from "@/components/analytics/basic/LiquidityChart";
import { MarketShareDonut } from "@/components/analytics/basic/MarketShareDonut";
import { ParTrendChart } from "@/components/analytics/basic/ParTrendChart";
import { ProfitabilityChart } from "@/components/analytics/basic/ProfitabilityChart";
import { ScopeHeader } from "@/components/analytics/basic/ScopeHeader";
import { SeriesBarChart } from "@/components/analytics/basic/SeriesBarChart";
import { StructureChart } from "@/components/analytics/basic/StructureChart";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/AuthContext";
import { useBasicDashboard } from "@/hooks/analytics/useBasicDashboard";
import { useCooperatives } from "@/hooks/cooperatives/useCooperatives";
import {
  DEFAULT_FILTERS,
  REGIONS,
  SECTORS,
  filtersToParams,
  type BasicFilterState,
} from "@/lib/basic-dashboard-filters";
import { HEADLINE_KEYS, humanizeKey } from "@/lib/basic-dashboard";
import type { BasicDashboardResponse } from "@/types/basic-dashboard";

function DashboardBody({ data, query }: { data: BasicDashboardResponse; query: string }) {
  const { t } = useTranslation();
  const { scope, series } = data;
  const currency = scope.currency;
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
          <IndicatorGroupSection indicators={data.indicators} scope={scope} />

          <CollapsibleSection id="basic-trends" title={t("basicDashboard.sections.trends")}>
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <SeriesBarChart
                  chartKey="assetEvolution"
                  seriesLabelKey="assets"
                  points={series.asset_evolution}
                  valueKey="total_assets"
                  currency={currency}
                  color={CHART_COLORS[0]}
                />
                <SeriesBarChart
                  chartKey="savingsTrend"
                  seriesLabelKey="savings"
                  points={series.savings_trend}
                  valueKey="total_deposits"
                  currency={currency}
                  color={CHART_COLORS[1]}
                />
                <SeriesBarChart
                  chartKey="loanPortfolio"
                  seriesLabelKey="loans"
                  points={series.loan_portfolio}
                  valueKey="gross_loans"
                  currency={currency}
                  color={CHART_COLORS[2]}
                />
              </div>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <ParTrendChart points={series.par_trend} />
                <LiquidityChart points={series.liquidity} />
                <StructureChart points={series.financial_structure} />
                <CapitalChart points={series.institutional_capital} />
                <ProfitabilityChart points={series.profitability} currency={currency} />
              </div>
            </div>
          </CollapsibleSection>
          {scope.level === "consolidated" && data.market_share && (
            <CollapsibleSection id="basic-share" title={t("basicDashboard.sections.marketShare")}>
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <MarketShareDonut
                  chartKey="marketShareAssets"
                  rows={data.market_share.by_assets}
                  currency={currency}
                />
                <MarketShareDonut
                  chartKey="marketShareLoans"
                  rows={data.market_share.by_loans}
                  currency={currency}
                />
              </div>
            </CollapsibleSection>
          )}
          <CollapsibleSection id="basic-members" title={t("basicDashboard.sections.members")}>
            <div className="space-y-6">
              <DemographicsPanel demographics={data.demographics} />
            </div>
          </CollapsibleSection>
          <CollapsibleSection id="basic-ranking" title={t("basicDashboard.sections.ranking")}>
            <div className="space-y-6">
              <CooperativeRankingTable
                rows={data.cooperatives}
                currency={currency}
                thresholds={data.thresholds}
              />
            </div>
          </CollapsibleSection>
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
  const { data, isLoading, error } = useBasicDashboard(params);
  const { data: cooperatives = [] } = useCooperatives();

  const cooperativeOptions = useMemo(
    () => cooperatives.map((c) => ({ id: c.id, name: c.name })),
    [cooperatives],
  );

  return (
    <AppShell title={t("basicDashboard.title")} subtitle={t("basicDashboard.subtitle")}>
      <div className="space-y-6">
        <BasicFilterBar
          state={filters}
          onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          onClear={() => setFilters((prev) => ({ ...DEFAULT_FILTERS, currency: prev.currency }))}
          availablePeriods={data?.scope.available_periods ?? []}
          cooperatives={cooperativeOptions}
          regions={REGIONS}
          sectors={SECTORS}
          showScopeFilters={!isCooperative}
        />
        <IndicatorSearch value={query} onChange={setQuery} />
        {isLoading ? (
          <div className="flex items-center justify-center py-32 text-muted-foreground">
            <Spinner size="md" className="mr-2" /> {t("basicDashboard.loading")}
          </div>
        ) : error ? (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-sm text-destructive">
            {t("basicDashboard.loadError", { error: String(error) })}
          </div>
        ) : data ? (
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
