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
  ZoomIn,
  ZoomOut,
  Maximize2,
  ExternalLink,
  Upload,
  PenLine,
  Users,
  ClipboardList,
} from "lucide-react";
import { AppShell, Card, StatusPill } from "@/components/app-shell";
import { useUserRole, useAuth } from "@/lib/auth";
import {
  useSubmission,
  useDeleteSubmission,
  useSubmissionReviews,
  useDeleteFinancialStatement,
  useDelegateSubmission,
  useReclaimSubmission,
  useClaimCooperativeEdit,
  useClaimApexEdit,
} from "@/hooks/submissions/useSubmissions";
import { useDeleteManualNonFinancialData } from "@/hooks/submissions/useManualEntry";
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
import { SubmissionContentTabs } from "./detail/SubmissionContentTabs";
import { NfUploadZone } from "@/components/non-financial/NfUploadZone";
import { NfParseResults } from "@/components/non-financial/NfParseResults";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NonFinancialIndicatorsForm } from "@/components/submissions/non-financial-indicators-form";
import { QuestionnaireResponseViewer } from "@/components/submissions/QuestionnaireResponseViewer";
import { useQuestionnaire, useActiveTemplate } from "@/hooks/submissions/useQuestionnaire";
import { DeleteConfirmationDialog } from "@/components/shared/DeleteConfirmationDialog";
import { useVerifyIdentity } from "@/hooks/auth/useVerifyIdentity";
import { useLineItems } from "@/hooks/submissions/useFinancialStatement";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useMemo } from "react";
import type { NfUploadResponse } from "@/types/non-financial";
import { useMembers } from "@/hooks/non-financial/useMembers";
import { useSavings } from "@/hooks/non-financial/useSavings";
import { useLoans } from "@/hooks/non-financial/useLoans";
import { useFixedDeposits } from "@/hooks/non-financial/useFixedDeposits";
import { useFarmCoops } from "@/hooks/non-financial/useFarmCoop";
import { getAccessToken } from "@/services/shared/authService";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import {
  SubmissionMethodModal,
  type SubmissionMethod,
} from "@/components/submissions/SubmissionMethodModal";

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

function statusLabel(s: string, t: TFunction) {
  const keysMap: Record<string, string> = {
    draft: "submissions.status.draft",
    awaiting_coop_validation: "submissions.status.awaitingValidation",
    submitted: "submissions.status.submitted",
    in_review: "submissions.status.inReview",
    apex_review: "submissions.status.apexReview",
    apex_returned: "submissions.status.apexReturned",
    federation_review: "submissions.status.federationReview",
    federation_returned: "submissions.status.federationReturned",
    ministry_review: "submissions.status.ministryReview",
    approved: "submissions.status.approved",
    rejected: "submissions.status.rejected",
  };
  const key = keysMap[s];
  return key ? t(key) : s;
}

function sectionStatusTone(status: string): "neutral" | "warning" | "success" {
  return status === "ready" ? "success" : status === "in_progress" ? "warning" : "neutral";
}

function sectionStatusLabel(status: string, t: TFunction) {
  const map: Record<string, string> = {
    pending: "submissions.detail.pendingStatus",
    in_progress: "submissions.detail.inProgressStatus",
    ready: "submissions.detail.readyStatus",
  };
  const key = map[status];
  return key ? t(key) : status;
}

const isValueFilled = (val: unknown): boolean => {
  if (val === undefined || val === null) return false;
  if (typeof val === "string") return val.trim().length > 0;
  if (typeof val === "number") return val !== 0;
  if (typeof val === "boolean") return true;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "object") return Object.keys(val).length > 0;
  return false;
};

const isQuestionnaireComplete = (
  q: { answers?: Record<string, unknown> } | null | undefined,
  template:
    | { sections?: Array<{ fields?: Array<{ key: string; required?: boolean }> }> }
    | null
    | undefined,
): boolean => {
  if (!q || !q.answers) return false;
  const answers = q.answers;

  if (template && template.sections && template.sections.length > 0) {
    let requiredCount = 0;
    for (const sec of template.sections) {
      if (!sec.fields) continue;
      for (const field of sec.fields) {
        if (field.required) {
          requiredCount++;
          if (!isValueFilled(answers[field.key])) {
            return false;
          }
        }
      }
    }
    if (requiredCount > 0) return true;
  }

  // Fallback when template is uninitialized or has no required flags:
  // Requires at least 5 non-empty, non-zero filled values in answers
  const filledCount = Object.values(answers).filter(isValueFilled).length;
  return filledCount >= 5;
};

// ── Page ─────────────────────────────────────────────────────────────────────

