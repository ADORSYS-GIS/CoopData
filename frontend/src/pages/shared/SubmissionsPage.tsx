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
  Loader2,
  AlertCircle,
} from "lucide-react";
import { AppShell, Card, StatusPill, StatCard } from "@/components/app-shell";
import { useUserRole } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";
import { useCooperativeSubmissions } from "@/hooks/submissions/useSubmissions";
import type { SubmissionResponse } from "@/hooks/submissions/useSubmissions";

type FilterType = "all" | "draft" | "submitted" | "approved" | "rejected";

function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  switch (status) {
    case "approved":
      return "success";
    case "awaiting_coop_validation":
    case "submitted":
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

export const SubmissionsPage: React.FC = () => {
  const role = useUserRole();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  // Only cooperative role uses real data for now; other roles still see their queue
  const isCooperative = role === "cooperative";
  const { data: submissions = [], isLoading, isError, error } = useCooperativeSubmissions();

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

  const filtered = submissions.filter((s: SubmissionResponse) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "draft" && s.status === "draft") ||
      (filter === "submitted" &&
        ["submitted", "apex_review", "federation_review", "ministry_review"].includes(s.status)) ||
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
    draft: submissions.filter((s: SubmissionResponse) => s.status === "draft").length,
    submitted: submissions.filter((s: SubmissionResponse) =>
      ["submitted", "apex_review", "federation_review", "ministry_review"].includes(s.status),
    ).length,
    approved: submissions.filter((s: SubmissionResponse) => s.status === "approved").length,
    rejected: submissions.filter((s: SubmissionResponse) => s.status === "rejected").length,
  };

  return (
    <AppShell
      title={titleByRole[role] ?? "Submissions"}
      subtitle={subtitleByRole[role] ?? "Inbound data returns and validation queue"}
    >
      <div className="space-y-6">
        {/* KPI Stats Row */}
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

        {/* Submissions Table */}
        <Card
          title="Submission Queue"
          subtitle="Real-time inbox · track every submission through the review pipeline"
          action={
            <button
              onClick={() => toast.success("Exporting submissions registry…")}
              className="press-feedback inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 transition-colors"
            >
              <Download className="size-3.5" /> Export
            </button>
          }
        >
          {/* Filters & Search */}
          <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5 text-xs">
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
                  className={`press-feedback rounded-lg border px-3 py-1.5 font-bold transition-all ${
                    filter === f
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-surface text-muted-foreground hover:bg-muted/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

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
                  <th className="px-5 py-3">Reporting Year</th>
                  <th className="px-5 py-3 hidden md:table-cell">Tier</th>
                  <th className="px-5 py-3 hidden lg:table-cell">Created</th>
                  <th className="px-5 py-3">Priority</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <Loader2 className="size-6 mx-auto mb-2 animate-spin text-muted-foreground/50" />
                      <p className="text-xs">Loading submissions…</p>
                    </td>
                  </tr>
                ) : isError ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <AlertCircle className="size-8 mx-auto mb-2 text-destructive/50" />
                      <p className="text-sm font-semibold">Failed to load submissions</p>
                      <p className="text-xs mt-1 text-muted-foreground">
                        {error instanceof Error ? error.message : "Unknown error"}
                      </p>
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-muted-foreground">
                      <FileText className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                      <p className="text-sm font-semibold">No submissions found</p>
                      {isCooperative && counts.total === 0 && (
                        <p className="text-xs mt-1">
                          Go to Data Collection to create your first submission.
                        </p>
                      )}
                    </td>
                  </tr>
                ) : (
                  filtered.map((s: SubmissionResponse) => (
                    <tr
                      key={s.id}
                      className="group hover:bg-muted/30 transition-colors duration-150 cursor-pointer"
                      onClick={() => navigate({ to: "/app/submissions/$id", params: { id: s.id } })}
                    >
                      <td className="px-5 py-3.5 font-mono text-xs text-muted-foreground">
                        {s.reference ?? s.id.slice(0, 8).toUpperCase()}
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-foreground">{s.reporting_year}</p>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs hidden md:table-cell capitalize">
                        {s.current_tier}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground text-xs hidden lg:table-cell">
                        {new Date(s.created_at).toLocaleDateString()}
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
                        <StatusPill tone={statusTone(s.status)}>{statusLabel(s.status)}</StatusPill>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-accent group-hover:underline">
                          {canValidate && s.status !== "draft" ? "Review" : "View"}{" "}
                          <ChevronRight className="size-3" />
                        </span>
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
};
