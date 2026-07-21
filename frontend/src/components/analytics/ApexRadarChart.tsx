import {
  Radar,
  RadarChart as RechartsRadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { type CoopKpiRow } from "@/hooks/analytics/useNationalOverview";

interface ApexRadarChartProps {
  data: CoopKpiRow[];
  compareWithSectorAverage?: boolean;
}

export function ApexRadarChart({ data, compareWithSectorAverage = true }: ApexRadarChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground">
        <p className="text-sm font-semibold">No performance data available</p>
      </div>
    );
  }

  // Calculate averages across the provided cooperatives for the radar dimensions
  // Dimensions: Liquidity, Asset Quality (inverted NPL), Earnings (ROA), Capital (CAR)
  const averages = {
    liquidity: 0,
    assetQuality: 0,
    earnings: 0,
    capital: 0,
    count: 0,
  };

  data.forEach((c) => {
    if (c.has_data) {
      averages.liquidity += c.kpis["liquid_funds_ratio"]?.value || 0;
      averages.assetQuality += 100 - (c.kpis["npl_ratio"]?.value || 0); // Invert so higher is better
      averages.earnings += c.kpis["roa"]?.value || 0;
      averages.capital += c.kpis["capital_adequacy_ratio"]?.value || 0;
      averages.count += 1;
    }
  });

  if (averages.count > 0) {
    averages.liquidity /= averages.count;
    averages.assetQuality /= averages.count;
    averages.earnings /= averages.count;
    averages.capital /= averages.count;
  }

  // We map the raw values to a normalized 0-100 score for the radar visual
  const chartData = [
    {
      subject: "Liquidity",
      A: Math.min(Math.max((averages.liquidity / 30) * 100, 0), 100), // Target ~30%
      B: 80, // Sector Average mock
      fullMark: 100,
      rawValue: averages.liquidity.toFixed(1) + "%",
    },
    {
      subject: "Asset Quality",
      A: Math.min(Math.max((averages.assetQuality / 100) * 100, 0), 100), // 100-NPL
      B: 95, // Sector Average (NPL 5%)
      fullMark: 100,
      rawValue: (100 - averages.assetQuality).toFixed(1) + "% (NPL)",
    },
    {
      subject: "Earnings (ROA)",
      A: Math.min(Math.max((averages.earnings / 5) * 100, 0), 100), // Target ~5%
      B: 60, // Sector Average
      fullMark: 100,
      rawValue: averages.earnings.toFixed(1) + "%",
    },
    {
      subject: "Capital Adequacy",
      A: Math.min(Math.max((averages.capital / 15) * 100, 0), 100), // Target ~15%
      B: 90, // Sector Average
      fullMark: 100,
      rawValue: averages.capital.toFixed(1) + "%",
    },
    {
      subject: "Mgmt Efficiency", // OSS placeholder
      A: 75,
      B: 85,
      fullMark: 100,
      rawValue: "75.0%",
    },
  ];

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RechartsRadarChart cx="50%" cy="50%" outerRadius="80%" data={chartData}>
          <PolarGrid stroke="var(--border)" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
          />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />

          <Radar
            name="This Network"
            dataKey="A"
            stroke="var(--primary)"
            fill="var(--primary)"
            fillOpacity={0.6}
          />
          {compareWithSectorAverage && (
            <Radar
              name="Sector Average"
              dataKey="B"
              stroke="var(--chart-2)"
              fill="var(--chart-2)"
              fillOpacity={0.3}
            />
          )}

          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                const subject = payload[0].payload.subject;
                const rawValue = payload[0].payload.rawValue;
                return (
                  <div className="rounded-lg border bg-background p-3 shadow-sm">
                    <p className="text-sm font-semibold mb-1">{subject}</p>
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <div className="size-3 rounded-full bg-primary" />
                        <span className="text-xs text-muted-foreground">Network Avg:</span>
                      </div>
                      <span className="text-sm font-bold">{rawValue}</span>
                    </div>
                  </div>
                );
              }
              return null;
            }}
          />
        </RechartsRadarChart>
      </ResponsiveContainer>
    </div>
  );
}
