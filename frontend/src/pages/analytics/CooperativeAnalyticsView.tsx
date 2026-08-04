import { useMemo } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/app-shell";
import { ComplianceRadialGauges } from "@/components/analytics/ComplianceRadialGauges";
import { CoopTrendAreaChart } from "@/components/analytics/CoopTrendAreaChart";
import { PortfolioOverviewChart } from "@/components/analytics/PortfolioOverviewChart";
import { GenderParticipationChart } from "@/components/analytics/GenderParticipationChart";
import { SavingsLoansDepositsChart } from "@/components/analytics/SavingsLoansDepositsChart";
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
import { useUserRole } from "@/lib/auth";
import type { AnalyticsFilterValues } from "./analyticsTypes";
import type { components } from "@/openapi-client/api";
import { useTranslation } from "react-i18next";
import { KpiScorecard } from "@/components/analytics/KpiScorecard";

interface Props {
  filterValues: AnalyticsFilterValues;
}

export function CooperativeAnalyticsView({ filterValues }: Props) {
  const { t } = useTranslation();
  const reportingYear = Number(filterValues.year);
  const role = useUserRole();

  const latestSubmission = useLatestSubmission(reportingYear, filterValues.cooperativeId);
  const submissionId = latestSubmission?.id;
  const coopId = latestSubmission?.cooperative_id;
  const hasApprovedSubmission =
    !!latestSubmission &&
    (latestSubmission.status === "approved" || latestSubmission.status === "submitted");

  const { data: kpisData, isLoading: kpisLoading } = useCooperativeKpis(submissionId);
  const { data: trendData } = useMonthlyTrend(
    { reportingYear, cooperativeId: coopId },
    hasApprovedSubmission,
  );
  const isCooperative = role === "cooperative";
  const { data: nfStats } = useNfStatistics(
    isCooperative,
    { reportingYear, cooperativeId: coopId },
    hasApprovedSubmission,
  );

  const kpiMap = useMemo(() => {
    const map: Record<string, number> = {};
    kpisData?.kpis.forEach((k) => {
      map[k.name] = k.value;
    });
    return map;
  }, [kpisData]);

  const kpiGridMetrics = useMemo(() => {
    if (!kpisData?.kpis) return [];

    const CORE_KPI_NAMES = new Set([
      "NPL_RATIO",
      "CAPITAL_ADEQUACY_RATIO",
      "LIQUID_FUNDS_RATIO",
      "ROA",
      "ROE",
      "NET_SURPLUS",
      "PAR30",
      "OPERATING_EXPENSE_RATIO",
    ]);

    return kpisData.kpis
      .filter((k: components["schemas"]["KpiItemResponse"]) =>
        CORE_KPI_NAMES.has(k.name.toUpperCase()),
      )
      .map((k: components["schemas"]["KpiItemResponse"]) => ({
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
            ? t("analytics.healthy")
            : k.status === "amber"
              ? t("analytics.watch")
              : k.status === "red"
                ? t("analytics.risk")
                : t("analytics.unknown"),
      }));
  }, [kpisData, t]);

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
        name: t("cooperativeAnalytics.myCooperative"),
        dormancy_pct: m.dormancy_pct,
        active_members_pct: m.active_pct,
        total_members: m.total,
      },
    ];
  }, [nfStats, t]);

  const membershipMetrics = useMemo(() => {
    if (!nfStats?.membership) return [];
    const m = nfStats.membership;
    return [
      {
        label: t("cooperativeAnalytics.totalMembers"),
        value: m.total.toLocaleString(),
        tooltip: t("cooperativeAnalytics.totalMembersTooltip"),
        trend: "up" as const,
        trendValue: t("cooperativeAnalytics.totalMembersTrend"),
      },
      {
        label: t("cooperativeAnalytics.activeMembers"),
        value: m.active.toLocaleString(),
        tooltip: t("cooperativeAnalytics.activeMembersTooltip"),
        trend: "up" as const,
        trendValue: t("cooperativeAnalytics.activeMembersTrend", { pct: m.active_pct.toFixed(1) }),
      },
      {
        label: t("cooperativeAnalytics.dormantMembers"),
        value: m.dormant.toLocaleString(),
        tooltip: t("cooperativeAnalytics.dormantMembersTooltip"),
        trend: m.dormancy_pct > 20 ? ("down" as const) : ("neutral" as const),
        trendValue: t("cooperativeAnalytics.dormantMembersTrend", {
          pct: m.dormancy_pct.toFixed(1),
        }),
      },
      {
        label: t("cooperativeAnalytics.youthMembers"),
        value: m.age_18_35.toLocaleString(),
        tooltip: t("cooperativeAnalytics.youthMembersTooltip"),
        trend: "neutral" as const,
        trendValue: t("cooperativeAnalytics.youthMembersTrend", { pct: m.youth_pct.toFixed(1) }),
      },
    ];
  }, [nfStats, t]);

  const savingsMetrics = useMemo(() => {
    if (!nfStats?.savings) return [];
    const s = nfStats.savings;
    return [
      {
        label: t("cooperativeAnalytics.savingsAccounts"),
        value: s.total_accounts.toLocaleString(),
        tooltip: t("cooperativeAnalytics.savingsAccountsTooltip"),
        trend: "up" as const,
        trendValue: t("cooperativeAnalytics.savingsAccountsTrend", { count: s.active_accounts }),
      },
      {
        label: t("cooperativeAnalytics.totalSavings"),
        value: `$${(s.total_balance / 1000).toFixed(1)}K`,
        tooltip: t("cooperativeAnalytics.totalSavingsTooltip"),
        trend: "up" as const,
        trendValue: t("cooperativeAnalytics.totalSavingsTrend", {
          value: s.average_balance.toFixed(0),
        }),
      },
      {
        label: t("cooperativeAnalytics.activeSavers"),
        value: s.active_accounts.toLocaleString(),
        tooltip: t("cooperativeAnalytics.activeSaversTooltip"),
        trend: "up" as const,
        trendValue: t("cooperativeAnalytics.activeSaversTrend", {
          pct: s.active_savers_pct.toFixed(1),
        }),
      },
      {
        label: t("cooperativeAnalytics.regularSavers"),
        value: `${s.regular_savers_pct.toFixed(1)}%`,
        tooltip: t("cooperativeAnalytics.regularSaversTooltip"),
        trend: s.regular_savers_pct > 50 ? ("up" as const) : ("neutral" as const),
        trendValue: t("cooperativeAnalytics.regularSaversTrend"),
      },
    ];
  }, [nfStats, t]);

  const loanMetrics = useMemo(() => {
    if (!nfStats?.loans) return [];
    const l = nfStats.loans;
    return [
      {
        label: t("cooperativeAnalytics.loanAccounts"),
        value: l.total_loans.toLocaleString(),
        tooltip: t("cooperativeAnalytics.loanAccountsTooltip"),
        trend: "up" as const,
        trendValue: t("cooperativeAnalytics.loanAccountsTrend", { count: l.active_loans }),
      },
      {
        label: t("cooperativeAnalytics.totalLoans"),
        value: `$${(l.total_loan_amount / 1000).toFixed(1)}K`,
        tooltip: t("cooperativeAnalytics.totalLoansTooltip"),
        trend: "up" as const,
        trendValue: t("cooperativeAnalytics.totalLoansTrend", {
          value: l.average_loan_size.toFixed(0),
        }),
      },
      {
        label: t("cooperativeAnalytics.loansInArrears"),
        value: l.arrears.toLocaleString(),
        tooltip: t("cooperativeAnalytics.loansInArrearsTooltip"),
        trend: l.arrears_rate_pct > 5 ? ("down" as const) : ("up" as const),
        trendValue: t("cooperativeAnalytics.loansInArrearsTrend", {
          pct: l.arrears_rate_pct.toFixed(1),
        }),
      },
      {
        label: t("cooperativeAnalytics.onTimeRepayment"),
        value: `${l.on_time_repayment_pct.toFixed(1)}%`,
        tooltip: t("cooperativeAnalytics.onTimeRepaymentTooltip"),
        trend: l.on_time_repayment_pct > 90 ? ("up" as const) : ("neutral" as const),
        trendValue: t("cooperativeAnalytics.onTimeRepaymentTrend"),
      },
    ];
  }, [nfStats, t]);

  const fdMetrics = useMemo(() => {
    if (!nfStats?.fixed_deposits) return [];
    const fd = nfStats.fixed_deposits;
    return [
      {
        label: t("cooperativeAnalytics.fdAccounts"),
        value: fd.total_fds.toLocaleString(),
        tooltip: t("cooperativeAnalytics.fdAccountsTooltip"),
        trend: "up" as const,
        trendValue: t("cooperativeAnalytics.fdAccountsTrend", { count: fd.active_fds }),
      },
      {
        label: t("cooperativeAnalytics.totalFdBalance"),
        value: `$${(fd.total_balance / 1000).toFixed(1)}K`,
        tooltip: t("cooperativeAnalytics.totalFdBalanceTooltip"),
        trend: "up" as const,
        trendValue: t("cooperativeAnalytics.totalFdBalanceTrend", {
          value: fd.average_balance.toFixed(0),
        }),
      },
      {
        label: t("cooperativeAnalytics.fdPenetration"),
        value: `${fd.fd_penetration_pct.toFixed(1)}%`,
        tooltip: t("cooperativeAnalytics.fdPenetrationTooltip"),
        trend: fd.fd_penetration_pct > 20 ? ("up" as const) : ("neutral" as const),
        trendValue: t("cooperativeAnalytics.fdPenetrationTrend"),
      },
      {
        label: t("cooperativeAnalytics.rolloverRate"),
        value: `${fd.rollover_rate_pct.toFixed(1)}%`,
        tooltip: t("cooperativeAnalytics.rolloverRateTooltip"),
        trend: fd.rollover_rate_pct > 70 ? ("up" as const) : ("neutral" as const),
        trendValue: t("cooperativeAnalytics.rolloverRateTrend"),
      },
    ];
  }, [nfStats, t]);

  if (!latestSubmission) {
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

  const isTrendEmpty = trendPoints.every(
    (p) => p.liquidity === 0 && p.savings === 0 && p.loans === 0,
  );

  return (
    <div className="space-y-6">
      {kpisLoading ? (
        <div className="flex items-center gap-2 text-muted-foreground text-sm p-4">
          <Loader2 className="size-4 animate-spin" /> {t("cooperativeAnalytics.loadingKpis")}
        </div>
      ) : null}

      {kpiGridMetrics.length > 0 && (
        <div className="mb-6">
          <KpiScorecard metrics={kpiGridMetrics} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title={t("cooperativeAnalytics.regComplianceTitle")}
          subtitle={t("cooperativeAnalytics.regComplianceSubtitle")}
          info={t("cooperativeAnalytics.regComplianceInfo")}
        >
          <ComplianceRadialGauges
            carValue={kpiMap["capital_adequacy_ratio"] ?? 0}
            liquidityValue={kpiMap["liquid_funds_ratio"] ?? 0}
            nplValue={kpiMap["npl_ratio"] ?? 0}
          />
        </Card>

        {nfStats && (
          <Card
            title={t("cooperativeAnalytics.savingsPortfolioTitle")}
            subtitle={t("cooperativeAnalytics.savingsPortfolioSubtitle")}
            info={t("cooperativeAnalytics.savingsPortfolioInfo")}
          >
            <SavingsRadialGauges data={nfStats.savings} />
          </Card>
        )}
      </div>

      {/* Row 1: Portfolio Overview & Gender Participation */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 mb-6">
        <div className="lg:col-span-3">
          <PortfolioOverviewChart
            data={
              trendPoints.length > 0
                ? trendPoints
                : [
                    "Jan",
                    "Feb",
                    "Mar",
                    "Apr",
                    "May",
                    "Jun",
                    "Jul",
                    "Aug",
                    "Sep",
                    "Oct",
                    "Nov",
                    "Dec",
                  ].map((m) => ({ month: m, liquidity: 0, savings: 0, loans: 0 }))
            }
          />
        </div>
        <div className="lg:col-span-2">
          <GenderParticipationChart
            data={
              nfStats?.membership ?? {
                total: 0,
                male: 0,
                female: 0,
                other: 0,
                male_pct: 0,
                female_pct: 0,
                other_pct: 0,
              }
            }
          />
        </div>
      </div>

      {/* Row 2: Savings Loans & Deposits grouped bar chart & Provisioning Waterfall */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <SavingsLoansDepositsChart
          data={
            trendPoints.length > 0
              ? trendPoints
              : [
                  "Jan",
                  "Feb",
                  "Mar",
                  "Apr",
                  "May",
                  "Jun",
                  "Jul",
                  "Aug",
                  "Sep",
                  "Oct",
                  "Nov",
                  "Dec",
                ].map((m) => ({ month: m, liquidity: 0, savings: 0, loans: 0 }))
          }
        />
        {kpisData && (
          <Card
            title={t("cooperativeAnalytics.loanProvTitle")}
            subtitle={t("cooperativeAnalytics.loanProvSubtitle")}
            info={t("cooperativeAnalytics.loanProvInfo")}
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
            title={t("cooperativeAnalytics.liquidityRiskTitle")}
            subtitle={t("cooperativeAnalytics.liquidityRiskSubtitle")}
            info={t("cooperativeAnalytics.liquidityRiskInfo")}
          >
            <DepositConcentrationGauge stats={nfStats.fixed_deposits} />
          </Card>
        )}

        {nfStats && (
          <Card
            title={t("cooperativeAnalytics.democraticTitle")}
            subtitle={t("cooperativeAnalytics.democraticSubtitle")}
            info={t("cooperativeAnalytics.democraticInfo")}
          >
            <GovernanceFunnel stats={nfStats.membership} />
          </Card>
        )}

        {nfStats && (
          <Card
            title={t("cooperativeAnalytics.inclusionTitle")}
            subtitle={t("cooperativeAnalytics.inclusionSubtitle")}
            info={t("cooperativeAnalytics.inclusionInfo")}
          >
            <FinancialInclusionBar stats={nfStats.loans} />
          </Card>
        )}
      </div>

      {nfStats?.membership && membershipMetrics.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-foreground mb-3">
            {t("cooperativeAnalytics.membershipOverview")}
          </h3>
          <MetricsGridCards metrics={membershipMetrics} columns={4} />
        </div>
      )}

      {nfStats?.savings && savingsMetrics.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-foreground mb-3">
            {t("cooperativeAnalytics.savingsMetrics")}
          </h3>
          <MetricsGridCards metrics={savingsMetrics} columns={4} />
        </div>
      )}

      {nfStats?.loans && loanMetrics.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-foreground mb-3">
            {t("cooperativeAnalytics.loanMetrics")}
          </h3>
          <MetricsGridCards metrics={loanMetrics} columns={4} />
        </div>
      )}

      {nfStats && (
        <Card
          title={t("cooperativeAnalytics.loanPortfolioTitle")}
          subtitle={t("cooperativeAnalytics.loanPortfolioSubtitle")}
          info={t("cooperativeAnalytics.loanPortfolioInfo")}
        >
          <LoanDualBar data={nfStats.loans} />
        </Card>
      )}

      {nfStats?.fixed_deposits && fdMetrics.length > 0 && (
        <div>
          <h3 className="text-sm font-bold text-foreground mb-3">
            {t("cooperativeAnalytics.fdMetrics")}
          </h3>
          <MetricsGridCards metrics={fdMetrics} columns={4} />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {nfStats && (
          <Card
            title={t("cooperativeAnalytics.memberDemoTitle")}
            subtitle={t("cooperativeAnalytics.memberDemoSubtitle")}
            info={t("cooperativeAnalytics.memberDemoInfo")}
          >
            <GenderStatusDoughnuts data={nfStats.membership} />
          </Card>
        )}

        {dormancyData.length > 0 && (
          <Card
            title={t("cooperativeAnalytics.dormancyLeaderboardTitle")}
            info={t("cooperativeAnalytics.dormancyLeaderboardInfo")}
          >
            <DormancyLeaderboard data={dormancyData} />
          </Card>
        )}
      </div>

      {nfStats && nfStats.farm_coop.total_coops > 0 && (
        <Card
          title={t("cooperativeAnalytics.agriResilienceTitle")}
          subtitle={t("cooperativeAnalytics.agriResilienceSubtitle")}
          info={t("cooperativeAnalytics.agriResilienceInfo")}
        >
          <AgriResilienceRadar stats={nfStats.farm_coop} />
        </Card>
      )}

      {!hasApprovedSubmission && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 flex items-start gap-3">
          <ShieldCheck className="size-4 text-amber-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
              {t("cooperativeAnalytics.pendingApprovalTitle")}
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500 mt-0.5">
              {t("cooperativeAnalytics.pendingApprovalDesc")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
