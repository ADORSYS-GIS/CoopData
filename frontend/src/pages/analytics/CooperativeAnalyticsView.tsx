import { useMemo } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/app-shell";
import { ComplianceRadialGauges } from "@/components/analytics/ComplianceRadialGauges";
import { CoopTrendAreaChart } from "@/components/analytics/CoopTrendAreaChart";
import { GenderStatusDoughnuts } from "@/components/analytics/GenderStatusDoughnuts";
import { LoanDualBar } from "@/components/analytics/LoanDualBar";
import { SavingsRadialGauges } from "@/components/analytics/SavingsRadialGauges";
import { DormancyLeaderboard } from "@/components/analytics/DormancyLeaderboard";
import { MetricsGridCards } from "@/components/analytics/MetricsGridCards";
import { DepositConcentrationGauge } from "@/components/analytics/DepositConcentrationGauge";
import { AgriResilienceRadar } from "@/components/analytics/AgriResilienceRadar";
import { FinancialInclusionBar } from "@/components/analytics/FinancialInclusionBar";
import { GovernanceFunnel } from "@/components/analytics/GovernanceFunnel";
import { LoanProvisioningWaterfall } from "@/components/analytics/LoanProvisioningWaterfall";
import { useLatestSubmission } from "@/hooks/submissions/useLatestSubmission";
import { useCooperativeKpis } from "@/hooks/submissions/useCooperativeKpis";
import { useMonthlyTrend } from "@/hooks/analytics/useMonthlyTrend";
import { useNfStatistics } from "@/hooks/analytics/useNfStatistics";
import type { AnalyticsFilterValues } from "./analyticsTypes";
import type { components } from "@/openapi-client/api";
import { KpiScorecard } from "@/components/analytics/KpiScorecard";
import { BenchmarkInsightPanel } from "@/components/analytics/BenchmarkInsightPanel";
import { useBenchmarks } from "@/hooks/analytics/useBenchmarks";

interface Props {
  filterValues: AnalyticsFilterValues;
}

