import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
  LabelList,
} from "recharts";
import type { LoanStats } from "@/hooks/analytics/useNfStatistics";
import { useTranslation } from "react-i18next";

interface Props {
  stats: LoanStats;
}

export function FinancialInclusionBar({ stats }: Props) {
  const { t } = useTranslation();
  if (!stats) return null;

  if (stats.total_loans === 0) {
    return (
      <div className="flex h-[250px] items-center justify-center text-sm text-muted-foreground">
        {t("analytics.inclusionNoData")}
      </div>
    );
  }

  const data = [
    {
      group: t("analytics.genderWomen"),
      value: stats.women_borrower_pct ?? 0,
      color: "var(--chart-4)",
    },
    {
      group: t("analytics.inclusionYouth"),
      value: stats.youth_borrower_pct ?? 0,
      color: "var(--chart-5)",
    },
    {
      group: t("analytics.inclusionRural"),
      value: stats.rural_borrower_pct ?? 0,
      color: "var(--chart-3)",
    },
  ];

  return (
    <div className="h-[250px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 20, right: 30, left: 40, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(val) => `${val}%`}
            tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="group"
            tick={{ fill: "var(--foreground)", fontSize: 12, fontWeight: 700 }}
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
            formatter={(val: number) => [`${val.toFixed(1)}%`, t("analytics.inclusionShare")]}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(val: number) => `${val.toFixed(1)}%`}
              style={{ fill: "var(--muted-foreground)", fontSize: 11, fontWeight: "bold" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
