import { createFileRoute } from "@tanstack/react-router";
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
  PieChart,
  Pie,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  RadialBarChart,
  RadialBar,
} from "recharts";
import {
  ArrowUpRight,
  ArrowDownRight,
  Download,
  Building2,
  Users,
  Wallet,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Plus,
  Lock,
  RefreshCw,
  MapPin,
  Camera,
  Database,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  UserCog,
  FileText,
  FileSpreadsheet,
  CheckSquare,
  ClipboardCheck,
  Power,
  Search,
  Target,
  PieChart as PieChartIcon,
  BarChart3,
  Activity,
  Award,
} from "lucide-react";
import { AppShell, Card, StatusPill, StatCard } from "@/components/app-shell";
import {
  KPI as MOCK_KPI,
  GROWTH_TREND,
  SECTOR_BREAKDOWN,
  REGIONS,
  COOPERATIVES as INITIAL_COOPERATIVES,
  SUBMISSIONS as INITIAL_SUBMISSIONS,
  ACTIVITY_FEED as INITIAL_ACTIVITY_FEED,
  USERS as INITIAL_USERS,
  SAMPLE_BALANCE_SHEETS,
  SAMPLE_MEMBERS,
  SAMPLE_LOANS,
  formatCurrency,
  formatNumber,
} from "@/lib/mock-data";
import { calculateFinancialKPIs, calculateMembershipKPIs, calculateLoanKPIs, type ComplianceScoreResult } from "@/lib/kpi-calculations";
import { useAuth } from "@/lib/auth";
import { useState, useEffect } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — CoopData" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { role } = useAuth();

  // Shared state simulation so changes persist in memory
  const [usersList, setUsersList] = useState(INITIAL_USERS);
  const [submissions, setSubmissions] = useState(INITIAL_SUBMISSIONS);
  const [activities, setActivities] = useState(INITIAL_ACTIVITY_FEED);
  const [cooperatives, setCooperatives] = useState(INITIAL_COOPERATIVES);

  // Return the appropriate dashboard based on user role
  switch (role) {
    case "ministry":
      return <MinistryDashboard cooperatives={cooperatives} activities={activities} />;
    case "federation":
      return (
        <FederationDashboard
          submissions={submissions}
          setSubmissions={setSubmissions}
          activities={activities}
          setActivities={setActivities}
        />
      );
    case "regional_officer":
      return (
        <RegionalOfficerDashboard
          cooperatives={cooperatives}
          setCooperatives={setCooperatives}
          submissions={submissions}
          setSubmissions={setSubmissions}
        />
      );
    case "cooperative":
      return (
        <CooperativeDashboard
          submissions={submissions}
          setSubmissions={setSubmissions}
          activities={activities}
          setActivities={setActivities}
        />
      );
    default:
      return <MinistryDashboard cooperatives={cooperatives} activities={activities} />;
  }
}

