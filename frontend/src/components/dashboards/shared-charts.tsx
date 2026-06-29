import {
  AreaChart,
  Area,
  ResponsiveContainer,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from "recharts";
import {
  GROWTH_TREND,
  SECTOR_BREAKDOWN,
  REGIONS,
  formatNumber,
  formatCurrency,
  COOPERATIVES as INITIAL_COOPERATIVES,
  ACTIVITY_FEED as INITIAL_ACTIVITY_FEED,
} from "@/lib/mock-data";
import { StatusPill } from "@/components/app-shell";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────
// Shared Types
// ─────────────────────────────────────────────────────────────────────
export type { Cooperative, Submission } from "@/lib/mock-data";

// ─────────────────────────────────────────────────────────────────────
// Time Range Selector
// ─────────────────────────────────────────────────────────────────────
export function TimeRange() {
  return (
    <div className="flex items-center gap-1 text-xs">
      {["1M", "3M", "YTD", "1Y", "All"].map((r, i) => (
        <button
          key={r}
          className={`rounded-lg px-2.5 py-1 font-semibold transition-colors ${
            i === 3 ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted"
          }`}
        >
          {r}
        </button>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Trend Chart (Area)
// ─────────────────────────────────────────────────────────────────────
export function TrendChart() {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={GROWTH_TREND} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id="g-members" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.22} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.01} />
            </linearGradient>
            <linearGradient id="g-loans" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--success)" stopOpacity={0.2} />
              <stop offset="100%" stopColor="var(--success)" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="month"
            stroke="var(--muted-foreground)"
            fontSize={11}
            fontFamily="var(--font-sans)"
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="left"
            stroke="var(--muted-foreground)"
            fontSize={11}
            fontFamily="var(--font-sans)"
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            stroke="var(--muted-foreground)"
            fontSize={11}
            fontFamily="var(--font-sans)"
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `$${v}M`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "12px",
              fontFamily: "var(--font-sans)",
              padding: "8px 12px",
              boxShadow: "var(--shadow-elev-2)",
            }}
            itemStyle={{ color: "var(--foreground)" }}
            labelStyle={{ fontWeight: "600", color: "var(--foreground)", marginBottom: "4px" }}
            formatter={(value: number, name: string) => {
              if (name === "loans") {
                return [`$${value}M`, "Loan Portfolio"];
              }
              return [formatNumber(value), "Active Members"];
            }}
          />
          <Area
            yAxisId="left"
            type="monotone"
            dataKey="members"
            stroke="var(--accent)"
            fill="url(#g-members)"
            strokeWidth={2}
            name="members"
          />
          <Area
            yAxisId="right"
            type="monotone"
            dataKey="loans"
            stroke="var(--success)"
            fill="url(#g-loans)"
            strokeWidth={2}
            name="loans"
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-3 flex items-center gap-5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-accent" />
          Members (Left Axis)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" />
          Loan portfolio ($M - Right Axis)
        </span>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Sector Breakdown (Horizontal Bar)
// ─────────────────────────────────────────────────────────────────────
export function SectorBreakdown() {
  // Single accent color — monochromatic bars with graduated opacity for hierarchy
  const barColor = "var(--accent)";
  const opacities = [1, 0.82, 0.64, 0.48, 0.34];

  return (
    <div className="space-y-4">
      <div className="h-40 -mx-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={SECTOR_BREAKDOWN}
            layout="vertical"
            margin={{ top: 0, right: 10, bottom: 0, left: 0 }}
          >
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" hide />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.15 }}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                fontSize: "12px",
                fontFamily: "var(--font-sans)",
                padding: "8px 12px",
                boxShadow: "var(--shadow-elev-2)",
              }}
              itemStyle={{ color: "var(--foreground)" }}
              labelStyle={{ fontWeight: "600", color: "var(--foreground)", marginBottom: "4px" }}
              formatter={(v: number) => `${v}%`}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {SECTOR_BREAKDOWN.map((_, i) => (
                <Cell key={i} fill={barColor} fillOpacity={opacities[i] ?? 0.3} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2.5 text-sm">
        {SECTOR_BREAKDOWN.map((s, i) => (
          <li key={s.name} className="flex items-center justify-between">
            <span className="flex items-center gap-2 min-w-0">
              <span
                className="size-2 shrink-0 rounded-sm"
                style={{ background: barColor, opacity: opacities[i] ?? 0.3 }}
              />
              <span className="truncate">{s.name}</span>
            </span>
            <span className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
              <span className="num">{s.count.toLocaleString()}</span>
              <span className="font-semibold text-foreground num">{s.value}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const getRegionCellData = (regionCode: string, index: number) => {
  const seed = regionCode.charCodeAt(0) + regionCode.charCodeAt(1) + index;
  const coops = Math.floor(4 + (seed % 28));
  const compliance = (78 + (seed % 22) + (seed % 3) * 0.4).toFixed(1);
  return { coops, compliance };
};

export function RegionsHeatGrid() {
  return (
    <div className="grid grid-cols-2 gap-4">
      {REGIONS.map((r) => {
        return (
          <div
            key={r.code}
            className="rounded-lg border border-border bg-background p-4 shadow-[var(--shadow-elev-1)] hover-lift"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {r.code}
                </p>
                <p className="mt-0.5 font-semibold">{r.name}</p>
              </div>
              <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent">
                +{r.growth}%
              </span>
            </div>
            <div className="mt-3 grid grid-cols-12 gap-1">
              {Array.from({ length: 36 }).map((_, i) => {
                const { coops, compliance } = getRegionCellData(r.code, i);
                // Map coops density (range 4 to 32) to shade opacity
                const densityPercent = Math.round(((coops - 4) / 28) * 100);
                return (
                  <div
                    key={i}
                    title={`Zone ${i + 1}: ${coops} active cooperatives (${compliance}% compliance)`}
                    className="aspect-square rounded-[2px] transition-all hover:scale-110 hover:shadow-sm cursor-help"
                    style={{
                      background: `color-mix(in oklab, var(--accent) ${densityPercent}%, var(--muted))`,
                    }}
                  />
                );
              })}
            </div>
            {/* Legend inside each region box */}
            <div className="mt-2.5 flex items-center justify-between text-[9px] text-muted-foreground">
              <span>Low density</span>
              <div className="flex gap-0.5">
                {[10, 30, 50, 70, 90].map((p) => (
                  <span
                    key={p}
                    className="size-1.5 rounded-[1px]"
                    style={{
                      background: `color-mix(in oklab, var(--accent) ${p}%, var(--muted))`,
                    }}
                  />
                ))}
              </div>
              <span>High density</span>
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-[11px] border-t border-border pt-3">
              <div>
                <dt className="text-muted-foreground">Coops</dt>
                <dd className="font-semibold num">{r.coops.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Members</dt>
                <dd className="font-semibold num">{formatNumber(r.members)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Compliance</dt>
                <dd className="font-semibold num">{r.compliance}%</dd>
              </div>
            </dl>
          </div>
        );
      })}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Activity Feed List
// ─────────────────────────────────────────────────────────────────────
export function ActivityFeedList({ activities }: { activities: typeof INITIAL_ACTIVITY_FEED }) {
  const toneMap = {
    success: "bg-success/10 text-success",
    info: "bg-info/10 text-info",
    warning: "bg-warning/15 text-warning-foreground",
    neutral: "bg-muted text-muted-foreground",
  } as const;
  return (
    <ul className="-my-2 divide-y divide-border">
      {activities.slice(0, 5).map((a) => (
        <li key={a.id} className="flex items-start gap-3 py-3">
          <div
            className={`flex size-9 items-center justify-center rounded-lg text-[10px] font-bold ${toneMap[a.tone]}`}
          >
            {a.initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{a.title}</p>
            <p className="truncate text-xs text-muted-foreground">{a.detail}</p>
          </div>
          <span className="shrink-0 text-[11px] text-muted-foreground">{a.time}</span>
        </li>
      ))}
      <li className="pt-3">
        <button
          onClick={() => toast.info("Opening full audit system activity log...")}
          className="inline-flex w-full items-center justify-center gap-2 text-xs font-semibold text-accent hover:underline"
        >
          <Sparkles className="size-3.5" /> View audit timeline
        </button>
      </li>
    </ul>
  );
}

// ─────────────────────────────────────────────────────────────────────
// Top Cooperatives Table
// ─────────────────────────────────────────────────────────────────────
export function TopTable({ cooperatives }: { cooperatives: typeof INITIAL_COOPERATIVES }) {
  const rows = [...cooperatives].sort((a, b) => b.portfolio - a.portfolio).slice(0, 6);
  return (
    <div className="-mx-5 -mb-5 overflow-x-auto">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-y border-border bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            <th className="px-5 py-3">Reg. No.</th>
            <th className="px-5 py-3">Cooperative</th>
            <th className="px-5 py-3">Sector</th>
            <th className="px-5 py-3">Region</th>
            <th className="px-5 py-3 text-right">Members</th>
            <th className="px-5 py-3 text-right">Capital base</th>
            <th className="px-5 py-3">Compliance</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.id} className="transition-colors hover:bg-muted/40">
              <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{r.regNo}</td>
              <td className="px-5 py-3 font-semibold">{r.name}</td>
              <td className="px-5 py-3 text-muted-foreground">{r.sector}</td>
              <td className="px-5 py-3 text-muted-foreground">{r.region}</td>
              <td className="px-5 py-3 text-right num">{r.members.toLocaleString()}</td>
              <td className="px-5 py-3 text-right font-semibold num">
                {formatCurrency(r.portfolio)}
              </td>
              <td className="px-5 py-3">
                <StatusPill
                  tone={
                    r.compliance === "Verified"
                      ? "success"
                      : r.compliance === "Pending"
                        ? "warning"
                        : r.compliance === "Under Review"
                          ? "info"
                          : "danger"
                  }
                >
                  {r.compliance}
                </StatusPill>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
