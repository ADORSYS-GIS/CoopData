import { RegionalGroupedBar } from "../RegionalGroupedBar";
import { GenderStatusDoughnuts } from "../GenderStatusDoughnuts";
import { type CoopKpiRow } from "@/hooks/analytics/useNationalOverview";
import type { MembershipStats } from "@/hooks/analytics/useNfStatistics";
import { useTranslation } from "react-i18next";

interface MinistryDashboardProps {
  cooperatives: CoopKpiRow[];
  nfStats: {
    membership: MembershipStats;
  } | null;
}

export function MinistryDashboard({ cooperatives, nfStats }: MinistryDashboardProps) {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border bg-surface p-5 shadow-sm">
          <h3 className="font-heading font-bold mb-4">
            {t("analytics.macroRegionalDistribution")}
          </h3>
          <RegionalGroupedBar cooperatives={cooperatives} />
        </div>

        <div className="rounded-xl border bg-surface p-5 shadow-sm">
          <h3 className="font-heading font-bold mb-4">{t("analytics.nationalDemographics")}</h3>
          {nfStats ? (
            <GenderStatusDoughnuts data={nfStats.membership} />
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground">
              {t("analytics.noDemographicData")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
