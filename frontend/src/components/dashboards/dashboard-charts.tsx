import { BarChart3 } from "lucide-react";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import type { SubmissionResponse } from "@/hooks/submissions/useSubmissions";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface TrendPoint {
  label: string;
  count: number;
}

export function buildSubmissionTrend(submissions: SubmissionResponse[]): TrendPoint[] {
  const months: { key: string; label: string; count: number }[] = [];
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString(undefined, { month: "short" }),
      count: 0,
    });
  }

  for (const sub of submissions) {
    const raw = sub.submitted_at ?? sub.created_at;
    if (!raw) continue;
    const d = new Date(raw);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = months.find((m) => m.key === key);
    if (bucket) bucket.count += 1;
  }

  return months.map(({ label, count }) => ({ label, count }));
}

export function SubmissionTrendChart({
  data,
  emptyTitle,
  emptySub,
  seriesLabel,
}: {
  data: SubmissionResponse[];
  emptyTitle: string;
  emptySub: string;
  seriesLabel: string;
}) {
  const points = buildSubmissionTrend(data);

  if (points.length === 0 || points.every((p) => p.count === 0)) {
    return (
      <div className="flex flex-col items-center justify-center h-[280px] text-center text-muted-foreground gap-3">
        <BarChart3 className="size-8 opacity-30" />
        <p className="text-sm font-semibold">{emptyTitle}</p>
        <p className="text-xs">{emptySub}</p>
      </div>
    );
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="colorSubmissions" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
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
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number) => [value, seriesLabel]}
          />
          <Area
            type="monotone"
            dataKey="count"
            name={seriesLabel}
            stroke="var(--chart-1)"
            strokeWidth={2}
            fillOpacity={1}
            fill="url(#colorSubmissions)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function StatusBreakdownDonut({
  approved,
  pending,
  rejected,
  draft,
  totalLabel,
  emptyLabel,
}: {
  approved: number;
  pending: number;
  rejected: number;
  draft: number;
  totalLabel: string;
  emptyLabel: string;
}) {
  const { t } = useOrganizationLabelsContext();

  const data = [
    { name: t("dashboard.status.approved"), value: approved, color: "var(--chart-2)" },
    { name: t("dashboard.status.inReview"), value: pending, color: "var(--chart-3)" },
    { name: t("dashboard.status.rejected"), value: rejected, color: "var(--chart-4)" },
    { name: t("dashboard.status.draft"), value: draft, color: "var(--muted-foreground)" },
  ].filter((d) => d.value > 0);

  const total = approved + pending + rejected + draft;

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[240px] text-center text-muted-foreground gap-3">
        <BarChart3 className="size-8 opacity-30" />
        <p className="text-sm font-semibold">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[180px] w-[180px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              innerRadius={58}
              outerRadius={82}
              paddingAngle={2}
              strokeWidth={0}
            >
              {data.map((entry, index) => (
                <Cell key={index} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-heading text-2xl font-bold num text-foreground">
            {total.toLocaleString()}
          </span>
          <span className="text-xs text-muted-foreground">{totalLabel}</span>
        </div>
      </div>
      <div className="mt-4 grid w-full grid-cols-2 gap-2">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-xs">
            <span className="size-2.5 rounded-full shrink-0" style={{ background: d.color }} />
            <span className="text-muted-foreground truncate">{d.name}</span>
            <span className="ml-auto font-semibold num text-foreground">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
