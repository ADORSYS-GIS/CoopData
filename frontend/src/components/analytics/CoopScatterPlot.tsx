import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  ReferenceLine,
  Cell,
} from "recharts";
import { type CoopKpiRow } from "@/hooks/analytics/useNationalOverview";

interface CoopScatterPlotProps {
  data: CoopKpiRow[];
}

export function CoopScatterPlot({ data }: CoopScatterPlotProps) {
  const withData = data.filter((c) => c.has_data && c.kpis["roa"] && c.kpis["npl_ratio"]);

  if (withData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground">
        <p className="text-sm font-semibold">No performance data available</p>
      </div>
    );
  }

  // Transform data: X = NPL Ratio (Risk), Y = ROA (Return), Z = Asset Size (Bubble size)
  const chartData = withData.map((c) => ({
    name: c.name,
    npl: Math.min(c.kpis["npl_ratio"]?.value || 0, 30), // Cap at 30% for chart scaling
    roa: Math.max(Math.min(c.kpis["roa"]?.value || 0, 20), -20), // Cap between -20 and 20%
    size: c.kpis["total_assets"]?.value || 1000000,
    rawNpl: c.kpis["npl_ratio"]?.formatted || "0%",
    rawRoa: c.kpis["roa"]?.formatted || "0%",
    status: c.kpis["npl_ratio"]?.value > 5 ? "red" : "green", // Red if NPL > 5%
  }));

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            type="number"
            dataKey="npl"
            name="NPL Ratio"
            unit="%"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            domain={[0, "dataMax + 2"]}
            label={{
              value: "Risk (NPL Ratio)",
              position: "insideBottom",
              offset: -10,
              fill: "hsl(var(--muted-foreground))",
              fontSize: 12,
            }}
          />
          <YAxis
            type="number"
            dataKey="roa"
            name="ROA"
            unit="%"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
            domain={["auto", "auto"]}
            label={{
              value: "Return (ROA)",
              angle: -90,
              position: "insideLeft",
              offset: 0,
              fill: "hsl(var(--muted-foreground))",
              fontSize: 12,
            }}
          />
          <ZAxis type="number" dataKey="size" range={[50, 400]} name="Assets" />
          <Tooltip
            cursor={{ strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const data = payload[0].payload;
                return (
                  <div className="rounded-lg border bg-background p-3 shadow-sm min-w-[180px]">
                    <p className="text-sm font-semibold mb-2">{data.name}</p>
                    <div className="flex flex-col gap-1 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Return (ROA):</span>
                        <span className="font-medium font-heading">{data.rawRoa}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Risk (NPL):</span>
                        <span
                          className={`font-medium font-heading ${data.status === "red" ? "text-destructive" : "text-success"}`}
                        >
                          {data.rawNpl}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />

          {/* Reference Lines representing regulatory thresholds */}
          <ReferenceLine
            x={5}
            stroke="hsl(var(--destructive))"
            strokeDasharray="3 3"
            label={{
              value: "NPL Target (5%)",
              position: "top",
              fill: "hsl(var(--destructive))",
              fontSize: 10,
            }}
          />
          <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" />

          <Scatter name="Cooperatives" data={chartData}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.status === "red" ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
                fillOpacity={0.7}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
