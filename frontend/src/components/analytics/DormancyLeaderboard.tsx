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
import { useTranslation } from "react-i18next";

interface DormancyEntry {
  name: string;
  dormancy_pct: number;
  active_members_pct: number;
  total_members: number;
}

interface DormancyLeaderboardProps {
  data: DormancyEntry[];
  maxRows?: number;
}

function dormancyColor(pct: number): string {
  if (pct > 20) return "#ef4444";
  if (pct > 10) return "#f59e0b";
  return "#22c55e";
}

export function DormancyLeaderboard({ data, maxRows = 12 }: DormancyLeaderboardProps) {
  const { t } = useTranslation();
  const sorted = [...data]
    .sort((a, b) => b.dormancy_pct - a.dormancy_pct)
    .slice(0, maxRows)
    .map((d) => ({
      ...d,
      name: d.name.length > 22 ? d.name.slice(0, 20) + "…" : d.name,
      fullName: d.name,
    }));

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-center text-muted-foreground gap-2">
        <span className="text-sm font-semibold">{t("analytics.noMembershipData")}</span>
        <span className="text-xs">{t("analytics.dormancyHint")}</span>
      </div>
    );
  }

  const chartHeight = Math.max(200, sorted.length * 38 + 40);

  return (
    <div>
      <div className="flex items-center gap-4 mb-4 flex-wrap text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-emerald-500" /> {t("analytics.legendHealthy")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-amber-500" /> {t("analytics.legendWatch")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full bg-red-500" /> {t("analytics.legendCritical")}
        </span>
      </div>
      <div style={{ height: chartHeight }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sorted}
            layout="vertical"
            margin={{ top: 0, right: 50, left: 8, bottom: 0 }}
            barSize={18}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
            <XAxis
              type="number"
              domain={[0, Math.min(100, Math.ceil((sorted[0]?.dormancy_pct ?? 30) + 10))]}
              stroke="var(--muted-foreground)"
              fontSize={11}
              fontFamily="var(--font-sans)"
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${v}%`}
            />
            <YAxis
              type="category"
              dataKey="name"
              stroke="var(--muted-foreground)"
              fontSize={11}
              fontFamily="var(--font-sans)"
              tickLine={false}
              axisLine={false}
              width={140}
            />
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                fontSize: "12px",
                fontFamily: "var(--font-sans)",
                padding: "10px 14px",
                boxShadow: "var(--shadow-elev-2)",
              }}
              formatter={(value: number, _name: string, props: { payload?: DormancyEntry }) => {
                const entry = props?.payload;
                return [
                  <span key="val">
                    <strong>{value.toFixed(1)}%</strong> {t("analytics.dormant")}
                    <br />
                    <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                      {t("analytics.membersActivePct", {
                        total: entry?.total_members?.toLocaleString() ?? "0",
                        active: entry?.active_members_pct?.toFixed(1) ?? "0",
                      })}
                    </span>
                  </span>,
                  "",
                ];
              }}
              labelFormatter={(label) => `${label}`}
              cursor={{ fill: "var(--muted)", opacity: 0.3 }}
            />
            <Bar
              dataKey="dormancy_pct"
              radius={[0, 6, 6, 0]}
              name={t("analytics.dormancyPct")}
              minPointSize={5}
            >
              {sorted.map((entry) => (
                <Cell key={entry.fullName} fill={dormancyColor(entry.dormancy_pct)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
