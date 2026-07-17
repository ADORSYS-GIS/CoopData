import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface TrendDataPoint {
  month: string;
  liquidity: number;
  savings: number;
  loans: number;
}

interface CoopTrendAreaChartProps {
  data: TrendDataPoint[];
}

export function CoopTrendAreaChart({ data }: CoopTrendAreaChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[300px] text-center text-muted-foreground">
        <p className="text-sm font-semibold">No trend data available</p>
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorLiquidity" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.8} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorSavings" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.8} />
              <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="colorLoans" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-3)" stopOpacity={0.8} />
              <stop offset="95%" stopColor="var(--chart-3)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="month"
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="var(--muted-foreground)"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `$${value}K`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number) => [`$${value.toLocaleString()}K`]}
          />
          <Legend wrapperStyle={{ fontSize: 12, paddingTop: "10px" }} />
          <Area
            type="monotone"
            dataKey="loans"
            name="Gross Loans"
            stroke="var(--chart-3)"
            fillOpacity={1}
            fill="url(#colorLoans)"
          />
          <Area
            type="monotone"
            dataKey="savings"
            name="Member Deposits"
            stroke="var(--chart-2)"
            fillOpacity={1}
            fill="url(#colorSavings)"
          />
          <Area
            type="monotone"
            dataKey="liquidity"
            name="Liquid Assets"
            stroke="var(--chart-1)"
            fillOpacity={1}
            fill="url(#colorLiquidity)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
