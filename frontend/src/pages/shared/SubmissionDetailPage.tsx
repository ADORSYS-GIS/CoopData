import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Clock, FileText, Calendar, Hash, Loader2, AlertCircle } from "lucide-react";
import { AppShell, Card, StatusPill } from "@/components/app-shell";
import { useUserRole } from "@/lib/auth";
import { useSubmission } from "@/hooks/submissions/useSubmissions";
import { useExtractionJob } from "@/hooks/submissions/useExtractionJob";
import { FinancialStatementEditor } from "@/pages/cooperative/FinancialStatementEditor";

function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  const map: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
    approved: "success",
    submitted: "warning",
    apex_review: "warning",
    awaiting_coop_validation: "warning",
    federation_review: "warning",
    ministry_review: "warning",
    rejected: "danger",
    draft: "neutral",
  };
  return map[status] ?? "info";
}

function statusLabel(s: string) {
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
  return labels[s] ?? s;
}

export const SubmissionDetailPage: React.FC = () => {
  const role = useUserRole();
  const { id } = useParams({ from: "/app/submissions_/$id" });

  const { data: submission, isLoading, isError, error } = useSubmission(id ?? "");

  // Poll extraction job if one is attached
  const { data: extractionJob } = useExtractionJob(submission?.extraction_job_id ?? null);

  const isExtracting =
    extractionJob && !["succeeded", "failed", "partial"].includes(extractionJob.status);

  if (!role) return null;

  return (
    <AppShell
      title="Submission Detail"
      subtitle="Review extracted data, validate, and submit to Apex"
    >
      <div className="mb-4">
        <Link
          to="/app/submissions"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" /> Back to Submissions
        </Link>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="size-6 animate-spin mr-2" />
          Loading submission…
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-5">
          <AlertCircle className="size-5 text-destructive shrink-0" />
          <p className="text-sm">
            {error instanceof Error ? error.message : "Failed to load submission"}
          </p>
        </div>
      )}

      {submission && (
        <div className="space-y-5">
          {/* Header */}
          <Card
            title={submission.reference ?? submission.id.slice(0, 8).toUpperCase()}
            subtitle={`Reporting year ${submission.reporting_year} · ${submission.current_tier} tier`}
            action={
              <StatusPill tone={statusTone(submission.status)}>
                {statusLabel(submission.status)}
              </StatusPill>
            }
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <Calendar className="size-3.5 shrink-0" />
                {new Date(submission.created_at).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-2 font-mono">
                <Hash className="size-3.5 shrink-0" />
                {submission.id.slice(0, 8)}
              </div>
              <div className="flex items-center gap-2">
                <Clock className="size-3.5 shrink-0" />
                {submission.priority}
              </div>
              <div className="flex items-center gap-2">
                <FileText className="size-3.5 shrink-0" />
                <span className="capitalize">{submission.current_tier}</span>
              </div>
            </div>
          </Card>

          {/* Extraction in progress banner */}
          {isExtracting && (
            <div className="flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
              <Loader2 className="size-4 animate-spin text-accent shrink-0" />
              <div>
                <p className="text-sm font-semibold">
                  AI extraction in progress
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    Status: {extractionJob?.status}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Parsing and mapping your document to the Chart of Accounts. Usually takes 5–15
                  seconds.
                </p>
              </div>
            </div>
          )}

          {/* Grid editor — shown when FS is attached and role is cooperative */}
          {submission.financial_statement_id && role === "cooperative" && (
            <FinancialStatementEditor
              fsId={submission.financial_statement_id}
              submissionId={submission.id}
            />
          )}

          {/* No financial statement yet */}
          {!submission.financial_statement_id && !isExtracting && role === "cooperative" && (
            <Card title="Financial Statement" subtitle="No document uploaded yet">
              <div className="py-10 text-center text-muted-foreground">
                <FileText className="size-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">
                  Upload a financial statement from the Data Collection page to begin AI extraction.
                </p>
              </div>
            </Card>
          )}

          {/* Review roles — read-only view */}
          {submission.financial_statement_id && role !== "cooperative" && (
            <FinancialStatementEditor
              fsId={submission.financial_statement_id}
              submissionId={submission.id}
            />
          )}
        </div>
      )}
    </AppShell>
  );
};
