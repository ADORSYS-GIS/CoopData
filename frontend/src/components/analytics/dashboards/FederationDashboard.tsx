import { RegionalGroupedBar } from "../RegionalGroupedBar";
import { TopBottomLeaderboard } from "../TopBottomLeaderboard";
import { type CoopKpiRow } from "@/hooks/analytics/useNationalOverview";

interface FederationDashboardProps {
  cooperatives: CoopKpiRow[];
}

export function FederationDashboard({ cooperatives }: FederationDashboardProps) {
  return (
    <div className="space-y-6">
      <div className="rounded-xl border bg-surface p-5 shadow-sm">
        <h3 className="font-heading font-bold mb-4">
          Regional Distribution (Assets, Loans, Deposits)
        </h3>
        <RegionalGroupedBar cooperatives={cooperatives} />
      </div>

      <div className="rounded-xl border bg-surface p-5 shadow-sm">
        <h3 className="font-heading font-bold mb-4">Operational Efficiency Leaderboard (OER)</h3>
        {/* Sort by operating_expense_ratio (lower is better, meaning more efficient) */}
        <TopBottomLeaderboard cooperatives={cooperatives} sortByKpi="operating_expense_ratio" />
      </div>
    </div>
  );
}
