import { PieChart, Pie, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import type { CoopKpiRow } from "@/hooks/analytics/useNationalOverview";

interface ApexDistributionBarProps {
  cooperatives: CoopKpiRow[];
}

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

export function ApexDistributionBar({ cooperatives }: ApexDistributionBarProps) {
  // Aggregate data by apex
  const apexMap = new Map<string, { count: number; activeMembers: number }>();

  cooperatives.forEach((coop) => {
    const apex = coop.apex_name ?? "Independent / Direct";

    if (!apexMap.has(apex)) {
      apexMap.set(apex, { count: 0, activeMembers: 0 });
    }

    const curr = apexMap.get(apex)!;
    curr.count += 1;
    curr.activeMembers += coop.non_financial?.active_members ?? 0;
  });

  const data = Array.from(apexMap.entries())
    .map(([apex, values]) => ({
      name: apex,
      Cooperatives: values.count,
      "Active Members": values.activeMembers,
    }))
    .sort((a, b) => b.Cooperatives - a.Cooperatives); // Sort descending by number of coops

  if (data.length === 0) return null;

  return (
    <div className="h-72 flex w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 20, right: 20, left: 20, bottom: 20 }}>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={5}
            dataKey="Cooperatives"
            nameKey="name"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={true}
          >
            {data.map((_, index) => (
              <Cell
                key={`cell-${index}`}
                fill={COLORS[index % COLORS.length]}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number, name: string) => [value, "Cooperatives"]}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: "10px" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
