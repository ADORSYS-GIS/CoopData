import { RegionalGroupedBar } from "../RegionalGroupedBar";
import { TopBottomLeaderboard } from "../TopBottomLeaderboard";
import { type CoopKpiRow } from "@/hooks/analytics/useNationalOverview";
import { useTranslation } from "react-i18next";

interface FederationDashboardProps {
  cooperatives: CoopKpiRow[];
}

export function FederationDashboard({ cooperatives }: FederationDashboardProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-surface p-5 shadow-sm">
        <h3 className="font-heading font-bold mb-4">{t("analytics.regionalDistribution")}</h3>
        <RegionalGroupedBar cooperatives={cooperatives} />
      </div>

      <div className="rounded-xl border bg-surface p-5 shadow-sm">
        <h3 className="font-heading font-bold mb-4">{t("analytics.oerLeaderboard")}</h3>
        <TopBottomLeaderboard cooperatives={cooperatives} sortByKpi="operating_expense_ratio" />
      </div>
    </div>
  );
}
