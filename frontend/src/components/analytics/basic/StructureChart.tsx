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

const BAR_KEYS = ["earning_asset_ratio", "member_savings_ratio", "member_share_ratio"];
const LINE_KEY = "borrowed_funds_ratio";
const KEYS = [...BAR_KEYS, LINE_KEY];
const LABELS: Record<string, string> = {
  earning_asset_ratio: "earning",
  member_savings_ratio: "memberSavings",
  member_share_ratio: "memberShares",
  borrowed_funds_ratio: "borrowed",
};

export function StructureChart({ points }: { points: SeriesPoint[] | undefined }) {
  const text = useChartText("financialStructure");
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
          {BAR_KEYS.map((key, index) => (
            <Bar
              key={key}
              yAxisId="left"
              dataKey={key}
              fill={CHART_COLORS[index]}
              radius={[3, 3, 0, 0]}
              maxBarSize={22}
            />
          ))}
          <Line
            yAxisId="right"
            type="monotone"
            dataKey={LINE_KEY}
            stroke={CHART_COLORS[3]}
            strokeWidth={2}
            dot
            connectNulls
          />
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
