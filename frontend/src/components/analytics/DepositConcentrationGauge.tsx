import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslation } from "react-i18next";
import type { FixedDepositStats } from "@/hooks/analytics/useNfStatistics";

interface Props {
  stats: FixedDepositStats;
}

export function DepositConcentrationGauge({ stats }: Props) {
  const { t } = useTranslation();

  // If no fixed deposits, show empty state
  if (stats.total_fds === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
        {t("analytics.concentrationNoData")}
      </div>
    );
  }

  const riskValue = stats.concentration_risk_pct ?? 0;

  // Safe bounds (e.g. 0 to 100)
  const safeRisk = Math.min(Math.max(riskValue, 0), 100);
  const remaining = 100 - safeRisk;

  // Determine color based on severity
  // < 30% is Green, 30-60% is Amber, > 60% is Red
  const color =
    safeRisk > 60 ? "var(--chart-4)" : safeRisk > 30 ? "var(--chart-3)" : "var(--chart-2)";
  const bgColor = "var(--muted)";

  const data = [
    { name: t("analytics.concentrationTop5"), value: safeRisk },
    { name: t("analytics.concentrationOther"), value: remaining },
  ];

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative h-[200px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="100%"
              startAngle={180}
              endAngle={0}
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
              cornerRadius={5}
            >
              <Cell key="risk" fill={color} />
              <Cell key="rest" fill={bgColor} />
            </Pie>
            <Tooltip
              formatter={(val: number) => [`${val.toFixed(1)}%`, t("analytics.concentrationLabel")]}
              contentStyle={{
                borderRadius: "8px",
                border: "1px solid var(--border)",
                fontSize: "12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        {/* Centered label */}
        <div className="absolute inset-x-0 bottom-0 flex flex-col items-center pb-4">
          <span className="text-3xl font-black text-foreground num">{safeRisk.toFixed(1)}%</span>
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {t("analytics.concentrationRisk")}
          </span>
        </div>
      </div>
      <div className="text-center mt-2 max-w-xs text-xs text-muted-foreground leading-relaxed">
        {t("analytics.concentrationDesc")}
      </div>
    </div>
  );
}
