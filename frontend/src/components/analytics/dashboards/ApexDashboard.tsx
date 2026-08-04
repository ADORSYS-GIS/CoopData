import { ApexRadarChart } from "../ApexRadarChart";
import { CoopScatterPlot } from "../CoopScatterPlot";
import { TopBottomLeaderboard } from "../TopBottomLeaderboard";
import { type CoopKpiRow } from "@/hooks/analytics/useNationalOverview";
import { useTranslation } from "react-i18next";

interface ApexDashboardProps {
  cooperatives: CoopKpiRow[];
}

export function ApexDashboard({ cooperatives }: ApexDashboardProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border bg-surface p-5 shadow-sm">
          <h3 className="font-heading font-bold mb-4">{t("analytics.riskVsReturnProfile")}</h3>
          <CoopScatterPlot data={cooperatives} />
        </div>
        <div className="rounded-xl border bg-surface p-5 shadow-sm">
          <h3 className="font-heading font-bold mb-4">{t("analytics.networkComparativePerf")}</h3>
          <ApexRadarChart data={cooperatives} />
        </div>
      </div>

      <div className="rounded-xl border bg-surface p-5 shadow-sm">
        <h3 className="font-heading font-bold mb-4">{t("analytics.nplLeaderboard")}</h3>
        <TopBottomLeaderboard cooperatives={cooperatives} sortByKpi="npl_ratio" />
      </div>
    </div>
  );
}
