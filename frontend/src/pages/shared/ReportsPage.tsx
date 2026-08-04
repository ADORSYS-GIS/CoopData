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
  RefreshCw,
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
import { useTranslation } from "react-i18next";

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.FC<{ className?: string }>; className: string }
> = {
  approved: {
    label: "Approved",
    icon: CheckCircle2,
    className:
      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  },
  submitted: {
    label: "Submitted",
    icon: Clock3,
    className: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20",
  },
  pending: {
    label: "Pending",
    icon: AlertCircle,
    className: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  },
  rejected: {
    label: "Rejected",
    icon: XCircle,
    className: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
  },
  draft: {
    label: "Draft",
    icon: FileText,
    className: "bg-muted text-muted-foreground border border-border",
  },
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const lower = status.toLowerCase();
  const config = STATUS_CONFIG[lower] || {
    label: status,
    icon: AlertCircle,
    className: "bg-slate-500/10 text-slate-650 dark:text-slate-400 border border-slate-500/20",
  };

  const label = t(`reports.status.${lower}`, { defaultValue: config.label });

  const Icon = config.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold ${config.className}`}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

// ─── Export format picker ─────────────────────────────────────────────────────

type ExportFormat = "pdf";

function ExportButton({
  submissionId,
  filename,
  onExport,
  isExporting,
}: {
  submissionId: string;
  filename: string;
  onExport: (id: string, format: ExportFormat, name: string, regenerate?: boolean) => void;
  isExporting: string | null;
}) {
  const { t } = useTranslation();
  const isThis = isExporting === submissionId;

  return (
    <button
      onClick={() => onExport(submissionId, "pdf", filename, false)}
      disabled={isExporting !== null}
      className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-xl border border-border bg-background px-3 py-1.5 hover:bg-accent hover:text-white hover:border-accent transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed press-feedback"
    >
      {isThis ? (
        <>
          <Loader2 className="size-3.5 animate-spin" /> {t("reports.exporting")}
        </>
      ) : (
        <>
          <Download className="size-3.5" /> {t("reports.exportPdf")}
        </>
      )}
    </button>
  );
}

function RegenerateButton({
  submissionId,
  filename,
  onExport,
  isExporting,
}: {
  submissionId: string;
  filename: string;
  onExport: (id: string, format: ExportFormat, name: string, regenerate?: boolean) => void;
  isExporting: string | null;
}) {
  const { t } = useTranslation();
  const isThis = isExporting === submissionId + "-regen";

  return (
    <button
      onClick={() => onExport(submissionId, "pdf", filename, true)}
      disabled={isExporting !== null}
      title={t("reportExport.regenerateTooltip")}
      className="inline-flex items-center gap-1.5 text-xs font-semibold rounded-xl border border-amber-500/50 bg-amber-50 dark:bg-amber-900/20 px-3 py-1.5 text-amber-700 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-all shrink-0 disabled:opacity-50 disabled:cursor-not-allowed press-feedback"
    >
      {isThis ? (
        <>
          <Loader2 className="size-3.5 animate-spin" /> {t("reportExport.regenerating")}
        </>
      ) : (
        <>
          <RefreshCw className="size-3.5" /> {t("reportExport.regenerateAndExport")}
        </>
      )}
    </button>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const ReportsPage: React.FC = () => {
  const { t } = useTranslation();
  const role = useUserRole();
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState<string | null>(null);

  const cooperativeQuery = useCooperativeSubmissions(role === "cooperative");
  const apexQuery = useApexSubmissions(role === "apex");
  const federationQuery = useFederationSubmissions({ all: true, enabled: role === "federation" });
  const ministryQuery = useMinistrySubmissions({ all: true, enabled: role === "ministry" });

  if (!role) return null;

  const titleByRole: Record<Role, string> = {
    ministry: t("reports.title.ministry"),
    federation: t("reports.title.federation"),
    apex: t("reports.title.apex"),
    cooperative: t("reports.title.cooperative"),
  };

  const subtitleByRole: Record<Role, string> = {
    ministry: t("reports.subtitle.ministry"),
    federation: t("reports.subtitle.federation"),
    apex: t("reports.subtitle.apex"),
    cooperative: t("reports.subtitle.cooperative"),
  };

  const submissions = (() => {
    if (role === "cooperative") return cooperativeQuery.data ?? [];
    if (role === "apex") return apexQuery.data ?? [];
    if (role === "federation") return federationQuery.data ?? [];
    if (role === "ministry") return ministryQuery.data ?? [];
    return [];
  })();

  const isLoading = (() => {
    if (role === "cooperative") return cooperativeQuery.isLoading;
    if (role === "apex") return apexQuery.isLoading;
    if (role === "federation") return federationQuery.isLoading;
    if (role === "ministry") return ministryQuery.isLoading;
    return false;
  })();

  const recentSubmissions = [...submissions]
    .filter((s) => s.status.toLowerCase() === "approved")
    .sort(
      (a, b) =>
        new Date(b.submitted_at || b.created_at).getTime() -
        new Date(a.submitted_at || a.created_at).getTime(),
    )
    .slice(0, 10);

  // Resolve cooperative name: use field from submission, fall back to Keycloak org name
  const resolveCoopName = (s: (typeof submissions)[number]) =>
    s.cooperative_name ?? user?.organizationName ?? t("reports.myCooperative");

  const handleExport = async (
    submissionId: string,
    format: string,
    filename: string,
    regenerate = false,
  ) => {
    setIsExporting(submissionId + (regenerate ? "-regen" : ""));
    try {
      const token = await getAccessToken();
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "";
      const url = `${baseUrl}/api/v1/cooperative/submissions/${submissionId}/export?format=${format}${
        regenerate ? "&regenerate=true" : ""
      }`;
      const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const link = document.createElement("a");
      link.href = window.URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(link.href);
      if (regenerate) {
        toast.success(t("reportExport.regeneratedAndDownloaded"));
      } else {
        toast.success(t("reports.exportSuccess", { format: format.toUpperCase() }));
      }
    } catch (err) {
      console.error(err);
      toast.error(t("reports.exportFailed"));
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <AppShell title={titleByRole[role]} subtitle={subtitleByRole[role]}>
      <div className="relative min-h-[calc(100vh-10rem)]">
        {/* ── Page Background Watermark ── */}
        <FileBarChart2 className="pointer-events-none fixed -bottom-24 -right-24 size-[500px] text-blue-500/5 rotate-12 z-0" />

        <div className="relative z-10 space-y-8">
          {/* ── Export panel ── */}
          <ReportExportPanel />

          {/* ── Recent Submissions ── */}
          <div className="rounded-2xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="font-heading font-bold text-foreground text-[15px]">
                  {t("reports.recentDataSubmissions")}
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t("reports.recentDataSubmissionsDesc")}
                </p>
              </div>
              {recentSubmissions.length > 0 && (
                <span className="text-xs font-mono text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                  {recentSubmissions.length === 1
                    ? t("reports.entriesCount", { count: 1 })
                    : t("reports.entriesCount_plural", { count: recentSubmissions.length })}
                </span>
              )}
            </div>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <Loader2 className="size-7 animate-spin text-accent" />
                <span className="text-sm">{t("reports.loadingSubmissions")}</span>
              </div>
            ) : recentSubmissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
                <div className="size-14 rounded-2xl bg-muted grid place-items-center">
                  <FileBarChart2 className="size-7 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-semibold">{t("reports.noSubmissions")}</p>
                <p className="text-xs text-muted-foreground/60">{t("reports.submittedDataWill")}</p>
              </div>
            ) : (
              <>
                <div className="hidden sm:grid grid-cols-[1fr_auto_auto_auto] gap-4 px-6 py-2.5 bg-muted/40 border-b border-border text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <span>{t("reports.cooperativeYear")}</span>
                  <span className="text-center">{t("reports.statusHeader")}</span>
                  <span className="text-right">{t("reports.dateHeader")}</span>
                  <span className="text-right">{t("reports.exportHeader")}</span>
                </div>

                <ul className="divide-y divide-border">
                  {recentSubmissions.map((s) => {
                    const coopName = resolveCoopName(s);
                    const dateStr = s.submitted_at
                      ? new Date(s.submitted_at).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : new Date(s.created_at).toLocaleDateString("en-GB", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        });
                    const baseName = `${coopName.replace(/[^a-z0-9]/gi, "_").toLowerCase()}_${s.reporting_year}`;

                    return (
                      <li
                        key={s.id}
                        className="group grid grid-cols-[auto_1fr_auto] sm:grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-6 py-3.5 hover:bg-muted/20 transition-colors"
                      >
                        {/* Icon + name */}
                        <div className="flex items-center gap-3 min-w-0 col-span-2 sm:col-span-1">
                          <div className="size-9 rounded-xl bg-muted border border-border grid place-items-center shrink-0 group-hover:border-accent/30 group-hover:bg-accent/5 transition-colors">
                            <FileText className="size-4 text-muted-foreground group-hover:text-accent transition-colors" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-sm text-foreground truncate leading-tight">
                              {coopName}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {t("reports.financialReportLabel", { year: s.reporting_year })}
                            </p>
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

                        {/* Export actions */}
                        <div className="flex justify-end gap-2">
                          <RegenerateButton
                            submissionId={s.id}
                            filename={`${baseName}.pdf`}
                            onExport={handleExport}
                            isExporting={isExporting}
                          />
                          <ExportButton
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
                  {t("reports.showingMostRecent", { count: recentSubmissions.length })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
};
