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
import { buildNetworkRadar, type RadarAxis } from "@/lib/network-radar";
import { useTranslation } from "react-i18next";

interface ApexRadarChartProps {
  data: CoopKpiRow[];
}

const RADAR_LABELS: Record<RadarAxis, string> = {
  liquidity: "analytics.liquidity",
  assetQuality: "analytics.assetQuality",
  earnings: "analytics.earningsRoa",
  capital: "analytics.capitalAdequacy",
  efficiency: "analytics.mgmtEfficiency",
};

export function ApexRadarChart({ data }: ApexRadarChartProps) {
  const { t } = useTranslation();
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground">
        <p className="text-sm font-semibold">{t("analytics.noPerformanceData")}</p>
      </div>
    );
  }

  const chartData = buildNetworkRadar(data)
    .filter((spoke) => spoke.score !== null && spoke.ratio !== null)
    .map((spoke) => ({
      subject: t(RADAR_LABELS[spoke.axis]),
      A: spoke.score,
      fullMark: 100,
      rawValue: `${(spoke.ratio ?? 0).toFixed(1)}%`,
    }));

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground">
        <p className="text-sm font-semibold">{t("analytics.noPerformanceData")}</p>
      </div>
    );
  }

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