export const SubmissionDetailPage: React.FC = () => {
  const { t } = useTranslation();
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
  const { isOffline, user } = useAuth();
  const currentUserId = user?.sub ?? user?.id;
  const { verifyIdentity } = useVerifyIdentity();
  const submitMutation = useSubmitSubmission();
  const deleteMutation = useDeleteSubmission();
  const apexApprove = useApexApprove();
  const apexReturn = useApexReturn();
  const federationApprove = useFederationApprove();
  const federationReturn = useFederationReturn();
  const ministryApprove = useMinistryApprove();
  const ministryReject = useMinistryReject();
  const delegateSubmission = useDelegateSubmission();
  const reclaimSubmission = useReclaimSubmission();
  const [reviewComment, setReviewComment] = useState("");
  const [showDelegateModal, setShowDelegateModal] = useState(false);
  const [showReclaimModal, setShowReclaimModal] = useState(false);
  const [delegateComment, setDelegateComment] = useState("");
  const [nfResult, setNfResult] = useState<NfUploadResponse | null>(null);
  const [activeTab, setActiveTab] = useState("financial");
  const [updatingSectionKey, setUpdatingSectionKey] = useState<string | null>(null);
  const [methodModalOpen, setMethodModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const { data: reviews } = useSubmissionReviews(id);
  const { data: financialQ } = useQuestionnaire(id ?? "", "financial");
  const { data: nonFinancialQ } = useQuestionnaire(id ?? "", "non_financial");
  const { data: financialTemplate } = useActiveTemplate("financial");
  const { data: nonFinancialTemplate } = useActiveTemplate("non_financial");
  const { data: fsLineItems = [] } = useLineItems(submission?.financial_statement_id ?? null);

  const params = useMemo(() => ({ submission_id: id ?? "", page: 1, page_size: 1 }), [id]);
  const { data: membersData } = useMembers(id ? params : undefined);
  const { data: savingsData } = useSavings(id ? params : undefined);
  const { data: loansData } = useLoans(id ? params : undefined);
  const { data: fdsData } = useFixedDeposits(id ? params : undefined);
  const { data: farmCoopsData } = useFarmCoops(id ? params : undefined);

  const hasUploadedData = (sectionKey: string): boolean => {
    if (sectionKey === "financial") {
      return (
        fsLineItems.length > 0 ||
        isQuestionnaireComplete(
          financialQ,
          financialTemplate as unknown as {
            sections?: Array<{ fields?: Array<{ key: string; required?: boolean }> }>;
          },
        )
      );
    }
    if (
      sectionKey === "indicators" ||
      ["members", "savings", "loans", "fixed_deposits"].includes(sectionKey)
    ) {
      if (submissionMethod === "questionnaire") {
        return isQuestionnaireComplete(
          nonFinancialQ,
          nonFinancialTemplate as unknown as {
            sections?: Array<{ fields?: Array<{ key: string; required?: boolean }> }>;
          },
        );
      }
    }
    if (sectionKey === "members") {
      return (membersData?.total ?? 0) > 0 || (membersData?.data?.length ?? 0) > 0;
    }
    if (sectionKey === "savings") {
      return (savingsData?.total ?? 0) > 0 || (savingsData?.data?.length ?? 0) > 0;
    }
    if (sectionKey === "loans") {
      return (loansData?.total ?? 0) > 0 || (loansData?.data?.length ?? 0) > 0;
    }
    if (sectionKey === "fixed_deposits") {
      return (fdsData?.total ?? 0) > 0 || (fdsData?.data?.length ?? 0) > 0;
    }
    if (sectionKey === "farm_coop") {
      return (farmCoopsData?.total ?? 0) > 0 || (farmCoopsData?.data?.length ?? 0) > 0;
    }
    return false;
  };

  const isExtracting =
    extractionJob && !["succeeded", "failed", "partial"].includes(extractionJob.status);

  const updateSection = useUpdateSubmissionSection(id ?? "");

  const sectionMeta = useMemo(
    () => [
      {
        key: "financial",
        label: t("submissions.detail.sections.financial.label"),
        description: t("submissions.detail.sections.financial.description"),
        tab: "financial",
        icon: FileText,
        pendingAction: t("submissions.detail.sections.financial.pendingAction"),
        progressAction: t("submissions.detail.sections.financial.progressAction"),
        readyAction: t("submissions.detail.sections.financial.readyAction"),
      },
      {
        key: "members",
        label: t("submissions.detail.sections.members.label"),
        description: t("submissions.detail.sections.members.description"),
        tab: "databases",
        icon: Database,
        pendingAction: t("submissions.detail.sections.members.pendingAction"),
        readyAction: t("submissions.detail.sections.members.readyAction"),
      },
      {
        key: "savings",
        label: t("submissions.detail.sections.savings.label"),
        description: t("submissions.detail.sections.savings.description"),
        tab: "databases",
        icon: Database,
        pendingAction: t("submissions.detail.sections.savings.pendingAction"),
        readyAction: t("submissions.detail.sections.savings.readyAction"),
      },
      {
        key: "loans",
        label: t("submissions.detail.sections.loans.label"),
        description: t("submissions.detail.sections.loans.description"),
        tab: "databases",
        icon: Database,
        pendingAction: t("submissions.detail.sections.loans.pendingAction"),
        readyAction: t("submissions.detail.sections.loans.readyAction"),
      },
      {
        key: "fixed_deposits",
        label: t("submissions.detail.sections.fixed_deposits.label"),
        description: t("submissions.detail.sections.fixed_deposits.description"),
        tab: "databases",
        icon: Database,
        pendingAction: t("submissions.detail.sections.fixed_deposits.pendingAction"),
        readyAction: t("submissions.detail.sections.fixed_deposits.readyAction"),
      },
      {
        key: "farm_coop",
        label: t("submissions.detail.sections.farm_coop.label"),
        description: t("submissions.detail.sections.farm_coop.description"),
        tab: "databases",
        icon: Database,
        pendingAction: t("submissions.detail.sections.farm_coop.pendingAction"),
        readyAction: t("submissions.detail.sections.farm_coop.readyAction"),
      },
    ],
    [t],
  );

  const isDraft = submission?.status === "draft";
  const isCooperative = role === "cooperative";
  const isCreatorRole = submission?.created_by_role === role;
  const CHOSEN_METHODS: SubmissionMethod[] = ["upload", "manual", "questionnaire"];
  const submissionMethod: SubmissionMethod | null =
    submission && CHOSEN_METHODS.includes(submission.submission_method as SubmissionMethod)
      ? (submission.submission_method as SubmissionMethod)
      : null;
  const methodChosen = submissionMethod !== null;

  // Exclusive editor model: only the user who owns the draft (edited_by) can edit
  // Hooks must be called before any early returns
  const isEditor =
    isDraft && submission?.edited_by != null && submission.edited_by === currentUserId;

  const claimCoopEdit = useClaimCooperativeEdit();
  const claimApexEdit = useClaimApexEdit();

  // Auto-claim edit rights when opening a delegated draft with no editor
  useEffect(() => {
    if (!submission || !isDraft || submission.edited_by != null || !id) return;
    if (role === "cooperative" && submission.current_tier === "cooperative") {
      claimCoopEdit.mutate({ id });
    } else if (role === "apex" && submission.current_tier === "apex") {
      claimApexEdit.mutate({ id });
    }
  }, [submission, isDraft, id, role, claimCoopEdit, claimApexEdit]);

  useEffect(() => {
    if (isEditor && isDraft && !methodChosen) {
      setMethodModalOpen(true);
    }
  }, [isEditor, isDraft, methodChosen]);

  if (!role) return null;

  const isReadOnly = !isEditor;

  const mappedSections = (sections ?? []).map((s) => ({
    ...s,
    status: s.status ?? "pending",
  }));
  const requiredSections = mappedSections.filter((s) => s.section !== "farm_coop");
  const allReady =
    requiredSections.length > 0 && requiredSections.every((s) => s.status === "ready");
  const canSubmit = isDraft && allReady && !isReadOnly && !isExtracting;

  const readyCount = requiredSections.filter((s) => s.status === "ready").length;
  const totalSectionsCount = requiredSections.length;
  const progressPercent = totalSectionsCount > 0 ? (readyCount / totalSectionsCount) * 100 : 0;
  const remainingSections = requiredSections
    .filter((s) => s.status !== "ready")
    .map((s) => s.section.replace(/_/g, " "));

  const handleSubmit = async () => {
    if (!id) return;

    if (submissionMethod === "questionnaire") {
      const finComplete = isQuestionnaireComplete(
        financialQ,
        financialTemplate as unknown as {
          sections?: Array<{ fields?: Array<{ key: string; required?: boolean }> }>;
        },
      );
      const nonFinComplete = isQuestionnaireComplete(
        nonFinancialQ,
        nonFinancialTemplate as unknown as {
          sections?: Array<{ fields?: Array<{ key: string; required?: boolean }> }>;
        },
      );

      if (!finComplete) {
        toast.error(
          "Please complete all required fields in the Financial Questionnaire before submitting.",
        );
        return;
      }
      if (!nonFinComplete) {
        toast.error(
          "Please complete all required fields in the Non-Financial Questionnaire before submitting.",
        );
        return;
      }
    }

    if (!canSubmit) {
      if (remainingSections.length > 0) {
        toast.error(
          `Please complete the remaining required sections: ${remainingSections.join(", ")}`,
        );
      } else {
        toast.error("Please complete all sections before submitting.");
      }
      return;
    }

    try {
      await submitMutation.mutateAsync(id);
      toast.success(
        submission?.current_tier === "apex"
          ? "Submitted to Federation"
          : t("submissions.detail.toastSubmitted"),
      );
      navigate({ to: "/app/submissions" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("submissions.detail.toastSubmitFailed"));
    }
  };

  const handleDelete = () => {
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (verificationToken: string) => {
    if (!id) return;
    try {
      await deleteMutation.mutateAsync({ id, verificationToken });
      toast.success(t("submissions.detail.toastDraftDeleted"));
      setDeleteModalOpen(false);
      navigate({ to: "/app/submissions" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("submissions.detail.toastDeleteFailed"));
      throw e;
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
      toast.error(e instanceof Error ? e.message : t("submissions.detail.actionConfirmFailed"));
    }
  };

  const handleNfUploadComplete = (result: NfUploadResponse) => {
    setNfResult(result);
    void refetchSections();
    queryClient.invalidateQueries({ queryKey: ["cooperative-submissions", id] });
    queryClient.invalidateQueries({ queryKey: ["cooperative-submissions"] });
  };

  return (
    <AppShell title={t("submissions.detail.title")} subtitle={t("submissions.detail.subtitle")}>
      {/* Back nav */}
      <div className="mb-6">
        <Link
          to="/app/submissions"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group"
        >
          <div className="size-7 rounded-lg border border-border bg-surface grid place-items-center group-hover:border-border/80 group-hover:bg-muted transition-colors">
            <ArrowLeft className="size-3.5" />
          </div>
          {t("submissions.detail.back")}
        </Link>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-24 text-muted-foreground">
          <Loader2 className="size-6 animate-spin mr-2" /> {t("submissions.detail.loading")}
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-5">
          <AlertCircle className="size-5 text-destructive shrink-0" />
          <p className="text-sm">
            {error instanceof Error ? error.message : t("submissions.detail.failed")}
          </p>
        </div>
      )}

      {submission && (
        <div className="space-y-5">
          {/* ── Hero header ── */}
          <div
            className={`rounded-2xl border bg-surface shadow-[var(--shadow-elev-1)] overflow-hidden ${
              submission.status === "approved"
                ? "border-success/25"
                : submission.status === "rejected"
                  ? "border-destructive/25"
                  : submission.status === "draft"
                    ? "border-border"
                    : "border-warning/25"
            }`}
          >
            {/* Status top stripe */}
            <div
              className={`h-1 w-full ${
                submission.status === "approved"
                  ? "bg-success"
                  : submission.status === "rejected"
                    ? "bg-destructive"
                    : submission.status === "draft"
                      ? "bg-muted-foreground/20"
                      : "bg-warning"
              }`}
            />
            <div className="px-6 py-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-3 mb-1 flex-wrap">
                    <h2 className="font-mono text-xl font-bold text-foreground tracking-tight">
                      {submission.reference ?? submission.id.slice(0, 8).toUpperCase()}
                    </h2>
                    <StatusPill tone={statusTone(submission.status)}>
                      {statusLabel(submission.status, t)}
                    </StatusPill>
                    {submission.created_by_role === "apex" && submission.created_by_name && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary/80 bg-primary/5 border border-primary/10 rounded-lg px-2 py-1">
                        <span className="size-1.5 rounded-full bg-primary" />
                        Created by {submission.created_by_name} (Apex)
                      </span>
                    )}
                    {submission.edited_by_name && submission.status === "draft" && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground bg-muted/50 border border-border/60 rounded-lg px-2 py-1">
                        <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                        Editing: {submission.edited_by_name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {t("submissions.reportingYear")}{" "}
                    <span className="font-semibold text-foreground">
                      {submission.reporting_year}
                    </span>
                    {" · "}
                    <span className="capitalize font-medium">
                      {t("submissions.detail.tier", { tier: submission.current_tier })}
                    </span>
                  </p>
                </div>
                <button
                  onClick={handleDelete}
                  disabled={
                    !isEditor ||
                    deleteMutation.isPending ||
                    isOffline ||
                    submission.status === "approved"
                  }
                  className="inline-flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title={
                    !isEditor
                      ? t(
                          "submissions.detail.onlyEditorCanDelete",
                          "Only the editor can delete this submission",
                        )
                      : isOffline
                        ? t("submissions.cannotDeleteOffline", "Cannot delete while offline")
                        : t("submissions.detail.deleteSubmission")
                  }
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="size-3.5" />
                  )}
                  {isOffline
                    ? t("submissions.cannotDeleteOffline", "Cannot delete while offline")
                    : t("submissions.detail.deleteSubmission")}
                </button>
              </div>

              {/* Metadata strip */}
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/40 pt-4 text-[12px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-muted-foreground/60" />
                  <span>
                    {t("submissions.detail.created", {
                      date: new Date(submission.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      }),
                    })}
                  </span>
                </div>
                <div className="hidden sm:block h-3 w-px bg-border" />
                <div className="flex items-center gap-1.5">
                  <Hash className="size-3.5 text-muted-foreground/60" />
                  <span className="font-mono text-foreground/80">{submission.id.slice(0, 8)}</span>
                </div>
                <div className="hidden sm:block h-3 w-px bg-border" />
                <div className="flex items-center gap-1.5">
                  <Clock className="size-3.5 text-muted-foreground/60" />
                  <span className="capitalize">
                    {t("submissions.detail.priority", { priority: submission.priority })}
                  </span>
                </div>
                <div className="hidden sm:block h-3 w-px bg-border" />
                <div className="flex items-center gap-1.5">
                  <FileText className="size-3.5 text-muted-foreground/60" />
                  <span className="capitalize font-medium">
                    {t("submissions.detail.tier", { tier: submission.current_tier })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── AI Extraction Banner — prominent and dismissable ── */}
          {isExtracting && (
            <div className="relative overflow-hidden rounded-xl border border-accent/30 bg-accent/5 shimmer-bg">
              <div className="relative flex items-start gap-4 px-5 py-4">
                <div className="mt-0.5 shrink-0 flex size-10 items-center justify-center rounded-xl bg-accent/15 ring-1 ring-accent/25">
                  <Loader2 className="size-5 animate-spin text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    {t("submissions.detail.aiExtracting")}
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                      <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                      {extractionJob?.status ?? "processing"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("submissions.detail.aiExtractingDesc")}
                  </p>
                  <div className="mt-3 h-1.5 w-full bg-accent/10 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent/60 rounded-full animate-pulse"
                      style={{ width: "60%" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {isDraft && (
            <div className="rounded-2xl border border-border bg-surface shadow-[var(--shadow-elev-1)] overflow-hidden">
              {/* Card header */}
              <div
                className={`px-6 pt-5 pb-4 border-b border-border ${allReady ? "bg-success/5" : "bg-background"}`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div
                      className={`size-9 rounded-xl grid place-items-center ${allReady ? "bg-success/15 text-success" : "bg-warning/10 text-warning-foreground"}`}
                    >
                      {allReady ? (
                        <CheckCircle2 className="size-5" />
                      ) : (
                        <AlertCircle className="size-5" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-heading text-[14px] font-semibold text-foreground">
                        {t("submissions.detail.readinessCenter")}
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {t("submissions.detail.readinessDesc", {
                          readyLabel: t("submissions.detail.readyLabel"),
                        })}
                      </p>
                    </div>
                  </div>
                  {/* Progress pill */}
                  <div
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold tabular-nums ${
                      allReady ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {t("submissions.detail.doneCount", {
                      count: readyCount,
                      total: totalSectionsCount,
                    })}
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${
                        allReady ? "bg-success pulse-glow-success" : "bg-accent"
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Section cards grid */}
              <div className="p-5">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {sectionMeta.map((m, idx) => {
                    const secObj = mappedSections.find((s) => s.section === m.key);
                    const status = secObj?.status ?? "pending";
                    const hasData = hasUploadedData(m.key);
                    const isReady = status === "ready";
                    const isInProgress = !isReady && hasData;
                    const isPending = !isReady && !hasData;
                    const Icon = m.icon;
                    const isUpdatingThis = updateSection.isPending && updatingSectionKey === m.key;

                    return (
                      <div
                        key={m.key}
                        className={`group relative rounded-xl border p-4 transition-all duration-200 flex flex-col gap-3 ${
                          isReady
                            ? "border-success/25 bg-success/5 hover:border-success/40 hover:shadow-sm"
                            : isInProgress
                              ? "border-accent/25 bg-accent/5 hover:border-accent/40 hover:shadow-sm"
                              : "border-border bg-muted/30 hover:border-border/80 hover:bg-muted/50"
                        }`}
                      >
                        {/* Top row: icon + status + step number */}
                        <div className="flex items-start justify-between">
                          <div
                            className={`size-9 rounded-lg grid place-items-center shrink-0 ${
                              isReady
                                ? "bg-success/15 text-success"
                                : isInProgress
                                  ? "bg-accent/15 text-accent"
                                  : "bg-muted text-muted-foreground/70"
                            }`}
                          >
                            {isReady ? (
                              <CheckCircle2 className="size-4.5" />
                            ) : (
                              <Icon className="size-4.5" />
                            )}
                          </div>
                          <span
                            className={`step-bubble ${
                              isReady
                                ? "bg-success/15 text-success"
                                : isInProgress
                                  ? "bg-accent/10 text-accent"
                                  : "bg-muted text-muted-foreground/50"
                            }`}
                          >
                            {idx + 1}
                          </span>
                        </div>

                        {/* Label + description */}
                        <div className="flex-1">
                          <h4
                            className={`text-[12px] font-bold leading-snug ${
                              isReady
                                ? "text-success"
                                : isInProgress
                                  ? "text-foreground"
                                  : "text-foreground/80"
                            }`}
                          >
                            {m.label}
                          </h4>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">
                            {m.description}
                          </p>
                        </div>

                        {/* Status badge + CTA */}
                        <div className="flex items-center justify-between border-t border-border/40 pt-3 mt-auto">
                          <span
                            className={`inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide ${
                              isReady
                                ? "text-success"
                                : isInProgress
                                  ? "text-accent"
                                  : "text-muted-foreground/70"
                            }`}
                          >
                            <span
                              className={`size-1.5 rounded-full ${
                                isReady
                                  ? "bg-success"
                                  : isInProgress
                                    ? "bg-accent animate-pulse"
                                    : "bg-muted-foreground/40"
                              }`}
                            />
                            {isReady
                              ? t("submissions.detail.readyStatus")
                              : isInProgress
                                ? t("submissions.detail.inProgressStatus")
                                : t("submissions.detail.pendingStatus")}
                          </span>

                          {isReady ? (
                            <button
                              onClick={() => {
                                setActiveTab(m.tab);
                                const el = document.getElementById("detail-tabs-list");
                                if (el) el.scrollIntoView({ behavior: "smooth" });
                              }}
                              className="text-[11px] font-semibold text-success hover:underline transition-colors"
                            >
                              {t("submissions.detail.sections.financial.readyAction").split(" ")[0]}{" "}
                              →
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              {hasData && isEditor && (
                                <button
                                  onClick={async () => {
                                    setUpdatingSectionKey(m.key);
                                    try {
                                      await updateSection.mutateAsync({
                                        section: m.key,
                                        status: "ready",
                                      });
                                      toast.success(
                                        t("submissions.detail.toastMarkedReady", { name: m.label }),
                                      );
                                    } catch (e) {
                                      toast.error(
                                        e instanceof Error
                                          ? e.message
                                          : t("submissions.detail.toastUpdateFailed"),
                                      );
                                    } finally {
                                      setUpdatingSectionKey(null);
                                    }
                                  }}
                                  disabled={updateSection.isPending || !hasData}
                                  className="inline-flex items-center gap-1 rounded-lg bg-success text-white px-2 py-0.5 text-[10px] font-bold hover:bg-success/90 transition-colors shadow-sm disabled:opacity-50"
                                >
                                  {isUpdatingThis ? (
                                    <Loader2 className="size-2.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="size-2.5" />
                                  )}
                                  {t("submissions.detail.readyLabel")}
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setActiveTab(m.tab);
                                  const el = document.getElementById("detail-tabs-list");
                                  if (el) el.scrollIntoView({ behavior: "smooth" });
                                }}
                                className="text-[11px] font-semibold text-primary hover:underline transition-colors shrink-0"
                              >
                                {isInProgress
                                  ? (m.progressAction ?? m.pendingAction)
                                  : m.pendingAction}{" "}
                                →
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Footer: remaining hint + actions */}
                <div className="mt-5 pt-4 border-t border-border flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-sm min-w-0">
                    {allReady ? (
                      <>
                        <CheckCircle2 className="size-4 text-success shrink-0" />
                        <span className="font-semibold text-success text-xs sm:text-sm">
                          {t("submissions.detail.allReadyMsg")}
                        </span>
                      </>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="size-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground text-xs font-semibold">
                            {t("submissions.detail.completeAll")}
                          </span>
                        </div>
                        {remainingSections.length > 0 && (
                          <p className="text-[10px] text-muted-foreground/70 pl-6 capitalize">
                            {t("submissions.detail.remaining", {
                              sections: remainingSections.join(" · "),
                            })}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={handleDelete}
                      disabled={
                        !isEditor ||
                        deleteMutation.isPending ||
                        isOffline ||
                        submission?.status === "approved"
                      }
                      className="inline-flex items-center gap-2 rounded-xl border border-destructive/25 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      title={
                        !isEditor
                          ? t(
                              "submissions.detail.onlyEditorCanDelete",
                              "Only the editor can delete this submission",
                            )
                          : isOffline
                            ? t("submissions.cannotDeleteOffline", "Cannot delete while offline")
                            : t("submissions.detail.deleteDraft")
                      }
                    >
                      {deleteMutation.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="size-3.5" />
                      )}
                      {isOffline
                        ? t("submissions.cannotDeleteOffline", "Cannot delete while offline")
                        : t("submissions.detail.deleteDraft")}
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={!canSubmit || submitMutation.isPending}
                      title={!allReady ? t("submissions.detail.pleaseMarkAll") : undefined}
                      className={`inline-flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-bold transition-all shadow-sm ${
                        canSubmit
                          ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:shadow-md"
                          : "bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                      }`}
                    >
                      {submitMutation.isPending ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <Send className="size-4" />
                      )}
                      {submission.current_tier === "apex"
                        ? t("submissions.detail.submitToFederation", "Submit to Federation")
                        : t("submissions.detail.submitToApex")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {role === "apex" &&
            submission.status === "submitted" &&
            submission.created_by_role !== "apex" && (
              <ReviewActionPanel
                title={t("submissions.detail.apexReviewTitle")}
                description={t("submissions.detail.apexReviewDesc")}
                comment={reviewComment}
                setComment={setReviewComment}
                onApprove={() =>
                  handleReviewAction(apexApprove, t("submissions.detail.apexReviewApprovedMsg"))
                }
                onReturn={() =>
                  handleReviewAction(apexReturn, t("submissions.detail.apexReviewReturnedMsg"))
                }
                approveLabel={t("submissions.detail.btnApproveForward")}
                returnLabel={t("submissions.detail.btnRequestChanges")}
                isPending={apexApprove.isPending || apexReturn.isPending}
              />
            )}

          {/* Apex: Action Required — Fix myself or Delegate to Cooperative */}
          {role === "apex" &&
            submission.status === "submitted" &&
            submission.created_by_role === "apex" &&
            submission.current_tier === "apex" && (
              <Card
                title="Action Required"
                subtitle="Fix this submission yourself or delegate to the cooperative"
              >
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={async () => {
                      if (!id) return;
                      try {
                        await apexReturn.mutateAsync({ id });
                        toast.success("Returned to draft. You can now edit this submission.");
                      } catch (err) {
                        toast.error(
                          err instanceof Error ? err.message : "Failed to return submission",
                        );
                      }
                    }}
                    disabled={apexReturn.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {apexReturn.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <PenLine className="size-4" />
                    )}{" "}
                    Fix Myself
                  </button>
                  <button
                    onClick={() => setShowDelegateModal(true)}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm font-semibold text-amber-600 hover:bg-amber-500/10 transition-colors"
                  >
                    <Users className="size-4" /> Delegate to Cooperative
                  </button>
                </div>
              </Card>
            )}

          {/* Apex: Delegated submission — Reclaim back */}
          {role === "apex" &&
            submission.status === "draft" &&
            submission.current_tier === "cooperative" &&
            submission.created_by_role === "apex" && (
              <Card
                title="Delegated to Cooperative"
                subtitle="This submission is being fixed by the cooperative"
              >
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setShowReclaimModal(true)}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors"
                  >
                    <PenLine className="size-4" /> Reclaim Submission
                  </button>
                </div>
              </Card>
            )}

          {/* Apex: Reclaimed draft — Delegate to Cooperative */}
          {role === "apex" &&
            submission.status === "draft" &&
            submission.current_tier === "apex" &&
            submission.created_by_role === "apex" && (
              <Card
                title="Ready to Delegate"
                subtitle="Delegate this submission to the cooperative for editing"
              >
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => setShowDelegateModal(true)}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm font-semibold text-amber-600 hover:bg-amber-500/10 transition-colors"
                  >
                    <Users className="size-4" /> Delegate to Cooperative
                  </button>
                </div>
              </Card>
            )}

          {/* Delegate Modal */}
          {showDelegateModal && (
            <div
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
              onClick={(e) => e.target === e.currentTarget && setShowDelegateModal(false)}
            >
              <div className="w-full max-w-md bg-surface rounded-2xl border border-border shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
                <div className="px-6 pt-6 pb-4">
                  <h3 className="text-base font-bold text-foreground">Delegate to Cooperative</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    The cooperative will be notified to fix and resubmit.
                  </p>
                </div>
                <div className="px-6 pb-2">
                  <textarea
                    value={delegateComment}
                    onChange={(e) => setDelegateComment(e.target.value)}
                    placeholder="Add a comment (optional)..."
                    className="w-full rounded-xl border border-input bg-muted/30 p-3 text-sm resize-none focus:border-ring/60 focus:bg-surface focus:ring-2 focus:ring-ring/10 focus:outline-none placeholder:text-muted-foreground/60"
                    rows={3}
                  />
                </div>
                <div className="flex gap-3 px-6 py-5">
                  <button
                    onClick={() => setShowDelegateModal(false)}
                    className="flex-1 rounded-xl border border-border bg-transparent px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!id) return;
                      try {
                        await delegateSubmission.mutateAsync({
                          id,
                          comment: delegateComment || undefined,
                        });
                        toast.success("Submission delegated to cooperative");
                        setShowDelegateModal(false);
                        setDelegateComment("");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed to delegate");
                      }
                    }}
                    disabled={delegateSubmission.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    {delegateSubmission.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <Users className="size-4" />
                    )}
                    Delegate
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reclaim Modal */}
          {showReclaimModal && (
            <div
              className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
              onClick={(e) => e.target === e.currentTarget && setShowReclaimModal(false)}
            >
              <div className="w-full max-w-md bg-surface rounded-2xl border border-border shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
                <div className="px-6 pt-6 pb-4">
                  <h3 className="text-base font-bold text-foreground">Reclaim Submission</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Transfer editing rights back to you. The cooperative will no longer be able to
                    edit.
                  </p>
                </div>
                <div className="px-6 pb-2">
                  <textarea
                    value={delegateComment}
                    onChange={(e) => setDelegateComment(e.target.value)}
                    placeholder="Add a comment (optional)..."
                    className="w-full rounded-xl border border-input bg-muted/30 p-3 text-sm resize-none focus:border-ring/60 focus:bg-surface focus:ring-2 focus:ring-ring/10 focus:outline-none placeholder:text-muted-foreground/60"
                    rows={3}
                  />
                </div>
                <div className="flex gap-3 px-6 py-5">
                  <button
                    onClick={() => setShowReclaimModal(false)}
                    className="flex-1 rounded-xl border border-border bg-transparent px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      if (!id) return;
                      try {
                        await reclaimSubmission.mutateAsync({
                          id,
                          comment: delegateComment || undefined,
                        });
                        toast.success("Submission reclaimed");
                        setShowReclaimModal(false);
                        setDelegateComment("");
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed to reclaim");
                      }
                    }}
                    disabled={reclaimSubmission.isPending}
                    className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
                  >
                    {reclaimSubmission.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <PenLine className="size-4" />
                    )}
                    Reclaim
                  </button>
                </div>
              </div>
            </div>
          )}

          {role === "federation" &&
            (submission.status === "in_review" || submission.status === "submitted") &&
            submission.current_tier === "federation" && (
              <ReviewActionPanel
                title={t("submissions.detail.fedReviewTitle")}
                description={t("submissions.detail.fedReviewDesc")}
                comment={reviewComment}
                setComment={setReviewComment}
                onApprove={() =>
                  handleReviewAction(
                    federationApprove,
                    t("submissions.detail.fedReviewApprovedMsg"),
                  )
                }
                onReturn={() =>
                  handleReviewAction(federationReturn, t("submissions.detail.fedReviewReturnedMsg"))
                }
                approveLabel={t("submissions.detail.btnApproveForward")}
                returnLabel={t("submissions.detail.btnReturnToApex")}
                isPending={federationApprove.isPending || federationReturn.isPending}
              />
            )}

          {role === "ministry" &&
            submission.status === "in_review" &&
            submission.current_tier === "ministry" && (
              <ReviewActionPanel
                title={t("submissions.detail.minReviewTitle")}
                description={t("submissions.detail.minReviewDesc")}
                comment={reviewComment}
                setComment={setReviewComment}
                onApprove={() =>
                  handleReviewAction(ministryApprove, t("submissions.detail.minReviewApprovedMsg"))
                }
                onReject={() =>
                  handleReviewAction(ministryReject, t("submissions.detail.minReviewRejectedMsg"))
                }
                approveLabel={t("submissions.detail.btnApprove")}
                rejectLabel={t("submissions.detail.btnReject")}
                isPending={ministryApprove.isPending || ministryReject.isPending}
              />
            )}

          {reviews && reviews.length > 0 && (
            <Card
              title={t("submissions.detail.reviewHistory")}
              subtitle={t("submissions.detail.auditTrail")}
            >
              <div className="space-y-0">
                {reviews.map((r, idx) => (
                  <div
                    key={r.id}
                    className={`flex gap-4 ${idx < reviews.length - 1 ? "pb-4" : ""}`}
                  >
                    {/* Timeline rail */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`size-8 rounded-full grid place-items-center shrink-0 ring-2 ring-background ${
                          r.action?.toLowerCase() === "approve"
                            ? "bg-success/15 text-success ring-success/10"
                            : r.action?.toLowerCase() === "reject"
                              ? "bg-destructive/15 text-destructive ring-destructive/10"
                              : "bg-warning/15 text-warning-foreground ring-warning/10"
                        }`}
                      >
                        {r.action?.toLowerCase() === "approve" ? (
                          <CheckCircle2 className="size-4" />
                        ) : r.action?.toLowerCase() === "reject" ? (
                          <XCircle className="size-4" />
                        ) : (
                          <ArrowLeft className="size-4" />
                        )}
                      </div>
                      {idx < reviews.length - 1 && (
                        <div className="w-px flex-1 bg-border/60 mt-1" />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0 pt-1 pb-2">
                      <div className="flex items-center gap-2 flex-wrap text-xs mb-1">
                        <span className="font-bold capitalize text-foreground">
                          {t("submissions.detail.actions." + r.action, r.action)}
                        </span>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="text-muted-foreground capitalize">
                          {t("submissions.detail.timelineTier", { tier: r.tier })}
                        </span>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="text-muted-foreground">
                          {new Date(r.created_at).toLocaleString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      {r.comment && (
                        <p className="text-sm text-foreground bg-muted/40 rounded-lg px-3 py-2 mt-1.5 border border-border/60">
                          {r.comment}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <SubmissionContentTabs
            submission={submission}
            isDraft={!!isDraft}
            isCooperative={isEditor}
            isCreatorRole={isCreatorRole}
            role={role}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            isExtracting={!!isExtracting}
            extractionJob={extractionJob}
            financialQ={financialQ}
            nonFinancialQ={nonFinancialQ}
            isReadOnly={isReadOnly}
            sections={sections}
            handleNfUploadComplete={handleNfUploadComplete}
            nfResult={nfResult}
            submissionMethod={submissionMethod}
            methodChosen={methodChosen}
            onOpenMethodModal={() => setMethodModalOpen(true)}
          />
        </div>
      )}

      <SubmissionMethodModal
        open={methodModalOpen}
        submissionId={id ?? ""}
        onClose={() => setMethodModalOpen(false)}
        onMethodSelected={() => {
          queryClient.invalidateQueries({ queryKey: ["submission", id] });
          queryClient.invalidateQueries({ queryKey: ["cooperative-submissions"] });
        }}
      />
      <DeleteConfirmationDialog
        open={deleteModalOpen}
        onOpenChange={setDeleteModalOpen}
        entityName={submission ? submission.reference || submission.id.slice(0, 8) : ""}
        entityType="submission"
        entityId={submission?.id ?? ""}
        onVerifyIdentity={async (password, otp) => verifyIdentity({ password, otp })}
        onConfirmDelete={handleConfirmDelete}
      />
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
  const { t } = useTranslation();
  const hasComment = comment.trim().length > 0;
  const borderCls = onReject
    ? "border-l-4 border-l-destructive/50"
    : onReturn
      ? "border-l-4 border-l-warning/60"
      : "border-l-4 border-l-success/50";
  return (
    <div className={`rounded-xl border border-border bg-surface px-5 py-4 space-y-4 ${borderCls}`}>
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder={
          onReturn || onReject
            ? t("submissions.detail.reviewPlaceholderReason")
            : t("submissions.detail.reviewPlaceholderComment")
        }
        rows={2}
        className="w-full rounded-xl border border-input bg-muted/30 px-3 py-2.5 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-ring/20 resize-none"
      />
      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={onApprove}
          disabled={isPending}
          className="inline-flex items-center gap-2 rounded-xl bg-success px-5 py-2.5 text-sm font-semibold text-success-foreground hover:bg-success/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
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
            title={!hasComment ? t("submissions.detail.reviewTitleReturn") : undefined}
            className="inline-flex items-center gap-2 rounded-xl border border-warning/40 px-5 py-2.5 text-sm font-semibold text-warning-foreground hover:bg-warning/8 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
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
            title={!hasComment ? t("submissions.detail.reviewTitleReject") : undefined}
            className="inline-flex items-center gap-2 rounded-xl border border-destructive/30 px-5 py-2.5 text-sm font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <XCircle className="size-4" />
            )}
            {rejectLabel}
          </button>
        )}
        {(onReturn || onReject) && !hasComment && (
          <p className="text-[11px] text-muted-foreground ml-1">
            {t("submissions.detail.reviewCommentRequired")}
          </p>
        )}
      </div>
    </div>
  );
}
