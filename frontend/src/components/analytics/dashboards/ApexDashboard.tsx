import { ApexRadarChart } from "../ApexRadarChart";
import { CoopScatterPlot } from "../CoopScatterPlot";
import { TopBottomLeaderboard } from "../TopBottomLeaderboard";
import { type CoopKpiRow } from "@/hooks/analytics/useNationalOverview";

interface ApexDashboardProps {
  cooperatives: CoopKpiRow[];
}

export function ApexDashboard({ cooperatives }: ApexDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-xl border bg-surface p-5 shadow-sm">
          <h3 className="font-heading font-bold mb-4">Risk vs Return Profile</h3>
          <CoopScatterPlot data={cooperatives} />
        </div>
        <div className="rounded-xl border bg-surface p-5 shadow-sm">
          <h3 className="font-heading font-bold mb-4">Network Comparative Performance</h3>
          <ApexRadarChart data={cooperatives} />
        </div>
      </div>

      <div className="rounded-xl border bg-surface p-5 shadow-sm">
        <h3 className="font-heading font-bold mb-4">NPL Leaderboard</h3>
        <TopBottomLeaderboard cooperatives={cooperatives} sortByKpi="npl_ratio" />
      </div>
    </div>
  );
}
