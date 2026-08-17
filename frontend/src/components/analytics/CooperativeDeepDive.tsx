import React, { useMemo } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
            {t("analytics.deepDiveLabel")}
          </p>
          <h2 className="font-heading text-xl font-bold text-foreground">{cooperativeName}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {cooperativeType ?? t("analytics.unknownType")} ·{" "}
            {cooperativeRegion ?? t("analytics.unknownRegion")}
          </p>
        </div>
        <button
          onClick={onClose}
          className="press-feedback inline-flex items-center gap-2 rounded-lg border border-border bg-background px-4 py-2 text-xs font-bold text-muted-foreground hover:text-foreground transition-all"
        >
          <X className="size-3.5" />
          {t("analytics.closeDeepDive")}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title={t("analytics.deepDiveRegulatoryCompliance")}
          subtitle={t("analytics.deepDiveComplianceSubtitle")}
          info={t("analytics.deepDiveComplianceInfo")}
        >
          <ComplianceRadialGauges
            carValue={kpiMap["capital_adequacy_ratio"] ?? 0}
            liquidityValue={kpiMap["liquid_funds_ratio"] ?? 0}
            nplValue={kpiMap["npl_ratio"] ?? 0}
          />
        </Card>
        {trendPoints.length > 0 && (
          <Card
            title={t("analytics.deepDiveFinancialTrend")}
            subtitle={t("analytics.deepDiveTrendSubtitle")}
            info={t("analytics.deepDiveTrendInfo")}
          >
            {isDeepDiveTrendEmpty ? (
              <div className="h-[250px] flex items-center justify-center text-sm text-muted-foreground">
                {t("analytics.noHistoricalTrendData")}
              </div>
            ) : (
              <CoopTrendAreaChart data={trendPoints} />
            )}
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {deepDiveKpis && (
          <Card
            title={t("analytics.deepDiveLoanProvisioningGap")}
            subtitle={t("analytics.deepDiveProvisioningSubtitle")}
            info={t("analytics.deepDiveProvisioningInfo")}
          >
            <LoanProvisioningWaterfall
              glp={kpiMap["gross_loan_portfolio"] ?? 0}
              par30_pct={kpiMap["par30"] ?? 0}
              provisions_pct={kpiMap["loan_loss_coverage"] ?? 0}
            />
          </Card>
        )}
        {deepDiveNf && (
          <Card
            title={t("analytics.deepDiveMembershipDemographics")}
            info={t("analytics.deepDiveMembershipInfo")}
          >
            <GenderStatusDoughnuts data={deepDiveNf.membership} />
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {deepDiveNf && (
          <Card
            title={t("analytics.deepDiveLiquidityRisk")}
            subtitle={t("analytics.deepDiveLiquiditySubtitle")}
            info={t("analytics.deepDiveLiquidityInfo")}
          >
            <DepositConcentrationGauge stats={deepDiveNf.fixed_deposits} />
          </Card>
        )}
        {deepDiveNf && (
          <Card
            title={t("analytics.deepDiveDemocraticEngagement")}
            subtitle={t("analytics.deepDiveEngagementSubtitle")}
            info={t("analytics.deepDiveEngagementInfo")}
          >
            <GovernanceFunnel stats={deepDiveNf.membership} />
          </Card>
        )}
        {deepDiveNf && (
          <Card
            title={t("analytics.deepDiveFinancialInclusion")}
            subtitle={t("analytics.deepDiveInclusionSubtitle")}
            info={t("analytics.deepDiveInclusionInfo")}
          >
            <FinancialInclusionBar stats={deepDiveNf.loans} />
          </Card>
        )}
      </div>

      {deepDiveNf?.farm_coop && deepDiveNf.farm_coop.total_coops > 0 && (
        <Card
          title={t("analytics.deepDiveAgriculturalResilience")}
          subtitle={t("analytics.deepDiveAgriSubtitle")}
          info={t("analytics.deepDiveAgriInfo")}
        >
          <AgriResilienceRadar stats={deepDiveNf.farm_coop} />
        </Card>
      )}
    </div>
  );
};
