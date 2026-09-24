import React from "react";
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { useTranslation } from "react-i18next";
import { InfoTooltip } from "@/components/ui/info-tooltip";

interface TrendDataPoint {
  month: string;
  liquidity: number; // Liquid assets (COA 1100) — cash/near-cash
  loans: number; // Gross loan portfolio (COA 1200)
  savings: number; // Member deposits (COA 2100)
  totalAssets: number; // Total assets (COA 1999) — includes loans + liquidity; never sum with them
}

interface PortfolioOverviewChartProps {
  data: TrendDataPoint[];
}

export function PortfolioOverviewChart({ data }: PortfolioOverviewChartProps) {
  const { t } = useTranslation();

  // Format Y-axis ticks in thousands or millions
  const formatYAxis = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value}`;
  };

  // Headline figure is Total Assets for the latest month — it already
  // contains the loan portfolio and liquid assets shown as separate lines
  // below, so it must not be added to them (that was the previous bug:
  // liquidity+loans+savings summed three overlapping/unrelated balance
  // sheet figures into a number ~150x the real portfolio size).
  const totalBalance = React.useMemo(() => {
    if (data.length === 0) return 0;
    return data[data.length - 1].totalAssets;
  }, [data]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header section with Balance */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div className="flex items-start gap-1.5">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
              {t("analytics.portfolioOverview")}
            </span>
            <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
              ${(totalBalance / 1_000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K
            </h3>
          </div>
          <InfoTooltip text={t("analytics.portfolioOverviewTooltip")} />
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorOverviewSavings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorOverviewLoans" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.15} />
                <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            {/* Left Axis for Savings and Loans */}
            <YAxis
              yAxisId="left"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxis}
            />
            {/* Right Axis for Deposits */}
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxis}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "12px",
                fontSize: "12px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
              }}
              formatter={(value: number) => [`$${value.toLocaleString()}`]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: "15px" }}
              iconType="circle"
              iconSize={8}
            />

            {/* Savings (Liquid Assets) - Dotted line with area fill */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="liquidity"
              name={t("analytics.savingsLiquidFunds")}
              stroke="var(--chart-1)"
              strokeWidth={2}
              strokeDasharray="4 4"
              fill="url(#colorOverviewSavings)"
            />

            {/* Loans (Gross Loans) - Dotted green line with area fill */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="loans"
              name={t("analytics.loansLabel")}
              stroke="var(--chart-2)"
              strokeWidth={2}
              strokeDasharray="4 4"
              fill="url(#colorOverviewLoans)"
            />

            {/* Deposits (Member Savings/Deposits) - Solid yellow line */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="savings"
              name={t("analytics.depositsLabel")}
              stroke="var(--chart-3)"
              strokeWidth={3}
              dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
              activeDot={{ r: 6 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
