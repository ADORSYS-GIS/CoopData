import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { TrafficLightDistribution } from "@/hooks/analytics/useNationalOverview";

interface ComplianceStackedBarsProps {
  distributions: Record<string, TrafficLightDistribution>;
}

const labels: Record<string, string> = {
  par30: "PAR30",
  capital_adequacy_ratio: "CAR",
  roa: "ROA",
  npl_ratio: "NPL",
};

export function ComplianceStackedBars({ distributions }: ComplianceStackedBarsProps) {
  const data = Object.entries(distributions)
    .filter(([key]) => labels[key] !== undefined)
    .map(([key, dist]) => ({
      name: labels[key],
      Healthy: dist.green_pct,
      Watch: dist.amber_pct,
      Risk: dist.red_pct,
      noData: dist.no_data_pct,
      ...dist, // keep raw counts for tooltip
    }));

  if (data.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 flex-wrap text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-success" /> Healthy
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-warning" /> Watch
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-destructive" /> Risk
        </span>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            layout="vertical"
            margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
          >
            <XAxis type="number" domain={[0, 100]} hide />
            <YAxis
              type="category"
              dataKey="name"
              stroke="var(--muted-foreground)"
              fontSize={11}
              fontFamily="var(--font-sans)"
              tickLine={false}
              axisLine={false}
              width={60}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              cursor={{ fill: "var(--muted)", opacity: 0.3 }}
              formatter={(
                value: number,
                name: string,
                props: { payload: Record<string, number> },
              ) => {
                const count =
                  name === "Healthy"
                    ? props.payload.green_count
                    : name === "Watch"
                      ? props.payload.amber_count
                      : props.payload.red_count;
                return [`${value.toFixed(1)}% (${count} coops)`, name];
              }}
            />
            <Bar
              dataKey="Healthy"
              stackId="a"
              fill="var(--success)"
              barSize={24}
              radius={[4, 0, 0, 4]}
            />
            <Bar dataKey="Watch" stackId="a" fill="var(--warning)" barSize={24} />
            <Bar
              dataKey="Risk"
              stackId="a"
              fill="var(--destructive)"
              barSize={24}
              radius={[0, 4, 4, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
