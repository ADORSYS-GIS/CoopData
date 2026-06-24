import { createFileRoute } from "@tanstack/react-router";
import {
  Inbox,
  Download,
  CheckCircle2,
  Clock,
  XCircle,
  RefreshCw,
  Search,
  AlertTriangle,
  X,
  FileText,
  ChevronRight,
} from "lucide-react";
import { AppShell, Card, StatusPill, StatCard } from "@/components/app-shell";
import { SUBMISSIONS as INITIAL_SUBMISSIONS } from "@/lib/mock-data";
import { useAuth } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/submissions")({
  head: () => ({ meta: [{ title: "Submissions — CoopData" }] }),
  component: SubmissionsPage,
});

type Submission = (typeof INITIAL_SUBMISSIONS)[0];
type FilterType = "all" | "verified" | "pending" | "rejected";

function SubmissionsPage() {
  const { role } = useAuth();
  const [submissionsList, setSubmissionsList] = useState<Submission[]>(INITIAL_SUBMISSIONS);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const [reviewingSub, setReviewingSub] = useState<Submission | null>(null);

  const isReadOnly = false; // Read-only access can be granted to ministry users via settings
  const canValidate = role === "federation" || role === "regional_officer" || role === "ministry";

  const filtered = submissionsList.filter((s) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "verified" && s.status === "Verified") ||
      (filter === "pending" && s.status === "Pending Review") ||
      (filter === "rejected" && (s.status === "Rejected" || s.status === "Resubmit"));
    const matchesSearch =
      !search ||
      s.coopName.toLowerCase().includes(search.toLowerCase()) ||
      s.reference.toLowerCase().includes(search.toLowerCase()) ||
      s.type.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleReviewAction = (status: "Verified" | "Rejected" | "Resubmit") => {
    if (!reviewingSub) return;
    setSubmissionsList((prev) =>
      prev.map((s) => (s.id === reviewingSub.id ? { ...s, status } : s)),
    );
    toast.success(`Submission ${reviewingSub.reference} → ${status.toUpperCase()}`);
    setReviewingSub(null);
  };

  const counts = {
    total: submissionsList.length,
    verified: submissionsList.filter((s) => s.status === "Verified").length,
    pending: submissionsList.filter((s) => s.status === "Pending Review").length,
    rejected: submissionsList.filter((s) => s.status === "Rejected" || s.status === "Resubmit")
      .length,
  };

  return (
    <AppShell
      title="Submissions"
      subtitle="Inbound data returns from cooperatives and field collectors · real-time validation queue"
    >
      <div className="space-y-6">
        {/* Audit read-only banner */}
        {isReadOnly && (
          <div className="flex items-center gap-3 rounded-xl border border-warning/50 bg-warning/10 px-4 py-3 text-xs font-semibold text-warning-foreground">
            <AlertTriangle className="size-4 shrink-0" />
            AUDIT MODE — Interactive validation is locked. Data is read-only.
          </div>
        )}

        {/* KPI Stats Row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={Inbox}
            label="Total submissions"
            value={counts.total.toString()}
            subtitle="All inbound returns"
            tone="primary"
          />
          <StatCard
            icon={CheckCircle2}
            label="Verified"
            value={counts.verified.toString()}
            subtitle="Approved declarations"
            tone="success"
          />
          <StatCard
            icon={Clock}
            label="Pending Review"
            value={counts.pending.toString()}
            subtitle="Awaiting validation"
            tone="warning"
          />
          <StatCard
            icon={XCircle}
            label="Rejected / Changes"
            value={counts.rejected.toString()}
            subtitle="Flagged or resubmit"
            tone="danger"
          />
        </div>

        {/* Review Panel — appears when selecting a submission */}
        {reviewingSub && (
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-5 space-y-4 shadow-[var(--shadow-elev-2)]">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-1">
                  {reviewingSub.reference}
                </p>
                <h3 className="font-heading text-base font-bold text-foreground">
                  Reviewing: {reviewingSub.coopName}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {reviewingSub.type} · Filed {reviewingSub.submittedOn}
                </p>
              </div>
              <button
                onClick={() => setReviewingSub(null)}
                className="press-feedback rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="grid md:grid-cols-3 gap-4 rounded-xl bg-surface border border-border p-4">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                  Type
                </p>
                <p className="text-sm font-semibold text-foreground">{reviewingSub.type}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                  Filed By
                </p>
                <p className="text-sm font-semibold text-foreground">{reviewingSub.submittedBy}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
                  Timestamp
                </p>
                <p className="text-sm font-semibold text-foreground">{reviewingSub.submittedOn}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
              <button
                onClick={() => handleReviewAction("Verified")}
                className="press-feedback inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2 text-xs font-bold text-white hover:bg-success/90 transition-colors"
              >
                <CheckCircle2 className="size-3.5" /> Approve Return
              </button>
              <button
                onClick={() => handleReviewAction("Resubmit")}
                className="press-feedback inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-xs font-bold text-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw className="size-3.5" /> Request Re-submission
              </button>
              <button
                onClick={() => handleReviewAction("Rejected")}
                className="press-feedback inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-xs font-bold text-white hover:bg-destructive/90 transition-colors"
              >
                <XCircle className="size-3.5" /> Reject Declaration
              </button>
            </div>
          </div>
        )}

        {/* Submissions Table Card */}
        <Card
          title="Submission Queue"
          subtitle="Real-time inbox · automated routing and validation console"
          action={
            <button
              onClick={() => toast.success("Exporting submissions registry...")}
              className="press-feedback inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 transition-colors"
            >
              <Download className="size-3.5" /> Export
            </button>
          }
        >
          {/* Filters & Search Bar */}
          <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Status Tabs */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              {(["all", "verified", "pending", "rejected"] as FilterType[]).map((f) => {
                const labels: Record<FilterType, string> = {
                  all: `All (${counts.total})`,
                  verified: `Verified (${counts.verified})`,
                  pending: `Pending (${counts.pending})`,
                  rejected: `Flagged (${counts.rejected})`,
                };
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`press-feedback rounded-lg border px-3 py-1.5 font-bold transition-all ${
                      filter === f
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-border bg-surface text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {labels[f]}
                  </button>
                );
              })}
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search submissions…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-lg border border-input bg-muted/40 py-1.5 pl-9 pr-3 text-xs transition-all focus:border-ring focus:bg-surface focus:ring-2 focus:ring-ring/10 focus:outline-none"
              />
            </div>
          </div>

          {/* Table */}
          <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-left">
                  <th className="px-5 py-3">Reference</th>
                  <th className="px-5 py-3">Cooperative</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3 hidden md:table-cell">Filed By</th>
                  <th className="px-5 py-3 hidden lg:table-cell">Date</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-muted-foreground">
                      <FileText className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm font-semibold">No submissions match this filter</p>
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr
                      key={s.id}
                      className="group hover:bg-muted/30 transition-colors duration-150"
                    >
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                        {s.reference}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-foreground">{s.coopName}</p>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs">{s.type}</td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs hidden md:table-cell">
                        {s.submittedBy}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs hidden lg:table-cell">
                        {s.submittedOn}
                      </td>
                      <td className="px-5 py-3.5">
                        <span
                          className={`inline-block text-xs font-bold ${
                            s.priority === "Urgent"
                              ? "text-destructive"
                              : s.priority === "Quarterly"
                                ? "text-accent"
                                : "text-muted-foreground"
                          }`}
                        >
                          {s.priority === "Urgent" && "⚡ "}
                          {s.priority}
                        </span>
                      </td>
                      <td className="px-5 py-3.5">
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
                      <td className="px-5 py-3.5 text-right">
                        {canValidate && s.status === "Pending Review" ? (
                          <button
                            onClick={() => setReviewingSub(s)}
                            className="press-feedback inline-flex items-center gap-1 text-xs font-bold text-accent hover:underline"
                          >
                            Review <ChevronRight className="size-3" />
                          </button>
                        ) : isReadOnly ? (
                          <span className="text-xs text-muted-foreground italic">Audit View</span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
