import React from "react";
import {
  ComposedChart,
  Bar,
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
  loans: number;     // mapped to Loans (1200)
  savings: number;   // mapped to Deposits (2100)
}

interface SavingsLoansDepositsChartProps {
  data: TrendDataPoint[];
}

export function SavingsLoansDepositsChart({ data }: SavingsLoansDepositsChartProps) {
  // Compute Net Variation for each data point
  const formattedData = React.useMemo(() => {
    return data.map((item) => {
      // Calculate Net Variation: (Savings + Loans) - Deposits
      const netVariation = (item.liquidity + item.loans) - item.savings;
      return {
        ...item,
        netVariation,
      };
    });
  }, [data]);

  const formatYAxis = (value: number) => {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value}`;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
      <div>
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">
          Savings, Loans & Deposits
        </span>
        <span className="text-xs text-slate-500 font-medium block mt-0.5">
          Your monthly financial breakdown & variation
        </span>
      </div>

      {/* Grouped Bar & Line Chart Canvas */}
      <div className="h-[320px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={formattedData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            {/* Left YAxis for Bars */}
            <YAxis
              yAxisId="left"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxis}
            />
            {/* Right YAxis for Net Variation Line */}
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
              formatter={(value: number, name: string) => [
                `$${value.toLocaleString()}`,
                name === "liquidity"
                  ? "Savings"
                  : name === "loans"
                  ? "Loans"
                  : name === "savings"
                  ? "Deposits"
                  : name,
              ]}
            />
            <Legend
              wrapperStyle={{ fontSize: 11, paddingTop: "15px" }}
              iconType="circle"
              iconSize={8}
            />

            {/* Savings (Liquid Assets) - Blue Bar */}
            <Bar
              yAxisId="left"
              dataKey="liquidity"
              name="Savings"
              fill="#3b82f6"
              radius={[4, 4, 0, 0]}
              maxBarSize={16}
            />

            {/* Loans - Green Bar */}
            <Bar
              yAxisId="left"
              dataKey="loans"
              name="Loans"
              fill="#10b981"
              radius={[4, 4, 0, 0]}
              maxBarSize={16}
            />

            {/* Deposits - Yellow Bar */}
            <Bar
              yAxisId="left"
              dataKey="savings"
              name="Deposits"
              fill="#f59e0b"
              radius={[4, 4, 0, 0]}
              maxBarSize={16}
            />

            {/* Net Variation - Purple Line Overlay */}
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="netVariation"
              name="Net Variation"
              stroke="#8b5cf6"
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
