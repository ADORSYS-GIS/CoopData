/**
 * MinistryAnalyticsView
 * Renders the national analytics dashboard for Ministry administrators.
 * Shows: macro portfolio distribution map, national NF demographics,
 * NF portfolio indicators, compliance distribution, and the
 * full non-financial consolidation panel.
 */
import { useMemo } from "react";
import { Loader2, Info } from "lucide-react";
import { Card } from "@/components/app-shell";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RegionalGroupedBar } from "@/components/analytics/RegionalGroupedBar";
import { CooperativeDeepDive } from "@/components/analytics/CooperativeDeepDive";
import { NetworkConsolidatedMetrics } from "@/components/analytics/NetworkConsolidatedMetrics";
import { ComplianceDoughnutCharts } from "@/components/analytics/ComplianceDoughnutCharts";
import { TopBottomLeaderboard } from "@/components/analytics/TopBottomLeaderboard";
import { NonFinancialConsolidation } from "@/components/analytics/non-financial-consolidation";
import { LoanProvisioningWaterfall } from "@/components/analytics/LoanProvisioningWaterfall";
import { CustomKpiBuilder } from "@/components/analytics/CustomKpiBuilder";
import { CooperativeComparison } from "@/components/analytics/CooperativeComparison";
import { CooperativeRanking } from "@/components/analytics/CooperativeRanking";
import { useMonthlyTrend } from "@/hooks/analytics/useMonthlyTrend";
import { useNationalOverview } from "@/hooks/analytics/useNationalOverview";
import { useNfStatistics } from "@/hooks/analytics/useNfStatistics";
import { useMinistryStats } from "@/hooks/analytics/useMinistryStats";
import type { AnalyticsFilterValues } from "./analyticsTypes";

interface Props {
  filterValues: AnalyticsFilterValues;
  onFilterChange: (id: string, value: string) => void;
}

