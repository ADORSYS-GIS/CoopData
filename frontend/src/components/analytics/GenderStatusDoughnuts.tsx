import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslation } from "react-i18next";
import type { MembershipStats } from "@/hooks/analytics/useNfStatistics";

interface GenderStatusDoughnutsProps {
  data: MembershipStats;
}

export function GenderStatusDoughnuts({ data }: GenderStatusDoughnutsProps) {
  const { t } = useTranslation();
  if (!data) return null;
  const genderData = [
    { name: t("analytics.genderWomen"), value: data.female, fill: "var(--chart-1)" },
    { name: t("analytics.genderMen"), value: data.male, fill: "var(--chart-2)" },
    { name: t("analytics.genderOther"), value: data.other, fill: "var(--chart-3)" },
  ].filter((d) => d.value > 0);

  const statusData = [
    { name: t("analytics.doughnutActive"), value: data.active, fill: "var(--success)" },
    { name: t("analytics.doughnutDormant"), value: data.dormant, fill: "var(--warning)" },
    { name: t("analytics.doughnutExited"), value: data.exited, fill: "var(--muted-foreground)" },
  ].filter((d) => d.value > 0);

  const renderDoughnut = (
    title: string,
    pieData: { name: string; value: number; fill: string }[],
    total: number,
  ) => (
    <div className="flex flex-col items-center">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
        {title}
      </p>
      <div className="relative h-40 w-full flex items-center justify-center">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={pieData} dataKey="value" innerRadius={50} outerRadius={70} paddingAngle={3}>
              {pieData.map((d) => (
                <Cell key={d.name} fill={d.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              itemStyle={{ color: "var(--foreground)" }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-heading text-xl font-bold text-foreground num leading-none">
            {total.toLocaleString()}
          </span>
        </div>
      </div>
      <ul className="space-y-1 mt-2 w-full max-w-[160px]">
        {pieData.map((d) => (
          <li key={d.name} className="flex items-center justify-between text-[11px]">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <span className="size-2 rounded-sm shrink-0" style={{ background: d.fill }} />
              {d.name}
            </span>
            <span className="font-bold num text-foreground">
              {Math.round((d.value / Math.max(total, 1)) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {renderDoughnut(
        t("analytics.genderBreakdown"),
        genderData,
        data.male + data.female + data.other,
      )}
      {renderDoughnut(
        t("analytics.membershipStatus"),
        statusData,
        data.active + data.dormant + data.exited,
      )}
    </div>
  );
}