// ─────────────────────────────────────────────────────────────────────
// 1. SUPER ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────
function SuperAdminDashboard({
  usersList,
  setUsersList,
  activities,
  setActivities,
}: {
  usersList: typeof INITIAL_USERS;
  setUsersList: React.Dispatch<React.SetStateAction<typeof INITIAL_USERS>>;
  activities: typeof INITIAL_ACTIVITY_FEED;
  setActivities: React.Dispatch<React.SetStateAction<typeof INITIAL_ACTIVITY_FEED>>;
}) {
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    role: "Cooperative Manager",
    region: "National",
  });
  const [systemConfigs, setSystemConfigs] = useState({
    mfa: true,
    maintenance: false,
    backup: true,
    multilingual: true,
  });

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name || !newUser.email) {
      toast.error("Please fill in all fields.");
      return;
    }
    const created = {
      id: "u" + (usersList.length + 1),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      region: newUser.region,
      lastActive: "Never active",
      status: "Active" as const,
    };
    setUsersList([created, ...usersList]);
    setActivities([
      {
        id: "f" + (activities.length + 1),
        initials: "SYS",
        type: "auth",
        title: "User Account Created",
        detail: `${newUser.name} assigned as ${newUser.role}`,
        time: "Just now",
        tone: "success" as const,
      },
      ...activities,
    ]);
    toast.success(`User ${newUser.name} created successfully!`);
    setNewUser({ name: "", email: "", role: "Cooperative Manager", region: "National" });
  };

  const toggleConfig = (key: keyof typeof systemConfigs) => {
    setSystemConfigs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      toast.success(
        `System Configuration Updated: ${key.toUpperCase()} set to ${next[key] ? "ENABLED" : "DISABLED"}`,
      );
      return next;
    });
  };

  return (
    <AppShell
      title="System Administration Portal"
      subtitle="Full control · Security settings, database configurations & user provisioning"
    >
      <div className="space-y-6">
        {/* Statistics Banner */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Users Provisioned"
            value={usersList.length.toString()}
            subtitle="Registered platform identities"
            icon={Users}
            tone="accent"
          />
          <StatCard
            label="Active Sessions"
            value="142"
            subtitle="Currently connected"
            icon={Clock}
            tone="info"
          />
          <StatCard
            label="MFA Enrollment Rate"
            value="98.2%"
            subtitle="Secured with 2-step verification"
            icon={ShieldCheck}
            tone="success"
          />
          <StatCard
            label="System Integrity"
            value="100%"
            subtitle="All background jobs passing"
            icon={CheckCircle2}
            tone="success"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* System Configs & Switches */}
          <Card
            title="System Configurations"
            subtitle="Global switches controlling platform runtime parameters"
          >
            <div className="space-y-4 pt-2">
              <ConfigSwitch
                label="Enforce Multi-Factor Auth (MFA)"
                desc="Forces SMS/Email verification for administrative roles"
                active={systemConfigs.mfa}
                onToggle={() => toggleConfig("mfa")}
              />
              <ConfigSwitch
                label="Weekly Automated Backups"
                desc="Store encrypted database dumps in secondary region"
                active={systemConfigs.backup}
                onToggle={() => toggleConfig("backup")}
              />
              <ConfigSwitch
                label="Enable Multi-Language UI"
                desc="Expose language selector in topbar (Siswati / English)"
                active={systemConfigs.multilingual}
                onToggle={() => toggleConfig("multilingual")}
              />
              <ConfigSwitch
                label="Maintenance Mode"
                desc="Puts the platform read-only; schedules login blocks"
                active={systemConfigs.maintenance}
                onToggle={() => toggleConfig("maintenance")}
              />
            </div>
          </Card>

          {/* Provision New Account */}
          <Card
            className="lg:col-span-2"
            title="User Account Provisioning"
            subtitle="Instantly register regional or cooperative actors"
          >
            <form onSubmit={handleCreateUser} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Full Name</label>
                  <input
                    type="text"
                    required
                    value={newUser.name}
                    onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    placeholder="e.g. Dr. Nomcebo Dlamini"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Email Address</label>
                  <input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="e.g. n.dlamini@coop.org"
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Assigned Role</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  >
                    <option>Super Administrator</option>
                    <option>Ministry Official</option>
                    <option>Federation Officer</option>
                    <option>Regional Officer</option>
                    <option>Cooperative Manager</option>
                    <option>Field Data Officer</option>
                    <option>Read-only Auditor</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Jurisdiction / Region</label>
                  <select
                    value={newUser.region}
                    onChange={(e) => setNewUser({ ...newUser, region: e.target.value })}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  >
                    <option>National</option>
                    <option>Hhohho</option>
                    <option>Manzini</option>
                    <option>Lubombo</option>
                    <option>Shiselweni</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Plus className="size-4" /> Provision Account
                </button>
              </div>
            </form>
          </Card>
        </div>

        {/* Current Provisioned Users */}
        <Card
          title="Administrative Users List"
          subtitle="Manage provisioned accounts across all cooperative segments"
        >
          <div className="-mx-5 -mb-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-y border-border bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-5 py-3 font-semibold">Name</th>
                  <th className="px-5 py-3 font-semibold">Email</th>
                  <th className="px-5 py-3 font-semibold">Workspace Role</th>
                  <th className="px-5 py-3 font-semibold">Jurisdiction</th>
                  <th className="px-5 py-3 font-semibold">Account Status</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {usersList.map((u) => (
                  <tr key={u.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-5 py-3 font-semibold">{u.name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{u.email}</td>
                    <td className="px-5 py-3 text-muted-foreground">{u.role}</td>
                    <td className="px-5 py-3 text-muted-foreground">{u.region}</td>
                    <td className="px-5 py-3">
                      <StatusPill tone={u.status === "Active" ? "success" : "danger"}>
                        {u.status}
                      </StatusPill>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => {
                          setUsersList((prev) =>
                            prev.map((item) =>
                              item.id === u.id
                                ? {
                                    ...item,
                                    status:
                                      item.status === "Active"
                                        ? ("Suspended" as const)
                                        : ("Active" as const),
                                  }
                                : item,
                            ),
                          );
                          toast.success(`Account state toggled for ${u.name}`);
                        }}
                        className={`text-xs font-bold hover:underline ${
                          u.status === "Active" ? "text-destructive" : "text-success"
                        }`}
                      >
                        {u.status === "Active" ? "Suspend" : "Activate"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function ConfigSwitch({
  label,
  desc,
  active,
  onToggle,
}: {
  label: string;
  desc: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-start justify-between p-3 rounded-lg border border-border bg-background/50">
      <div className="space-y-0.5 pr-4">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
      <button
        onClick={onToggle}
        className={`flex size-10 shrink-0 items-center justify-center rounded-lg transition-colors ${
          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        <Power className="size-4" />
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 2. MINISTRY DASHBOARD
// ─────────────────────────────────────────────────────────────────────
function MinistryDashboard({
  cooperatives,
  activities,
}: {
  cooperatives: typeof INITIAL_COOPERATIVES;
  activities: typeof INITIAL_ACTIVITY_FEED;
}) {
  return (
    <AppShell
      title="National Cooperative Intelligence"
      subtitle="Real-time oversight · Ministry of Commerce & Cooperative Development"
      actions={
        <button
          onClick={() => {
            toast.success("Preparing PDF download for national registry snapshot...");
          }}
          className="hidden items-center gap-2 rounded-lg bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:inline-flex"
        >
          <Download className="size-4" />
          Generate national report
        </button>
      }
    >
      <div className="space-y-6">
        <KPIGrid />
        <div className="grid gap-6 lg:grid-cols-3">
          <Card
            className="lg:col-span-2"
            title="Membership growth"
            subtitle="Monthly active members across all cooperatives — 2025"
            action={<TimeRange />}
          >
            <TrendChart />
          </Card>
          <Card title="Sector distribution" subtitle="Share of registered cooperatives by sector">
            <SectorBreakdown />
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <Card
            className="lg:col-span-2"
            title="Regional penetration"
            subtitle="Cooperative density and compliance by region"
          >
            <RegionsHeatGrid />
          </Card>
          <Card title="Live activity" subtitle="Submission stream across the federation">
            <ActivityFeedList activities={activities} />
          </Card>
        </div>

        <Card
          title="Top performing cooperatives"
          subtitle="Ranked by member growth and capital base — last 30 days"
          action={
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => toast.info("Opening filter pane...")}
                className="rounded-lg border border-border px-2.5 py-1.5 font-semibold transition-colors hover:bg-muted"
              >
                Filter
              </button>
              <button
                onClick={() => toast.success("Exporting cooperatives to CSV...")}
                className="rounded-lg border border-border px-2.5 py-1.5 font-semibold transition-colors hover:bg-muted"
              >
                Export CSV
              </button>
            </div>
          }
        >
          <TopTable cooperatives={cooperatives} />
        </Card>
      </div>
    </AppShell>
  );
}

function KPIGrid() {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard
        icon={Building2}
        label="Total cooperatives"
        value={formatNumber(MOCK_KPI.totalCoops)}
        subtitle={`+${(MOCK_KPI.growthYoY * 100).toFixed(1)}% vs last year`}
        tone="accent"
      />
      <StatCard
        icon={Users}
        label="Active members"
        value={formatNumber(MOCK_KPI.totalMembers)}
        subtitle={`${(MOCK_KPI.womenShare * 100).toFixed(1)}% women · ${(MOCK_KPI.youthShare * 100).toFixed(1)}% youth`}
        tone="success"
      />
      <StatCard
        icon={Wallet}
        label="Loan portfolio"
        value={formatCurrency(MOCK_KPI.loanPortfolio)}
        subtitle="1.2% NPL non-performing"
        tone="warning"
      />
      <StatCard
        icon={ShieldCheck}
        label="Compliance score"
        value={MOCK_KPI.complianceScore.toFixed(1)}
        subtitle={`${MOCK_KPI.complianceTrend.toFixed(1)} pts national median`}
        tone="info"
      />
    </div>
  );
}

function TimeRange() {
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

function TrendChart() {
  return (
    <div className="h-72">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={GROWTH_TREND} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
          <defs>
            <linearGradient id="g-members" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="g-loans" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--success)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--success)" stopOpacity={0} />
            </linearGradient>
          </defs>
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
            tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(v: number) => formatNumber(v)}
          />
          <Area
            type="monotone"
            dataKey="members"
            stroke="var(--accent)"
            fill="url(#g-members)"
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="loans"
            stroke="var(--success)"
            fill="url(#g-loans)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
      <div className="mt-3 flex items-center gap-5 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-accent" />
          Members
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-full bg-success" />
          Loan portfolio ($M)
        </span>
      </div>
    </div>
  );
}

function SectorBreakdown() {
  const palette = [
    "var(--chart-1)",
    "var(--chart-2)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
  ];
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
              cursor={{ fill: "var(--muted)" }}
              contentStyle={{
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: number) => `${v}%`}
            />
            <Bar dataKey="value" radius={[0, 6, 6, 0]}>
              {SECTOR_BREAKDOWN.map((_, i) => (
                <Cell key={i} fill={palette[i % palette.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="space-y-2.5 text-sm">
        {SECTOR_BREAKDOWN.map((s, i) => (
          <li key={s.name} className="flex items-center justify-between">
            <span className="flex items-center gap-2 min-w-0">
              <span className="size-2 shrink-0 rounded-sm" style={{ background: palette[i] }} />
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

function RegionsHeatGrid() {
  const max = Math.max(...REGIONS.map((r) => r.coops));
  return (
    <div className="grid grid-cols-2 gap-4">
      {REGIONS.map((r) => {
        const intensity = r.coops / max;
        return (
          <div
            key={r.code}
            className="rounded-lg border border-border bg-background p-4 card-edge-primary hover-lift"
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
                const cell = Math.min(1, intensity + Math.sin(i * 1.2) * 0.15);
                return (
                  <div
                    key={i}
                    className="aspect-square rounded-[2px]"
                    style={{
                      background: `color-mix(in oklab, var(--accent) ${Math.round(cell * 85)}%, var(--muted))`,
                    }}
                  />
                );
              })}
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-2 text-[11px]">
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
                <dd className="font-semibold num">{r.compliance}</dd>
              </div>
            </dl>
          </div>
        );
      })}
    </div>
  );
}

function ActivityFeedList({ activities }: { activities: typeof INITIAL_ACTIVITY_FEED }) {
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

function TopTable({ cooperatives }: { cooperatives: typeof INITIAL_COOPERATIVES }) {
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

// ─────────────────────────────────────────────────────────────────────
// 3. FEDERATION DASHBOARD
// ─────────────────────────────────────────────────────────────────────
function FederationDashboard({
  submissions,
  setSubmissions,
  activities,
  setActivities,
}: {
  submissions: typeof INITIAL_SUBMISSIONS;
  setSubmissions: React.Dispatch<React.SetStateAction<typeof INITIAL_SUBMISSIONS>>;
  activities: typeof INITIAL_ACTIVITY_FEED;
  setActivities: React.Dispatch<React.SetStateAction<typeof INITIAL_ACTIVITY_FEED>>;
}) {
  const pendingCount = submissions.filter((s) => s.status === "Pending Review").length;
  const verifiedCount = submissions.filter((s) => s.status === "Verified").length;
  const rejectedCount = submissions.filter(
    (s) => s.status === "Rejected" || s.status === "Resubmit",
  ).length;

  const handleAction = (id: string, name: string, status: "Verified" | "Rejected" | "Resubmit") => {
    setSubmissions((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
    setActivities([
      {
        id: "f" + (activities.length + 1),
        initials: "FED",
        type: "submission",
        title: "Submission Audited",
        detail: `${name} return set to ${status}`,
        time: "Just now",
        tone: status === "Verified" ? ("success" as const) : ("warning" as const),
      },
      ...activities,
    ]);
    toast.success(`Submission return for ${name} marked as ${status.toUpperCase()}!`);
  };

  return (
    <AppShell
      title="Federation Workspace"
      subtitle="Manzini Regional Federation · Review data declarations, resolve flags, and guide compliance"
    >
      <div className="space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Federation Cooperatives"
            value="142"
            subtitle="Active registered coops"
            icon={Building2}
            tone="accent"
          />
          <StatCard
            label="Pending Validation"
            value={pendingCount.toString()}
            subtitle="Awaiting review"
            icon={Clock}
            tone="warning"
          />
          <StatCard
            label="Verified Returns"
            value={verifiedCount.toString()}
            subtitle="Approved declarations"
            icon={CheckCircle2}
            tone="success"
          />
          <StatCard
            label="Rejected & Flags"
            value={rejectedCount.toString()}
            subtitle="Requires intervention"
            icon={XCircle}
            tone="danger"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Validation Inbox */}
          <Card
            className="lg:col-span-2"
            title="Validation Center"
            subtitle="Analyze incoming cooperative returns and cross-reference financial metrics"
          >
            <div className="space-y-4 pt-2">
              {submissions.filter((s) => s.status === "Pending Review").length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground border-2 border-dashed border-border rounded-lg">
                  <CheckSquare className="size-8 mb-2 text-success" />
                  <p className="text-sm font-semibold">Inbox Cleared</p>
                  <p className="text-xs">All submitted reports have been validated.</p>
                </div>
              ) : (
                submissions
                  .filter((s) => s.status === "Pending Review")
                  .map((sub) => (
                    <div
                      key={sub.id}
                      className="p-4 rounded-xl border border-border bg-background flex flex-col md:flex-row md:items-center justify-between gap-4 card-edge hover-lift"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-mono text-xs text-muted-foreground">
                            {sub.reference}
                          </span>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                            {sub.type}
                          </span>
                        </div>
                        <h4 className="text-sm font-bold truncate text-foreground">
                          {sub.coopName}
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Submitted by {sub.submittedBy} · {sub.submittedOn}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleAction(sub.id, sub.coopName, "Verified")}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-success text-white hover:bg-success/90 transition-all"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleAction(sub.id, sub.coopName, "Resubmit")}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-muted transition-all"
                        >
                          Need Changes
                        </button>
                        <button
                          onClick={() => handleAction(sub.id, sub.coopName, "Rejected")}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-destructive text-white hover:bg-destructive/95 transition-all"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </Card>

          {/* Support and Ticket Center */}
          <Card
            title="Cooperative Support"
            subtitle="Active assistance requests and system compliance tickets"
          >
            <ul className="space-y-3 pt-2">
              <li className="p-3 rounded-lg border border-border bg-background/50 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-foreground">Lubombo Dairy Coop</span>
                  <StatusPill tone="warning">Open</StatusPill>
                </div>
                <p className="text-muted-foreground leading-snug">
                  "Cannot upload auditor certificate v2. File format error message is displayed."
                </p>
                <button
                  onClick={() => toast.success("Notification sent to Cooperative support line.")}
                  className="mt-2 text-accent font-bold hover:underline"
                >
                  Contact Manager
                </button>
              </li>
              <li className="p-3 rounded-lg border border-border bg-background/50 text-xs">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-foreground">Apex Savings Union</span>
                  <StatusPill tone="success">Resolved</StatusPill>
                </div>
                <p className="text-muted-foreground leading-snug">
                  "Offline submission sync queue is showing duplicates."
                </p>
                <p className="mt-1 text-[10px] text-success">Synced successfully 1h ago</p>
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 4. REGIONAL OFFICER DASHBOARD
// ─────────────────────────────────────────────────────────────────────
function RegionalOfficerDashboard({
  cooperatives,
  setCooperatives,
  submissions,
  setSubmissions,
}: {
  cooperatives: typeof INITIAL_COOPERATIVES;
  setCooperatives: React.Dispatch<React.SetStateAction<typeof INITIAL_COOPERATIVES>>;
  submissions: typeof INITIAL_SUBMISSIONS;
  setSubmissions: React.Dispatch<React.SetStateAction<typeof INITIAL_SUBMISSIONS>>;
}) {
  const [auditCoop, setAuditCoop] = useState("1");
  const [claimedCount, setClaimedCount] = useState(12402);
  const [verifiedCount, setVerifiedCount] = useState(12000);

  const [inspectCoop, setInspectCoop] = useState("1");
  const [inspectionNotes, setInspectionNotes] = useState("");
  const [inspectedConfigs, setInspectedConfigs] = useState({
    governance: true,
    ledger: true,
    assets: false,
  });

  const handleVerifyMembers = (e: React.FormEvent) => {
    e.preventDefault();
    setCooperatives((prev) =>
      prev.map((c) =>
        c.id === auditCoop
          ? {
              ...c,
              members: verifiedCount,
              compliance: "Verified" as const,
            }
          : c,
      ),
    );
    toast.success(`Verification Completed. Cooperative members audited and certified!`);
  };

  const handleInspection = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectionNotes) {
      toast.error("Please add notes before submitting the inspection report.");
      return;
    }
    const target = cooperatives.find((c) => c.id === inspectCoop)!;
    const inspectRef = "SUB-" + Math.floor(10000 + Math.random() * 90000);

    const newSub: (typeof INITIAL_SUBMISSIONS)[0] = {
      id: "s" + (submissions.length + 1),
      reference: inspectRef,
      coopName: target.name,
      type: "Field Inspection Report",
      submittedBy: "Moses Dlamini (Regional)",
      submittedOn: new Date().toISOString().slice(0, 16).replace("T", " "),
      status: "Verified",
      priority: "Routine",
    };
    setSubmissions([newSub, ...submissions]);
    toast.success(`Inspection report ${inspectRef} for ${target.name} submitted successfully!`);
    setInspectionNotes("");
  };

  const activeCoop = cooperatives.find((c) => c.id === auditCoop)!;

  return (
    <AppShell
      title="Regional Supervision Workspace"
      subtitle="Hhohho & Lubombo Region · Track inspections, audit member lists, and enforce reporting compliance"
    >
      <div className="space-y-6">
        {/* Statistics Banner */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Regional Cooperatives"
            value="28"
            subtitle="Active in your zones"
            icon={Building2}
            tone="accent"
          />
          <StatCard
            label="Visits Scheduled"
            value="3"
            subtitle="Pending field audits"
            icon={Clock}
            tone="warning"
          />
          <StatCard
            label="Inspections Completed"
            value="18"
            subtitle="Successfully filed"
            icon={ClipboardCheck}
            tone="success"
          />
          <StatCard
            label="Audited Membership"
            value="48,240"
            subtitle="Validated census count"
            icon={Users}
            tone="success"
          />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Member Audit/Verification */}
          <Card
            title="Field Verification Audit"
            subtitle="Compare claimed membership counts against registers"
          >
            <form onSubmit={handleVerifyMembers} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Select Cooperative</label>
                <select
                  value={auditCoop}
                  onChange={(e) => {
                    setAuditCoop(e.target.value);
                    const selected = cooperatives.find((c) => c.id === e.target.value)!;
                    setClaimedCount(selected.members);
                    setVerifiedCount(Math.round(selected.members * 0.95));
                  }}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                >
                  {cooperatives.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold mb-1">Claimed Roster Count</label>
                  <input
                    type="number"
                    readOnly
                    value={claimedCount}
                    className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm font-mono text-muted-foreground outline-none cursor-not-allowed"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">
                    Physically Verified Count
                  </label>
                  <input
                    type="number"
                    value={verifiedCount}
                    onChange={(e) => setVerifiedCount(parseInt(e.target.value) || 0)}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono outline-none focus:border-ring"
                  />
                </div>
              </div>

              <div className="bg-surface border border-border rounded-lg p-3 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Discrepancy Variance:</span>{" "}
                {claimedCount - verifiedCount} members (
                {(((claimedCount - verifiedCount) / claimedCount) * 100).toFixed(1)}%)
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <ShieldCheck className="size-4" /> Certify Membership
                </button>
              </div>
            </form>
          </Card>

          {/* Inspection report builder */}
          <Card
            title="Inspection Report Entry"
            subtitle="Log compliance notes and results from a cooperative visit"
          >
            <form onSubmit={handleInspection} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-1">
                  Select Cooperative Visited
                </label>
                <select
                  value={inspectCoop}
                  onChange={(e) => setInspectCoop(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                >
                  {cooperatives.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Inspection Checklist</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setInspectedConfigs({
                        ...inspectedConfigs,
                        governance: !inspectedConfigs.governance,
                      })
                    }
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 border rounded-lg text-xs font-semibold transition-all ${
                      inspectedConfigs.governance
                        ? "bg-success/15 border-success text-success-foreground"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    Governance Ok
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setInspectedConfigs({ ...inspectedConfigs, ledger: !inspectedConfigs.ledger })
                    }
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 border rounded-lg text-xs font-semibold transition-all ${
                      inspectedConfigs.ledger
                        ? "bg-success/15 border-success text-success-foreground"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    Accounts Ok
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setInspectedConfigs({ ...inspectedConfigs, assets: !inspectedConfigs.assets })
                    }
                    className={`flex items-center justify-center gap-1.5 py-2 px-3 border rounded-lg text-xs font-semibold transition-all ${
                      inspectedConfigs.assets
                        ? "bg-success/15 border-success text-success-foreground"
                        : "border-border hover:bg-muted"
                    }`}
                  >
                    Assets Audited
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">Compliance Officer Notes</label>
                <textarea
                  rows={2}
                  required
                  value={inspectionNotes}
                  onChange={(e) => setInspectionNotes(e.target.value)}
                  placeholder="Summarize governing board composition, assets verification and credit registries..."
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring resize-none"
                />
              </div>

              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => toast.success("Photo attachment simulated successfully.")}
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                >
                  <Camera className="size-4" /> Attach Visit Photo
                </button>
                <button
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Submit Inspection Report
                </button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 5. COOPERATIVE DASHBOARD
// ─────────────────────────────────────────────────────────────────────
function CooperativeDashboard({
  submissions,
  setSubmissions,
  activities,
  setActivities,
}: {
  submissions: typeof INITIAL_SUBMISSIONS;
  setSubmissions: React.Dispatch<React.SetStateAction<typeof INITIAL_SUBMISSIONS>>;
  activities: typeof INITIAL_ACTIVITY_FEED;
  setActivities: React.Dispatch<React.SetStateAction<typeof INITIAL_ACTIVITY_FEED>>;
}) {
  const [profile, setProfile] = useState({
    name: "Lubombo Dairy Cooperative",
    regNo: "COP-2015-00214",
    region: "Lubombo",
    address: "Plot 14, Siteki Industrial Road",
    phone: "+268 2343 9081",
    sector: "Agricultural Unions",
  });

  const [demographics, setDemographics] = useState({
    total: 8910,
    male: 4100,
    female: 4810,
    youth: 3370,
  });

  const [savingStats, setSavingStats] = useState({
    savings: 6400000,
    loans: 4800000,
  });

  const [subType, setSubType] = useState("Annual Compliance Filing");
  const [attachment, setAttachment] = useState<string>("");

  const handleUpdateDemographics = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Demographic register updated on national server!");
  };

  const handleReportSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const reference = "SUB-2026-" + Math.floor(10000 + Math.random() * 90000);
    const newSubmission: (typeof INITIAL_SUBMISSIONS)[0] = {
      id: "s" + (submissions.length + 1),
      reference,
      coopName: profile.name,
      type: subType,
      submittedBy: "Bongani Hlatshwayo",
      submittedOn: "Just now",
      status: "Pending Review",
      priority: subType.includes("Annual") ? "Annual" : "Quarterly",
    };
    setSubmissions([newSubmission, ...submissions]);
    setActivities([
      {
        id: "f" + (activities.length + 1),
        initials: "BH",
        type: "submission",
        title: profile.name,
        detail: `${subType} submitted`,
        time: "Just now",
        tone: "info" as const,
      },
      ...activities,
    ]);
    toast.success(`Return submitted successfully as ${reference}!`);
    setAttachment("");
  };

  return (
    <AppShell
      title="Cooperative Workspace"
      subtitle="Lubombo Dairy Cooperative · Declare data and verify credentials"
    >
      <div className="space-y-6">
        {/* Top summary stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Compliance Score"
            value="96.4"
            subtitle="In good standing"
            icon={ShieldCheck}
            tone="success"
          />
          <StatCard
            label="Members Registered"
            value={demographics.total.toLocaleString()}
            subtitle="Active cooperative census"
            icon={Users}
          />
          <StatCard
            label="Total Capital"
            value={formatCurrency(savingStats.savings)}
            subtitle="Total assets reported"
            icon={Wallet}
            tone="accent"
          />
          <StatCard
            label="Returns Audited"
            value="4"
            subtitle="Approved declarations"
            icon={CheckCircle2}
            tone="success"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Cooperative Profile */}
          <Card
            title="Cooperative Profile"
            subtitle="Official registration and contact identifiers"
          >
            <div className="space-y-3 pt-2 text-sm">
              <ProfileItem label="Registration Number" value={profile.regNo} mono />
              <ProfileItem label="Official Name" value={profile.name} />
              <ProfileItem label="Sector Guild" value={profile.sector} />
              <ProfileItem label="Regional Jurisdiction" value={profile.region} />
              <ProfileItem label="Headquarters" value={profile.address} />
              <ProfileItem label="Phone Line" value={profile.phone} />
            </div>
          </Card>

          {/* Demographic Register updating */}
          <Card
            title="Demographics Registry"
            subtitle="Manage gender & youth representation ratios"
          >
            <form onSubmit={handleUpdateDemographics} className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1">Male Members</label>
                  <input
                    type="number"
                    value={demographics.male}
                    onChange={(e) => {
                      const maleVal = parseInt(e.target.value) || 0;
                      setDemographics({
                        ...demographics,
                        male: maleVal,
                        total: maleVal + demographics.female,
                      });
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1">Female Members</label>
                  <input
                    type="number"
                    value={demographics.female}
                    onChange={(e) => {
                      const femaleVal = parseInt(e.target.value) || 0;
                      setDemographics({
                        ...demographics,
                        female: femaleVal,
                        total: demographics.male + femaleVal,
                      });
                    }}
                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Youth Members (&lt;35 yrs)
                </label>
                <input
                  type="number"
                  value={demographics.youth}
                  onChange={(e) =>
                    setDemographics({ ...demographics, youth: parseInt(e.target.value) || 0 })
                  }
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                />
              </div>

              <div className="bg-surface border border-border rounded-lg p-2.5 text-xs text-muted-foreground flex justify-between">
                <span>
                  Total Members: <b>{demographics.total.toLocaleString()}</b>
                </span>
                <span>
                  Women Ratio:{" "}
                  <b>{((demographics.female / demographics.total) * 100).toFixed(1)}%</b>
                </span>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  className="w-full inline-flex justify-center items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all"
                >
                  Save Registry Record
                </button>
              </div>
            </form>
          </Card>

          {/* Submission panel */}
          <Card
            title="Data Return Submission"
            subtitle="File regulatory statistics to federation reviewers"
          >
            <form onSubmit={handleReportSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-semibold mb-1">Return Template type</label>
                <select
                  value={subType}
                  onChange={(e) => setSubType(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                >
                  <option>Annual Compliance Filing</option>
                  <option>Q4 Financial Audit</option>
                  <option>Membership Roster Update</option>
                  <option>Loan Portfolio Report</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold mb-1">
                  Upload Audited Certificate
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="file"
                    id="sub-file"
                    className="hidden"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setAttachment(e.target.files[0].name);
                        toast.success(`Attached ${e.target.files[0].name}`);
                      }
                    }}
                  />
                  <label
                    htmlFor="sub-file"
                    className="flex-1 text-center py-2 px-3 border-2 border-dashed border-border rounded-lg text-xs cursor-pointer hover:bg-muted/40 truncate"
                  >
                    {attachment || "Choose file to attach (PDF, XLS)"}
                  </label>
                </div>
              </div>

              <button
                type="submit"
                className="w-full inline-flex justify-center items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-all shadow-[var(--shadow-elev-2)]"
              >
                Submit Return to Federation
              </button>
            </form>
          </Card>
        </div>

        {/* Cooperative Submissions History */}
        <Card
          title="Historical Returns Logs"
          subtitle="Track review cycle statuses on submitted reports"
        >
          <div className="-mx-5 -mb-5 overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-y border-border bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3">Return Category</th>
                  <th className="px-5 py-3">Filed By</th>
                  <th className="px-5 py-3">Filing Date</th>
                  <th className="px-5 py-3">Review Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {submissions
                  .filter((s) => s.coopName === profile.name)
                  .map((sub) => (
                    <tr key={sub.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-5 py-3 font-mono text-xs text-muted-foreground">
                        {sub.reference}
                      </td>
                      <td className="px-5 py-3 font-semibold">{sub.type}</td>
                      <td className="px-5 py-3 text-muted-foreground">{sub.submittedBy}</td>
                      <td className="px-5 py-3 text-muted-foreground">{sub.submittedOn}</td>
                      <td className="px-5 py-3">
                        <StatusPill
                          tone={
                            sub.status === "Verified"
                              ? "success"
                              : sub.status === "Pending Review"
                                ? "warning"
                                : sub.status === "Rejected"
                                  ? "danger"
                                  : "info"
                          }
                        >
                          {sub.status}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

function ProfileItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between py-1.5 border-b border-border last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold text-foreground ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 6. FIELD DATA OFFICER / DATA COLLECTOR DASHBOARD
// ─────────────────────────────────────────────────────────────────────
function FieldOfficerDashboard({
  submissions,
  setSubmissions,
  activities,
  setActivities,
}: {
  submissions: typeof INITIAL_SUBMISSIONS;
  setSubmissions: React.Dispatch<React.SetStateAction<typeof INITIAL_SUBMISSIONS>>;
  activities: typeof INITIAL_ACTIVITY_FEED;
  setActivities: React.Dispatch<React.SetStateAction<typeof INITIAL_ACTIVITY_FEED>>;
}) {
  const [wifiStatus, setWifiStatus] = useState(true);
  const [gps, setGps] = useState<{ lat: string; lng: string } | null>(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [offlineQueue, setOfflineQueue] = useState<
    {
      coopName: string;
      officerName: string;
      membersCount: string;
      gps: string;
      notes: string;
      capturedAt: string;
    }[]
  >([]);

  // Capture Form State
  const [coopName, setCoopName] = useState("Lakeside Agricultural Union");
  const [officerName, setOfficerName] = useState("Nomsa Simelane");
  const [membersCount, setMembersCount] = useState("");
  const [notes, setNotes] = useState("");

  const handleCaptureGPS = () => {
    setGpsLoading(true);
    setTimeout(() => {
      setGps({ lat: "-26.3167", lng: "31.1333" });
      setGpsLoading(false);
      toast.success("GPS Location Captured successfully!");
    }, 1200);
  };

  const handleOfflineSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!membersCount) {
      toast.error("Please enter a verified membership count.");
      return;
    }
    const record = {
      coopName,
      officerName,
      membersCount,
      gps: gps ? `${gps.lat}, ${gps.lng}` : "Not captured",
      notes,
      capturedAt: new Date().toLocaleTimeString(),
    };
    setOfflineQueue([...offlineQueue, record]);
    toast.success("Submission cached locally in offline database!");
    setMembersCount("");
    setNotes("");
    setGps(null);
  };

  const handleSync = () => {
    if (offlineQueue.length === 0) {
      toast.error("Offline queue is empty.");
      return;
    }
    if (!wifiStatus) {
      toast.error("Cannot sync: No internet connection detected. Turn on Wifi.");
      return;
    }

    // Add each offline queue item as a submission return
    const newSubs = offlineQueue.map((item, idx) => {
      const reference = "SUB-OFF-" + Math.floor(10000 + Math.random() * 90000);
      return {
        id: "s-off-" + (submissions.length + idx + 1),
        reference,
        coopName: item.coopName,
        type: "Field Census Verification",
        submittedBy: item.officerName,
        submittedOn: "Just now",
        status: "Pending Review" as const,
        priority: "Routine" as const,
      };
    });

    setSubmissions([...newSubs, ...submissions]);
    setActivities([
      {
        id: "f" + (activities.length + 1),
        initials: "FLD",
        type: "submission",
        title: "Field Officer Sync",
        detail: `Synced ${offlineQueue.length} records successfully`,
        time: "Just now",
        tone: "success" as const,
      },
      ...activities,
    ]);

    toast.success(`Synchronized ${offlineQueue.length} queue records to national server!`);
    setOfflineQueue([]);
  };

  return (
    <AppShell
      title="Field Offline Capture"
      subtitle="Mobile first · Collect statistics in rural cooperatives without connection"
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Connectivity status Banner */}
        <div className="p-4 rounded-xl border border-border bg-surface flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className={`size-3 rounded-full ${wifiStatus ? "bg-success animate-pulse" : "bg-warning-foreground"}`}
            />
            <div>
              <p className="text-sm font-bold text-foreground">
                Workspace Connection State: {wifiStatus ? "Online Mode" : "Offline Cache Mode"}
              </p>
              <p className="text-xs text-muted-foreground">
                {wifiStatus
                  ? "Changes sync directly. Device verified."
                  : "All submitted data is cached on your device storage."}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setWifiStatus(!wifiStatus);
              toast.info(`Connection set to ${!wifiStatus ? "ONLINE" : "OFFLINE"}`);
            }}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-border text-foreground hover:bg-muted"
          >
            Toggle Wifi
          </button>
        </div>

        {/* Sync queue panel */}
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Queue status
            </p>
            <p className="font-heading text-3xl font-bold tracking-tight py-2 num">
              {offlineQueue.length}{" "}
              <span className="text-xs text-muted-foreground">records queued</span>
            </p>
            <button
              onClick={handleSync}
              className="w-full inline-flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/95 transition-all"
            >
              <RefreshCw className="size-3.5 animate-spin-slow" /> Sync Queue to Server
            </button>
          </div>
          <div className="p-4 rounded-xl border border-border bg-surface flex flex-col justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Collected today
            </p>
            <p className="font-heading text-3xl font-bold tracking-tight py-2 num">
              8 <span className="text-xs text-muted-foreground">verified returns</span>
            </p>
            <div className="text-[11px] text-success font-semibold flex items-center gap-1">
              <CheckCircle2 className="size-3" /> GPS tracking verified
            </div>
          </div>
        </div>

        {/* Entry Capture Form */}
        <Card
          title="Field Census Return Form"
          subtitle="Record physical metrics for verification audits"
        >
          <form onSubmit={handleOfflineSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Select Cooperative</label>
              <select
                value={coopName}
                onChange={(e) => setCoopName(e.target.value)}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
              >
                <option>Lakeside Agricultural Union</option>
                <option>Central Transport SACCO</option>
                <option>Sunrise Savings & Credit</option>
                <option>Lubombo Dairy Federation</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1">Field Officer Name</label>
                <input
                  type="text"
                  required
                  value={officerName}
                  onChange={(e) => setOfficerName(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1">Verified Members count</label>
                <input
                  type="number"
                  required
                  value={membersCount}
                  onChange={(e) => setMembersCount(e.target.value)}
                  placeholder="e.g. 420"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring font-mono"
                />
              </div>
            </div>

            {/* GPS capture */}
            <div className="p-3 rounded-lg border border-border bg-background flex items-center justify-between">
              <div>
                <span className="block text-xs font-semibold text-foreground">
                  GPS Location Capture
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {gps
                    ? `Latitude: ${gps.lat}, Longitude: ${gps.lng}`
                    : "Coordinates required for verification"}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCaptureGPS}
                disabled={gpsLoading}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold border rounded-lg hover:bg-muted"
              >
                <MapPin className="size-3.5 text-accent" />{" "}
                {gpsLoading ? "Capturing..." : "Fetch GPS"}
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold mb-1">Field notes & remarks</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Log physical inspection notes, discrepancies detected on ledger and registers..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-ring resize-none"
              />
            </div>

            <button
              type="submit"
              className="w-full inline-flex justify-center items-center gap-1.5 rounded-lg bg-primary py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-all"
            >
              <Database className="size-3.5" /> Save Roster Return Offline
            </button>
          </form>
        </Card>
      </div>
    </AppShell>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 7. READ-ONLY AUDITOR DASHBOARD
// ─────────────────────────────────────────────────────────────────────
function AuditorDashboard({
  usersList,
  submissions,
  activities,
  cooperatives,
}: {
  usersList: typeof INITIAL_USERS;
  submissions: typeof INITIAL_SUBMISSIONS;
  activities: typeof INITIAL_ACTIVITY_FEED;
  cooperatives: typeof INITIAL_COOPERATIVES;
}) {
  return (
    <AppShell
      title="Audit & Oversight Portal"
      subtitle="Read-only national access · Compliance verification snapshot"
    >
      <div className="space-y-6">
        {/* Read only Warning Banner */}
        <div className="p-3 bg-warning/15 border border-warning rounded-xl flex items-center gap-2 text-warning-foreground text-xs font-semibold">
          <AlertTriangle className="size-4 shrink-0" />
          <span>AUDIT MODE: Read-Only. Modification, provisioning and approvals are disabled.</span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="Total Cooperatives"
            value="12,842"
            subtitle="Across all regions"
            icon={Building2}
            tone="accent"
          />
          <StatCard
            label="Total Members Registered"
            value="2.4M"
            subtitle="National census count"
            icon={Users}
            tone="primary"
          />
          <StatCard
            label="National Loan Portfolio"
            value="$842.1M"
            subtitle="Total reported assets"
            icon={Wallet}
            tone="info"
          />
          <StatCard
            label="Audit Submissions Log"
            value={submissions.length.toString()}
            subtitle="Pending validation"
            icon={FileText}
            tone="warning"
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Submission history logs */}
          <Card
            className="lg:col-span-2"
            title="Registry Returns Logs"
            subtitle="Verify submitted declarations and federation review decisions"
          >
            <div className="-mx-5 -mb-5 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-y border-border bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <th className="px-5 py-3">Ref</th>
                    <th className="px-5 py-3">Cooperative</th>
                    <th className="px-5 py-3">Type</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3">Decision</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {submissions.map((s) => (
                    <tr key={s.id}>
                      <td className="px-5 py-2.5 font-mono text-muted-foreground">{s.reference}</td>
                      <td className="px-5 py-2.5 font-semibold">{s.coopName}</td>
                      <td className="px-5 py-2.5 text-muted-foreground">{s.type}</td>
                      <td className="px-5 py-2.5 text-muted-foreground">{s.submittedOn}</td>
                      <td className="px-5 py-2.5">
                        <StatusPill
                          tone={
                            s.status === "Verified"
                              ? "success"
                              : s.status === "Pending Review"
                                ? "warning"
                                : s.status === "Rejected"
                                  ? "danger"
                                  : "info"
                          }
                        >
                          {s.status}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Audit trail / Activity stream */}
          <Card
            title="Oversight Audit Trail"
            subtitle="Trace user operations and system log events"
          >
            <ul className="space-y-3 pt-2 text-xs">
              {activities.map((a) => (
                <li key={a.id} className="p-3 border rounded-lg bg-background/50 leading-relaxed">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-foreground">{a.title}</span>
                    <span className="text-muted-foreground font-mono">{a.time}</span>
                  </div>
                  <p className="text-muted-foreground">{a.detail}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        {/* Report downloads */}
        <Card
          title="Export Compliance Archives"
          subtitle="Export national registry records in standardized reports"
        >
          <div className="grid md:grid-cols-3 gap-3">
            <button
              onClick={() => toast.success("Exporting compliance returns registry as PDF...")}
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-surface hover:bg-muted/30 transition-all text-left"
            >
              <div className="size-9 rounded-lg bg-destructive/10 text-destructive grid place-items-center">
                <FileText className="size-4.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Registry Compliance PDF</p>
                <p className="text-[10px] text-muted-foreground">
                  Download national compliance rates report
                </p>
              </div>
            </button>

            <button
              onClick={() => toast.success("Exporting financial stats spreadsheet as CSV...")}
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-surface hover:bg-muted/30 transition-all text-left"
            >
              <div className="size-9 rounded-lg bg-success/10 text-success grid place-items-center">
                <FileSpreadsheet className="size-4.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Financial Stats Spreadsheet</p>
                <p className="text-[10px] text-muted-foreground">
                  Download savings and loans datasets (XLS)
                </p>
              </div>
            </button>

            <button
              onClick={() => toast.success("Exporting system access log audit trails...")}
              className="flex items-center gap-3 p-4 rounded-xl border border-border bg-surface hover:bg-muted/30 transition-all text-left"
            >
              <div className="size-9 rounded-lg bg-info/10 text-info grid place-items-center">
                <ShieldCheck className="size-4.5" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">System Access Trails</p>
                <p className="text-[10px] text-muted-foreground">
                  CSV audit trail tracking all login records
                </p>
              </div>
            </button>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
