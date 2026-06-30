import {
  FileText,
  FileSpreadsheet,
  FileBarChart,
  Download,
  Clock,
  TrendingUp,
  ChevronRight,
  BarChart3,
  PieChart,
  ShieldCheck,
  Building2,
  Network,
  Landmark,
} from "lucide-react";
import { AppShell, Card } from "@/components/app-shell";
import { REPORTS } from "@/lib/mock-data";
import { useAuth, type Role } from "@/lib/auth";
import { ReportExportPanel } from "@/components/reports/report-export-panel";
import { toast } from "sonner";
import { requireAuth } from "@/lib/route-guards";

const CATEGORIES_BY_ROLE: Record<
  Role,
  { tag: string; count: number; title: string; desc: string; icon: typeof TrendingUp }[]
> = {
  ministry: [
    {
      tag: "National",
      count: 24,
      title: "National Snapshot",
      desc: "Aggregated views across all sectors and regions — federation-level intelligence.",
      icon: Landmark,
    },
    {
      tag: "Regional",
      count: 18,
      title: "Regional Performance",
      desc: "Per-region deep dives with comparative benchmarks and penetration metrics.",
      icon: BarChart3,
    },
    {
      tag: "Compliance",
      count: 12,
      title: "Compliance & Audit",
      desc: "Filing rates, late submission flags, and systemic risk indicators by type.",
      icon: ShieldCheck,
    },
  ],
  federation: [
    {
      tag: "Federation",
      count: 16,
      title: "Federation Overview",
      desc: "Aggregated data across all apexes and cooperatives under your federation.",
      icon: TrendingUp,
    },
    {
      tag: "Apex",
      count: 12,
      title: "Apex Performance",
      desc: "Per-apex deep dives with comparative benchmarks and submission metrics.",
      icon: Network,
    },
    {
      tag: "Compliance",
      count: 8,
      title: "Compliance & Audit",
      desc: "Filing rates, late submissions, and compliance indicators across your federation.",
      icon: ShieldCheck,
    },
  ],
  apex: [
    {
      tag: "Apex",
      count: 10,
      title: "Apex Overview",
      desc: "Aggregated data for all cooperatives under your apex organization.",
      icon: TrendingUp,
    },
    {
      tag: "Cooperative",
      count: 14,
      title: "Cooperative Reports",
      desc: "Individual and comparative reports for cooperatives under your supervision.",
      icon: Building2,
    },
    {
      tag: "Compliance",
      count: 6,
      title: "Compliance Tracking",
      desc: "Submission status, compliance rates, and review outcomes for your cooperatives.",
      icon: ShieldCheck,
    },
  ],
  cooperative: [
    {
      tag: "My Reports",
      count: 8,
      title: "My Submissions",
      desc: "Reports generated from your submitted financial statements and databases.",
      icon: FileBarChart,
    },
    {
      tag: "Analytics",
      count: 4,
      title: "Performance Analytics",
      desc: "Trends, growth patterns, and key performance indicators for your cooperative.",
      icon: PieChart,
    },
  ],
};

const titleByRole: Record<Role, string> = {
  ministry: "Reporting Center",
  federation: "Federation Reports",
  apex: "Apex Reports",
  cooperative: "My Reports",
};

const subtitleByRole: Record<Role, string> = {
  ministry: "Generate and download intelligence reports across the cooperative ecosystem",
  federation: "Generate and download reports for your federation and its apex organizations",
  apex: "Generate and download reports for cooperatives under your apex organization",
  cooperative: "View and export reports from your submitted data and analytics",
};

export const ReportsPage: React.FC = () => {
  const { role } = useAuth();
  const categories = CATEGORIES_BY_ROLE[role];

  return (
    <AppShell title={titleByRole[role]} subtitle={subtitleByRole[role]}>
      <div className="space-y-8">
        {/* Category Cards — clean grid, no colored edges */}
        <div className="grid lg:grid-cols-3 gap-px bg-border rounded-xl overflow-hidden border border-border">
          {categories.map((c) => (
            <button
              key={c.title}
              className="bg-surface p-5 text-left group transition-colors hover:bg-muted/40"
              onClick={() => toast.info(`Opening ${c.title} reports...`)}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-muted text-muted-foreground">
                  {c.tag}
                </span>
                <span className="text-xs font-mono text-muted-foreground">{c.count} reports</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-lg grid place-items-center shrink-0 bg-muted text-muted-foreground group-hover:bg-accent/10 group-hover:text-accent transition-colors">
                  <c.icon className="size-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-heading font-bold text-foreground leading-tight">
                    {c.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{c.desc}</p>
                </div>
              </div>
              <span className="press-feedback mt-4 inline-flex items-center gap-1 text-xs font-semibold text-accent group-hover:underline">
                Browse reports <ChevronRight className="size-3" />
              </span>
            </button>
          ))}
        </div>

        {/* Export Panel */}
        <ReportExportPanel />

        {/* Recent Reports */}
        <Card title="Recent Reports" subtitle="Most recently generated and published report files">
          <div className="-mx-5 -mb-5">
            <ul className="divide-y divide-border">
              {REPORTS.map((r) => {
                const Icon =
                  r.format === "PDF"
                    ? FileText
                    : r.format === "XLSX"
                      ? FileSpreadsheet
                      : FileBarChart;
                return (
                  <li
                    key={r.id}
                    className="py-3.5 flex items-center gap-4 hover:bg-muted/20 px-5 transition-colors cursor-pointer"
                    onClick={() => toast.info(`Opening ${r.title}...`)}
                  >
                    <div className="size-10 rounded-lg bg-muted grid place-items-center shrink-0">
                      <Icon className="size-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm text-foreground truncate">{r.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {r.category} · {r.format} · {r.size}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5 shrink-0">
                      <Clock className="size-3" /> {r.updated}
                    </p>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toast.success(`Downloading ${r.title}...`);
                      }}
                      className="press-feedback inline-flex items-center gap-1.5 text-xs font-semibold rounded-lg border border-border px-3 py-1.5 hover:bg-muted transition-colors shrink-0"
                    >
                      <Download className="size-3.5" /> Download
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </Card>
      </div>
    </AppShell>
  );
};
