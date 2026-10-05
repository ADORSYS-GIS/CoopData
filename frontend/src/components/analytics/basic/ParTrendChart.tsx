import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartCard } from "@/components/analytics/basic/chart-shared";
import {
  AXIS_PROPS,
  CHART_COLORS,
  percentFormatters,
  TOOLTIP_STYLE,
  useChartText,
} from "@/components/analytics/basic/chart-config";
import { hasSeriesData, seriesToChartData } from "@/lib/basic-dashboard";
import type { SeriesPoint } from "@/types/basic-dashboard";

const KEYS = ["par_gt_30_pct", "par_gt_90_pct", "portfolio_at_risk_pct"];
const LABELS: Record<string, string> = {
  par_gt_30_pct: "par30",
  par_gt_90_pct: "par90",
  portfolio_at_risk_pct: "portfolioAtRisk",
};

export function ParTrendChart({ points }: { points: SeriesPoint[] | undefined }) {
  const text = useChartText("parTrend");
  const data = seriesToChartData(points, KEYS);

  return (
    <ChartCard
      title={text.title}
      subtitle={text.subtitle}
      info={text.info}
      hasData={hasSeriesData(points, KEYS)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} tickFormatter={percentFormatters.axis} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number, name: string) => [
              percentFormatters.tooltip(value),
              text.series(LABELS[name] ?? name),
            ]}
          />
          <Legend formatter={(name: string) => text.series(LABELS[name] ?? name)} />
          {KEYS.map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={CHART_COLORS[index]}
              strokeWidth={2}
              dot
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
