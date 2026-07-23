import React, { useState } from "react";
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

interface TrendDataPoint {
  month: string;
  liquidity: number; // mapped to Savings (1100)
  loans: number; // mapped to Loans (1200)
  savings: number; // mapped to Deposits (2100)
}

interface PortfolioOverviewChartProps {
  data: TrendDataPoint[];
}

export function PortfolioOverviewChart({ data }: PortfolioOverviewChartProps) {
  const [range, setRange] = useState<"1D" | "5D" | "1M" | "1Y">("1Y");

  // Format Y-axis ticks in thousands or millions
  const formatYAxis = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value}`;
  };

  // Compute total portfolio balance (Savings + Loans + Deposits) for the latest month
  const totalBalance = React.useMemo(() => {
    if (data.length === 0) return 0;
    const latest = data[data.length - 1];
    return latest.liquidity + latest.loans + latest.savings;
  }, [data]);

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Header section with Balance & Slicer buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
            Portfolio Overview
          </span>
          <h3 className="text-3xl font-extrabold text-slate-900 dark:text-white mt-1">
            ${(totalBalance / 1_000).toLocaleString(undefined, { maximumFractionDigits: 0 })}K
          </h3>
        </div>

        {/* Chart Timeframe selectors */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg border border-slate-200/50">
          {(["1D", "5D", "1M", "1Y"] as const).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                range === r
                  ? "bg-white dark:bg-slate-700 text-primary shadow-sm"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorOverviewSavings" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorOverviewLoans" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
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
              name="Savings (Liquid Funds)"
              stroke="#3b82f6"
              strokeWidth={2}
              strokeDasharray="4 4"
              fill="url(#colorOverviewSavings)"
            />

            {/* Loans (Gross Loans) - Dotted green line with area fill */}
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="loans"
              name="Loans"
              stroke="#10b981"
              strokeWidth={2}
              strokeDasharray="4 4"
              fill="url(#colorOverviewLoans)"
            />

            {/* Deposits (Member Savings/Deposits) - Solid yellow line */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="savings"
              name="Deposits"
              stroke="#f59e0b"
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
