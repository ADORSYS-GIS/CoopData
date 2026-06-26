import { createFileRoute } from "@tanstack/react-router";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { AppShell, Card, StatCard } from "@/components/app-shell";
import { GROWTH_TREND, REGIONS, SECTOR_BREAKDOWN, formatNumber } from "@/lib/mock-data";
import {
  TrendingUp,
  Users,
  PieChart as PieChartIcon,
  BarChart3,
  SlidersHorizontal,
  Award,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/app/analytics")({
  head: () => ({ meta: [{ title: "Analytics — CoopData" }] }),
  component: AnalyticsPage,
});

const palette = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const PERFORMERS = [
  { n: "Sunrise Savings SACCO", s: 98, p: "Finance" },
  { n: "Lakeside Agricultural Union", s: 95, p: "Agriculture" },
  { n: "National Teachers SACCO", s: 94, p: "Finance" },
  { n: "Unity Housing Federation", s: 92, p: "Housing" },
  { n: "Lubombo Dairy Co-op", s: 90, p: "Agriculture" },
  { n: "Highveld Women's Trust", s: 88, p: "Finance" },
  { n: "Eastern Grain Collective", s: 84, p: "Agriculture" },
  { n: "Shiselweni Coffee Growers", s: 78, p: "Agriculture" },
];

function AnalyticsPage() {
  const [activeFilter, setActiveFilter] = useState("YTD 2025");

  const genderData = [
    { name: "Women", value: 54.1, fill: "var(--chart-1)" },
    { name: "Men", value: 38.4, fill: "var(--chart-2)" },
    { name: "Non-binary / Undisclosed", value: 7.5, fill: "var(--chart-3)" },
  ];
  const youthData = REGIONS.map((r) => ({
    name: r.name,
    youth: 25 + Math.round(r.growth * 4),
    adult: 70 - Math.round(r.growth * 2),
  }));

  return (
    <AppShell
      title="Analytics Center"
      subtitle="Drill-down national, regional, and sector intelligence with live data sourcing"
    >
      <div className="space-y-6">
        {/* Filter Bar */}
        <div className="flex flex-wrap items-center gap-2">
          <SlidersHorizontal className="size-4 text-muted-foreground" />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mr-1">
            Filters:
          </span>
          {["National", "All sectors", "YTD 2025", "All regions", "Verified only"].map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`press-feedback rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                activeFilter === f
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/70"
              }`}
            >
              {f}
            </button>
          ))}
          <button className="press-feedback text-xs font-bold text-accent hover:underline ml-1">
            + Add filter
          </button>
        </div>

        {/* KPI Insight Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            icon={TrendingUp}
            label="YoY Growth"
            value="+12.4%"
            subtitle="vs same period last year"
            tone="success"
          />
          <StatCard
            icon={Users}
            label="Total Members"
            value="2.4M"
            subtitle="Active cooperative members"
            tone="primary"
          />
          <StatCard
            icon={PieChartIcon}
            label="Sector Diversity"
            value="8 sectors"
            subtitle="Active industry groups"
            tone="info"
          />
          <StatCard
            icon={BarChart3}
            label="Avg Compliance"
            value="92.4%"
            subtitle="National average"
            tone="accent"
          />
        </div>

        {/* Line Chart + Gender Pie */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card
            className="lg:col-span-2"
            title="Membership & Portfolio over Time"
            subtitle="National aggregate · YoY comparison"
          >
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={GROWTH_TREND}
                  margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="month"
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
                    tickFormatter={(v) => formatNumber(v as number)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      fontSize: 12,
                      boxShadow: "var(--shadow-elev-2)",
                    }}
                  />
                  <Line dataKey="members" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} />
                  <Line dataKey="loans" stroke="var(--chart-2)" strokeWidth={2.5} dot={false} />
                  <Line dataKey="savings" stroke="var(--chart-3)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card title="Gender Participation" subtitle="National aggregate breakdown">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderData}
                    dataKey="value"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={3}
                  >
                    {genderData.map((d) => (
                      <Cell key={d.name} fill={d.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                    formatter={(value) => [`${value}%`]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-2.5 mt-2 border-t border-border pt-3">
              {genderData.map((g) => (
                <li key={g.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2.5 text-muted-foreground text-xs">
                    <span className="size-2.5 rounded-sm shrink-0" style={{ background: g.fill }} />
                    {g.name}
                  </span>
                  <span className="font-heading font-bold num text-foreground">{g.value}%</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Sector Pie + Youth BarChart */}
        <div className="grid lg:grid-cols-3 gap-6">
          <Card title="Sector Capital Share" subtitle="Share of national portfolio by sector">
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={SECTOR_BREAKDOWN} dataKey="value" nameKey="name" outerRadius={90}>
                    {SECTOR_BREAKDOWN.map((_, i) => (
                      <Cell key={i} fill={palette[i % palette.length]} />
                    ))}
                  </Pie>
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <Card
            className="lg:col-span-2"
            title="Youth Participation by Region"
            subtitle="% of members under 35 years old"
          >
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={youthData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
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
                      borderRadius: 10,
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="youth"
                    stackId="a"
                    fill="var(--chart-1)"
                    radius={[6, 6, 0, 0]}
                    name="Youth (< 35)"
                  />
                  <Bar
                    dataKey="adult"
                    stackId="a"
                    fill="var(--muted)"
                    radius={[6, 6, 0, 0]}
                    name="Adult (35+)"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        {/* Performance Score Heatmap */}
        <Card
          title="Performance Score — Top Cooperatives"
          subtitle="Composite score based on compliance, portfolio quality, and member engagement"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {PERFORMERS.map((c, i) => (
              <div
                key={c.n}
                className="rounded-xl p-4 text-white relative overflow-hidden hover-lift cursor-pointer"
                style={{ background: `color-mix(in oklab, var(--accent) ${c.s}%, var(--primary))` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] uppercase tracking-wider text-white/70 font-bold">
                    {c.p}
                  </span>
                  {i === 0 && <Award className="size-3.5 text-yellow-300" />}
                </div>
                <p className="text-xs font-semibold leading-tight text-white/90">{c.n}</p>
                <p className="mt-3 font-heading text-3xl font-bold num">{c.s}</p>
                <div
                  className="absolute bottom-0 left-0 h-1 bg-white/30 rounded-b-xl"
                  style={{ width: `${c.s}%` }}
                />
              </div>
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
