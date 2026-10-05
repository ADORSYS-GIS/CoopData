import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartCard } from "@/components/analytics/basic/chart-shared";
import {
  AXIS_PROPS,
  CHART_COLORS,
  moneyFormatters,
  TOOLTIP_STYLE,
  useChartText,
} from "@/components/analytics/basic/chart-config";
import { hasSeriesData, seriesToChartData } from "@/lib/basic-dashboard";
import type { SeriesPoint } from "@/types/basic-dashboard";

interface ProfitabilityChartProps {
  points: SeriesPoint[] | undefined;
  currency: string;
}

export function ProfitabilityChart({ points, currency }: ProfitabilityChartProps) {
  const text = useChartText("profitability");
  const money = moneyFormatters(currency);
  const data = seriesToChartData(points, ["net_income"]);

  return (
    <ChartCard
      title={text.title}
      subtitle={text.subtitle}
      info={text.info}
      hasData={hasSeriesData(points, ["net_income"])}
    >
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 16, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" {...AXIS_PROPS} />
          <YAxis {...AXIS_PROPS} tickFormatter={money.axis} />
          <ReferenceLine y={0} stroke="var(--border)" />
          <Tooltip
            contentStyle={TOOLTIP_STYLE}
            formatter={(value: number) => [money.tooltip(value), text.series("netIncome")]}
          />
          <Line
            type="monotone"
            dataKey="net_income"
            stroke={CHART_COLORS[0]}
            strokeWidth={2.5}
            dot
            connectNulls
          />
        </LineChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
