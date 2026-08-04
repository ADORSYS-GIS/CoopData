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
import { useTranslation } from "react-i18next";

interface ApexRadarChartProps {
  data: CoopKpiRow[];
  compareWithSectorAverage?: boolean;
}

export function ApexRadarChart({ data, compareWithSectorAverage = true }: ApexRadarChartProps) {
  const { t } = useTranslation();
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground">
        <p className="text-sm font-semibold">{t("analytics.noPerformanceData")}</p>
      </div>
    );
  }

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
      averages.assetQuality += 100 - (c.kpis["npl_ratio"]?.value || 0);
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

  const chartData = [
    {
      subject: t("analytics.liquidity"),
      A: Math.min(Math.max((averages.liquidity / 30) * 100, 0), 100),
      B: 80,
      fullMark: 100,
      rawValue: averages.liquidity.toFixed(1) + "%",
    },
    {
      subject: t("analytics.assetQuality"),
      A: Math.min(Math.max((averages.assetQuality / 100) * 100, 0), 100),
      B: 95,
      fullMark: 100,
      rawValue: (100 - averages.assetQuality).toFixed(1) + "% (NPL)",
    },
    {
      subject: t("analytics.earningsRoa"),
      A: Math.min(Math.max((averages.earnings / 5) * 100, 0), 100),
      B: 60,
      fullMark: 100,
      rawValue: averages.earnings.toFixed(1) + "%",
    },
    {
      subject: t("analytics.capitalAdequacy"),
      A: Math.min(Math.max((averages.capital / 15) * 100, 0), 100),
      B: 90,
      fullMark: 100,
      rawValue: averages.capital.toFixed(1) + "%",
    },
    {
      subject: t("analytics.mgmtEfficiency"),
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
            name={t("analytics.thisNetwork")}
            dataKey="A"
            stroke="var(--primary)"
            fill="var(--primary)"
            fillOpacity={0.6}
          />
          {compareWithSectorAverage && (
            <Radar
              name={t("analytics.sectorAverage")}
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
                        <span className="text-xs text-muted-foreground">
                          {t("analytics.networkAvg")}
                        </span>
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
