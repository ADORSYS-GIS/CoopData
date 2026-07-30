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
import { useUserRole } from "@/lib/auth";
import {
  useSubmission,
  useDeleteSubmission,
  useSubmissionReviews,
  useDeleteFinancialStatement,
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
import { NfUploadZone } from "@/components/non-financial/NfUploadZone";
import { NfParseResults } from "@/components/non-financial/NfParseResults";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NonFinancialIndicatorsForm } from "@/components/submissions/non-financial-indicators-form";
import { QuestionnaireResponseViewer } from "@/components/submissions/QuestionnaireResponseViewer";
import { useQuestionnaire } from "@/hooks/submissions/useQuestionnaire";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import type { NfUploadResponse } from "@/types/non-financial";
import { useMembers } from "@/hooks/non-financial/useMembers";
import { useSavings } from "@/hooks/non-financial/useSavings";
import { useLoans } from "@/hooks/non-financial/useLoans";
import { useFixedDeposits } from "@/hooks/non-financial/useFixedDeposits";
import { useFarmCoops } from "@/hooks/non-financial/useFarmCoop";
import { getAccessToken } from "@/services/shared/authService";

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

const isQuestionnaireFilled = (q: any) => {
  return q && q.id && q.id !== "00000000-0000-0000-0000-000000000000";
};

// ── Document Viewer ────────────────────────────────────────────────────────────

