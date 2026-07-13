import { Link, useParams, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Clock,
  FileText,
  Calendar,
  Hash,
  Loader2,
  AlertCircle,
  BarChart3,
  Database,
  Send,
  Trash2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { AppShell, Card, StatusPill } from "@/components/app-shell";
import { useUserRole } from "@/lib/auth";
import {
  useSubmission,
  useDeleteSubmission,
  useSubmissionReviews,
} from "@/hooks/submissions/useSubmissions";
import {
  useApexApprove,
  useApexReturn,
  useFederationApprove,
  useFederationReturn,
  useMinistryApprove,
  useMinistryReject,
} from "@/hooks/submissions/useReviewSubmissions";
import { useExtractionJob } from "@/hooks/submissions/useExtractionJob";
import {
  useSubmissionSections,
  useUpdateSubmissionSection,
  type SubmissionSectionResponse,
} from "@/hooks/submissions/useSubmissionSections";
import { useSubmitSubmission } from "@/hooks/submissions/useFinancialStatement";
import { FinancialStatementEditor } from "@/pages/cooperative/FinancialStatementEditor";
import { UploadFinancialStatementWidget } from "@/pages/cooperative/UploadFinancialStatement";
import { NfUploadZone } from "@/components/non-financial/NfUploadZone";
import { NfParseResults } from "@/components/non-financial/NfParseResults";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NonFinancialIndicatorsForm } from "@/components/submissions/non-financial-indicators-form";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { NfUploadResponse } from "@/types/non-financial";
import { useMembers } from "@/hooks/non-financial/useMembers";
import { useSavings } from "@/hooks/non-financial/useSavings";
import { useLoans } from "@/hooks/non-financial/useLoans";
import { useFixedDeposits } from "@/hooks/non-financial/useFixedDeposits";
import { useFarmCoops } from "@/hooks/non-financial/useFarmCoop";

// ── Helpers ───────────────────────────────────────────────────────────────────

