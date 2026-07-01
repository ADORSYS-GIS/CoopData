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
} from "lucide-react";
import { AppShell, Card, StatusPill, StatCard } from "@/components/app-shell";
import { SUBMISSIONS as INITIAL_SUBMISSIONS } from "@/lib/mock-data";
import { useUserRole } from "@/lib/auth";
import { useState } from "react";
import { toast } from "sonner";

type Submission = (typeof INITIAL_SUBMISSIONS)[0];
type FilterType = "all" | "verified" | "pending" | "rejected" | "forwarded";

export const SubmissionsPage: React.FC = () => {
  const role = useUserRole();
  if (!role) return null;
  const navigate = useNavigate();
  const [submissionsList] = useState<Submission[]>(INITIAL_SUBMISSIONS);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  const canValidate = role === "federation" || role === "apex" || role === "ministry";

  const titleByRole: Record<string, string> = {
    ministry: "Submissions — National Oversight",
    federation: "Submissions — Federation Review",
    apex: "Submissions — Apex Review",
    cooperative: "My Submissions",
  };
  const subtitleByRole: Record<string, string> = {
    ministry: "National submission oversight · monitor all inbound data returns across the country",
    federation: "Review and validate submissions forwarded from apex organizations",
    apex: "Review and validate submissions from cooperatives under your management",
    cooperative: "Track and manage your cooperative's data submissions",
  };

  const pageTitle = titleByRole[role] || "Submissions";
  const pageSubtitle = subtitleByRole[role] || "Inbound data returns and validation queue";

  const filtered = submissionsList.filter((s) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "verified" && s.status === "Verified") ||
      (filter === "pending" && s.status === "Pending Review") ||
      (filter === "rejected" && (s.status === "Rejected" || s.status === "Resubmit")) ||
      (filter === "forwarded" && s.status === "Verified");
    const matchesSearch =
      !search ||
      s.coopName.toLowerCase().includes(search.toLowerCase()) ||
      s.reference.toLowerCase().includes(search.toLowerCase()) ||
      s.type.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const counts = {
    total: submissionsList.length,
    verified: submissionsList.filter((s) => s.status === "Verified").length,
    pending: submissionsList.filter((s) => s.status === "Pending Review").length,
    rejected: submissionsList.filter((s) => s.status === "Rejected" || s.status === "Resubmit")
      .length,
  };

  return (
    <AppShell title={pageTitle} subtitle={pageSubtitle}>
      <div className="space-y-6">
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

        {/* Submissions Table Card */}
        <Card
          title="Submission Queue"
          subtitle="Real-time inbox · automated routing and validation console"
          action={
            <div className="flex items-center gap-2">
              <button
                onClick={() => toast.success("Exporting submissions registry...")}
                className="press-feedback inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted/50 transition-colors"
              >
                <Download className="size-3.5" /> Export
              </button>
            </div>
          }
        >
          {/* Filters & Search Bar */}
          <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            {/* Status Tabs */}
            <div className="flex flex-wrap gap-1.5 text-xs">
              {(["all", "pending", "verified", "rejected"] as FilterType[]).map((f) => {
                const labels: Record<FilterType, string> = {
                  all: `All (${counts.total})`,
                  pending: `Pending (${counts.pending})`,
                  verified: `Verified (${counts.verified})`,
                  rejected: `Flagged (${counts.rejected})`,
                  forwarded: `Forwarded`,
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
                      className="group hover:bg-muted/30 transition-colors duration-150 cursor-pointer"
                      onClick={() => {
                        navigate({ to: "/app/submissions/$id", params: { id: s.id } });
                      }}
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
                        <span className="inline-flex items-center gap-1 text-xs font-bold text-accent group-hover:underline">
                          {canValidate && s.status === "Pending Review" ? "Review" : "View"}{" "}
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
