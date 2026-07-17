/**
 * MinistryAnalyticsView
 * Renders the national analytics dashboard for Ministry administrators.
 * Shows: macro portfolio distribution map, national NF demographics,
 * NF portfolio indicators, compliance distribution, and the
 * full non-financial consolidation panel.
 */
import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Card } from "@/components/app-shell";
import { RegionalGroupedBar } from "@/components/analytics/RegionalGroupedBar";
import { GenderStatusDoughnuts } from "@/components/analytics/GenderStatusDoughnuts";
import { ComplianceStackedBars } from "@/components/analytics/ComplianceStackedBars";
import { TopBottomLeaderboard } from "@/components/analytics/TopBottomLeaderboard";
import { NonFinancialConsolidation } from "@/components/analytics/non-financial-consolidation";
import { useNationalOverview } from "@/hooks/analytics/useNationalOverview";
import { useNfStatistics } from "@/hooks/analytics/useNfStatistics";
import { useMinistryStats } from "@/hooks/analytics/useMinistryStats";
import type { AnalyticsFilterValues } from "./analyticsTypes";

interface Props {
  filterValues: AnalyticsFilterValues;
}

export function MinistryAnalyticsView({ filterValues }: Props) {
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
  const { data: ministryStats } = useMinistryStats();

  const coops = overview?.cooperatives ?? [];
  const nfSummary = overview?.non_financial_summary;

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground p-8">
        <Loader2 className="size-5 animate-spin" /> Loading national analytics…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ministry headline stats */}
      {ministryStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Cooperatives", value: ministryStats.total_cooperatives?.toLocaleString() ?? "—" },
            { label: "Total Submissions", value: ministryStats.total_submissions?.toLocaleString() ?? "—" },
            { label: "Pending Review", value: ministryStats.pending_review_count?.toLocaleString() ?? "—" },
            { label: "Approved", value: ministryStats.approved_count?.toLocaleString() ?? "—" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{stat.label}</p>
              <p className="font-heading text-2xl font-bold text-foreground num mt-1">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Macro distribution */}
        <Card
          title="National Portfolio Distribution"
          subtitle="Assets, loans and deposits by region"
        >
          <RegionalGroupedBar cooperatives={coops} />
        </Card>

        {/* National demographics */}
        {nfStats && (
          <Card title="National Membership Demographics" subtitle="Gender and activity breakdown">
            <GenderStatusDoughnuts data={nfStats.membership} />
          </Card>
        )}
      </div>

      {/* NF portfolio indicators */}
      {nfSummary && (
        <Card title="Portfolio NF Indicators" subtitle="Averaged across all cooperatives with data">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Savings Penetration", value: nfSummary.average_savings_penetration_pct },
              { label: "Credit Penetration", value: nfSummary.average_credit_penetration_pct },
              { label: "FD Penetration", value: nfSummary.average_fd_penetration_pct },
              { label: "On-time Repayment", value: nfSummary.average_on_time_repayment_pct },
              { label: "Member Dormancy", value: nfSummary.average_dormancy_pct },
              { label: "AGM Participation", value: nfSummary.average_agm_participation_pct },
              { label: "Loans in Arrears", value: nfSummary.average_arrears_rate_pct },
              { label: "FD Early Withdrawals", value: nfSummary.average_fd_early_withdrawal_pct },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-border bg-muted/20 p-3">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {label}
                </p>
                <p className="mt-1 text-lg font-bold text-foreground">{value.toFixed(1)}%</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Top & bottom performers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="ROA Leaderboard" subtitle="Best and worst performing cooperatives by ROA">
          <TopBottomLeaderboard cooperatives={coops} sortByKpi="roa" />
        </Card>
        <Card title="CAR Leaderboard" subtitle="Capital adequacy leaders and laggards">
          <TopBottomLeaderboard cooperatives={coops} sortByKpi="capital_adequacy_ratio" />
        </Card>
      </div>

      {/* Traffic-light compliance distribution */}
      {overview?.distributions && Object.keys(overview.distributions).length > 0 && (
        <Card title="National KPI Traffic-Light Distribution" subtitle="Proportion of cooperatives in each status band">
          <ComplianceStackedBars distributions={overview.distributions} />
        </Card>
      )}

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
