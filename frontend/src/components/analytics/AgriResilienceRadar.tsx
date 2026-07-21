import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import type { FarmCoopStats } from "@/hooks/analytics/useNfStatistics";

interface Props {
  stats: FarmCoopStats;
}

export function AgriResilienceRadar({ stats }: Props) {
  if (stats.total_coops === 0 && stats.active_producers === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No agricultural data available
      </div>
    );
  }

  const data = [
    { subject: "Planning", A: stats.planning_adoption_pct ?? 0, fullMark: 100 },
    { subject: "Shared Inputs", A: stats.shared_services_pct ?? 0, fullMark: 100 },
    { subject: "Formal Off-take", A: stats.formal_offtake_pct ?? 0, fullMark: 100 },
    { subject: "Storage", A: stats.storage_coverage_pct ?? 0, fullMark: 100 },
    { subject: "Processing", A: stats.processing_access_pct ?? 0, fullMark: 100 },
    { subject: "Irrigation", A: stats.irrigation_coverage_pct ?? 0, fullMark: 100 },
    { subject: "Climate Mitig.", A: stats.climate_mitigation_pct ?? 0, fullMark: 100 },
  ];

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="70%" data={data}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: 700 }}
          />
          <PolarRadiusAxis
            angle={30}
            domain={[0, 100]}
            tick={{ fill: "var(--muted-foreground)", fontSize: 10 }}
            tickCount={5}
          />
          <Radar
            name="Agri-Resilience"
            dataKey="A"
            stroke="var(--chart-3)"
            fill="var(--chart-3)"
            fillOpacity={0.4}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--border)",
              fontSize: "12px",
            }}
            formatter={(val: number) => [`${val.toFixed(1)}%`, "Coverage"]}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
