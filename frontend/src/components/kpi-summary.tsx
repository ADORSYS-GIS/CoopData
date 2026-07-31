import type {
  FinancialKPIs,
  MembershipKPIs,
  SavingsKPIs,
  LoanKPIs,
  FixedDepositKPIs,
} from "@/lib/kpi-calculations";
import { TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface KPICardProps {
  label: string;
  value: string;
  unit?: string;
  description?: string;
  status?: "green" | "amber" | "red";
  benchmark?: number;
  trend?: "up" | "down" | "stable";
  trendValue?: string;
}

export function KPICard({
  label,
  value,
  unit,
  description,
  status,
  benchmark,
  trend,
  trendValue,
}: KPICardProps) {
  const statusColors = {
    green: "bg-success/10 text-success border-success/20",
    amber: "bg-warning/10 text-warning-foreground border-warning/20",
    red: "bg-destructive/10 text-destructive border-destructive/20",
  };

  const trendIcons = {
    up: <TrendingUp className="size-3" />,
    down: <TrendingDown className="size-3" />,
    stable: <Minus className="size-3" />,
  };

  const trendColors = {
    up: "text-success",
    down: "text-destructive",
    stable: "text-muted-foreground",
  };

  return (
    <div className="p-4 rounded-xl border border-border bg-surface">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium truncate">{label}</p>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-2xl font-bold text-foreground truncate">{value}</span>
            {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
          </div>
          {description && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{description}</p>
          )}
        </div>
        {status && (
          <div
            className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${statusColors[status]}`}
          >
            {status === "green" && <CheckCircle2 className="size-3" />}
            {status === "red" && <AlertTriangle className="size-3" />}
            {benchmark !== undefined && `${benchmark}%`}
          </div>
        )}
      </div>
      {trend && trendValue && (
        <div className="flex items-center gap-1 mt-2 text-xs">
          <span className={`flex items-center gap-0.5 ${trendColors[trend]}`}>
            {trendIcons[trend]}
            {trendValue}
          </span>
        </div>
      )}
    </div>
  );
}

interface KPIGridProps {
  kpis: FinancialKPIs | null;
  type: "size" | "portfolio" | "profitability" | "liquidity" | "all";
}

export function FinancialKPIGrid({ kpis, type }: KPIGridProps) {
  const { t } = useTranslation();

  if (!kpis) {
    return <div className="p-8 text-center text-muted-foreground">{t("kpis.noFinancialData")}</div>;
  }

  const sizeKPIs = [
    {
      label: t("kpis.totalAssets"),
      value: kpis.totalAssets.formatted,
      description: kpis.totalAssets.description,
    },
    {
      label: t("kpis.grossLoanPortfolio"),
      value: kpis.grossLoanPortfolio.formatted,
      description: kpis.grossLoanPortfolio.description,
    },
    {
      label: t("kpis.netLoanPortfolio"),
      value: kpis.netLoanPortfolio.formatted,
      description: kpis.netLoanPortfolio.description,
    },
    {
      label: t("kpis.memberDeposits"),
      value: kpis.totalMemberDeposits.formatted,
      description: kpis.totalMemberDeposits.description,
    },
    {
      label: t("kpis.totalEquity"),
      value: kpis.totalEquity.formatted,
      description: kpis.totalEquity.description,
    },
  ];

  const portfolioKPIs = [
    {
      label: t("kpis.par30"),
      value: kpis.par30.formatted,
      status: kpis.par30.status,
      benchmark: kpis.par30.benchmark,
    },
    {
      label: t("kpis.par60"),
      value: kpis.par60.formatted,
      status: kpis.par60.status,
      benchmark: kpis.par60.benchmark,
    },
    {
      label: t("kpis.par90"),
      value: kpis.par90.formatted,
      status: kpis.par90.status,
      benchmark: kpis.par90.benchmark,
    },
    { label: t("kpis.nplRatio"), value: kpis.nplRatio.formatted },
    {
      label: t("kpis.loanLossCoverage"),
      value: kpis.loanLossCoverage.formatted,
      status: kpis.loanLossCoverage.status,
      benchmark: kpis.loanLossCoverage.benchmark,
    },
  ];

  const profitabilityKPIs = [
    {
      label: t("kpis.roa"),
      value: kpis.roa.formatted,
      status: kpis.roa.status,
      benchmark: kpis.roa.benchmark,
    },
    {
      label: t("kpis.roe"),
      value: kpis.roe.formatted,
      status: kpis.roe.status,
      benchmark: kpis.roe.benchmark,
    },
    { label: t("kpis.financialRevenueRatio"), value: kpis.financialRevenueRatio.formatted },
    {
      label: t("kpis.operatingExpenseRatio"),
      value: kpis.operatingExpenseRatio.formatted,
      status: kpis.operatingExpenseRatio.status,
      benchmark: kpis.operatingExpenseRatio.benchmark,
    },
    { label: t("kpis.netInterestMargin"), value: kpis.netInterestMargin.formatted },
    {
      label: t("kpis.operationalSelfSufficiency"),
      value: kpis.operationalSelfSufficiency.formatted,
      status: kpis.operationalSelfSufficiency.status,
      benchmark: kpis.operationalSelfSufficiency.benchmark,
    },
  ];

  const liquidityKPIs = [
    {
      label: t("kpis.currentRatio"),
      value: kpis.currentRatio.formatted,
      status: kpis.currentRatio.status,
      benchmark: kpis.currentRatio.benchmark,
    },
    {
      label: t("kpis.cashRatio"),
      value: kpis.cashRatio.formatted,
      status: kpis.cashRatio.status,
      benchmark: kpis.cashRatio.benchmark,
    },
    {
      label: t("kpis.capitalAdequacy"),
      value: kpis.capitalAdequacyRatio.formatted,
      status: kpis.capitalAdequacyRatio.status,
      benchmark: kpis.capitalAdequacyRatio.benchmark,
    },
    {
      label: t("kpis.debtToEquity"),
      value: kpis.debtToEquity.formatted,
      status: kpis.debtToEquity.status,
      benchmark: kpis.debtToEquity.benchmark,
    },
    {
      label: t("kpis.liquidFundsRatio"),
      value: kpis.liquidFundsRatio.formatted,
      status: kpis.liquidFundsRatio.status,
      benchmark: kpis.liquidFundsRatio.benchmark,
    },
    { label: t("kpis.depositsToLoans"), value: kpis.depositsToLoans.formatted },
  ];

  const getKPIs = () => {
    switch (type) {
      case "size":
        return sizeKPIs;
      case "portfolio":
        return portfolioKPIs;
      case "profitability":
        return profitabilityKPIs;
      case "liquidity":
        return liquidityKPIs;
      case "all":
      default:
        return [
          ...sizeKPIs.slice(0, 3),
          ...portfolioKPIs.slice(0, 3),
          ...profitabilityKPIs.slice(0, 3),
          ...liquidityKPIs.slice(0, 3),
        ];
    }
  };

  const kpiList = getKPIs();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {kpiList.map((kpi, index) => (
        <KPICard key={index} {...kpi} />
      ))}
    </div>
  );
}

interface MembershipKPIGridProps {
  kpis: MembershipKPIs | null;
}

export function MembershipKPIGrid({ kpis }: MembershipKPIGridProps) {
  const { t } = useTranslation();

  if (!kpis) {
    return (
      <div className="p-8 text-center text-muted-foreground">{t("kpis.noMembershipData")}</div>
    );
  }

  const kpiList = [
    {
      label: t("kpis.totalMembers"),
      value: kpis.totalMembers.formatted,
      description: kpis.totalMembers.description,
    },
    {
      label: t("kpis.growthRate"),
      value: kpis.membershipGrowthRate.formatted,
      status: kpis.membershipGrowthRate.status,
      benchmark: kpis.membershipGrowthRate.benchmark,
    },
    {
      label: t("kpis.dormancyRate"),
      value: kpis.dormancyRate.formatted,
      status: kpis.dormancyRate.status,
      benchmark: kpis.dormancyRate.benchmark,
    },
    {
      label: t("kpis.exitRate"),
      value: kpis.exitRate.formatted,
      status: kpis.exitRate.status,
      benchmark: kpis.exitRate.benchmark,
    },
    {
      label: t("kpis.activeMembers"),
      value: kpis.activeMembersRatio.formatted,
      status: kpis.activeMembersRatio.status,
      benchmark: kpis.activeMembersRatio.benchmark,
    },
    {
      label: t("kpis.agmParticipation"),
      value: kpis.agmParticipationRate.formatted,
      status: kpis.agmParticipationRate.status,
      benchmark: kpis.agmParticipationRate.benchmark,
    },
    { label: t("kpis.womenMembers"), value: kpis.womenMembersPercent.formatted },
    { label: t("kpis.youthMembers"), value: kpis.youthMembersPercent.formatted },
    { label: t("kpis.ruralMembers"), value: kpis.ruralMembersPercent.formatted },
    { label: t("kpis.womenInGovernance"), value: kpis.womenInGovernancePercent.formatted },
    { label: t("kpis.youthInGovernance"), value: kpis.youthInGovernancePercent.formatted },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {kpiList.map((kpi, index) => (
        <KPICard key={index} {...kpi} />
      ))}
    </div>
  );
}

interface LoanKPIGridProps {
  kpis: LoanKPIs | null;
}

export function LoanKPIGrid({ kpis }: LoanKPIGridProps) {
  const { t } = useTranslation();

  if (!kpis) {
    return <div className="p-8 text-center text-muted-foreground">{t("kpis.noLoanData")}</div>;
  }

  const kpiList = [
    { label: t("kpis.creditPenetration"), value: kpis.creditPenetration.formatted },
    {
      label: t("kpis.onTimeRepayment"),
      value: kpis.onTimeRepaymentRatio.formatted,
      status: kpis.onTimeRepaymentRatio.status,
      benchmark: kpis.onTimeRepaymentRatio.benchmark,
    },
    {
      label: t("kpis.loansInArrears"),
      value: kpis.loansInArrearsPercent.formatted,
      status: kpis.loansInArrearsPercent.status,
      benchmark: kpis.loansInArrearsPercent.benchmark,
    },
    {
      label: t("kpis.restructuredLoans"),
      value: kpis.restructuredLoansRatio.formatted,
      status: kpis.restructuredLoansRatio.status,
      benchmark: kpis.restructuredLoansRatio.benchmark,
    },
    { label: t("kpis.womenBorrowers"), value: kpis.womenBorrowersPercent.formatted },
    { label: t("kpis.youthBorrowers"), value: kpis.youthBorrowersPercent.formatted },
    { label: t("kpis.ruralBorrowers"), value: kpis.ruralBorrowersPercent.formatted },
    { label: t("kpis.averageLoanSize"), value: kpis.averageLoanSize.formatted },
    { label: t("kpis.loansPerMember"), value: kpis.loansPerMember.formatted },
    { label: t("kpis.avgInterestRate"), value: kpis.averageInterestRate.formatted },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {kpiList.map((kpi, index) => (
        <KPICard key={index} {...kpi} />
      ))}
    </div>
  );
}

interface ComplianceScoreDisplayProps {
  score: number;
  status: "green" | "amber" | "red";
  components: {
    timelySubmission: number;
    dataQuality: number;
    financialRatios: number;
    documentation: number;
  };
  summary: string;
}

export function ComplianceScoreDisplay({
  score,
  status,
  components,
  summary,
}: ComplianceScoreDisplayProps) {
  const { t } = useTranslation();
  const statusColors = {
    green: {
      bg: "bg-success/10",
      border: "border-success/20",
      text: "text-success",
      label: t("kpis.compliant"),
    },
    amber: {
      bg: "bg-warning/10",
      border: "border-warning/20",
      text: "text-warning-foreground",
      label: t("kpis.needsAttention"),
    },
    red: {
      bg: "bg-destructive/10",
      border: "border-destructive/20",
      text: "text-destructive",
      label: t("kpis.nonCompliant"),
    },
  };

  const colors = statusColors[status];

  return (
    <div className={`rounded-xl ${colors.bg} ${colors.border} border p-6`}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-foreground">{t("kpis.complianceScore")}</h3>
          <p className="text-sm text-muted-foreground">{summary}</p>
        </div>
        <div className="text-right">
          <div className={`text-4xl font-bold ${colors.text}`}>{score.toFixed(1)}%</div>
          <div className={`text-sm font-medium ${colors.text}`}>{colors.label}</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t("kpis.timelySubmission")}</span>
          <span className="text-sm font-bold text-foreground">
            {components.timelySubmission.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-primary" style={{ width: `${components.timelySubmission}%` }} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t("kpis.dataQuality")}</span>
          <span className="text-sm font-bold text-foreground">
            {components.dataQuality.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-info" style={{ width: `${components.dataQuality}%` }} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t("kpis.financialRatios")}</span>
          <span className="text-sm font-bold text-foreground">
            {components.financialRatios.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-accent" style={{ width: `${components.financialRatios}%` }} />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{t("kpis.documentation")}</span>
          <span className="text-sm font-bold text-foreground">
            {components.documentation.toFixed(0)}%
          </span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className="h-full bg-warning" style={{ width: `${components.documentation}%` }} />
        </div>
      </div>
    </div>
  );
}

interface BenchmarkChartProps {
  title: string;
  cooperatives: Array<{
    name: string;
    value: number;
    regional: number;
    national: number;
  }>;
}

export function BenchmarkChart({ title, cooperatives }: BenchmarkChartProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h3 className="text-sm font-bold text-foreground mb-4">{title}</h3>
      <div className="space-y-3">
        {cooperatives.map((coop, index) => {
          const maxVal = Math.max(coop.value, coop.regional, coop.national, 100);
          return (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground font-medium truncate">{coop.name}</span>
                <span className="text-muted-foreground font-mono">{coop.value.toFixed(1)}%</span>
              </div>
              <div className="relative h-3 rounded-full bg-muted overflow-hidden">
                <div
                  className="absolute inset-y-0 left-0 bg-muted-foreground/30"
                  style={{ width: `${(coop.national / maxVal) * 100}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-primary/50"
                  style={{ width: `${(coop.regional / maxVal) * 100}%` }}
                />
                <div
                  className="absolute inset-y-0 left-0 bg-primary"
                  style={{ width: `${(coop.value / maxVal) * 100}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{t("kpis.regionalLabel", { value: coop.regional.toFixed(1) })}%</span>
                <span>{t("kpis.nationalLabel", { value: coop.national.toFixed(1) })}%</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-primary" />
          <span>{t("kpis.cooperative")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-primary/50" />
          <span>{t("kpis.regionalAvg")}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-sm bg-muted-foreground/30" />
          <span>{t("kpis.nationalAvg")}</span>
        </div>
      </div>
    </div>
  );
}
