import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";

interface Props {
  glp: number;
  par30_pct: number;
  provisions_pct: number; // loan loss coverage
}

export function LoanProvisioningWaterfall({ glp, par30_pct, provisions_pct }: Props) {
  if (!glp || glp === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
        No loan portfolio data available
      </div>
    );
  }

  // Calculate absolute amounts
  const arrearsAmount = glp * (par30_pct / 100);
  const performingAmount = glp - arrearsAmount;
  const provisionsAmount = arrearsAmount * (provisions_pct / 100);

  // At-risk is whatever arrears are not covered by provisions
  const atRiskAmount = Math.max(0, arrearsAmount - provisionsAmount);

  // Stacked bar trick for waterfall:
  // "transparent" is the hidden bottom base, "solid" is the visible block.
  const data = [
    {
      name: "Gross Portfolio",
      transparent: 0,
      solid: glp,
      color: "var(--chart-1)",
      formatted: glp,
    },
    {
      name: "Performing",
      transparent: arrearsAmount,
      solid: performingAmount,
      color: "var(--chart-2)",
      formatted: performingAmount,
    },
    {
      name: "Provisions",
      transparent: atRiskAmount,
      solid: provisionsAmount,
      color: "var(--chart-3)",
      formatted: provisionsAmount,
    },
    {
      name: "At-Risk Capital",
      transparent: 0,
      solid: atRiskAmount,
      color: "var(--chart-4)",
      formatted: atRiskAmount,
    },
  ];

  const formatCurrency = (val: number) => {
    if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `$${(val / 1000).toFixed(1)}K`;
    return `$${val.toFixed(0)}`;
  };

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 20, left: 20, bottom: 25 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="name"
            tick={{ fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 600 }}
            axisLine={false}
            tickLine={false}
            angle={-20}
            textAnchor="end"
          />
          <YAxis
            tickFormatter={formatCurrency}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--muted)", opacity: 0.4 }}
            contentStyle={{
              borderRadius: "8px",
              border: "1px solid var(--border)",
              fontSize: "12px",
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: number, name: string, props: any) => {
              if (name === "transparent") return []; // hide transparent block from tooltip
              return [formatCurrency(props.payload.formatted), "Amount"];
            }}
          />
          <Bar dataKey="transparent" stackId="a" fill="transparent" />
          <Bar dataKey="solid" stackId="a" radius={[2, 2, 0, 0]}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
