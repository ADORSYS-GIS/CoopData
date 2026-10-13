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
import { useTranslation } from "react-i18next";

import { ChartCard } from "@/components/analytics/basic/chart-shared";
import {
  AXIS_PROPS,
  CHART_COLORS,
  percentFormatters,
  TOOLTIP_STYLE,
} from "@/components/analytics/basic/chart-config";
import { hasSeriesData, humanizeKey, seriesToChartData } from "@/lib/basic-dashboard";
import type { IndicatorGroup, SeriesPoint } from "@/types/basic-dashboard";

interface GroupTrendChartProps {
  group: IndicatorGroup;
  keys: string[];
  points: SeriesPoint[] | undefined;
}

/** Percentage indicators of one group across reporting periods. */
export function GroupTrendChart({ group, keys, points }: GroupTrendChartProps) {
  const { t } = useTranslation();
  const data = seriesToChartData(points, keys);
  const label = (key: string) =>
    t(`basicDashboard.indicators.${key}`, { defaultValue: humanizeKey(key) });

  return (
    <ChartCard
      title={t(`basicDashboard.groups.${group}`)}
      subtitle={t("basicDashboard.charts.groupTrend.subtitle")}
      info={t("basicDashboard.charts.groupTrend.info")}
      hasData={hasSeriesData(points, keys)}
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
              label(name),
            ]}
          />
          <Legend formatter={(name: string) => label(name)} />
          {keys.map((key, index) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
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
