import { PieTooltip } from "@/components/analytics/PieTooltip";
import React from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { useTranslation } from "react-i18next";
import { InfoTooltip } from "@/components/ui/info-tooltip";

interface GenderParticipationChartProps {
  data: {
    total: number;
    male: number;
    female: number;
    other: number;
    male_pct: number;
    female_pct: number;
    other_pct: number;
  };
}

export function GenderParticipationChart({ data }: GenderParticipationChartProps) {
  const { t } = useTranslation();
  const women = t("analytics.genderWomen");
  const men = t("analytics.genderMen");
  const nonBinary = t("analytics.nonBinaryUndisclosed");

  const chartData = [
    { name: women, value: data.female_pct || 0, color: "var(--chart-1)" },
    { name: men, value: data.male_pct || 0, color: "var(--chart-2)" },
    { name: nonBinary, value: data.other_pct || 0, color: "var(--chart-3)" },
  ].filter((item) => item.value > 0);

  const hasData = data.total > 0 && chartData.length > 0;
  const primaryPct = hasData ? data.female_pct || 0 : 0;

  return (
    <div className="bg-surface border border-border rounded-xl p-5 space-y-6 h-full flex flex-col justify-between">
      <div className="flex items-start gap-1.5">
        <div>
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">
            {t("analytics.genderParticipation")}
          </span>
          <span className="text-xs text-muted-foreground font-medium block mt-0.5">
            {t("analytics.membershipBreakdown")}
          </span>
        </div>
        <InfoTooltip text={t("analytics.genderParticipationTooltip")} />
      </div>

      {!hasData ? (
        <div className="flex-1 flex items-center justify-center text-center py-8">
          <p className="text-xs text-muted-foreground max-w-[200px]">
            {t("analytics.genderParticipationNoData")}
          </p>
        </div>
      ) : (
        <>
          {/* Doughnut Chart Canvas */}
          <div className="relative h-[180px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={
                    <PieTooltip
                      total={100}
                      showPercent={false}
                      format={(v) => `${v.toFixed(1)}%`}
                    />
                  }
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Center Label */}
            <div className="pointer-events-none absolute inset-0 mt-1 flex flex-col items-center justify-center">
              <span className="text-2xl font-extrabold text-foreground">
                {primaryPct.toFixed(1)}%
              </span>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                {t("analytics.genderWomen")}
              </span>
            </div>
          </div>

          {/* Detailed Legend table below */}
          <div className="divide-y divide-border text-xs font-medium text-muted-foreground">
            {chartData.map((item, idx) => (
              <div key={idx} className="flex justify-between items-center py-2">
                <span className="flex items-center gap-2">
                  <span className="size-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                  {item.name}
                </span>
                <span className="font-bold text-foreground">{item.value.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