const DocumentViewer: React.FC<{ src: string }> = ({ src }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [isPdf, setIsPdf] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    setBlobUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    setLoading(true);
    setError(false);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    (async () => {
      try {
        const token = await getAccessToken();
        const res = await fetch(src, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (cancelled) return;
        setIsPdf(blob.type === "application/pdf");
        setBlobUrl(URL.createObjectURL(blob));
      } catch {
        if (!cancelled) setError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  const clampZoom = (z: number) => Math.min(4, Math.max(0.25, z));

  const handleWheel = (e: React.WheelEvent) => {
    if (isPdf) return; // PDF uses native browser zoom
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.15 : -0.15;
    setZoom((z) => clampZoom(z + delta));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isPdf || zoom <= 1) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setDragging(false);

  const zoomIn = () => setZoom((z) => clampZoom(z + 0.25));
  const zoomOut = () => setZoom((z) => clampZoom(z - 0.25));
  const resetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const openInTab = () => {
    if (blobUrl) window.open(blobUrl, "_blank");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[420px] text-muted-foreground rounded-xl border border-border bg-muted/10">
        <Loader2 className="size-6 animate-spin mr-2" />
        <span className="text-sm">Loading document…</span>
      </div>
    );
  }

  if (error || !blobUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-[420px] text-muted-foreground rounded-xl border border-border bg-muted/10">
        <AlertCircle className="size-10 mb-3 opacity-40" />
        <p className="text-sm font-medium">Failed to load document</p>
        <p className="text-xs text-muted-foreground mt-1">The file may no longer be available</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-muted/5">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-4 py-2 bg-muted/30 border-b border-border">
        <div className="flex items-center gap-1">
          {!isPdf && (
            <>
              <button
                onClick={zoomOut}
                disabled={zoom <= 0.25}
                title="Zoom out"
                className="inline-flex items-center justify-center size-7 rounded-md hover:bg-muted/60 disabled:opacity-40 transition-colors text-muted-foreground hover:text-foreground"
              >
                <ZoomOut className="size-4" />
              </button>
              <span className="text-xs font-mono text-muted-foreground w-12 text-center select-none">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={zoomIn}
                disabled={zoom >= 4}
                title="Zoom in"
                className="inline-flex items-center justify-center size-7 rounded-md hover:bg-muted/60 disabled:opacity-40 transition-colors text-muted-foreground hover:text-foreground"
              >
                <ZoomIn className="size-4" />
              </button>
              <button
                onClick={resetView}
                title="Reset view"
                className="inline-flex items-center justify-center size-7 rounded-md hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground ml-1"
              >
                <Maximize2 className="size-4" />
              </button>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isPdf && (
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted/50 rounded px-2 py-0.5">
              PDF — use browser scroll to zoom
            </span>
          )}
          <button
            onClick={openInTab}
            title="Open in new tab"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground rounded-md px-2.5 py-1 hover:bg-muted/60 transition-colors"
          >
            <ExternalLink className="size-3.5" />
            Open full
          </button>
        </div>
      </div>

      {/* Viewer area */}
      {isPdf ? (
        <iframe
          src={blobUrl}
          className="w-full border-0"
          style={{ height: "72vh", minHeight: 480 }}
          title="Financial Statement"
        />
      ) : (
        <div
          ref={containerRef}
          className="relative overflow-hidden bg-[#1e1e1e]"
          style={{
            height: "72vh",
            minHeight: 480,
            cursor: zoom > 1 ? (dragging ? "grabbing" : "grab") : "default",
          }}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <img
            src={blobUrl}
            alt="Financial Statement"
            draggable={false}
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px)) scale(${zoom})`,
              transformOrigin: "center center",
              transition: dragging ? "none" : "transform 0.15s ease",
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              userSelect: "none",
            }}
          />
          {zoom > 1 && (
            <div className="absolute bottom-3 right-3 text-[10px] text-white/50 bg-black/30 rounded px-2 py-1 pointer-events-none select-none">
              Scroll to zoom · Drag to pan
            </div>
          )}
          {zoom <= 1 && (
            <div className="absolute bottom-3 right-3 text-[10px] text-white/50 bg-black/30 rounded px-2 py-1 pointer-events-none select-none">
              Scroll to zoom
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Clear Non-Financial Databases Button ──────────────────────────────────────

const ClearNonFinancialButton: React.FC<{ submissionId: string }> = ({ submissionId }) => {
  const deleteNf = useDeleteManualNonFinancialData(submissionId);

  const handleClick = async () => {
    if (
      !window.confirm(
        "Are you sure you want to clear all non-financial databases (membership, savings, loans, deposits, and farm profile)? This cannot be undone.",
      )
    )
      return;
    try {
      await deleteNf.mutateAsync();
      toast.success("Non-financial databases cleared successfully");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to clear databases");
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={deleteNf.isPending}
      className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors cursor-pointer"
    >
      {deleteNf.isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Trash2 className="size-3.5" />
      )}
      Clear Non-Financial Databases
    </button>
  );
};

// ── Delete File Button ────────────────────────────────────────────────────────

const DeleteFileButton: React.FC<{ submissionId: string }> = ({ submissionId }) => {
  const deleteFs = useDeleteFinancialStatement();

  const handleClick = async () => {
    if (
      !window.confirm(
        "Remove this file and its extracted data? The draft is kept — you can upload a corrected file right after.",
      )
    )
      return;
    try {
      await deleteFs.mutateAsync(submissionId);
      toast.success("File removed — upload a new one to replace it");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to remove file");
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={deleteFs.isPending}
      title="Remove file and re-upload a corrected version"
      className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50 transition-colors"
    >
      {deleteFs.isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <Trash2 className="size-3.5" />
      )}
      Remove &amp; Re-upload
    </button>
  );
};

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
  const [activeTab, setActiveTab] = useState("financial");
  const [updatingSectionKey, setUpdatingSectionKey] = useState<string | null>(null);
  const { data: reviews } = useSubmissionReviews(id);
  const { data: financialQ } = useQuestionnaire(id ?? "", "financial");
  const { data: nonFinancialQ } = useQuestionnaire(id ?? "", "non_financial");

  const params = { submission_id: id ?? "", page: 1, page_size: 1 };
  const { data: membersData } = useMembers(id ? params : undefined);
  const { data: savingsData } = useSavings(id ? params : undefined);
  const { data: loansData } = useLoans(id ? params : undefined);
  const { data: fdsData } = useFixedDeposits(id ? params : undefined);
  const { data: farmCoopsData } = useFarmCoops(id ? params : undefined);

  const hasUploadedData = (sectionKey: string): boolean => {
    if (sectionKey === "financial") {
      return !!submission?.financial_statement_id || isQuestionnaireFilled(financialQ);
    }
    if (sectionKey === "indicators") {
      return isQuestionnaireFilled(nonFinancialQ);
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

  if (!role) return null;

  const isReadOnly = submission ? submission.status !== "draft" || role !== "cooperative" : true;
  const isDraft = submission?.status === "draft";
  const isCooperative = role === "cooperative";
  const mappedSections = (sections ?? []).map((s) => {
    // If non-financial questionnaire is filled, database sections are implicitly ready
    if (
      isQuestionnaireFilled(nonFinancialQ) &&
      ["members", "savings", "loans", "fixed_deposits", "farm_coop"].includes(s.section)
    ) {
      return { ...s, status: "ready" };
    }
    return s;
  });
  const requiredSections = mappedSections.filter((s) => s.section !== "farm_coop");
  const allReady =
    requiredSections.length > 0 && requiredSections.every((s) => s.status === "ready");
  const canSubmit = isDraft && allReady && isCooperative && !isExtracting;

  const readyCount = requiredSections.filter((s) => s.status === "ready").length;
  const totalSectionsCount = requiredSections.length;
  const progressPercent = totalSectionsCount > 0 ? (readyCount / totalSectionsCount) * 100 : 0;
  const remainingSections = requiredSections
    .filter((s) => s.status !== "ready")
    .map((s) => s.section.replace(/_/g, " "));

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

  const sectionMeta = [
    {
      key: "financial",
      label: "Financial Statement",
      description: "Upload and review audited financial statement",
      tab: "financial",
      icon: FileText,
      pendingAction: "Upload File",
      progressAction: "Review & Mark Ready",
      readyAction: "View Statement",
    },
    {
      key: "members",
      label: "Membership Register",
      description: "Register of active, youth, women, and rural members",
      tab: "databases",
      icon: Database,
      pendingAction: "Upload Excel",
      readyAction: "View Register",
    },
    {
      key: "savings",
      label: "Savings Ledger",
      description: "Details of member savings accounts and frequencies",
      tab: "databases",
      icon: Database,
      pendingAction: "Upload Excel",
      readyAction: "View Savings",
    },
    {
      key: "loans",
      label: "Loan Book",
      description: "Current loan status, balances, and risk classifications",
      tab: "databases",
      icon: Database,
      pendingAction: "Upload Excel",
      readyAction: "View Loans",
    },
    {
      key: "fixed_deposits",
      label: "Fixed Deposits",
      description: "Term deposits, renewed accounts, and maturities",
      tab: "databases",
      icon: Database,
      pendingAction: "Upload Excel",
      readyAction: "View Deposits",
    },
    {
      key: "farm_coop",
      label: "Farm Cooperative Data (Optional)",
      description: "Production types, activities and compliance metrics",
      tab: "databases",
      icon: Database,
      pendingAction: "Upload Excel",
      readyAction: "View Farm Data",
    },

  ];

  return (
    <AppShell title="Submission Detail" subtitle="Review data, validate, and submit to Apex">
      {/* Back nav */}
      <div className="mb-6">
        <Link
          to="/app/submissions"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground transition-colors group"
        >
          <div className="size-7 rounded-lg border border-border bg-surface grid place-items-center group-hover:border-border/80 group-hover:bg-muted transition-colors">
            <ArrowLeft className="size-3.5" />
          </div>
          Back to Submissions
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
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="font-mono text-xl font-bold text-foreground tracking-tight">
                      {submission.reference ?? submission.id.slice(0, 8).toUpperCase()}
                    </h2>
                    <StatusPill tone={statusTone(submission.status)}>
                      {statusLabel(submission.status)}
                    </StatusPill>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Reporting year{" "}
                    <span className="font-semibold text-foreground">
                      {submission.reporting_year}
                    </span>
                    {" · "}
                    <span className="capitalize font-medium">{submission.current_tier}</span> tier
                  </p>
                </div>
                {isCooperative && submission.status !== "approved" && (
                  <button
                    onClick={handleDelete}
                    disabled={deleteMutation.isPending}
                    className="inline-flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {deleteMutation.isPending ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                    Delete Submission
                  </button>
                )}
              </div>

              {/* Metadata strip */}
              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border/40 pt-4 text-[12px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <Calendar className="size-3.5 text-muted-foreground/60" />
                  <span>
                    Created{" "}
                    {new Date(submission.created_at).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
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
                  <span className="capitalize">{submission.priority} Priority</span>
                </div>
                <div className="hidden sm:block h-3 w-px bg-border" />
                <div className="flex items-center gap-1.5">
                  <FileText className="size-3.5 text-muted-foreground/60" />
                  <span className="capitalize font-medium">{submission.current_tier} tier</span>
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
                    AI is extracting your financial data
                    <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-semibold text-accent">
                      <span className="size-1.5 rounded-full bg-accent animate-pulse" />
                      {extractionJob?.status ?? "processing"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Parsing the uploaded document and mapping values to the Chart of Accounts. This
                    process takes about 1 minute to 1 minute 30 seconds. Please do not close or
                    refresh this page.
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

          {isCooperative && isDraft && (
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
                        Submission Readiness Center
                      </h3>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        All 6 mandatory sections must be marked{" "}
                        <span className="font-semibold text-success">Ready</span> before submitting
                        to the Apex
                      </p>
                    </div>
                  </div>
                  {/* Progress pill */}
                  <div
                    className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold tabular-nums ${
                      allReady ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {readyCount}/{totalSectionsCount} done
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
                            {isReady ? "Ready" : isInProgress ? "In Progress" : "Pending"}
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
                              View →
                            </button>
                          ) : (
                            <div className="flex items-center gap-2">
                              {m.key !== "financial" && (hasUploadedData(m.key) || isInProgress) && (
                                <button
                                  onClick={async () => {
                                    setUpdatingSectionKey(m.key);
                                    try {
                                      await updateSection.mutateAsync({
                                        section: m.key,
                                        status: "ready",
                                      });
                                      toast.success(`${m.label} marked ready`);
                                    } catch (e) {
                                      toast.error(e instanceof Error ? e.message : "Failed to update");
                                    } finally {
                                      setUpdatingSectionKey(null);
                                    }
                                  }}
                                  disabled={updateSection.isPending}
                                  className="inline-flex items-center gap-1 rounded-lg bg-success text-white px-2 py-0.5 text-[10px] font-bold hover:bg-success/90 transition-colors shadow-sm disabled:opacity-50"
                                >
                                  {isUpdatingThis ? (
                                    <Loader2 className="size-2.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="size-2.5" />
                                  )}
                                  Mark Ready
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
                          All sections ready — you can submit now!
                        </span>
                      </>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="size-4 text-muted-foreground shrink-0" />
                          <span className="text-muted-foreground text-xs font-semibold">
                            Complete all sections to enable submission
                          </span>
                        </div>
                        {remainingSections.length > 0 && (
                          <p className="text-[10px] text-muted-foreground/70 pl-6 capitalize">
                            Remaining: {remainingSections.join(" · ")}
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {submission?.status !== "approved" && (
                      <button
                        onClick={handleDelete}
                        disabled={deleteMutation.isPending}
                        className="inline-flex items-center gap-2 rounded-xl border border-destructive/25 px-4 py-2 text-xs font-semibold text-destructive hover:bg-destructive/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="size-3.5" />
                        )}
                        Delete Draft
                      </button>
                    )}
                    <button
                      onClick={handleSubmit}
                      disabled={!canSubmit || submitMutation.isPending}
                      title={
                        !allReady ? "Please mark all 7 sections as ready to submit" : undefined
                      }
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
                      Submit to Apex
                    </button>
                  </div>
                </div>
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
            <Card title="Review History" subtitle="Audit trail for this submission">
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
                          r.action === "approve"
                            ? "bg-success/15 text-success ring-success/10"
                            : r.action === "reject"
                              ? "bg-destructive/15 text-destructive ring-destructive/10"
                              : "bg-warning/15 text-warning-foreground ring-warning/10"
                        }`}
                      >
                        {r.action === "approve" ? (
                          <CheckCircle2 className="size-4" />
                        ) : r.action === "reject" ? (
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
                        <span className="font-bold capitalize text-foreground">{r.action}</span>
                        <span className="text-muted-foreground/50">·</span>
                        <span className="text-muted-foreground capitalize">{r.tier} tier</span>
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

          {submission.submission_method === "questionnaire" ? (
            <Card
              title="Questionnaire Responses"
              subtitle="Guided form entries submitted by the cooperative"
              action={
                isDraft && (isCooperative || role === "ministry") ? (
                  <button
                    onClick={() =>
                      navigate({
                        to: "/app/submissions/$id/questionnaire",
                        params: { id: submission.id },
                      })
                    }
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                  >
                    <ClipboardList className="size-3.5" />
                    Edit Answers
                  </button>
                ) : undefined
              }
            >
              <QuestionnaireResponseViewer submissionId={submission.id} />
            </Card>
          ) : (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList id="detail-tabs-list" className="w-full grid grid-cols-2 mb-5 h-auto p-1">
                <TabsTrigger value="financial" className="flex items-center gap-2 py-2.5">
                  <FileText className="size-4" />
                  <span>Financial Statement</span>
                </TabsTrigger>
                <TabsTrigger value="databases" className="flex items-center gap-2 py-2.5">
                  <Database className="size-4" />
                  <span>Non-Financial Information</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="financial" className="space-y-4">
                {isExtracting && (
                  <Card
                    title="AI Extraction in Progress"
                    subtitle="Our AI engine is parsing and mapping the uploaded financial statement"
                  >
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <div className="relative mb-4">
                        <div className="size-16 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
                        <FileText className="size-6 text-primary absolute inset-0 m-auto animate-pulse" />
                      </div>
                      <h3 className="text-base font-bold text-foreground">Processing Document</h3>
                      <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                        This process takes about 1 minute to 1 minute 30 seconds. The page will
                        automatically update once the extraction completes. Please do not close or
                        refresh this page.
                      </p>
                      <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent capitalize">
                        Status: {extractionJob?.status || "Running"}
                      </div>
                    </div>
                  </Card>
                )}
                {submission.extraction_job_id && extractionJob?.source_file_id && !isExtracting && (
                  <Card
                    title="Uploaded Document"
                    subtitle="Original financial statement file"
                    action={
                      isDraft && isCooperative ? (
                        <DeleteFileButton submissionId={submission.id} />
                      ) : undefined
                    }
                  >
                    <DocumentViewer
                      src={`${import.meta.env.VITE_API_BASE_URL || ""}/api/v1/${role}/submissions/${submission.id}/files/${extractionJob.source_file_id}`}
                    />
                  </Card>
                )}
                {isQuestionnaireFilled(financialQ) ? (
                  <Card
                    title="Financial Questionnaire Responses"
                    subtitle="Guided form entries submitted by the cooperative"
                    action={
                      isDraft && isCooperative ? (
                        <button
                          onClick={() =>
                            navigate({
                              to: `/app/submissions/${submission.id}/questionnaire`,
                              search: { type: "financial" },
                            })
                          }
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                          <ClipboardList className="size-3.5" />
                          Edit Answers
                        </button>
                      ) : undefined
                    }
                  >
                    <QuestionnaireResponseViewer submissionId={submission.id} questionnaireType="financial" />
                  </Card>
                ) : (
                  <>
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
                        subtitle="Choose how you want to submit your financial data"
                      >
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2">
                          {/* Option 1: Upload */}
                          <div className="rounded-xl border border-border bg-muted/20 p-5 flex flex-col gap-3 hover:border-primary/30 hover:bg-primary/5 transition-all group">
                            <div className="size-10 rounded-xl bg-primary/10 grid place-items-center">
                              <Upload className="size-5 text-primary" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-foreground">Upload Document</h4>
                              <p className="text-xs text-muted-foreground mt-1">
                                Upload your audited balance sheet PDF or Excel file. Our AI will extract and map the data automatically.
                              </p>
                            </div>
                            <div className="mt-auto">
                              <UploadFinancialStatementWidget submissionId={submission.id} />
                            </div>
                          </div>

                          {/* Option 2: Manual Entry */}
                          <div className="rounded-xl border border-border bg-muted/20 p-5 flex flex-col gap-3 hover:border-accent/30 hover:bg-accent/5 transition-all group">
                            <div className="size-10 rounded-xl bg-accent/10 grid place-items-center">
                              <PenLine className="size-5 text-accent" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-foreground">Manual Entry</h4>
                              <p className="text-xs text-muted-foreground mt-1">
                                Don't have the file? Enter your financial data directly using our structured forms — all Chart of Accounts fields included.
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                navigate({
                                  to: "/app/submissions/$id/manual-entry",
                                  params: { id: submission.id },
                                  search: { step: "financial" },
                                })
                              }
                              className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors shadow-sm"
                            >
                              <PenLine className="size-4" />
                              Enter Data Manually
                            </button>
                          </div>

                          {/* Option 3: Questionnaire (Basic Cooperatives) */}
                          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex flex-col gap-3 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-all group">
                            <div className="size-10 rounded-xl bg-emerald-500/10 grid place-items-center">
                              <ClipboardList className="size-5 text-emerald-600 dark:text-emerald-400" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <h4 className="text-sm font-bold text-foreground">Questionnaire</h4>
                                <span className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 rounded-full px-2 py-0.5">Basic</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                For basic-tier cooperatives that cannot provide full financial ledgers. Answer guided questions to complete your submission.
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                navigate({
                                  to: "/app/submissions/$id/questionnaire",
                                  params: { id: submission.id },
                                  search: { type: "financial" },
                                })
                              }
                              className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                            >
                              <ClipboardList className="size-4" />
                              Start Questionnaire
                            </button>
                          </div>
                        </div>
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
                  </>
                )}
              </TabsContent>

              <TabsContent value="databases" className="space-y-4">
                {isQuestionnaireFilled(nonFinancialQ) ? (
                  <Card
                    title="Non-Financial Questionnaire Responses"
                    subtitle="Guided form entries submitted by the cooperative"
                    action={
                      isDraft && isCooperative ? (
                        <button
                          onClick={() =>
                            navigate({
                              to: `/app/submissions/${submission.id}/questionnaire`,
                              search: { type: "non_financial" },
                            })
                          }
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
                        >
                          <ClipboardList className="size-3.5" />
                          Edit Answers
                        </button>
                      ) : undefined
                    }
                  >
                    <QuestionnaireResponseViewer submissionId={submission.id} questionnaireType="non_financial" />
                  </Card>
                ) : (
                  <NfDatabasesTab
                    submissionId={submission.id}
                    isReadOnly={isReadOnly}
                    isDraft={!!isDraft}
                    isCooperative={isCooperative}
                    sections={sections}
                    onUploadComplete={handleNfUploadComplete}
                    nfResult={nfResult}
                  />
                )}
              </TabsContent>


          </Tabs>
          )}
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
            ? "Provide a reason for returning/rejecting (required)…"
            : "Add a comment (optional)…"
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
            title={!hasComment ? "A comment is required to return" : undefined}
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
            title={!hasComment ? "A comment is required to reject" : undefined}
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
            A comment is required to send back
          </p>
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
  const navigate = useNavigate();

  return (
    <div className="space-y-4">
      {isCooperative && isDraft && hasData && (
        <div className="flex justify-end pr-2">
          <ClearNonFinancialButton submissionId={submissionId} />
        </div>
      )}
      {isCooperative && isDraft && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Option 1: Upload Excel */}
          <Card
            title="Upload Non-Financial Databases"
            subtitle="Upload your Excel file containing member, savings, loan, and farm data"
            edge="primary"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                {[
                  { sheet: "NF MSHIP", label: "Members" },
                  { sheet: "NF S", label: "Savings" },
                  { sheet: "NF LOANS", label: "Loans" },
                  { sheet: "NF FS", label: "Fixed Deposits" },
                  { sheet: "NF FARM", label: "Farm Coop" },
                ].map(({ sheet, label }) => (
                  <div
                    key={sheet}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                  >
                    <span className="font-mono">{sheet}</span>
                    <span className="text-muted-foreground/50">·</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <NfUploadZone submissionId={submissionId} onUploadComplete={onUploadComplete} />
              {nfResult && <NfParseResults result={nfResult} />}
            </div>
          </Card>

          {/* Option 2: Manual Entry */}
          <Card
            title="Manual Entry"
            subtitle="Enter your member and database records directly using structured forms"
          >
            <div className="flex flex-col gap-4 h-full">
              <div className="flex flex-wrap gap-2">
                {[
                  { icon: "👥", label: "Members" },
                  { icon: "💰", label: "Savings" },
                  { icon: "📋", label: "Loans" },
                  { icon: "🏦", label: "Fixed Deposits" },
                ].map(({ icon, label }) => (
                  <div
                    key={label}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 px-3 py-1.5 text-xs font-semibold text-muted-foreground"
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Don't have the Excel file? Use our guided forms to enter your member, savings,
                loan, and deposit data row by row.
              </p>
              <button
                onClick={() =>
                  navigate({
                    to: "/app/submissions/$id/manual-entry",
                    params: { id: submissionId },
                    search: { step: "members" },
                  })
                }
                className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors shadow-sm w-full"
              >
                <Users className="size-4" />
                Enter Member Data Manually
              </button>
            </div>
          </Card>

          {/* Option 3: Questionnaire (Basic / Non-Financial Options) */}
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex flex-col gap-3 hover:border-emerald-500/40 hover:bg-emerald-500/10 transition-all group">
            <div className="size-10 rounded-xl bg-emerald-500/10 grid place-items-center">
              <ClipboardList className="size-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h4 className="text-sm font-bold text-foreground">Questionnaire</h4>
                <span className="text-[10px] font-semibold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 rounded-full px-2 py-0.5">Basic</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                For non-financial cooperatives (Agriculture, Handicraft, etc.). Answer guided questions to complete your submission.
              </p>
            </div>
            <button
              onClick={() =>
                navigate({
                  to: "/app/submissions/$id/questionnaire",
                  params: { id: submissionId },
                  search: { type: "non_financial" },
                })
              }
              className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <ClipboardList className="size-4" />
              Start Non-Financial Questionnaire
            </button>
          </div>
        </div>
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
              className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 border border-success/25 px-2.5 py-1 text-xs font-semibold text-success hover:bg-success/15 disabled:opacity-50 transition-colors"
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
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted/50"
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
