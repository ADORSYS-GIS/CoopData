import { RadialBarChart, RadialBar, ResponsiveContainer, PolarAngleAxis } from "recharts";
import type { SavingsStats } from "@/hooks/analytics/useNfStatistics";
import { useTranslation } from "react-i18next";

interface SavingsRadialGaugesProps {
  data: SavingsStats;
}

export function SavingsRadialGauges({ data }: SavingsRadialGaugesProps) {
  const { t } = useTranslation();
  if (!data) return null;
  const gauges = [
    {
      title: t("analytics.savingsPenetration"),
      value: data.savings_penetration_pct,
      color: "var(--chart-1)",
      desc: t("analytics.membersWithSavings"),
    },
    {
      title: t("analytics.regularSavers"),
      value: data.regular_savers_pct,
      color: "var(--chart-2)",
      desc: t("analytics.consistentDeposits"),
    },
    {
      title: t("analytics.activeSavers"),
      value: data.active_savers_pct,
      color: "var(--chart-3)",
      desc: t("analytics.recentActivity"),
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {gauges.map((g, i) => (
        <div key={i} className="flex flex-col items-center">
          <div className="h-40 w-40 relative">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="70%"
                outerRadius="90%"
                barSize={12}
                data={[{ name: g.title, value: g.value, fill: g.color }]}
                startAngle={90}
                endAngle={-270}
              >
                <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
                <RadialBar
                  background={{ fill: "var(--muted)", opacity: 0.3 }}
                  dataKey="value"
                  cornerRadius={10}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="font-heading text-2xl font-bold text-foreground num leading-none">
                {Math.round(g.value)}%
              </span>
            </div>
          </div>
          <div className="text-center mt-2">
            <p className="text-sm font-bold text-foreground">{g.title}</p>
            <p className="text-xs text-muted-foreground">{g.desc}</p>
          </div>
        </div>
      ))}
      <div className="md:col-span-3 text-center mt-4 pt-4 border-t border-border">
        <p className="text-sm font-semibold text-muted-foreground">
          {t("analytics.totalSavingsBalance")}
        </p>
        <p className="font-heading text-2xl font-bold text-foreground num mt-1">
          ${data.total_balance.toLocaleString()}
        </p>
      </div>
    </div>
  );
}
