import { ComplianceRadialGauges } from "../ComplianceRadialGauges";
import { CoopTrendAreaChart } from "../CoopTrendAreaChart";
import { GenderStatusDoughnuts } from "../GenderStatusDoughnuts";
import { KpiChipGrid } from "../KpiChipGrid";
import type { MembershipStats } from "@/hooks/analytics/useNfStatistics";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";

interface KpiItem {
  name: string;
  value: number;
  formatted: string;
  unit: string;
  status?: string | null;
  description: string;
}

interface TrendPoint {
  monthShort?: string;
  month_label?: string;
  assets: number;
  savings: number;
  loans: number;
}

interface CooperativeDashboardProps {
  kpis: KpiItem[];
  trendData: TrendPoint[];
  nfStats: { membership: MembershipStats } | null;
}

export function CooperativeDashboard({ kpis, trendData, nfStats }: CooperativeDashboardProps) {
  const { t } = useOrganizationLabelsContext();
  const getKpi = (name: string) => {
    return kpis?.find((k) => k.name === name)?.value || 0;
  };

  const carValue = getKpi("capital_adequacy_ratio");
  const liquidityValue = getKpi("liquid_funds_ratio");
  const nplValue = getKpi("npl_ratio");

  const formattedTrendData =
    trendData?.map((m) => ({
      month: m.monthShort ?? m.month_label ?? "",
      liquidity: m.assets,
      savings: m.savings,
      loans: m.loans,
    })) || [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border bg-surface p-5 shadow-sm">
          <h3 className="font-heading font-bold mb-4">
            {t("analytics.regulatoryComplianceStatus")}
          </h3>
          <ComplianceRadialGauges
            carValue={carValue}
            liquidityValue={liquidityValue}
            nplValue={nplValue}
          />
        </div>

        <div className="rounded-xl border bg-surface p-5 shadow-sm">
          <h3 className="font-heading font-bold mb-4">{t("analytics.liquiditySavingsTrend")}</h3>
          <CoopTrendAreaChart data={formattedTrendData} />
        </div>
      </div>

      <div className="rounded-xl border bg-surface p-5 shadow-sm">
        <h3 className="font-heading font-bold mb-4">{t("analytics.membershipDemographics")}</h3>
        {nfStats ? (
          <GenderStatusDoughnuts data={nfStats.membership} />
        ) : (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            {t("analytics.noMembershipData")}
          </div>
        )}
      </div>
    </div>
  );
}
