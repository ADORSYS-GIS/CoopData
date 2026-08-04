import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import type { LoanStats } from "@/hooks/analytics/useNfStatistics";
import { useTranslation } from "react-i18next";

interface LoanDualBarProps {
  data: LoanStats;
}

export function LoanDualBar({ data }: LoanDualBarProps) {
  const { t } = useTranslation();

  const countData = [
    {
      name: t("analytics.loanAccounts"),
      Total: data.total_loans,
      Active: data.active_loans,
      Arrears: data.arrears,
      Restructured: data.restructured,
    },
  ];

  const valueData = [
    {
      name: t("analytics.loanValueK"),
      Total: Math.round(data.total_loan_amount / 1000),
      Outstanding: Math.round(data.total_balance / 1000),
      Arrears: Math.round(
        (data.total_balance * (data.arrears / Math.max(data.total_loans, 1))) / 1000,
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">
      <div className="h-64">
        <p className="text-xs font-bold text-center text-muted-foreground mb-2">
          {t("analytics.accountsCount")}
        </p>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={countData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              cursor={{ fill: "var(--muted)", opacity: 0.3 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              dataKey="Total"
              name={t("analytics.total")}
              fill="var(--chart-1)"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
            <Bar
              dataKey="Active"
              name={t("analytics.active")}
              fill="var(--chart-2)"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
            <Bar
              dataKey="Arrears"
              name={t("analytics.arrears")}
              fill="var(--destructive)"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
            <Bar
              dataKey="Restructured"
              name={t("analytics.restructured")}
              fill="var(--chart-4)"
              radius={[4, 4, 0, 0]}
              barSize={20}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="h-64">
        <p className="text-xs font-bold text-center text-muted-foreground mb-2">
          {t("analytics.valueAmount")}
        </p>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={valueData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v}K`}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(val: number) => [`$${val}K`]}
              cursor={{ fill: "var(--muted)", opacity: 0.3 }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar
              dataKey="Total"
              name={t("analytics.total")}
              fill="var(--chart-1)"
              radius={[4, 4, 0, 0]}
              barSize={30}
            />
            <Bar
              dataKey="Outstanding"
              name={t("analytics.outstanding")}
              fill="var(--chart-2)"
              radius={[4, 4, 0, 0]}
              barSize={30}
            />
            <Bar
              dataKey="Arrears"
              name={t("analytics.arrears")}
              fill="var(--destructive)"
              radius={[4, 4, 0, 0]}
              barSize={30}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
