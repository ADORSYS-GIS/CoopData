import React, { useMemo } from "react";
import { X } from "lucide-react";
import { Card } from "@/components/app-shell";
import { ComplianceRadialGauges } from "@/components/analytics/ComplianceRadialGauges";
import { CoopTrendAreaChart } from "@/components/analytics/CoopTrendAreaChart";
import { LoanProvisioningWaterfall } from "@/components/analytics/LoanProvisioningWaterfall";
import { GenderStatusDoughnuts } from "@/components/analytics/GenderStatusDoughnuts";
import { DepositConcentrationGauge } from "@/components/analytics/DepositConcentrationGauge";
import { GovernanceFunnel } from "@/components/analytics/GovernanceFunnel";
import { FinancialInclusionBar } from "@/components/analytics/FinancialInclusionBar";
import { AgriResilienceRadar } from "@/components/analytics/AgriResilienceRadar";
import { useCooperativeKpis } from "@/hooks/submissions/useCooperativeKpis";
import { useMonthlyTrend } from "@/hooks/analytics/useMonthlyTrend";
import { useNfStatistics } from "@/hooks/analytics/useNfStatistics";

export interface CooperativeDeepDiveProps {
  cooperativeId: string;
  submissionId?: string | null;
  cooperativeName: string;
  cooperativeRegion?: string | null;
  cooperativeType?: string | null;
  reportingYear: number;
  onClose: () => void;
}

export const CooperativeDeepDive: React.FC<CooperativeDeepDiveProps> = ({
  cooperativeId,
  submissionId,
  cooperativeName,
  cooperativeRegion,
  cooperativeType,
  reportingYear,
  onClose,
}) => {
  const { data: deepDiveKpis } = useCooperativeKpis(submissionId ?? undefined);
  const { data: deepDiveTrend } = useMonthlyTrend(
    { reportingYear, cooperativeId },
    true, // always enabled when this component mounts
  );
  const { data: deepDiveNf } = useNfStatistics(
    false,
    { reportingYear, cooperativeId },
    true, // always enabled
  );

  const kpiMap = useMemo(() => {
    const map: Record<string, number> = {};
    deepDiveKpis?.kpis.forEach((k) => {
      map[k.name] = k.value;
    });
    return map;
  }, [deepDiveKpis]);

  const trendPoints = useMemo(
    () =>
      (deepDiveTrend?.months ?? []).map((m) => ({
        month: m.month_label,
        liquidity: m.assets,
        savings: m.savings,
        loans: m.loans,
      })),
    [deepDiveTrend],
  );

  const isDeepDiveTrendEmpty = trendPoints.every(
    (p) => p.liquidity === 0 && p.savings === 0 && p.loans === 0,
  );

  return (
    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
      {/* Header */}
      <div className="rounded-xl border border-primary/30 bg-primary/4 p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-primary mb-1">
            Cooperative Deep Dive
          </p>
          <h2 className="font-heading text-xl font-bold text-foreground">
            {cooperativeName}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {cooperativeType ?? "Unknown Type"} · {cooperativeRegion ?? "Unknown Region"}
          </p>
        </div>
        <button
          onClick={onClose}
          className="press-feedback inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-all"
        >
          <X className="size-3.5" />
          Close Deep Dive
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Regulatory Compliance" subtitle="CAR · Liquidity · NPL" info="Monitors the cooperative's compliance with critical financial regulations. Capital Adequacy ensures sufficient equity against risk, Liquidity measures cash available for short-term obligations, and NPL tracks loan defaults.">
          <ComplianceRadialGauges
            carValue={kpiMap["capital_adequacy_ratio"] ?? 0}
            liquidityValue={kpiMap["liquid_funds_ratio"] ?? 0}
            nplValue={kpiMap["npl_ratio"] ?? 0}
          />
        </Card>
        {trendPoints.length > 0 && (
          <Card
            title="Financial Trend"
            subtitle="12-month assets, loans & savings"
            info="Visualizes the month-over-month trajectory of the cooperative's core financial balances."
          >
            {isDeepDiveTrendEmpty ? (
              <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
                No historical trend data available yet
              </div>
            ) : (
              <CoopTrendAreaChart data={trendPoints} />
            )}
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {deepDiveKpis && (
          <Card title="Loan Provisioning Gap" subtitle="Unprotected at-risk capital visualization" info="A waterfall breakdown of the gross loan portfolio, highlighting 'At-Risk Capital' by subtracting loan loss provisions from non-performing loans, showing potential unprotected losses.">
            <LoanProvisioningWaterfall
              glp={kpiMap["gross_loan_portfolio"] ?? 0}
              par30_pct={kpiMap["par30"] ?? 0}
              provisions_pct={kpiMap["loan_loss_coverage"] ?? 0}
            />
          </Card>
        )}
        {deepDiveNf && (
          <Card title="Membership Demographics" info="Visualizes the demographic makeup of the member base, including gender ratios and the proportion of active versus dormant accounts.">
            <GenderStatusDoughnuts data={deepDiveNf.membership} />
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {deepDiveNf && (
          <Card title="Liquidity Risk" subtitle="Term deposit concentration" info="Assesses liquidity risk by examining the concentration of fixed (term) deposits. High concentration in a few accounts or short-term maturities can pose withdrawal risks.">
            <DepositConcentrationGauge stats={deepDiveNf.fixed_deposits} />
          </Card>
        )}
        {deepDiveNf && (
          <Card title="Democratic Engagement" subtitle="Member governance participation" info="Measures the democratic health of the cooperative by tracking member participation in governance activities, such as voting in the Annual General Meeting (AGM).">
            <GovernanceFunnel stats={deepDiveNf.membership} />
          </Card>
        )}
        {deepDiveNf && (
          <Card title="Financial Inclusion" subtitle="Credit access for target demographics" info="Tracks the distribution of credit access across key demographics (e.g., Women, Youth) to ensure the cooperative is fulfilling its inclusive mandate.">
            <FinancialInclusionBar stats={deepDiveNf.loans} />
          </Card>
        )}
      </div>

      {deepDiveNf && deepDiveNf.farm_coop.total_coops > 0 && (
        <Card title="Agricultural Resilience" subtitle="Physical and operational infrastructure scores" info="A radar analysis evaluating the cooperative's agricultural infrastructure, including storage capacity, processing facilities, and mechanization levels.">
          <AgriResilienceRadar stats={deepDiveNf.farm_coop} />
        </Card>
      )}
    </div>
  );
};
