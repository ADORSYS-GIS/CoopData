import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { CoopKpiRow } from "@/hooks/analytics/useNationalOverview";

interface RegionalGroupedBarProps {
  cooperatives: CoopKpiRow[];
}

export function RegionalGroupedBar({ cooperatives }: RegionalGroupedBarProps) {
  // Aggregate data by region
  const regionMap = new Map<string, { Assets: number; Loans: number; Deposits: number }>();

  cooperatives.forEach((coop) => {
    if (!coop.has_data) return;
    const region = coop.region ?? "Unknown";
    
    if (!regionMap.has(region)) {
      regionMap.set(region, { Assets: 0, Loans: 0, Deposits: 0 });
    }
    
    const curr = regionMap.get(region)!;
    curr.Assets += coop.kpis["total_assets"]?.value ?? 0;
    curr.Loans += coop.kpis["gross_loan_portfolio"]?.value ?? 0;
    curr.Deposits += coop.kpis["total_member_deposits"]?.value ?? 0;
  });

  const data = Array.from(regionMap.entries()).map(([region, values]) => ({
    name: region,
    Assets: Math.round(values.Assets / 1000), // convert to $K
    Loans: Math.round(values.Loans / 1000),
    Deposits: Math.round(values.Deposits / 1000),
  }));

  if (data.length === 0) return null;

  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="name" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}K`} />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(val: number) => [`$${val.toLocaleString()}K`]}
            cursor={{ fill: "var(--muted)", opacity: 0.3 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Assets" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Loans" fill="var(--chart-2)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="Deposits" fill="var(--chart-3)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