function statusTone(status: string): "success" | "warning" | "danger" | "info" | "neutral" {
  const map: Record<string, "success" | "warning" | "danger" | "info" | "neutral"> = {
    approved: "success",
    submitted: "warning",
    in_review: "warning",
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
    in_review: "In Review",
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

function sectionStatusTone(status: string): "neutral" | "warning" | "success" {
  return status === "ready" ? "success" : status === "in_progress" ? "warning" : "neutral";
}

function sectionStatusLabel(status: string) {
  return (
    ({ pending: "Pending", in_progress: "In Progress", ready: "Ready" } as Record<string, string>)[
      status
    ] ?? status
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export const SubmissionDetailPage: React.FC = () => {
  const role = useUserRole();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { id } = useParams({ from: "/app/submissions_/$id" });

  const {
    data: submission,
    isLoading,
    isError,
    error,
  } = useSubmission(id ?? "", role ?? undefined);
  const { data: extractionJob } = useExtractionJob(submission?.extraction_job_id ?? null);
  const { data: sections, refetch: refetchSections } = useSubmissionSections(id);
  const submitMutation = useSubmitSubmission();
  const deleteMutation = useDeleteSubmission();
  const apexApprove = useApexApprove();
  const apexReturn = useApexReturn();
  const federationApprove = useFederationApprove();
  const federationReturn = useFederationReturn();
  const ministryApprove = useMinistryApprove();
  const ministryReject = useMinistryReject();
  const [reviewComment, setReviewComment] = useState("");
  const [nfResult, setNfResult] = useState<NfUploadResponse | null>(null);
  const { data: reviews } = useSubmissionReviews(id);

  const isExtracting =
    extractionJob && !["succeeded", "failed", "partial"].includes(extractionJob.status);

  if (!role) return null;

  const isReadOnly = submission ? submission.status !== "draft" || role !== "cooperative" : true;
  const isDraft = submission?.status === "draft";
  const isCooperative = role === "cooperative";
  const allReady = sections?.every((s) => s.status === "ready") ?? false;
  const canSubmit = isDraft && allReady && isCooperative && !isExtracting;

  const handleSubmit = async () => {
    if (!id) return;
    try {
      await submitMutation.mutateAsync(id);
      toast.success("Submission sent to Apex for review");
      navigate({ to: "/app/submissions" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to submit");
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast.success("Draft deleted");
      navigate({ to: "/app/submissions" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to delete");
    }
  };

  const handleReviewAction = async (
    mutation: { mutateAsync: (args: { id: string; comment?: string }) => Promise<unknown> },
    successMsg: string,
  ) => {
    if (!id) return;
    try {
      await mutation.mutateAsync({ id, comment: reviewComment || undefined });
      toast.success(successMsg);
      setReviewComment("");
      queryClient.invalidateQueries({ queryKey: ["cooperative-submissions", id] });
      queryClient.invalidateQueries({ queryKey: ["apex-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["federation-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["ministry-submissions"] });
      navigate({ to: "/app/submissions" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Review action failed");
    }
  };

  const handleNfUploadComplete = (result: NfUploadResponse) => {
    setNfResult(result);
    void refetchSections();
    queryClient.invalidateQueries({ queryKey: ["cooperative-submissions", id] });
    queryClient.invalidateQueries({ queryKey: ["cooperative-submissions"] });
  };

  return (
    <AppShell title="Submission Detail" subtitle="Upload data, validate, and submit to Apex">
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
          <Loader2 className="size-6 animate-spin mr-2" /> Loading submission…
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

          {isExtracting && (
            <div className="flex items-center gap-3 rounded-xl border border-accent/20 bg-accent/5 px-4 py-3">
              <Loader2 className="size-4 animate-spin text-accent shrink-0" />
              <div>
                <p className="text-sm font-semibold">
                  AI extraction in progress{" "}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    Status: {extractionJob?.status}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Parsing and mapping to Chart of Accounts…
                </p>
              </div>
            </div>
          )}

          {isCooperative && isDraft && (
            <div className="rounded-xl border border-border bg-surface px-4 py-3 space-y-3">
              {sections && sections.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {sections.map((s) => (
                    <StatusPill key={s.section} tone={sectionStatusTone(s.status)}>
                      {s.section.replace(/_/g, " ")} — {sectionStatusLabel(s.status)}
                    </StatusPill>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-3">
                <div className="flex-1 flex items-center gap-2 text-sm">
                  {allReady ? (
                    <>
                      <CheckCircle2 className="size-4 text-success" />
                      <span className="font-semibold text-success">
                        All sections ready — you can submit
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="size-4 text-muted-foreground" />
                      <span className="text-muted-foreground">
                        Complete all sections before submitting
                      </span>
                    </>
                  )}
                </div>
                <button
                  onClick={handleSubmit}
                  disabled={!canSubmit || submitMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                >
                  {submitMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                  Submit to Apex
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleteMutation.isPending}
                  className="inline-flex items-center gap-2 rounded-xl border border-destructive/30 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Delete Draft
                </button>
              </div>
            </div>
          )}

          {role === "apex" && submission.status === "submitted" && (
            <ReviewActionPanel
              title="Apex Review"
              description="Approve to forward to federation, or return to cooperative for corrections"
              comment={reviewComment}
              setComment={setReviewComment}
              onApprove={() =>
                handleReviewAction(apexApprove, "Approved and forwarded to federation")
              }
              onReturn={() => handleReviewAction(apexReturn, "Returned to cooperative")}
              approveLabel="Approve & Forward"
              returnLabel="Request Changes"
              isPending={apexApprove.isPending || apexReturn.isPending}
            />
          )}

          {role === "federation" &&
            submission.status === "in_review" &&
            submission.current_tier === "federation" && (
              <ReviewActionPanel
                title="Federation Review"
                description="Approve to forward to ministry, or return to apex for corrections"
                comment={reviewComment}
                setComment={setReviewComment}
                onApprove={() =>
                  handleReviewAction(federationApprove, "Approved and forwarded to ministry")
                }
                onReturn={() => handleReviewAction(federationReturn, "Returned to apex")}
                approveLabel="Approve & Forward"
                returnLabel="Return to Apex"
                isPending={federationApprove.isPending || federationReturn.isPending}
              />
            )}

          {role === "ministry" &&
            submission.status === "in_review" &&
            submission.current_tier === "ministry" && (
              <ReviewActionPanel
                title="Ministry Review"
                description="Approve to finalize, or reject this submission"
                comment={reviewComment}
                setComment={setReviewComment}
                onApprove={() => handleReviewAction(ministryApprove, "Submission approved")}
                onReject={() => handleReviewAction(ministryReject, "Submission rejected")}
                approveLabel="Approve"
                rejectLabel="Reject"
                isPending={ministryApprove.isPending || ministryReject.isPending}
              />
            )}

          {reviews && reviews.length > 0 && (
            <Card title="Review History" subtitle="Comments and actions from all review tiers">
              <div className="space-y-3">
                {reviews.map((r) => (
                  <div
                    key={r.id}
                    className="flex gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5"
                  >
                    <div className="shrink-0 mt-0.5">
                      {r.action === "approve" ? (
                        <CheckCircle2 className="size-4 text-success" />
                      ) : r.action === "reject" ? (
                        <XCircle className="size-4 text-destructive" />
                      ) : (
                        <ArrowLeft className="size-4 text-warning" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="font-semibold capitalize">{r.action}</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground capitalize">{r.tier} tier</span>
                        <span className="text-muted-foreground">·</span>
                        <span className="text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </span>
                      </div>
                      {r.comment && <p className="mt-1 text-sm text-foreground">{r.comment}</p>}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <Tabs defaultValue="financial" className="w-full">
            <TabsList className="grid w-full grid-cols-3 max-w-lg mb-4">
              <TabsTrigger value="financial" className="flex items-center gap-2">
                <FileText className="size-4" />
                Financial Statement
              </TabsTrigger>
              <TabsTrigger value="databases" className="flex items-center gap-2">
                <Database className="size-4" />5 Databases
              </TabsTrigger>
              <TabsTrigger value="non-financial" className="flex items-center gap-2">
                <BarChart3 className="size-4" />
                NF Ledger
              </TabsTrigger>
            </TabsList>

            <TabsContent value="financial" className="space-y-4">
              {submission.financial_statement_id && (
                <FinancialStatementEditor
                  fsId={submission.financial_statement_id}
                  submissionId={submission.id}
                  isDraft={isDraft}
                  isCooperative={isCooperative}
                />
              )}
              {!submission.financial_statement_id && !isExtracting && isCooperative && (
                <Card
                  title="Financial Statement"
                  subtitle="Upload your audited balance sheet — data is extracted automatically"
                >
                  <UploadFinancialStatementWidget submissionId={submission.id} />
                </Card>
              )}
              {!submission.financial_statement_id && !isExtracting && !isCooperative && (
                <Card title="Financial Statement" subtitle="No document uploaded yet">
                  <div className="py-10 text-center text-muted-foreground">
                    <FileText className="size-10 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No financial statement uploaded for this submission.</p>
                  </div>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="databases" className="space-y-4">
              <NfDatabasesTab
                submissionId={submission.id}
                isReadOnly={isReadOnly}
                isDraft={!!isDraft}
                isCooperative={isCooperative}
                sections={sections}
                onUploadComplete={handleNfUploadComplete}
                nfResult={nfResult}
              />
            </TabsContent>

            <TabsContent value="non-financial" className="space-y-4">
              <NonFinancialIndicatorsForm submissionId={submission.id} isReadOnly={isReadOnly} />
            </TabsContent>
          </Tabs>
        </div>
      )}
    </AppShell>
  );
};

// ── Review Action Panel ───────────────────────────────────────────────────────

function ReviewActionPanel({
  title,
  description,
  comment,
  setComment,
  onApprove,
  onReturn,
  onReject,
  approveLabel,
  returnLabel,
  rejectLabel,
  isPending,
}: {
  title: string;
  description: string;
  comment: string;
  setComment: (s: string) => void;
  onApprove: () => void;
  onReturn?: () => void;
  onReject?: () => void;
  approveLabel: string;
  returnLabel?: string;
  rejectLabel?: string;
  isPending: boolean;
}) {
  const hasComment = comment.trim().length > 0;
  return (
    <div className="rounded-xl border border-border bg-surface px-4 py-3 space-y-3">
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={
          onReturn || onReject
            ? "Provide a reason for returning/rejecting (required)…"
            : "Add a comment (optional)…"
        }
        rows={2}
        className="w-full rounded-lg border border-input bg-muted/40 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/20"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={onApprove}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-success px-4 py-2 text-sm font-semibold text-success-foreground hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckCircle2 className="size-4" />
          )}
          {approveLabel}
        </button>
        {onReturn && (
          <button
            onClick={onReturn}
            disabled={isPending || !hasComment}
            className="inline-flex items-center gap-2 rounded-xl border border-warning/30 px-4 py-2 text-sm font-semibold text-warning hover:bg-warning/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ArrowLeft className="size-4" />
            )}
            {returnLabel}
          </button>
        )}
        {onReject && (
          <button
            onClick={onReject}
            disabled={isPending || !hasComment}
            className="inline-flex items-center gap-2 rounded-xl border border-destructive/30 px-4 py-2 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <XCircle className="size-4" />
            )}
            {rejectLabel}
          </button>
        )}
      </div>
    </div>
  );
}

// ── NF Databases Tab ──────────────────────────────────────────────────────────

interface NfDatabasesTabProps {
  submissionId: string;
  isReadOnly: boolean;
  isDraft: boolean;
  isCooperative: boolean;
  sections: SubmissionSectionResponse[] | undefined;
  onUploadComplete: (result: NfUploadResponse) => void;
  nfResult: NfUploadResponse | null;
}

function NfDatabasesTab({
  submissionId,
  isReadOnly,
  isDraft,
  isCooperative,
  sections,
  onUploadComplete,
  nfResult,
}: NfDatabasesTabProps) {
  const params = { submission_id: submissionId, page: 1, page_size: 200 };
  const { data: membersData, isLoading: lm } = useMembers(params);
  const { data: savingsData, isLoading: ls } = useSavings(params);
  const { data: loansData, isLoading: ll } = useLoans(params);
  const { data: fdsData, isLoading: lf } = useFixedDeposits(params);
  const { data: farmCoopsData, isLoading: lfc } = useFarmCoops(params);
  const updateSection = useUpdateSubmissionSection(submissionId);

  const members = membersData?.data ?? [];
  const savings = savingsData?.data ?? [];
  const loans = loansData?.data ?? [];
  const fds = fdsData?.data ?? [];
  const farmCoops = farmCoopsData?.data ?? [];
  const hasData =
    members.length > 0 ||
    savings.length > 0 ||
    loans.length > 0 ||
    fds.length > 0 ||
    farmCoops.length > 0;
  const isLoading = lm || ls || ll || lf || lfc;
  const canMarkReady = isCooperative && isDraft;

  const handleMarkReady = async (sectionKey: string, label: string) => {
    try {
      await updateSection.mutateAsync({ section: sectionKey, status: "ready" });
      toast.success(`${label} marked as ready`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : `Failed to update ${label}`);
    }
  };

  const sec = (key: string) => sections?.find((s) => s.section === key);

  return (
    <div className="space-y-4">
      {isCooperative && isDraft && (
        <Card
          title="Upload Non-Financial Databases"
          subtitle="Upload your Excel file, review all imported records, then mark each section ready"
        >
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              {["NF MSHIP", "NF S", "NF LOANS", "NF FS", "NF FARM"].map((sheet) => (
                <div
                  key={sheet}
                  className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-center text-xs font-semibold text-muted-foreground"
                >
                  {sheet}
                </div>
              ))}
            </div>
            <NfUploadZone submissionId={submissionId} onUploadComplete={onUploadComplete} />
            {nfResult && <NfParseResults result={nfResult} />}
          </div>
        </Card>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="size-5 animate-spin mr-2" /> Loading records…
        </div>
      )}

      {!isLoading && !hasData && (
        <div className="text-center py-10 text-muted-foreground text-sm border rounded-xl bg-muted/10">
          {isReadOnly
            ? "No non-financial data has been uploaded for this submission."
            : "No records yet. Upload the Excel file above to import data."}
        </div>
      )}

      {members.length > 0 && (
        <NfTable
          title={`Membership (${members.length})`}
          section={sec("members")}
          canMarkReady={canMarkReady}
          onMarkReady={() => handleMarkReady("members", "Membership")}
          isUpdating={updateSection.isPending}
          columns={[
            "member_id",
            "status",
            "gender",
            "age_group",
            "region",
            "urban_rural",
            "join_date",
            "exit_date",
            "agm_attendance",
            "leadership_role",
            "voting_exercised",
          ]}
          rows={members.map((m) => ({
            member_id: m.member_id,
            status: m.status,
            gender: m.gender,
            age_group: m.age_group,
            region: m.region,
            urban_rural: m.urban_rural,
            join_date: m.join_date,
            exit_date: m.exit_date ?? null,
            agm_attendance: m.agm_attendance,
            leadership_role: m.leadership_role ?? null,
            voting_exercised: m.voting_exercised,
          }))}
        />
      )}
      {savings.length > 0 && (
        <NfTable
          title={`Savings Accounts (${savings.length})`}
          section={sec("savings")}
          canMarkReady={canMarkReady}
          onMarkReady={() => handleMarkReady("savings", "Savings")}
          isUpdating={updateSection.isPending}
          columns={[
            "savings_account_id",
            "account_type",
            "account_status",
            "balance",
            "interest_rate",
            "contribution_frequency",
            "last_contribution_date",
            "number_of_contributions",
            "balance_trend",
            "zero_balance_flag",
            "withdrawal_frequency_category",
            "emergency_withdrawals_flag",
          ]}
          rows={savings.map((s) => ({
            savings_account_id: s.savings_account_id,
            account_type: s.account_type,
            account_status: s.account_status,
            balance: s.balance,
            interest_rate: s.interest_rate,
            contribution_frequency: s.contribution_frequency,
            last_contribution_date: s.last_contribution_date,
            number_of_contributions: s.number_of_contributions,
            balance_trend: s.balance_trend,
            zero_balance_flag: s.zero_balance_flag,
            withdrawal_frequency_category: s.withdrawal_frequency_category,
            emergency_withdrawals_flag: s.emergency_withdrawals_flag,
          }))}
        />
      )}
      {loans.length > 0 && (
        <NfTable
          title={`Loans (${loans.length})`}
          section={sec("loans")}
          canMarkReady={canMarkReady}
          onMarkReady={() => handleMarkReady("loans", "Loans")}
          isUpdating={updateSection.isPending}
          columns={[
            "loan_id",
            "loan_product_type",
            "loan_status",
            "balance",
            "loan_amount",
            "interest_rate",
            "loan_start_date",
            "loan_maturity_date",
            "days_past_due_category",
            "borrower_type",
            "youth_borrower_flag",
            "women_borrower_flag",
            "rural_borrower_flag",
            "repayment_regularity",
            "restructured_loan_flag",
          ]}
          rows={loans.map((l) => ({
            loan_id: l.loan_id,
            loan_product_type: l.loan_product_type,
            loan_status: l.loan_status,
            balance: l.balance,
            loan_amount: l.loan_amount,
            interest_rate: l.interest_rate,
            loan_start_date: l.loan_start_date,
            loan_maturity_date: l.loan_maturity_date,
            days_past_due_category: l.days_past_due_category,
            borrower_type: l.borrower_type,
            youth_borrower_flag: l.youth_borrower_flag,
            women_borrower_flag: l.women_borrower_flag,
            rural_borrower_flag: l.rural_borrower_flag,
            repayment_regularity: l.repayment_regularity,
            restructured_loan_flag: l.restructured_loan_flag,
          }))}
        />
      )}
      {fds.length > 0 && (
        <NfTable
          title={`Fixed Deposits (${fds.length})`}
          section={sec("fixed_deposits")}
          canMarkReady={canMarkReady}
          onMarkReady={() => handleMarkReady("fixed_deposits", "Fixed Deposits")}
          isUpdating={updateSection.isPending}
          columns={[
            "fixed_deposit_id",
            "deposit_type",
            "status",
            "balance",
            "interest_rate",
            "start_date",
            "maturity_date",
            "tenure_category",
            "rollover_at_maturity_flag",
            "number_of_renewals",
            "early_withdrawal_flag",
          ]}
          rows={fds.map((fd) => ({
            fixed_deposit_id: fd.fixed_deposit_id,
            deposit_type: fd.deposit_type,
            status: fd.status,
            balance: fd.balance,
            interest_rate: fd.interest_rate,
            start_date: fd.start_date,
            maturity_date: fd.maturity_date,
            tenure_category: fd.tenure_category,
            rollover_at_maturity_flag: fd.rollover_at_maturity_flag,
            number_of_renewals: fd.number_of_renewals,
            early_withdrawal_flag: fd.early_withdrawal_flag,
          }))}
        />
      )}
      {farmCoops.length > 0 && (
        <NfTable
          title={`Farm Coops (${farmCoops.length})`}
          section={sec("farm_coop")}
          canMarkReady={canMarkReady}
          onMarkReady={() => handleMarkReady("farm_coop", "Farm Coops")}
          isUpdating={updateSection.isPending}
          columns={[
            "cooperative_type",
            "primary_activities",
            "operational_status",
            "active_producer_flag",
            "production_type",
            "market_channel_type",
            "participation_frequency",
            "delivery_compliance",
            "access_to_storage",
            "access_to_processing_facilities",
            "climate_exposure_type",
          ]}
          rows={farmCoops.map((fc) => ({
            cooperative_type: fc.cooperative_type,
            primary_activities: fc.primary_activities,
            operational_status: fc.operational_status,
            active_producer_flag: fc.active_producer_flag,
            production_type: fc.production_type,
            market_channel_type: fc.market_channel_type,
            participation_frequency: fc.participation_frequency,
            delivery_compliance: fc.delivery_compliance,
            access_to_storage: fc.access_to_storage,
            access_to_processing_facilities: fc.access_to_processing_facilities,
            climate_exposure_type: fc.climate_exposure_type,
          }))}
        />
      )}
    </div>
  );
}

// ── Reusable data table ───────────────────────────────────────────────────────

function NfTable({
  title,
  section,
  columns,
  rows,
  canMarkReady,
  onMarkReady,
  isUpdating,
}: {
  title: string;
  section?: SubmissionSectionResponse;
  columns: string[];
  rows: Record<string, unknown>[];
  canMarkReady?: boolean;
  onMarkReady?: () => void;
  isUpdating?: boolean;
}) {
  const [open, setOpen] = useState(true);
  const fmt = (col: string) => col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const cell = (val: unknown) => {
    if (val === null || val === undefined || val === "")
      return <span className="text-muted-foreground/40">—</span>;
    if (typeof val === "boolean") return val ? "Yes" : "No";
    return String(val);
  };
  const isReady = section?.status === "ready";
  const isInProgress = section?.status === "in_progress";

  return (
    <Card
      title={title}
      action={
        <div className="flex items-center gap-2">
          {section && (
            <StatusPill tone={sectionStatusTone(section.status)}>
              {sectionStatusLabel(section.status)}
            </StatusPill>
          )}
          {canMarkReady && !isReady && isInProgress && (
            <button
              onClick={onMarkReady}
              disabled={isUpdating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 border border-success/30 px-2.5 py-1 text-xs font-semibold text-success hover:bg-success/20 disabled:opacity-50 transition-colors"
            >
              {isUpdating ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3" />
              )}
              Mark Ready
            </button>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            {open ? "Collapse" : "Expand"}
          </button>
        </div>
      }
    >
      {open && (
        <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border mt-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-left">
                {columns.map((col) => (
                  <th key={col} className="px-4 py-2.5 whitespace-nowrap">
                    {fmt(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-2 whitespace-nowrap text-foreground">
                      {cell(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
