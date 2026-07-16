import { useNavigate } from "@tanstack/react-router";
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

function statusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Draft",
    awaiting_coop_validation: "Awaiting Validation",
    submitted: "Submitted",
    in_review: "In Review",
    apex_review: "Apex Review",
    apex_returned: "Returned by Apex",
    federation_review: "Federation Review",
    federation_returned: "Returned by Federation",
    ministry_review: "Ministry Review",
    approved: "Approved",
    rejected: "Rejected",
  };
  return labels[status] ?? status;
}

function NewSubmissionModal({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const createSubmission = useCreateSubmission();

  const handleCreate = async () => {
    try {
      const sub = await createSubmission.mutateAsync({ reporting_year: year });
      toast.success(`Submission for ${year} created`);
      onClose();
      navigate({ to: "/app/submissions/$id", params: { id: sub.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create submission");
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
              <h2 className="text-base font-bold text-foreground">New Submission</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Start a new annual data return</p>
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
            Reporting Year
          </label>
          <div className="grid grid-cols-4 gap-2">
            {[currentYear, currentYear - 1, currentYear - 2, currentYear - 3].map((y) => (
              <button
                key={y}
                onClick={() => setYear(y)}
                className={`rounded-xl border py-3 text-sm font-bold transition-all duration-150 ${
                  year === y
                    ? "border-primary bg-primary text-primary-foreground shadow-sm"
                    : "border-border bg-muted/30 text-foreground hover:border-primary/40 hover:bg-muted/60"
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-border bg-transparent px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
          >
            Cancel
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
            Create Submission
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
        {count} submission{count !== 1 ? "s" : ""}
      </p>
      <div className="flex items-center flex-wrap gap-x-3 gap-y-1.5 text-[11px] font-semibold border-t border-border/60 pt-3">
        {reviewCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-warning-foreground">
            <span className="size-1.5 rounded-full bg-warning animate-pulse" />
            {reviewCount} in review
          </span>
        )}
        {approvedCount > 0 && (
          <span className="inline-flex items-center gap-1.5 text-success">
            <span className="size-1.5 rounded-full bg-success" />
            {approvedCount} approved
          </span>
        )}
        {reviewCount === 0 && approvedCount === 0 && (
          <span className="inline-flex items-center gap-1.5 text-muted-foreground/60">
            <span className="size-1.5 rounded-full bg-muted-foreground/40" />
            No activity
          </span>
        )}
      </div>
    </button>
  );
}

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
  const canValidate = true;

  return (
    <Card
      title="Submission Queue"
      subtitle="Real-time inbox · track every submission through the review pipeline"
      action={
        <button
          onClick={onExport}
          className="press-feedback inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 transition-colors"
        >
          <Download className="size-3.5" /> Export
        </button>
      }
    >
      <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Segmented filter control */}
        <div className="inline-flex items-center gap-0.5 bg-muted/50 rounded-xl p-1 border border-border/60">
          {(
            [
              ["all", `All (${counts.total})`],
              ["draft", `Draft (${counts.draft})`],
              ["submitted", `In Review (${counts.submitted})`],
              ["approved", `Approved (${counts.approved})`],
              ["rejected", `Rejected (${counts.rejected})`],
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
            placeholder="Search by reference or year…"
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
              <th className="px-5 py-3.5">Reference</th>
              {showCoopColumn && <th className="px-5 py-3.5 hidden md:table-cell">Cooperative</th>}
              <th className="px-5 py-3.5">Year</th>
              <th className="px-5 py-3.5 hidden md:table-cell">Tier</th>
              <th className="px-5 py-3.5 hidden lg:table-cell">Created</th>
              <th className="px-5 py-3.5">Priority</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Action</th>
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
                  <p className="text-xs font-medium">Loading submissions…</p>
                </td>
              </tr>
            ) : isError ? (
              <tr>
                <td
                  colSpan={showCoopColumn ? 8 : 7}
                  className="py-16 text-center text-muted-foreground"
                >
                  <AlertCircle className="size-8 mx-auto mb-3 text-destructive/50" />
                  <p className="text-sm font-semibold">Failed to load submissions</p>
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
                  <p className="text-sm font-semibold">No submissions found</p>
                  <p className="text-xs mt-1 text-muted-foreground/70">
                    Adjust the filter or search to see more results.
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
                    <StatusPill tone={statusTone(s.status)}>{statusLabel(s.status)}</StatusPill>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/5 border border-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary opacity-0 group-hover:opacity-100 transition-all duration-150 group-hover:bg-primary/10">
                      {canValidate && s.status !== "draft" ? "Review" : "Open"}
                      <ArrowUpRight className="size-3" />
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export const SubmissionsPage: React.FC = () => {
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
  const federationQ = useFederationSubmissions(role === "federation");
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
    ministry: "Submissions — National Oversight",
    federation: "Submissions — Federation Review",
    apex: "Submissions — Apex Review",
    cooperative: "My Submissions",
  };
  const subtitleByRole: Record<string, string> = {
    ministry: "National submission oversight · monitor all inbound data returns",
    federation: "Review and validate submissions forwarded from apex organizations",
    apex: "Review and validate submissions from cooperatives under your management",
    cooperative: "Track and manage your cooperative's data submissions",
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
        title={titleByRole[role] ?? "Submissions"}
        subtitle={subtitleByRole[role] ?? "Inbound data returns and validation queue"}
        actions={
          isCooperative ? (
            <button
              onClick={() => setShowNewModal(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <Plus className="size-4" /> New Submission
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
                  label="Federations"
                  value={federationGroups.length.toString()}
                  subtitle="Nationwide"
                  tone="primary"
                />
                <StatCard
                  icon={Inbox}
                  label="Total submissions"
                  value={allSubmissions.length.toString()}
                  subtitle="All data returns"
                  tone="info"
                />
                <StatCard
                  icon={CheckCircle2}
                  label="Approved"
                  value={(allSubmissions as SubmissionWithName[])
                    .filter((s) => s.status === "approved")
                    .length.toString()}
                  subtitle="Finalized declarations"
                  tone="success"
                />
                <StatCard
                  icon={Clock}
                  label="In Review"
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
                  subtitle="Awaiting validation"
                  tone="warning"
                />
              </div>

              <Card
                title="Select a Federation"
                subtitle="Choose a federation to view its apex organizations"
              >
                {isLoading ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Loader2 className="size-6 mx-auto mb-2 animate-spin text-muted-foreground/50" />
                    <p className="text-xs">Loading federations…</p>
                  </div>
                ) : isError ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <AlertCircle className="size-8 mx-auto mb-2 text-destructive/50" />
                    <p className="text-sm font-semibold">Failed to load submissions</p>
                    <p className="text-xs mt-1 text-muted-foreground">
                      {error instanceof Error ? error.message : "Unknown error"}
                    </p>
                  </div>
                ) : federationGroups.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Landmark className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm font-semibold">No federations with submissions</p>
                    <p className="text-xs mt-1">
                      Submissions will appear here once federations forward them.
                    </p>
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
                <ChevronLeft className="size-4" /> Back to federations
              </button>

              <Card
                title="Select an Apex"
                subtitle={`Apex organizations under ${selectedFederationId}`}
              >
                {apexGroups.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Network className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm font-semibold">No apexes with submissions</p>
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
                <ChevronLeft className="size-4" /> Back to apexes
              </button>

              <Card title="Select a Cooperative" subtitle={`Cooperatives under ${selectedApexId}`}>
                {coopGroups.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Building2 className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm font-semibold">No cooperatives with submissions</p>
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
                  label="Apexes"
                  value={apexGroups.length.toString()}
                  subtitle="Under your federation"
                  tone="primary"
                />
                <StatCard
                  icon={Inbox}
                  label="Total submissions"
                  value={allSubmissions.length.toString()}
                  subtitle="All data returns"
                  tone="info"
                />
                <StatCard
                  icon={CheckCircle2}
                  label="Approved"
                  value={(allSubmissions as SubmissionWithName[])
                    .filter((s) => s.status === "approved")
                    .length.toString()}
                  subtitle="Finalized declarations"
                  tone="success"
                />
                <StatCard
                  icon={Clock}
                  label="In Review"
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
                  subtitle="Awaiting validation"
                  tone="warning"
                />
              </div>

              <Card
                title="Select an Apex"
                subtitle="Choose an apex organization to view its cooperatives"
              >
                {isLoading ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Loader2 className="size-6 mx-auto mb-2 animate-spin text-muted-foreground/50" />
                    <p className="text-xs">Loading apexes…</p>
                  </div>
                ) : isError ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <AlertCircle className="size-8 mx-auto mb-2 text-destructive/50" />
                    <p className="text-sm font-semibold">Failed to load submissions</p>
                    <p className="text-xs mt-1 text-muted-foreground">
                      {error instanceof Error ? error.message : "Unknown error"}
                    </p>
                  </div>
                ) : apexGroups.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Building2 className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm font-semibold">No apexes with submissions</p>
                    <p className="text-xs mt-1">
                      Submissions will appear here once apexes forward them.
                    </p>
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
                <ChevronLeft className="size-4" /> Back to apexes
              </button>

              <Card title="Select a Cooperative" subtitle={`Cooperatives under ${selectedApexId}`}>
                {coopGroups.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Building2 className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm font-semibold">No cooperatives with submissions</p>
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
                  label="Cooperatives"
                  value={coopGroups.length.toString()}
                  subtitle="Under your management"
                  tone="primary"
                />
                <StatCard
                  icon={Inbox}
                  label="Total submissions"
                  value={allSubmissions.length.toString()}
                  subtitle="All data returns"
                  tone="info"
                />
                <StatCard
                  icon={CheckCircle2}
                  label="Approved"
                  value={(allSubmissions as SubmissionWithName[])
                    .filter((s) => s.status === "approved")
                    .length.toString()}
                  subtitle="Finalized declarations"
                  tone="success"
                />
                <StatCard
                  icon={Clock}
                  label="In Review"
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
                  subtitle="Awaiting validation"
                  tone="warning"
                />
              </div>

              <Card
                title="Select a Cooperative"
                subtitle="Choose a cooperative to view its submissions"
              >
                {isLoading ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Loader2 className="size-6 mx-auto mb-2 animate-spin text-muted-foreground/50" />
                    <p className="text-xs">Loading cooperatives…</p>
                  </div>
                ) : isError ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <AlertCircle className="size-8 mx-auto mb-2 text-destructive/50" />
                    <p className="text-sm font-semibold">Failed to load submissions</p>
                    <p className="text-xs mt-1 text-muted-foreground">
                      {error instanceof Error ? error.message : "Unknown error"}
                    </p>
                  </div>
                ) : coopGroups.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <Building2 className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p className="text-sm font-semibold">No cooperatives with submissions</p>
                    <p className="text-xs mt-1">
                      Submissions will appear here once cooperatives create them.
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
          ) : (
            <>
              {isApex && selectedCoopId !== null && (
                <button
                  onClick={() => setSelectedCoopId(null)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group mb-2"
                >
                  <ChevronLeft className="size-4" /> Back to cooperatives
                </button>
              )}
              {isFederation && selectedCoopId !== null && (
                <button
                  onClick={() => setSelectedCoopId(null)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group mb-2"
                >
                  <ChevronLeft className="size-4" /> Back to cooperatives
                </button>
              )}
              {isMinistry && selectedCoopId !== null && (
                <button
                  onClick={() => setSelectedCoopId(null)}
                  className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group mb-2"
                >
                  <ChevronLeft className="size-4" /> Back to cooperatives
                </button>
              )}

              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                <StatCard
                  icon={Inbox}
                  label="Total submissions"
                  value={counts.total.toString()}
                  subtitle="All data returns"
                  tone="primary"
                />
                <StatCard
                  icon={CheckCircle2}
                  label="Approved"
                  value={counts.approved.toString()}
                  subtitle="Finalized declarations"
                  tone="success"
                />
                <StatCard
                  icon={Clock}
                  label="In Review"
                  value={counts.submitted.toString()}
                  subtitle="Awaiting validation"
                  tone="warning"
                />
                <StatCard
                  icon={XCircle}
                  label="Rejected"
                  value={counts.rejected.toString()}
                  subtitle="Requires correction"
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
                onExport={() => toast.success("Exporting submissions registry…")}
              />
            </>
          )}
        </div>
      </AppShell>
    </>
  );
};
