import type { CoopKpiRow } from "@/hooks/analytics/useNationalOverview";
import { ShieldCheck, Target } from "lucide-react";

interface TopBottomLeaderboardProps {
  cooperatives: CoopKpiRow[];
  sortByKpi: string; // usually "par30"
}

function KpiChip({ status }: { status: string | null }) {
  if (status === "green") return <span className="size-2.5 rounded-full bg-success shrink-0" />;
  if (status === "amber") return <span className="size-2.5 rounded-full bg-warning shrink-0" />;
  if (status === "red") return <span className="size-2.5 rounded-full bg-destructive shrink-0" />;
  return <span className="size-2.5 rounded-full bg-muted-foreground shrink-0" />;
}

export function TopBottomLeaderboard({ cooperatives, sortByKpi }: TopBottomLeaderboardProps) {
  const withData = cooperatives.filter((c) => c.has_data && c.kpis[sortByKpi] !== undefined);

  // Sort ascending (lower PAR30 is better)
  const sorted = [...withData].sort((a, b) => {
    return a.kpis[sortByKpi].value - b.kpis[sortByKpi].value;
  });

  const top5 = sorted.slice(0, 5);
  // Bottom 5 are the last 5 in the array, reversed so worst is at the top of its list
  const bottom5 = sorted.slice(-5).reverse();

  if (withData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground">
        <p className="text-sm font-semibold">No performance data available</p>
      </div>
    );
  }

  const renderRow = (coop: CoopKpiRow, index: number) => (
    <div key={coop.cooperative_id} className="flex items-center justify-between p-3 border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
      <div className="flex items-center gap-3 overflow-hidden">
        <span className="text-xs font-bold text-muted-foreground w-4">{index + 1}.</span>
        <div className="truncate">
          <p className="text-sm font-semibold text-foreground truncate" title={coop.name}>
            {coop.name}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider truncate">
            {coop.region ?? "Unknown"} • {coop.sector ?? coop.institution_type ?? "Unclassified"}
          </p>
        </div>
      </div>
      <div className="flex flex-col items-end shrink-0 pl-4">
        <div className="flex items-center gap-2">
          <span className="font-heading font-bold num">{coop.kpis[sortByKpi].formatted}</span>
          <KpiChip status={coop.kpis[sortByKpi].status} />
        </div>
        {coop.kpis["capital_adequacy_ratio"] && (
          <span className="text-[10px] text-muted-foreground">
            CAR: {coop.kpis["capital_adequacy_ratio"].formatted}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Top 5 */}
      <div className="rounded-xl border border-success/30 bg-success/5 overflow-hidden flex flex-col">
        <div className="px-4 py-3 bg-success/10 border-b border-success/20 flex items-center gap-2">
          <ShieldCheck className="size-4 text-success" />
          <h3 className="font-bold text-sm text-success">Top 5 Performers</h3>
        </div>
        <div className="flex-1 p-1">
          {top5.map((c, i) => renderRow(c, i))}
        </div>
      </div>

      {/* Bottom 5 */}
      <div className="rounded-xl border border-destructive/30 bg-destructive/5 overflow-hidden flex flex-col">
        <div className="px-4 py-3 bg-destructive/10 border-b border-destructive/20 flex items-center gap-2">
          <Target className="size-4 text-destructive" />
          <h3 className="font-bold text-sm text-destructive">Watch List (Bottom 5)</h3>
        </div>
        <div className="flex-1 p-1">
          {bottom5.map((c, i) => renderRow(c, i))}
        </div>
      </div>
    </div>
  );
}
