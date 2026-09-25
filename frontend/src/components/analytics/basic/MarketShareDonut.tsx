import { PieTooltip } from "@/components/analytics/PieTooltip";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslation } from "react-i18next";

import { ChartCard } from "@/components/analytics/basic/chart-shared";
import {
  CHART_COLORS,
  moneyFormatters,
  useChartText,
} from "@/components/analytics/basic/chart-config";
import { topShares } from "@/lib/basic-dashboard";
import type { ShareRow } from "@/types/basic-dashboard";

interface MarketShareDonutProps {
  chartKey: "marketShareAssets" | "marketShareLoans";
  rows: ShareRow[];
  currency: string;
}

const SLICE_COLORS = [...CHART_COLORS, "#8b6f47", "#3f6b6b", "#a05a7a", "#6b7280", "#c084fc"];
const MAX_SLICES = 9;

export function MarketShareDonut({ chartKey, rows, currency }: MarketShareDonutProps) {
  const { t } = useTranslation();
  const text = useChartText(chartKey);
  const money = moneyFormatters(currency);
  const slices = topShares(
    rows,
    MAX_SLICES,
    t("basicDashboard.charts.other", { defaultValue: "Other" }),
  );

  const coloured = slices.map((slice, index) => ({
    ...slice,
    fill: SLICE_COLORS[index % SLICE_COLORS.length],
  }));

  return (
    <ChartCard
      title={text.title}
      subtitle={text.subtitle}
      info={text.info}
      hasData={slices.length > 0}
    >
      <div className="flex h-full flex-col gap-3 sm:flex-row sm:items-center">
        <div className="h-full min-h-0 flex-1">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={coloured}
                dataKey="value"
                nameKey="name"
                innerRadius="55%"
                outerRadius="85%"
                paddingAngle={2}
              >
                {coloured.map((slice) => (
                  <Cell key={slice.name} fill={slice.fill} />
                ))}
              </Pie>
              <Tooltip
                content={
                  <PieTooltip
                    total={slices.reduce((sum, slice) => sum + slice.value, 0)}
                    format={money.tooltip}
                    detail={(slice) =>
                      typeof slice["share_pct"] === "number"
                        ? `${slice["share_pct"].toFixed(2)}%`
                        : null
                    }
                    showPercent={false}
                  />
                }
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ul className="max-h-full min-w-[9rem] space-y-1 overflow-y-auto text-xs">
          {slices.map((slice, index) => (
            <li key={slice.name} className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 truncate">
                <span
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: SLICE_COLORS[index % SLICE_COLORS.length] }}
                />
                <span className="truncate">{slice.name}</span>
              </span>
              <span className="font-semibold tabular-nums">{slice.share_pct.toFixed(2)}%</span>
            </li>
          ))}
        </ul>
      </div>
    </ChartCard>
  );
}
