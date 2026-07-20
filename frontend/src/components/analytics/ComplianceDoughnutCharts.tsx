import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import type { TrafficLightDistribution } from "@/hooks/analytics/useNationalOverview";

interface ComplianceDoughnutChartsProps {
  distributions: Record<string, TrafficLightDistribution>;
}

const labels: Record<string, string> = {
  par30: "PAR30",
  capital_adequacy_ratio: "CAR",
  roa: "ROA",
  npl_ratio: "NPL",
};

export function ComplianceDoughnutCharts({ distributions }: ComplianceDoughnutChartsProps) {
  const dataList = Object.entries(distributions)
    .filter(([key]) => labels[key] !== undefined)
    .map(([key, dist]) => {
      const total = dist.green_count + dist.amber_count + dist.red_count;
      return {
        name: labels[key],
        total,
        data: [
          { name: "Healthy", value: dist.green_count, fill: "var(--success)" },
          { name: "Watch", value: dist.amber_count, fill: "var(--warning)" },
          { name: "Risk", value: dist.red_count, fill: "var(--destructive)" },
        ].filter((d) => d.value > 0),
      };
    });

  if (dataList.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-4 mb-6 flex-wrap justify-center text-[11px] text-muted-foreground">
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

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
        {dataList.map((item) => (
          <div key={item.name} className="flex flex-col items-center">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
              {item.name}
            </p>
            <div className="relative h-32 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={item.data}
                    dataKey="value"
                    innerRadius={40}
                    outerRadius={55}
                    paddingAngle={3}
                  >
                    {item.data.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    itemStyle={{ color: "var(--foreground)" }}
                    formatter={(value: number, name: string) => [
                      `${value} coops (${Math.round((value / Math.max(item.total, 1)) * 100)}%)`,
                      name,
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="font-heading text-lg font-bold text-foreground num leading-none">
                  {item.total}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
