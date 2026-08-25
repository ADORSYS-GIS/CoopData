import { useNavigate } from "@tanstack/react-router";
import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import type { TFunction } from "i18next";
import {
  Inbox,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  FileText,
  ChevronRight,
  ChevronLeft,
  Loader2,
  AlertCircle,
  Plus,
  X,
  Calendar,
  Building2,
  Landmark,
  Network,
  ArrowUpRight,
  Filter,
  Trash2,
} from "lucide-react";
import { AppShell, Card, StatusPill, StatCard } from "@/components/app-shell";
import { useUserRole } from "@/lib/auth";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  useCooperativeSubmissions,
  useApexSubmissions,
  useFederationSubmissions,
  useMinistrySubmissions,
  useCreateSubmission,
  useDeleteSubmission,
} from "@/hooks/submissions/useSubmissions";
import type { SubmissionResponse } from "@/hooks/submissions/useSubmissions";

// Suppress unused import warnings for icons that may be used in JSX conditionally
void ArrowUpRight;
void Filter;

type FilterType = "all" | "draft" | "submitted" | "approved" | "rejected";

type SubmissionWithName = SubmissionResponse & {
  cooperative_name?: string;
  apex_name?: string;
  federation_name?: string;
};

function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "approved":
      return "success";
    case "awaiting_coop_validation":
    case "submitted":
    case "in_review":
    case "apex_review":
    case "federation_review":
    case "ministry_review":
      return "warning";
    case "rejected":
      return "danger";
    case "draft":
      return "neutral";
    default:
      return "info";
  }
}

function statusLabel(status: string, t: (key: string, options?: any) => string): string {
  const labels: Record<string, string> = {
    draft: t("submissions.status.draft"),
    awaiting_coop_validation: t("submissions.status.awaitingValidation"),
    submitted: t("submissions.status.submitted"),
    in_review: t("submissions.status.inReview"),
    apex_review: t("submissions.status.apexReview"),
    apex_returned: t("submissions.status.apexReturned"),
    federation_review: t("submissions.status.federationReview"),
    federation_returned: t("submissions.status.federationReturned"),
    ministry_review: t("submissions.status.ministryReview"),
    approved: t("submissions.status.approved"),
    rejected: t("submissions.status.rejected"),
  };
  return labels[status] ?? status;
}

