import {
  FileText,
  Download,
  TrendingUp,
  ChevronRight,
  BarChart3,
  PieChart,
  ShieldCheck,
  Building2,
  Network,
  Landmark,
  Calendar,
  Loader2,
  ArrowUpRight,
  FileBarChart2,
  Sparkles,
  CheckCircle2,
  Clock3,
  XCircle,
  AlertCircle,
  FileSpreadsheet,
  FileType,
  ChevronDown,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { type Role, useUserRole } from "@/lib/auth";
import { useAuth } from "@/context/AuthContext";
import { ReportExportPanel } from "@/components/reports/report-export-panel";
import { toast } from "sonner";
import {
  useCooperativeSubmissions,
  useApexSubmissions,
  useFederationSubmissions,
  useMinistrySubmissions,
} from "@/hooks/submissions/useSubmissions";
import { getAccessToken } from "@/services/shared/authService";
import { useState, useRef, useEffect } from "react";

// ─── Category config ─────────────────────────────────────────────────────────

const CATEGORIES_BY_ROLE: Record<
  Role,
  { tag: string; count: number; title: string; desc: string; icon: React.FC<{ className?: string }>; gradient: string }[]
> = {
  ministry: [
    { tag: "National", count: 24, title: "National Snapshot", desc: "Aggregated views across all sectors and regions — federation-level intelligence.", icon: Landmark, gradient: "from-violet-500/10 to-purple-500/5" },
    { tag: "Regional", count: 18, title: "Regional Performance", desc: "Per-region deep dives with comparative benchmarks and penetration metrics.", icon: BarChart3, gradient: "from-blue-500/10 to-cyan-500/5" },
    { tag: "Compliance", count: 12, title: "Compliance & Audit", desc: "Filing rates, late submission flags, and systemic risk indicators by type.", icon: ShieldCheck, gradient: "from-emerald-500/10 to-teal-500/5" },
  ],
  federation: [
    { tag: "Federation", count: 16, title: "Federation Overview", desc: "Aggregated data across all apexes and cooperatives under your federation.", icon: TrendingUp, gradient: "from-violet-500/10 to-purple-500/5" },
    { tag: "Apex", count: 12, title: "Apex Performance", desc: "Per-apex deep dives with comparative benchmarks and submission metrics.", icon: Network, gradient: "from-blue-500/10 to-cyan-500/5" },
    { tag: "Compliance", count: 8, title: "Compliance & Audit", desc: "Filing rates, late submissions, and compliance indicators across your federation.", icon: ShieldCheck, gradient: "from-emerald-500/10 to-teal-500/5" },
  ],
  apex: [
    { tag: "Apex", count: 10, title: "Apex Overview", desc: "Aggregated data for all cooperatives under your apex organization.", icon: TrendingUp, gradient: "from-violet-500/10 to-purple-500/5" },
    { tag: "Cooperative", count: 14, title: "Cooperative Reports", desc: "Individual and comparative reports for cooperatives under your supervision.", icon: Building2, gradient: "from-blue-500/10 to-cyan-500/5" },
    { tag: "Compliance", count: 6, title: "Compliance Tracking", desc: "Submission status, compliance rates, and review outcomes for your cooperatives.", icon: ShieldCheck, gradient: "from-emerald-500/10 to-teal-500/5" },
  ],
  cooperative: [
    { tag: "My Reports", count: 8, title: "My Submissions", desc: "Reports generated from your submitted financial statements and databases.", icon: FileBarChart2, gradient: "from-violet-500/10 to-purple-500/5" },
    { tag: "Analytics", count: 4, title: "Performance Analytics", desc: "Trends, growth patterns, and key performance indicators for your cooperative.", icon: PieChart, gradient: "from-blue-500/10 to-cyan-500/5" },
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

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; icon: React.FC<{ className?: string }>; className: string }> = {
  approved:  { label: "Approved",  icon: CheckCircle2, className: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20" },
  submitted: { label: "Submitted", icon: Clock3,       className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20" },
  pending:   { label: "Pending",   icon: AlertCircle,  className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" },
  rejected:  { label: "Rejected",  icon: XCircle,      className: "bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20" },
  draft:     { label: "Draft",     icon: FileText,     className: "bg-muted text-muted-foreground border border-border" },
};

function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status.toLowerCase()] ?? STATUS_CONFIG["draft"];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${config.className}`}>
      <Icon className="size-3" />
      {config.label}
    </span>
  );
}

// ─── Export format picker ─────────────────────────────────────────────────────

const FORMAT_OPTIONS = [
  { value: "pdf",  label: "PDF",  icon: FileText,       desc: "Portable Document" },
  { value: "xlsx", label: "Excel", icon: FileSpreadsheet, desc: "Spreadsheet (.xlsx)" },
  { value: "csv",  label: "CSV",  icon: FileBarChart2,  desc: "Comma-Separated" },
  { value: "docx", label: "Word", icon: FileType,       desc: "Word Document (.docx)" },
] as const;

type ExportFormat = typeof FORMAT_OPTIONS[number]["value"];

function ExportDropdown({
  submissionId,
  filename,
  onExport,
  isExporting,
}: {
  submissionId: string;
  filename: string;
  onExport: (id: string, format: ExportFormat, name: string) => void;
  isExporting: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isThis = isExporting === submissionId;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        disabled={isThis}
        className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-xl border border-border bg-background px-3 py-1.5 hover:bg-accent hover:text-white hover:border-accent transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed press-feedback"
      >
        {isThis ? (
          <><Loader2 className="size-3.5 animate-spin" /> Exporting…</>
        ) : (
          <><Download className="size-3.5" /> Export <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} /></>
        )}
      </button>

      {open && !isThis && (
        <div className="absolute right-0 top-full mt-2 z-50 w-52 rounded-xl border border-border bg-surface shadow-xl shadow-black/10 overflow-hidden animate-in fade-in-0 zoom-in-95 duration-100">
          <div className="px-3 py-2 border-b border-border">
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Choose format</p>
          </div>
          <div className="p-1">
            {FORMAT_OPTIONS.map((fmt) => {
              const Icon = fmt.icon;
              return (
                <button
                  key={fmt.value}
                  onClick={() => {
                    setOpen(false);
                    const ext = fmt.value;
                    const fmtFilename = filename.replace(/\.pdf$/, `.${ext}`);
                    onExport(submissionId, fmt.value, fmtFilename);
                  }}
                  className="w-full flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-left hover:bg-muted transition-colors group"
                >
                  <div className="size-7 rounded-lg bg-muted grid place-items-center shrink-0 group-hover:bg-accent/10 group-hover:text-accent transition-colors">
                    <Icon className="size-3.5 text-muted-foreground group-hover:text-accent" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground text-xs">{fmt.label}</p>
                    <p className="text-[10px] text-muted-foreground">{fmt.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ReportsPage: React.FC = () => {
  const role = useUserRole();
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const cooperativeQuery = useCooperativeSubmissions(role === "cooperative");
  const apexQuery        = useApexSubmissions(role === "apex");
  const federationQuery  = useFederationSubmissions({ all: true, enabled: role === "federation" });
  const ministryQuery    = useMinistrySubmissions({ all: true, enabled: role === "ministry" });

  if (!role) return null;
  const categories = CATEGORIES_BY_ROLE[role];

  const submissions = (() => {
    if (role === "cooperative") return cooperativeQuery.data ?? [];
    if (role === "apex")        return apexQuery.data ?? [];
    if (role === "federation")  return federationQuery.data ?? [];
    if (role === "ministry")    return ministryQuery.data ?? [];
    return [];
  })();

  const isLoading = (() => {
    if (role === "cooperative") return cooperativeQuery.isLoading;
    if (role === "apex")        return apexQuery.isLoading;
    if (role === "federation")  return federationQuery.isLoading;
    if (role === "ministry")    return ministryQuery.isLoading;
    return false;
  })();

  const recentSubmissions = [...submissions]
    .filter((s) => ["submitted", "approved"].includes(s.status.toLowerCase()))
    .sort((a, b) => new Date(b.submitted_at || b.created_at).getTime() - new Date(a.submitted_at || a.created_at).getTime())
    .slice(0, 10);

  // Resolve cooperative name: use field from submission, fall back to Keycloak org name
  const resolveCoopName = (s: typeof submissions[number]) =>
    s.cooperative_name ?? user?.organizationName ?? "My Cooperative";

  const handleExport = async (submissionId: string, format: string, filename: string) => {
    setIsExporting(submissionId);
    try {
      const token   = await getAccessToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
      const url     = `${baseUrl}/api/v1/cooperative/submissions/${submissionId}/export?format=${format}`;
      const res     = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(link.href);
      toast.success(`Report exported as ${format.toUpperCase()}!`);
    } catch (err) {
      console.error(err);
      toast.error("Failed to export report.");
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <AppShell title={titleByRole[role]} subtitle={subtitleByRole[role]}>
      <div className="space-y-8">

        {/* ── Category cards ── */}
        <div className={`grid gap-4 ${categories.length === 2 ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
          {categories.map((c) => {
            const Icon = c.icon;
            return (
              <button
                key={c.title}
                onClick={() => toast.info(`Opening ${c.title} reports…`)}
                className={`group relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br ${c.gradient} p-5 text-left transition-all hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 press-feedback`}
              >
                <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-accent/10 blur-2xl transition-all group-hover:bg-accent/20" />
                <div className="relative">
                  <div className="flex items-start justify-between mb-4">
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground backdrop-blur-sm">
                      <Sparkles className="size-2.5" />
                      {c.tag}
                    </span>
                    <span className="text-xs font-mono font-medium text-muted-foreground">{c.count} reports</span>
                  </div>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="size-10 rounded-xl bg-background/60 backdrop-blur-sm border border-border/60 grid place-items-center shrink-0 text-accent group-hover:bg-accent group-hover:text-white group-hover:border-accent transition-all">
                      <Icon className="size-5" />
                    </div>
                    <h3 className="font-heading font-bold text-foreground text-[15px] leading-tight">{c.title}</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-4">{c.desc}</p>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent group-hover:gap-2 transition-all">
                    Browse reports <ArrowUpRight className="size-3.5" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* ── Export panel ── */}
        <ReportExportPanel />

        {/* ── Recent Submissions ── */}
        <div className="rounded-2xl border border-border bg-surface overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h2 className="font-heading font-bold text-foreground text-[15px]">Recent Data Submissions</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Most recently submitted financial statements — click Export to download</p>
            </div>
            {recentSubmissions.length > 0 && (
              <span className="text-xs font-mono text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                {recentSubmissions.length} entries
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <Loader2 className="size-7 animate-spin text-accent" />
              <span className="text-sm">Loading submissions…</span>
            </div>
          ) : recentSubmissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
              <div className="size-14 rounded-2xl bg-muted grid place-items-center">
                <FileBarChart2 className="size-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium">No submissions yet</p>
              <p className="text-xs text-muted-foreground/60">Submitted data will appear here</p>
            </div>
          ) : (
            <>
              <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-2.5 bg-muted/40 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span>Cooperative / Year</span>
                <span className="text-center">Status</span>
                <span className="text-right">Date</span>
                <span className="text-right">Export</span>
              </div>

              <ul className="divide-y divide-border">
                {recentSubmissions.map((s) => {
                  const coopName = resolveCoopName(s);
                  const dateStr  = s.submitted_at
                    ? new Date(s.submitted_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
                    : new Date(s.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
                  const baseName = `${coopName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${s.reporting_year}`;

                  return (
                    <li key={s.id} className="group grid grid-cols-[auto_1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-6 py-3.5 hover:bg-muted/20 transition-colors">
                      {/* Icon + name */}
                      <div className="flex items-center gap-3 min-w-0 col-span-2 sm:col-span-1">
                        <div className="size-9 rounded-xl bg-muted border border-border grid place-items-center shrink-0 group-hover:border-accent/30 group-hover:bg-accent/5 transition-colors">
                          <FileText className="size-4 text-muted-foreground group-hover:text-accent transition-colors" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-sm text-foreground truncate leading-tight">{coopName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{s.reporting_year} Financial Report</p>
                        </div>
                      </div>

                      {/* Status */}
                      <div className="flex justify-center">
                        <StatusBadge status={s.status} />
                      </div>

                      {/* Date */}
                      <div className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground shrink-0 justify-end">
                        <Calendar className="size-3" />
                        {dateStr}
                      </div>

                      {/* Export dropdown */}
                      <div className="flex justify-end">
                        <ExportDropdown
                          submissionId={s.id}
                          filename={`${baseName}.pdf`}
                          onExport={handleExport}
                          isExporting={isExporting}
                        />
                      </div>
                    </li>
                  );
                })}
              </ul>

              <div className="px-6 py-3 border-t border-border bg-muted/20 flex items-center gap-2 text-[11px] text-muted-foreground">
                <ChevronRight className="size-3 shrink-0" />
                Showing the {recentSubmissions.length} most recent submissions. Use the Export Panel above for consolidated reports.
              </div>
            </>
          )}
        </div>

      </div>
    </AppShell>
  );
};
