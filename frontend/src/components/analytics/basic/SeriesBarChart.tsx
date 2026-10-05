import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartCard } from "@/components/analytics/basic/chart-shared";
import {
  AXIS_PROPS,
  moneyFormatters,
  TOOLTIP_STYLE,
  useChartText,
} from "@/components/analytics/basic/chart-config";
import { hasSeriesData, seriesToChartData } from "@/lib/basic-dashboard";
import type { SeriesPoint } from "@/types/basic-dashboard";

interface SeriesBarChartProps {
  chartKey: string;
  seriesLabelKey: string;
  points: SeriesPoint[] | undefined;
  valueKey: string;
  currency: string;
  color: string;
}

export function SeriesBarChart({
  chartKey,
  seriesLabelKey,
  points,
  valueKey,
  currency,
  color,
}: SeriesBarChartProps) {
  const text = useChartText(chartKey);
  const money = moneyFormatters(currency);
  const data = seriesToChartData(points, [valueKey]);

  return (
    <ChartCard
      title={text.title}
      subtitle={text.subtitle}
      info={text.info}
      hasData={hasSeriesData(points, [valueKey])}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} tickFormatter={money.axis} />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number) => [money.tooltip(value), text.series(seriesLabelKey)]}
          />
          <Bar dataKey={valueKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={56} />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