function CalendarYearPicker({
  selectedYear,
  onChangeYear,
}: {
  selectedYear: number;
  onChangeYear: (y: number) => void;
}) {
  const currentYear = new Date().getFullYear();
  const [pageStartYear, setPageStartYear] = useState(() => {
    return Math.floor(selectedYear / 12) * 12;
  });

  const years = Array.from({ length: 12 }, (_, i) => pageStartYear + i);

  return (
    <div className="border border-border rounded-xl p-3 bg-muted/10">
      <div className="flex items-center justify-between mb-3 px-1">
        <button
          type="button"
          onClick={() => setPageStartYear((prev) => prev - 12)}
          className="size-8 rounded-lg grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border border-border"
        >
          <ChevronLeft className="size-4" />
        </button>
        <span className="text-xs font-bold text-foreground">
          {pageStartYear} - {pageStartYear + 11}
        </span>
        <button
          type="button"
          onClick={() => setPageStartYear((prev) => prev + 12)}
          className="size-8 rounded-lg grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors border border-border"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {years.map((y) => {
          const isSelected = y === selectedYear;
          const isFuture = y > currentYear;
          return (
            <button
              key={y}
              type="button"
              disabled={isFuture}
              onClick={() => onChangeYear(y)}
              className={`rounded-lg py-2 text-xs font-bold transition-all duration-150 border ${
                isSelected
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : isFuture
                    ? "border-transparent bg-transparent text-muted-foreground/30 cursor-not-allowed"
                    : "border-border bg-surface text-foreground hover:border-primary/40 hover:bg-muted/60"
              }`}
            >
              {y}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function NewSubmissionModal({ onClose }: { onClose: () => void }) {
  const { t } = useOrganizationLabelsContext();
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const createSubmission = useCreateSubmission();

  const handleCreate = async () => {
    try {
      const sub = await createSubmission.mutateAsync({ reporting_year: year });
      toast.success(t("submissions.submissionCreated", { year }));
      onClose();
      navigate({ to: "/app/submissions/$id", params: { id: sub.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("submissions.failedCreate"));
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-surface rounded-2xl border border-border shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-primary/10 grid place-items-center shrink-0">
              <Calendar className="size-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {t("submissions.newSubmission")}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("submissions.startAnnualReturn")}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-2">
          <label className="block text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
            {t("submissions.reportingYear")}
          </label>
          <CalendarYearPicker selectedYear={year} onChangeYear={setYear} />
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border bg-transparent px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
          >
            {t("submissions.cancel")}
          </button>
          <button
            onClick={handleCreate}
            disabled={createSubmission.isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {createSubmission.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Plus className="size-4" />
            )}
            {t("submissions.createSubmission")}
          </button>
        </div>
      </div>
    </div>
  );
}

function OrgCard({
  name,
  count,
  approvedCount,
  reviewCount,
  onClick,
  icon: Icon = Building2,
}: {
  name: string;
  count: number;
  approvedCount: number;
  reviewCount: number;
  onClick: () => void;
  icon?: React.ElementType;
}) {
  const { t } = useOrganizationLabelsContext();
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-2xl border border-border bg-surface p-5 hover:border-primary/30 hover:shadow-[var(--shadow-elev-2)] transition-all duration-200 hover:-translate-y-0.5 w-full press-feedback"
    >
      <div className="flex items-start justify-between mb-4">
        <div className="size-10 rounded-xl bg-primary/8 grid place-items-center ring-1 ring-border group-hover:bg-primary/12 transition-colors">
          <Icon className="size-5 text-primary" />
        </div>
        <ChevronRight className="size-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-150 mt-1.5" />
      </div>
      <p className="text-sm font-bold text-foreground mb-0.5 leading-snug line-clamp-2">{name}</p>
      <p className="text-[11px] text-muted-foreground mb-4">
        {count === 1
          ? t("submissions.orgSubmissionsCount", { count })
          : t("submissions.orgSubmissionsCount_plural", { count })}
      </p>
      <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 text-[11px] font-semibold border-t border-border/60 pt-3">
        {reviewCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-warning-foreground">
            <span className="size-1.5 rounded-full bg-warning animate-pulse" />
            {t("submissions.orgInReview", { count: reviewCount })}
          </span>
        )}
        {approvedCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-success">
            <span className="size-1.5 rounded-full bg-success" />
            {t("submissions.orgApproved", { count: approvedCount })}
          </span>
        )}
        {reviewCount === 0 && approvedCount === 0 && (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground/60">
            <span className="size-1.5 rounded-full bg-muted-foreground/40" />
            {t("submissions.orgNoActivity")}
          </span>
        )}
      </div>
    </button>
  );
}

import { DeleteConfirmationDialog } from "@/components/shared/DeleteConfirmationDialog";
import { useVerifyIdentity } from "@/hooks/auth/useVerifyIdentity";
import { useAuth } from "@/context/AuthContext";

function SubmissionTable({
  submissions,
  isLoading,
  isError,
  error,
  filter,
  setFilter,
  search,
  setSearch,
  counts,
  onRowClick,
  showCoopColumn,
  onExport,
}: {
  submissions: SubmissionWithName[];
  isLoading: boolean;
  isError: boolean;
  error: unknown;
  filter: FilterType;
  setFilter: (f: FilterType) => void;
  search: string;
  setSearch: (s: string) => void;
  counts: { total: number; draft: number; submitted: number; approved: number; rejected: number };
  onRowClick: (id: string) => void;
  showCoopColumn: boolean;
  onExport: () => void;
}) {
  const { t } = useOrganizationLabelsContext();
  const role = useUserRole();
  const { isOffline } = useAuth();
  const { verifyIdentity } = useVerifyIdentity();
  const deleteSubmission = useDeleteSubmission();
  const canValidate = true;
  const [submissionToDelete, setSubmissionToDelete] = useState<{
    id: string;
    reference?: string | null;
  } | null>(null);

  return (
    <Card title={t("submissions.queue")} subtitle={t("submissions.queueSubtitle")}>
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="inline-flex items-center gap-0.5 bg-muted/50 rounded-xl p-1 border border-border/60">
          {(
            [
              ["all", t("submissions.filterAll", { count: counts.total })],
              ["draft", t("submissions.filterDraft", { count: counts.draft })],
              ["submitted", t("submissions.filterInReview", { count: counts.submitted })],
              ["approved", t("submissions.filterApproved", { count: counts.approved })],
              ["rejected", t("submissions.filterRejected", { count: counts.rejected })],
            ] as [FilterType, string][]
          ).map(([f, label]) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all duration-150 ${
                filter === f
                  ? "bg-surface text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-60">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("submissions.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-input bg-muted/30 py-2 pl-9 pr-3 text-xs transition-all focus:border-ring/60 focus:bg-surface focus:ring-2 focus:ring-ring/10 focus:outline-none placeholder:text-muted-foreground/60"
          />
        </div>
      </div>

      <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20 text-[10px] uppercase tracking-widest text-muted-foreground font-bold text-left">
              <th className="px-5 py-3.5">{t("submissions.tableColReference")}</th>
              {showCoopColumn && (
                <th className="px-5 py-3.5 hidden md:table-cell">
                  {t("submissions.tableColCooperative")}
                </th>
              )}
              <th className="px-5 py-3.5">{t("submissions.tableColYear")}</th>
              <th className="px-5 py-3.5 hidden md:table-cell">{t("submissions.tableColTier")}</th>
              <th className="px-5 py-3.5 hidden lg:table-cell">
                {t("submissions.tableColCreated")}
              </th>
              <th className="px-5 py-3.5">{t("submissions.tableColPriority")}</th>
              <th className="px-5 py-3.5">{t("submissions.tableColStatus")}</th>
              <th className="px-5 py-3.5 text-right">{t("submissions.tableColAction")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60">
            {isLoading ? (
              <tr>
                <td
                  colSpan={showCoopColumn ? 8 : 7}
                  className="py-16 text-center text-muted-foreground"
                >
                  <Loader2 className="size-6 mx-auto mb-3 animate-spin text-accent/50" />
                  <p className="text-xs font-medium">{t("submissions.loading")}</p>
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td
                  colSpan={showCoopColumn ? 8 : 7}
                  className="py-16 text-center text-muted-foreground"
                >
                  <AlertCircle className="size-8 mx-auto mb-3 text-destructive/50" />
                  <p className="text-sm font-semibold">{t("submissions.failedLoad")}</p>
                  <p className="text-xs mt-1 text-muted-foreground">
                    {error instanceof Error ? error.message : "Unknown error"}
                  </p>
                </td>
              </tr>
            ) : submissions.length === 0 ? (
              <tr>
                <td
                  colSpan={showCoopColumn ? 8 : 7}
                  className="py-16 text-center text-muted-foreground"
                >
                  <FileText className="size-8 mx-auto mb-3 text-muted-foreground/40" />
                  <p className="text-sm font-semibold">{t("submissions.noSubmissionsFound")}</p>
                  <p className="text-xs mt-1 text-muted-foreground/70">
                    {t("submissions.adjustFilterSearch")}
                  </p>
                </td>
              </tr>
            ) : (
              submissions.map((s) => (
                <tr
                  key={s.id}
                  className="group border-l-2 border-l-transparent hover:border-l-accent hover:bg-accent/[0.03] transition-all duration-150 cursor-pointer"
                  onClick={() => onRowClick(s.id)}
                >
                  <td className="px-5 py-4 font-mono text-[12px] font-semibold text-foreground/70">
                    {s.reference ?? s.id.slice(0, 8).toUpperCase()}
                  </td>
                  {showCoopColumn && (
                    <td className="px-5 py-4 text-xs text-foreground hidden md:table-cell max-w-[160px] truncate font-medium">
                      {s.cooperative_name ?? "—"}
                    </td>
                  )}
                  <td className="px-5 py-4">
                    <p className="font-bold text-foreground text-sm">{s.reporting_year}</p>
                  </td>
                  <td className="px-5 py-4 hidden md:table-cell">
                    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground font-medium capitalize">
                      <span className="size-1.5 rounded-full bg-primary/30" />
                      {s.current_tier}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-muted-foreground text-xs hidden lg:table-cell">
                    {new Date(s.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`text-xs font-semibold ${
                        s.priority === "Urgent"
                          ? "text-destructive"
                          : s.priority === "Quarterly"
                            ? "text-primary"
                            : "text-muted-foreground"
                      }`}
                    >
                      {s.priority}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <StatusPill tone={statusTone(s.status)}>{statusLabel(s.status, t)}</StatusPill>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="inline-flex items-center gap-2 justify-end">
                      {role === "cooperative" && s.status !== "approved" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSubmissionToDelete({ id: s.id, reference: s.reference });
                          }}
                          disabled={deleteSubmission.isPending || isOffline}
                          className="inline-flex items-center justify-center p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          title={
                            isOffline
                              ? t("submissions.cannotDeleteOffline", "Cannot delete while offline")
                              : t("submissions.detail.deleteSubmission")
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                      <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/5 border border-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-all duration-150 group-hover:bg-primary/10">
                        {canValidate && s.status !== "draft"
                          ? t("submissions.actionReview")
                          : t("submissions.actionOpen")}
                        <ArrowUpRight className="size-3" />
                      </span>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <DeleteConfirmationDialog
        open={!!submissionToDelete}
        onOpenChange={(open) => !open && setSubmissionToDelete(null)}
        entityName={
          submissionToDelete
            ? submissionToDelete.reference || submissionToDelete.id.slice(0, 8)
            : ""
        }
        entityType="submission"
        entityId={submissionToDelete?.id ?? ""}
        onVerifyIdentity={async (password, otp) => verifyIdentity({ password, otp })}
        onConfirmDelete={async (verificationToken) => {
          if (!submissionToDelete) return;
          await deleteSubmission.mutateAsync({ id: submissionToDelete.id, verificationToken });
          toast.success(t("submissions.deleteSuccess"));
          setSubmissionToDelete(null);
        }}
      />
    </Card>
  );
}

export const SubmissionsPage: React.FC = () => {
  const { t } = useOrganizationLabelsContext();
  const role = useUserRole();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [showNewModal, setShowNewModal] = useState(false);
  const [selectedCoopId, setSelectedCoopId] = useState<string | null>(null);
  const [selectedApexId, setSelectedApexId] = useState<string | null>(null);
  const [selectedFederationId, setSelectedFederationId] = useState<string | null>(null);

  const cooperativeQ = useCooperativeSubmissions(role === "cooperative");
  const apexQ = useApexSubmissions(role === "apex");
  const federationQ = useFederationSubmissions({ all: true, enabled: role === "federation" });
  const ministryQ = useMinistrySubmissions(role === "ministry");

  const {
    data: allSubmissions = [],
    isLoading,
    isError,
    error,
  } = (() => {
    if (role === "apex") return apexQ;
    if (role === "federation") return federationQ;
    if (role === "ministry") return ministryQ;
    return cooperativeQ;
  })();

  const isCooperative = role === "cooperative";
  const isApex = role === "apex";
  const isFederation = role === "federation";
  const isMinistry = role === "ministry";

  const federationGroups = useMemo(() => {
    const map = new Map<string, { name: string; subs: SubmissionWithName[] }>();
    for (const s of allSubmissions as SubmissionWithName[]) {
      const key = s.federation_name ?? "Unknown Federation";
      if (!map.has(key)) map.set(key, { name: key, subs: [] });
      map.get(key)!.subs.push(s);
    }
    return Array.from(map.entries()).map(([id, { name, subs }]) => ({ id, name, subs }));
  }, [allSubmissions]);

  const apexGroups = useMemo(() => {
    const filtered =
      isMinistry && selectedFederationId
        ? (allSubmissions as SubmissionWithName[]).filter(
            (s) => (s.federation_name ?? "Unknown Federation") === selectedFederationId,
          )
        : (allSubmissions as SubmissionWithName[]);
    const map = new Map<string, { name: string; subs: SubmissionWithName[] }>();
    for (const s of filtered) {
      const key = s.apex_name ?? "Unknown Apex";
      if (!map.has(key)) map.set(key, { name: key, subs: [] });
      map.get(key)!.subs.push(s);
    }
    return Array.from(map.entries()).map(([id, { name, subs }]) => ({ id, name, subs }));
  }, [allSubmissions, selectedFederationId, isMinistry]);

  const coopGroups = useMemo(() => {
    let filtered = allSubmissions as SubmissionWithName[];
    if (isFederation && selectedApexId) {
      filtered = filtered.filter((s) => (s.apex_name ?? "Unknown Apex") === selectedApexId);
    } else if (isMinistry && selectedFederationId && selectedApexId) {
      filtered = filtered.filter(
        (s) =>
          (s.federation_name ?? "Unknown Federation") === selectedFederationId &&
          (s.apex_name ?? "Unknown Apex") === selectedApexId,
      );
    }
    const map = new Map<string, { name: string; subs: SubmissionWithName[] }>();
    for (const s of filtered) {
      const key = s.cooperative_id;
      const name = s.cooperative_name ?? s.cooperative_id.slice(0, 8);
      if (!map.has(key)) map.set(key, { name, subs: [] });
      map.get(key)!.subs.push(s);
    }
    return Array.from(map.entries()).map(([id, { name, subs }]) => ({ id, name, subs }));
  }, [allSubmissions, selectedApexId, selectedFederationId, isFederation, isMinistry]);

  const submissions = useMemo(() => {
    if ((isApex || isFederation || isMinistry) && selectedCoopId) {
      return (allSubmissions as SubmissionWithName[]).filter(
        (s) => s.cooperative_id === selectedCoopId,
      );
    }
    return allSubmissions as SubmissionWithName[];
  }, [allSubmissions, selectedCoopId, isApex, isFederation, isMinistry]);

  if (!role) return null;

  const canValidate = role === "federation" || role === "apex" || role === "ministry";

  const titleByRole: Record<string, string> = {
    ministry: t("submissions.title.ministry"),
    federation: t("submissions.title.federation"),
    apex: t("submissions.title.apex"),
    cooperative: t("submissions.title.cooperative"),
  };
  const subtitleByRole: Record<string, string> = {
    ministry: t("submissions.subtitle.ministry"),
    federation: t("submissions.subtitle.federation"),
    apex: t("submissions.subtitle.apex"),
    cooperative: t("submissions.subtitle.cooperative"),
  };

  const filtered = submissions.filter((s) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "draft" && s.status === "draft") ||
      (filter === "submitted" &&
        ["submitted", "in_review", "apex_review", "federation_review", "ministry_review"].includes(
          s.status,
        )) ||
      (filter === "approved" && s.status === "approved") ||
      (filter === "rejected" && s.status === "rejected");

    const matchesSearch =
      !search ||
      s.id.toLowerCase().includes(search.toLowerCase()) ||
      (s.reference ?? "").toLowerCase().includes(search.toLowerCase()) ||
      s.reporting_year.toString().includes(search);

    return matchesFilter && matchesSearch;
  });

  const counts = {
    total: submissions.length,
    draft: submissions.filter((s) => s.status === "draft").length,
    submitted: submissions.filter((s) =>
      ["submitted", "in_review", "apex_review", "federation_review", "ministry_review"].includes(
        s.status,
      ),
    ).length,
    approved: submissions.filter((s) => s.status === "approved").length,
    rejected: submissions.filter((s) => s.status === "rejected").length,
  };

  const showCoopColumn =
    ((isApex || isFederation) && selectedCoopId !== null) ||
    (isMinistry && selectedCoopId !== null);

  return (
    <>
      {showNewModal && <NewSubmissionModal onClose={() => setShowNewModal(false)} />}

      <AppShell
        title={titleByRole[role] ?? t("submissions.title.fallback")}
        subtitle={subtitleByRole[role] ?? t("submissions.subtitle.fallback")}
        actions={
          isCooperative ? (
            <button
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="size-4" /> {t("submissions.newSubmission")}
            </button>
          ) : undefined
        }
      >
        <div className="space-y-8">
          {isMinistry && selectedFederationId === null ? (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  icon={Landmark}
                  label={t("submissions.federations")}
                  value={federationGroups.length.toString()}
                  subtitle={t("submissions.nationwide")}
                  tone="primary"
                />
                <StatCard
                  icon={Inbox}
                  label={t("submissions.totalSubmissions")}
                  value={allSubmissions.length.toString()}
                  subtitle={t("submissions.allDataReturns")}
                  tone="info"
                />
                <StatCard
                  icon={CheckCircle2}
                  label={t("submissions.approved")}
                  value={(allSubmissions as SubmissionWithName[])
                    .filter((s) => s.status === "approved")
                    .length.toString()}
                  subtitle={t("submissions.finalizedDeclarations")}
                  tone="success"
                />
                <StatCard
                  icon={Clock}
                  label={t("submissions.inReview")}
                  value={(allSubmissions as SubmissionWithName[])
                    .filter((s) =>
                      [
                        "submitted",
                        "in_review",
                        "apex_review",
                        "federation_review",
                        "ministry_review",
                      ].includes(s.status),
                    )
                    .length.toString()}
                  subtitle={t("submissions.awaitingValidation")}
                  tone="warning"
                />
              </div>

              <Card
                title={t("submissions.selectFederation")}
                subtitle={t("submissions.chooseFederationSubtitle")}
              >
                {isLoading ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Loader2 className="size-6 mx-auto mb-2 animate-spin text-muted-foreground/50" />
                    <p className="text-xs">{t("submissions.loadingFederations")}</p>
                  </div>
                ) : isError ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <AlertCircle className="size-8 mx-auto mb-2 text-destructive/50" />
                    <p className="text-sm font-semibold">{t("submissions.failedLoad")}</p>
                    <p className="text-xs mt-1 text-muted-foreground">
                      {error instanceof Error ? error.message : "Unknown error"}
                    </p>
                  </div>
                ) : federationGroups.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Landmark className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm font-semibold">
                      {t("submissions.noFederationsSubmissions")}
                    </p>
                    <p className="text-xs mt-1">{t("submissions.submissionsWillAppearHere")}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {federationGroups.map((fed) => {
                      const approvedCount = fed.subs.filter((s) => s.status === "approved").length;
                      const reviewCount = fed.subs.filter((s) =>
                        [
                          "submitted",
                          "in_review",
                          "apex_review",
                          "federation_review",
                          "ministry_review",
                        ].includes(s.status),
                      ).length;
                      return (
                        <OrgCard
                          key={fed.id}
                          name={fed.name}
                          count={fed.subs.length}
                          approvedCount={approvedCount}
                          reviewCount={reviewCount}
                          onClick={() => {
                            setSelectedFederationId(fed.id);
                            setFilter("all");
                            setSearch("");
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </Card>
            </>
          ) : isMinistry && selectedFederationId !== null && selectedApexId === null ? (
            <>
              <button
                onClick={() => setSelectedFederationId(null)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group mb-2"
              >
                <ChevronLeft className="size-4" /> {t("submissions.backToFederations")}
              </button>

              <Card
                title={t("submissions.selectApex")}
                subtitle={t("submissions.apexesUnder", { name: selectedFederationId })}
              >
                {apexGroups.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Network className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm font-semibold">{t("submissions.noApexesSubmissions")}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {apexGroups.map((apex) => {
                      const approvedCount = apex.subs.filter((s) => s.status === "approved").length;
                      const reviewCount = apex.subs.filter((s) =>
                        [
                          "submitted",
                          "in_review",
                          "apex_review",
                          "federation_review",
                          "ministry_review",
                        ].includes(s.status),
                      ).length;
                      return (
                        <OrgCard
                          key={apex.id}
                          name={apex.name}
                          count={apex.subs.length}
                          approvedCount={approvedCount}
                          reviewCount={reviewCount}
                          onClick={() => {
                            setSelectedApexId(apex.id);
                            setFilter("all");
                            setSearch("");
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </Card>
            </>
          ) : isMinistry &&
            selectedFederationId !== null &&
            selectedApexId !== null &&
            selectedCoopId === null ? (
            <>
              <button
                onClick={() => setSelectedApexId(null)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group mb-2"
              >
                <ChevronLeft className="size-4" /> {t("submissions.backToApexes")}
              </button>

              <Card
                title={t("submissions.selectCooperative")}
                subtitle={t("submissions.cooperativesUnder", { name: selectedApexId })}
              >
                {coopGroups.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Building2 className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm font-semibold">
                      {t("submissions.noCooperativesSubmissions")}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {coopGroups.map((coop) => {
                      const approvedCount = coop.subs.filter((s) => s.status === "approved").length;
                      const reviewCount = coop.subs.filter((s) =>
                        [
                          "submitted",
                          "in_review",
                          "apex_review",
                          "federation_review",
                          "ministry_review",
                        ].includes(s.status),
                      ).length;
                      return (
                        <OrgCard
                          key={coop.id}
                          name={coop.name}
                          count={coop.subs.length}
                          approvedCount={approvedCount}
                          reviewCount={reviewCount}
                          onClick={() => {
                            setSelectedCoopId(coop.id);
                            setFilter("all");
                            setSearch("");
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </Card>
            </>
          ) : isFederation && selectedApexId === null ? (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  icon={Building2}
                  label={t("submissions.apexes")}
                  value={apexGroups.length.toString()}
                  subtitle={t("submissions.underYourFederation")}
                  tone="primary"
                />
                <StatCard
                  icon={Inbox}
                  label={t("submissions.totalSubmissions")}
                  value={allSubmissions.length.toString()}
                  subtitle={t("submissions.allDataReturns")}
                  tone="info"
                />
                <StatCard
                  icon={CheckCircle2}
                  label={t("submissions.approved")}
                  value={(allSubmissions as SubmissionWithName[])
                    .filter((s) => s.status === "approved")
                    .length.toString()}
                  subtitle={t("submissions.finalizedDeclarations")}
                  tone="success"
                />
                <StatCard
                  icon={Clock}
                  label={t("submissions.inReview")}
                  value={(allSubmissions as SubmissionWithName[])
                    .filter((s) =>
                      [
                        "submitted",
                        "in_review",
                        "apex_review",
                        "federation_review",
                        "ministry_review",
                      ].includes(s.status),
                    )
                    .length.toString()}
                  subtitle={t("submissions.awaitingValidation")}
                  tone="warning"
                />
              </div>

              <Card
                title={t("submissions.selectApex")}
                subtitle={t("submissions.chooseApexSubtitle")}
              >
                {isLoading ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Loader2 className="size-6 mx-auto mb-2 animate-spin text-muted-foreground/50" />
                    <p className="text-xs">{t("submissions.loadingApexes")}</p>
                  </div>
                ) : isError ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <AlertCircle className="size-8 mx-auto mb-2 text-destructive/50" />
                    <p className="text-sm font-semibold">{t("submissions.failedLoad")}</p>
                    <p className="text-xs mt-1 text-muted-foreground">
                      {error instanceof Error ? error.message : "Unknown error"}
                    </p>
                  </div>
                ) : apexGroups.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Building2 className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm font-semibold">{t("submissions.noApexesSubmissions")}</p>
                    <p className="text-xs mt-1">{t("submissions.submissionsAppearApexForward")}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {apexGroups.map((apex) => {
                      const approvedCount = apex.subs.filter((s) => s.status === "approved").length;
                      const reviewCount = apex.subs.filter((s) =>
                        [
                          "submitted",
                          "in_review",
                          "apex_review",
                          "federation_review",
                          "ministry_review",
                        ].includes(s.status),
                      ).length;
                      return (
                        <OrgCard
                          key={apex.id}
                          name={apex.name}
                          count={apex.subs.length}
                          approvedCount={approvedCount}
                          reviewCount={reviewCount}
                          onClick={() => {
                            setSelectedApexId(apex.id);
                            setFilter("all");
                            setSearch("");
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </Card>
            </>
          ) : isFederation && selectedApexId !== null && selectedCoopId === null ? (
            <>
              <button
                onClick={() => setSelectedApexId(null)}
                className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group mb-2"
              >
                <ChevronLeft className="size-4" /> {t("submissions.backToApexes")}
              </button>

              <Card
                title={t("submissions.selectCooperative")}
                subtitle={t("submissions.cooperativesUnder", { name: selectedApexId })}
              >
                {coopGroups.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Building2 className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm font-semibold">
                      {t("submissions.noCooperativesSubmissions")}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {coopGroups.map((coop) => {
                      const approvedCount = coop.subs.filter((s) => s.status === "approved").length;
                      const reviewCount = coop.subs.filter((s) =>
                        [
                          "submitted",
                          "in_review",
                          "apex_review",
                          "federation_review",
                          "ministry_review",
                        ].includes(s.status),
                      ).length;
                      return (
                        <OrgCard
                          key={coop.id}
                          name={coop.name}
                          count={coop.subs.length}
                          approvedCount={approvedCount}
                          reviewCount={reviewCount}
                          onClick={() => {
                            setSelectedCoopId(coop.id);
                            setFilter("all");
                            setSearch("");
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </Card>
            </>
          ) : isApex && selectedCoopId === null ? (
            <>
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  icon={Building2}
                  label={t("submissions.cooperatives")}
                  value={coopGroups.length.toString()}
                  subtitle={t("submissions.underYourManagement")}
                  tone="primary"
                />
                <StatCard
                  icon={Inbox}
                  label={t("submissions.totalSubmissions")}
                  value={allSubmissions.length.toString()}
                  subtitle={t("submissions.allDataReturns")}
                  tone="info"
                />
                <StatCard
                  icon={CheckCircle2}
                  label={t("submissions.approved")}
                  value={(allSubmissions as SubmissionWithName[])
                    .filter((s) => s.status === "approved")
                    .length.toString()}
                  subtitle={t("submissions.finalizedDeclarations")}
                  tone="success"
                />
                <StatCard
                  icon={Clock}
                  label={t("submissions.inReview")}
                  value={(allSubmissions as SubmissionWithName[])
                    .filter((s) =>
                      [
                        "submitted",
                        "in_review",
                        "apex_review",
                        "federation_review",
                        "ministry_review",
                      ].includes(s.status),
                    )
                    .length.toString()}
                  subtitle={t("submissions.awaitingValidation")}
                  tone="warning"
                />
              </div>

              <Card
                title={t("submissions.selectCooperative")}
                subtitle={t("submissions.chooseCooperativeSubtitle")}
              >
                {isLoading ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Loader2 className="size-6 mx-auto mb-2 animate-spin text-muted-foreground/50" />
                    <p className="text-xs">{t("submissions.loadingCooperatives")}</p>
                  </div>
                ) : isError ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <AlertCircle className="size-8 mx-auto mb-2 text-destructive/50" />
                    <p className="text-sm font-semibold">{t("submissions.failedLoad")}</p>
                    <p className="text-xs mt-1 text-muted-foreground">
                      {error instanceof Error ? error.message : "Unknown error"}
                    </p>
                  </div>
                ) : coopGroups.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Building2 className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm font-semibold">
                      {t("submissions.noCooperativesSubmissions")}
                    </p>
                    <p className="text-xs mt-1">{t("submissions.submissionsAppearCoopCreate")}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {coopGroups.map((coop) => {
                      const approvedCount = coop.subs.filter((s) => s.status === "approved").length;
                      const reviewCount = coop.subs.filter((s) =>
                        [
                          "submitted",
                          "in_review",
                          "apex_review",
                          "federation_review",
                          "ministry_review",
                        ].includes(s.status),
                      ).length;
                      return (
                        <OrgCard
                          key={coop.id}
                          name={coop.name}
                          count={coop.subs.length}
                          approvedCount={approvedCount}
                          reviewCount={reviewCount}
                          onClick={() => {
                            setSelectedCoopId(coop.id);
                            setFilter("all");
                            setSearch("");
                          }}
                        />
                      );
                    })}
                  </div>
                )}
              </Card>
            </>
          ) : (
            <>
              {isApex && selectedCoopId !== null && (
                <button
                  onClick={() => setSelectedCoopId(null)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group mb-2"
                >
                  <ChevronLeft className="size-4" /> {t("submissions.backToCooperatives")}
                </button>
              )}
              {isFederation && selectedCoopId !== null && (
                <button
                  onClick={() => setSelectedCoopId(null)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group mb-2"
                >
                  <ChevronLeft className="size-4" /> {t("submissions.backToCooperatives")}
                </button>
              )}
              {isMinistry && selectedCoopId !== null && (
                <button
                  onClick={() => setSelectedCoopId(null)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group mb-2"
                >
                  <ChevronLeft className="size-4" /> {t("submissions.backToCooperatives")}
                </button>
              )}

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  icon={Inbox}
                  label={t("submissions.totalSubmissions")}
                  value={counts.total.toString()}
                  subtitle={t("submissions.allDataReturns")}
                  tone="primary"
                />
                <StatCard
                  icon={CheckCircle2}
                  label={t("submissions.approved")}
                  value={counts.approved.toString()}
                  subtitle={t("submissions.finalizedDeclarations")}
                  tone="success"
                />
                <StatCard
                  icon={Clock}
                  label={t("submissions.inReview")}
                  value={counts.submitted.toString()}
                  subtitle={t("submissions.awaitingValidation")}
                  tone="warning"
                />
                <StatCard
                  icon={XCircle}
                  label={t("submissions.rejected")}
                  value={counts.rejected.toString()}
                  subtitle={t("submissions.requiresCorrection")}
                  tone="danger"
                />
              </div>

              <SubmissionTable
                submissions={filtered}
                isLoading={isLoading}
                isError={isError}
                error={error}
                filter={filter}
                setFilter={setFilter}
                search={search}
                setSearch={setSearch}
                counts={counts}
                onRowClick={(id) => navigate({ to: "/app/submissions/$id", params: { id } })}
                showCoopColumn={showCoopColumn}
                onExport={() => toast.success(t("submissions.exportingToast"))}
              />
            </>
          )}
        </div>
      </AppShell>
    </>
  );
};