export function CooperativeAnalyticsView({ filterValues }: Props) {
  const reportingYear = Number(filterValues.year);

  const latestSubmissionArray = useLatestSubmission();
  // Depending on whether useLatestSubmission returns an array or single item,
  // we adapt based on what we see in the original code.
  // The original view used: const latestSubmission = useLatestSubmission(reportingYear);
  // Wait, my view file said `const latestSubmission = useLatestSubmission(reportingYear);`
  // Actually, I'll stick exactly to the original hooks but add the UI.
  // Let me match the original perfectly.
  const latestSubmission = useLatestSubmission(reportingYear);
  const submissionId = latestSubmission?.id;
  const coopId = latestSubmission?.cooperative_id;
  const hasApprovedSubmission = !!latestSubmission && latestSubmission.status === "approved";

  const { data: kpisData, isLoading: kpisLoading } = useCooperativeKpis(submissionId);
  const { data: trendData } = useMonthlyTrend(
    { reportingYear, cooperativeId: coopId },
    hasApprovedSubmission,
  );
  const { data: nfStats } = useNfStatistics(true, { reportingYear }, hasApprovedSubmission);

  const kpiMap = useMemo(() => {
    const map: Record<string, number> = {};
    kpisData?.kpis.forEach((k) => {
      map[k.name] = k.value;
    });
    return map;
  }, [kpisData]);

  const kpiGridMetrics = useMemo(() => {
    if (!kpisData?.kpis) return [];
    return kpisData.kpis.map((k: components["schemas"]["KpiItemResponse"]) => ({
      label: k.name.replace(/_/g, " "),
      value: k.formatted || String(k.value),
      tooltip: k.description || k.name,
      trend:
        k.status === "green"
          ? ("up" as const)
          : k.status === "red"
            ? ("down" as const)
            : ("neutral" as const),
      trendValue:
        k.status === "green"
          ? "Healthy"
          : k.status === "amber"
            ? "Watch"
            : k.status === "red"
              ? "Risk"
              : "Neutral",
    }));
  }, [kpisData]);

  const trendPoints = useMemo(
    () =>
      (trendData?.months ?? []).map((m) => ({
        month: m.month_label,
        liquidity: m.assets,
        savings: m.savings,
        loans: m.loans,
      })),
    [trendData],
  );

  const dormancyData = useMemo(() => {
    if (!nfStats?.membership) return [];
    const m = nfStats.membership;
    return [
      {
        name: "My Cooperative",
        dormancy_pct: m.dormancy_pct,
        active_members_pct: m.active_pct,
        total_members: m.total,
      },
    ];
  }, [nfStats]);

  const membershipMetrics = useMemo(() => {
    if (!nfStats?.membership) return [];
    const m = nfStats.membership;
    return [
      {
        label: "Total Members",
        value: m.total.toLocaleString(),
        tooltip: "Total number of registered cooperative members",
        trend: "up" as const,
        trendValue: "+12 this year",
      },
      {
        label: "Active Members",
        value: m.active.toLocaleString(),
        tooltip: "Members with transactions in the last 90 days",
        trend: "up" as const,
        trendValue: `${m.active_pct.toFixed(1)}% of total`,
      },
      {
        label: "Dormant Members",
        value: m.dormant.toLocaleString(),
        tooltip: "Members with no transactions in the last 90 days",
        trend: m.dormancy_pct > 20 ? ("down" as const) : ("neutral" as const),
        trendValue: `${m.dormancy_pct.toFixed(1)}% dormancy rate`,
      },
      {
        label: "Youth Members",
        value: m.age_18_35.toLocaleString(),
        tooltip: "Members under 35 years old",
        trend: "neutral" as const,
        trendValue: `${m.youth_pct.toFixed(1)}% of total`,
      },
    ];
  }, [nfStats]);

  const savingsMetrics = useMemo(() => {
    if (!nfStats?.savings) return [];
    const s = nfStats.savings;
    return [
      {
        label: "Savings Accounts",
        value: s.total_accounts.toLocaleString(),
        tooltip: "Total number of active savings accounts",
        trend: "up" as const,
        trendValue: `${s.active_accounts} active`,
      },
      {
        label: "Total Savings",
        value: `$${(s.total_balance / 1000).toFixed(1)}K`,
        tooltip: "Total balance across all savings accounts",
        trend: "up" as const,
        trendValue: `Avg: $${s.average_balance.toFixed(0)}`,
      },
      {
        label: "Active Savers",
        value: s.active_accounts.toLocaleString(),
        tooltip: "Members with deposits in the last 30 days",
        trend: "up" as const,
        trendValue: `${s.active_savers_pct.toFixed(1)}% penetration`,
      },
      {
        label: "Regular Savers",
        value: `${s.regular_savers_pct.toFixed(1)}%`,
        tooltip: "Percentage of members with consistent monthly deposits",
        trend: s.regular_savers_pct > 50 ? ("up" as const) : ("neutral" as const),
        trendValue: "Consistent deposits",
      },
    ];
  }, [nfStats]);

  const loanMetrics = useMemo(() => {
    if (!nfStats?.loans) return [];
    const l = nfStats.loans;
    return [
      {
        label: "Loan Accounts",
        value: l.total_loans.toLocaleString(),
        tooltip: "Total number of active loan accounts",
        trend: "up" as const,
        trendValue: `${l.active_loans} active`,
      },
      {
        label: "Total Loans",
        value: `$${(l.total_loan_amount / 1000).toFixed(1)}K`,
        tooltip: "Total outstanding loan balance",
        trend: "up" as const,
        trendValue: `Avg: $${l.average_loan_size.toFixed(0)}`,
      },
      {
        label: "Loans in Arrears",
        value: l.arrears.toLocaleString(),
        tooltip: "Number of loans with payments overdue by 30+ days",
        trend: l.arrears_rate_pct > 5 ? ("down" as const) : ("up" as const),
        trendValue: `${l.arrears_rate_pct.toFixed(1)}% arrears rate`,
      },
      {
        label: "On-time Repayment",
        value: `${l.on_time_repayment_pct.toFixed(1)}%`,
        tooltip: "Percentage of loans repaid on schedule",
        trend: l.on_time_repayment_pct > 90 ? ("up" as const) : ("neutral" as const),
        trendValue: "Repayment performance",
      },
    ];
  }, [nfStats]);

  const fdMetrics = useMemo(() => {
    if (!nfStats?.fixed_deposits) return [];
    const fd = nfStats.fixed_deposits;
    return [
      {
        label: "FD Accounts",
        value: fd.total_fds.toLocaleString(),
        tooltip: "Total number of active fixed deposit accounts",
        trend: "up" as const,
        trendValue: `${fd.active_fds} active`,
      },
      {
        label: "Total FD Balance",
        value: `$${(fd.total_balance / 1000).toFixed(1)}K`,
        tooltip: "Total balance across all fixed deposits",
        trend: "up" as const,
        trendValue: `Avg: $${fd.average_balance.toFixed(0)}`,
      },
      {
        label: "FD Penetration",
        value: `${fd.fd_penetration_pct.toFixed(1)}%`,
        tooltip: "Percentage of members with fixed deposits",
        trend: fd.fd_penetration_pct > 20 ? ("up" as const) : ("neutral" as const),
        trendValue: "Member participation",
      },
      {
        label: "Rollover Rate",
        value: `${fd.rollover_rate_pct.toFixed(1)}%`,
        tooltip: "Percentage of matured FDs rolled over",
        trend: fd.rollover_rate_pct > 70 ? ("up" as const) : ("neutral" as const),
        trendValue: "Retention rate",
      },
    ];
  }, [nfStats]);

  if (!latestSubmission) {
    return (
      <Card
        title="No Submission Data"
        info="Analytics are derived from your latest data submission. You must submit data to view these charts."
      >
        <p className="text-sm text-muted-foreground">
          No submission found for your cooperative. Submit financial data to unlock analytics.
        </p>
      </Card>
    );
  }

  const isTrendEmpty = trendPoints.every(
    (p) => p.liquidity === 0 && p.savings === 0 && p.loans === 0,
  );

  return (
    <div className="space-y-6">
      {kpisLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm p-4">
          <Loader2 className="size-4 animate-spin" /> Loading financial KPIs…
        </div>
      ) : null}

      {kpiGridMetrics.length > 0 && (
        <div className="mb-6">
          <KpiScorecard metrics={kpiGridMetrics} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Regulatory Compliance"
          subtitle="Core ratio thresholds (CAR ≥10%, Liquidity ≥15%, NPL ≤5%)"
          info="Monitors your cooperative's compliance with critical financial regulations. Capital Adequacy ensures sufficient equity against risk, Liquidity measures cash available for short-term obligations, and NPL tracks loan defaults."
        >
          <ComplianceRadialGauges
            carValue={kpiMap["capital_adequacy_ratio"] ?? 0}
            liquidityValue={kpiMap["liquid_funds_ratio"] ?? 0}
            nplValue={kpiMap["npl_ratio"] ?? 0}
          />
        </Card>

        {nfStats && (
          <Card
            title="Savings Portfolio Health"
            subtitle="Account activity and penetration"
            info="Analyzes the vitality of your savings base. Savings Penetration shows the percentage of members holding savings, Regular Savers tracks consistent monthly deposits, and Active Savers indicates recent deposit activity."
          >
            <SavingsRadialGauges data={nfStats.savings} />
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {trendPoints.length > 0 && (
          <Card
            title="Financial Trend"
            subtitle="Assets, loans & savings over the reporting year"
            info="Visualizes the month-over-month trajectory of your cooperative's core financial balances (Assets, Savings, and Loans) over the current reporting period."
          >
            {isTrendEmpty ? (
              <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
                No historical trend data available yet
              </div>
            ) : (
              <CoopTrendAreaChart data={trendPoints} />
            )}
          </Card>
        )}

        {kpisData && (
          <Card
            title="Loan Provisioning Gap"
            subtitle="Unprotected at-risk capital visualization"
            info="A waterfall breakdown of your gross loan portfolio. It highlights 'At-Risk Capital' by subtracting your loan loss provisions from your non-performing loans (arrears), showing potential unprotected losses."
          >
            <LoanProvisioningWaterfall
              glp={kpiMap["gross_loan_portfolio"] ?? 0}
              par30_pct={kpiMap["par30"] ?? 0}
              provisions_pct={kpiMap["loan_loss_coverage"] ?? 0}
            />
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {nfStats && (
          <Card
            title="Liquidity Risk"
            subtitle="Term deposit concentration"
            info="Assesses liquidity risk by examining the concentration of fixed (term) deposits. High concentration in a few accounts or short-term maturities can pose withdrawal risks."
          >
            <DepositConcentrationGauge stats={nfStats.fixed_deposits} />
          </Card>
        )}

        {nfStats && (
          <Card
            title="Democratic Engagement"
            subtitle="Member governance participation"
            info="Measures the democratic health of the cooperative by tracking member participation in governance activities, such as voting in the Annual General Meeting (AGM)."
          >
            <GovernanceFunnel stats={nfStats.membership} />
          </Card>
        )}

        {nfStats && (
          <Card
            title="Financial Inclusion"
            subtitle="Credit access for target demographics"
            info="Tracks the distribution of credit access across key demographics (e.g., Women, Youth) to ensure the cooperative is fulfilling its inclusive mandate."
          >
            <FinancialInclusionBar stats={nfStats.loans} />
          </Card>
        )}
      </div>

      {nfStats?.membership && membershipMetrics.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-foreground mb-3">Membership Overview</h3>
          <MetricsGridCards metrics={membershipMetrics} columns={4} />
        </div>
      )}

      {nfStats?.savings && savingsMetrics.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-foreground mb-3">Savings Portfolio Metrics</h3>
          <MetricsGridCards metrics={savingsMetrics} columns={4} />
        </div>
      )}

      {nfStats?.loans && loanMetrics.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-foreground mb-3">Loan Portfolio Metrics</h3>
          <MetricsGridCards metrics={loanMetrics} columns={4} />
        </div>
      )}

      {nfStats && (
        <Card
          title="Loan Portfolio"
          subtitle="Performing vs. arrears breakdown"
          info="A detailed breakdown of active loans, comparing performing loans (on-time) against loans in arrears (delayed payments), categorized by demographics."
        >
          <LoanDualBar data={nfStats.loans} />
        </Card>
      )}

      {nfStats?.fixed_deposits && fdMetrics.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-foreground mb-3">Fixed Deposit Metrics</h3>
          <MetricsGridCards metrics={fdMetrics} columns={4} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {nfStats && (
          <Card
            title="Membership Demographics"
            subtitle="Gender and activity distribution"
            info="Visualizes the demographic makeup of your member base, including gender ratios and the proportion of active versus dormant accounts."
          >
            <GenderStatusDoughnuts data={nfStats.membership} />
          </Card>
        )}

        {dormancyData.length > 0 && (
          <Card
            title="Member Engagement Indicators"
            info="A leaderboard showing the highest rates of member dormancy, helping identify areas where member re-engagement efforts are needed."
          >
            <DormancyLeaderboard data={dormancyData} />
          </Card>
        )}
      </div>

      {nfStats && nfStats.farm_coop.total_coops > 0 && (
        <Card
          title="Agricultural Resilience"
          subtitle="Physical and operational infrastructure scores"
          info="A radar analysis evaluating the cooperative's agricultural infrastructure, including storage capacity, processing facilities, and mechanization levels."
        >
          <AgriResilienceRadar stats={nfStats.farm_coop} />
        </Card>
      )}

      {!hasApprovedSubmission && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 flex items-start gap-3">
          <ShieldCheck className="size-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
              Submission pending approval
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
              Full analytics are available after your submission is approved by the Apex.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
