import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
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

const KEYS = ["ratio_pct", "minimum_pct", "excess_pct"];
const LABELS: Record<string, string> = {
  ratio_pct: "capital",
  minimum_pct: "minimum",
  excess_pct: "excess",
};

export function CapitalChart({ points }: { points: SeriesPoint[] | undefined }) {
  const text = useChartText("institutionalCapital");
  const data = seriesToChartData(points, KEYS);

  return (
    <ChartCard
      title={text.title}
      subtitle={text.subtitle}
      info={text.info}
      hasData={hasSeriesData(points, KEYS)}
    >
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis yAxisId="left" {...AXIS_PROPS} tickFormatter={percentFormatters.axis} />
          <YAxis
            yAxisId="right"
            orientation="right"
            {...AXIS_PROPS}
            tickFormatter={percentFormatters.axis}
          />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number, name: string) => [
              percentFormatters.tooltip(value),
              text.series(LABELS[name] ?? name),
            ]}
          />
          <Legend formatter={(name: string) => text.series(LABELS[name] ?? name)} />
          <Bar
            yAxisId="left"
            dataKey="ratio_pct"
            fill={CHART_COLORS[0]}
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
          <Bar
            yAxisId="left"
            dataKey="minimum_pct"
            fill={CHART_COLORS[2]}
            radius={[4, 4, 0, 0]}
            maxBarSize={36}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="excess_pct"
            stroke={CHART_COLORS[1]}
            strokeWidth={2}
            dot
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