export function MinistryAnalyticsView({ filterValues, onFilterChange }: Props) {
  const year = Number(filterValues.year);

  const params = useMemo(
    () => ({
      reportingYear: year,
      cooperativeId: filterValues.cooperativeId !== "all" ? filterValues.cooperativeId : undefined,
      apexId: filterValues.apexId !== "all" ? filterValues.apexId : undefined,
      federationId: filterValues.federationId !== "all" ? filterValues.federationId : undefined,
      region: filterValues.region !== "all" ? filterValues.region : undefined,
      sector: filterValues.sector !== "all" ? filterValues.sector : undefined,
    }),
    [filterValues, year],
  );

  const { data: overview, isLoading } = useNationalOverview(params);
  const { data: nfStats } = useNfStatistics(false, params);
  const { data: networkTrend } = useMonthlyTrend(params, filterValues.cooperativeId === "all");
  const { data: ministryStats } = useMinistryStats();

  const hasSelected = filterValues.cooperativeId !== "all";
  const coops = overview?.cooperatives ?? [];
  const nfSummary = overview?.non_financial_summary;

  // Aggregate financial metrics for Loan Provisioning Gap at the national level
  const aggMetrics = useMemo(() => {
    let totalGLP = 0;
    let sumPar30 = 0;
    let sumProvisions = 0;
    let countPar30 = 0;
    let countProvisions = 0;

    coops.forEach((c) => {
      const glp = c.kpis["gross_loan_portfolio"]?.value ?? 0;
      const par30 = c.kpis["par30"]?.value;
      const prov = c.kpis["loan_loss_coverage"]?.value;

      totalGLP += glp;
      if (par30 !== undefined) {
        sumPar30 += par30;
        countPar30++;
      }
      if (prov !== undefined) {
        sumProvisions += prov;
        countProvisions++;
      }
    });

    return {
      totalGLP,
      avgPar30: countPar30 > 0 ? sumPar30 / countPar30 : 0,
      avgProvisions: countProvisions > 0 ? sumProvisions / countProvisions : 0,
    };
  }, [coops]);

  const selectedCoopRow = useMemo(
    () => coops.find((c) => c.cooperative_id === filterValues.cooperativeId),
    [coops, filterValues.cooperativeId],
  );

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <Loader2 className="size-5 animate-spin" /> Loading national analytics…
      </div>
    );
  }

  if (hasSelected && selectedCoopRow) {
    return (
      <CooperativeDeepDive
        cooperativeId={selectedCoopRow.cooperative_id}
        submissionId={selectedCoopRow.submission_id}
        cooperativeName={selectedCoopRow.name}
        cooperativeRegion={selectedCoopRow.region}
        cooperativeType={selectedCoopRow.institution_type}
        reportingYear={year}
        onClose={() => onFilterChange("cooperativeId", "all")}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Ministry headline stats */}
      {ministryStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Total Cooperatives",
              value: ministryStats.total_cooperatives?.toLocaleString() ?? "—",
              tooltip:
                "Total number of registered cooperatives in the national cooperative registry.",
            },
            {
              label: "Total Submissions",
              value: ministryStats.total_submissions?.toLocaleString() ?? "—",
              tooltip:
                "Total number of data submissions received from all cooperatives across the country.",
            },
            {
              label: "Pending Review",
              value: ministryStats.pending_review_count?.toLocaleString() ?? "—",
              tooltip:
                "Submissions currently awaiting review and approval by authorized personnel.",
            },
            {
              label: "Approved",
              value: ministryStats.approved_count?.toLocaleString() ?? "—",
              tooltip:
                "Submissions that have been successfully reviewed and approved this reporting period.",
            },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="flex items-start justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {stat.label}
                </p>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className="flex focus:outline-none rounded-full ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
                      <Info className="size-3 text-muted-foreground/60 hover:text-foreground cursor-pointer transition-colors" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    side="top"
                    className="max-w-xs whitespace-normal z-[60] p-3 shadow-xl"
                  >
                    <p className="text-sm font-normal normal-case tracking-normal text-foreground leading-snug">
                      {stat.tooltip}
                    </p>
                  </PopoverContent>
                </Popover>
              </div>
              <p className="font-heading text-2xl font-bold text-foreground num mt-1">
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      )}

      <NetworkConsolidatedMetrics
        nfStats={nfStats}
        networkTrend={networkTrend}
        totalCooperatives={overview?.total_cooperatives ?? 0}
        cooperativesWithData={overview?.cooperatives_with_data ?? 0}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Macro distribution */}
        <Card
          title="National Portfolio Distribution"
          subtitle="Assets, loans and deposits by region"
          info="Displays the aggregate financial balances distributed across different geographical regions."
        >
          <RegionalGroupedBar cooperatives={coops} />
        </Card>

        {/* National loan gap */}
        {coops.length > 0 && (
          <Card
            title="National Loan Provisioning Gap"
            subtitle="Unprotected at-risk capital visualization"
            info="Visualizes the gap between the Gross Loan Portfolio, the Portfolio at Risk (PAR30), and the actual Loan Loss Provisions set aside to cover those risks."
          >
            <LoanProvisioningWaterfall
              glp={aggMetrics.totalGLP}
              par30_pct={aggMetrics.avgPar30}
              provisions_pct={aggMetrics.avgProvisions}
            />
          </Card>
        )}
      </div>

      {/* Top & bottom performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="ROA Leaderboard"
          subtitle="Best and worst performing cooperatives by ROA"
          info="Highlights the cooperatives with the highest and lowest Return on Assets, indicating overall profitability and resource utilization."
        >
          <TopBottomLeaderboard cooperatives={coops} sortByKpi="roa" />
        </Card>
        <Card
          title="CAR Leaderboard"
          subtitle="Capital adequacy leaders and laggards"
          info="Highlights the cooperatives with the highest and lowest Capital Adequacy Ratios, ensuring they maintain sufficient capital to absorb potential losses."
        >
          <TopBottomLeaderboard cooperatives={coops} sortByKpi="capital_adequacy_ratio" />
        </Card>
      </div>

      {/* Traffic-light compliance distribution */}
      {overview?.distributions && Object.keys(overview.distributions).length > 0 && (
        <Card
          title="National KPI Traffic-Light Distribution"
          subtitle="Proportion of cooperatives in each status band"
          info="Shows the distribution of cooperatives falling into Healthy (Green), Watch (Amber), and Risk (Red) categories for various key performance indicators."
        >
          <ComplianceDoughnutCharts distributions={overview.distributions} />
        </Card>
      )}

      {/* Custom KPI Builder Panel */}
      <CustomKpiBuilder />

      {/* Full NF consolidation panel */}
      <NonFinancialConsolidation />

      {coops.length === 0 && (
        <div className="rounded-xl border border-border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
          No cooperative data available for the selected filters and reporting year.
        </div>
      )}
    </div>
  );
}
