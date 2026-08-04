import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  CheckCircle2,
  XCircle,
  RefreshCw,
  ArrowUpRight,
  MessageSquare,
  FileText,
  X,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  User,
  Building2,
  Calendar,
  Hash,
} from "lucide-react";
import { toast } from "sonner";

// ─────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────

export type SubmissionStatus =
  | "Pending Review"
  | "Under Review"
  | "Approved"
  | "Rejected"
  | "Changes Requested"
  | "Forwarded to Federation"
  | "Forwarded to Ministry";

export interface SubmissionDetail {
  id: string;
  reference: string;
  coopName: string;
  type: string;
  submittedBy: string;
  submittedOn: string;
  status: SubmissionStatus;
  priority: string;
  // Financial summary
  totalAssets?: number;
  totalLiabilities?: number;
  totalEquity?: number;
  netSurplus?: number;
  balanceCheck?: boolean;
  // Review trail
  reviewTrail: ReviewEntry[];
  // Databases included
  databasesIncluded: string[];
}

export interface ReviewEntry {
  id: string;
  reviewerName: string;
  reviewerRole: string;
  action: "approved" | "rejected" | "changes_requested" | "forwarded" | "commented";
  comment: string;
  timestamp: string;
}

interface SubmissionReviewPanelProps {
  submission: SubmissionDetail;
  userRole: "ministry" | "federation" | "apex" | "cooperative";
  onApprove: (submissionId: string, comment: string) => void;
  onReject: (submissionId: string, comment: string) => void;
  onRequestChanges: (submissionId: string, comment: string) => void;
  onForward: (submissionId: string, comment: string) => void;
  onClose: () => void;
}

// ─────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────

const formatCurrency = (n: number) => {
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
};

const statusTone = (status: SubmissionStatus) => {
  switch (status) {
    case "Approved":
    case "Forwarded to Federation":
    case "Forwarded to Ministry":
      return "success" as const;
    case "Pending Review":
    case "Under Review":
      return "warning" as const;
    case "Rejected":
      return "danger" as const;
    case "Changes Requested":
      return "info" as const;
    default:
      return "neutral" as const;
  }
};

const actionIcon = (action: ReviewEntry["action"]) => {
  switch (action) {
    case "approved":
      return <CheckCircle2 className="size-4 text-success" />;
    case "rejected":
      return <XCircle className="size-4 text-destructive" />;
    case "changes_requested":
      return <RefreshCw className="size-4 text-info" />;
    case "forwarded":
      return <ArrowUpRight className="size-4 text-accent" />;
    case "commented":
      return <MessageSquare className="size-4 text-muted-foreground" />;
  }
};

// ─────────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────────

export function SubmissionReviewPanel({
  submission,
  userRole,
  onApprove,
  onReject,
  onRequestChanges,
  onForward,
  onClose,
}: SubmissionReviewPanelProps) {
  const { t } = useTranslation();
  const [comment, setComment] = useState("");
  const [showTrail, setShowTrail] = useState(true);
  const [showFinancials, setShowFinancials] = useState(true);

  const canReview =
    (userRole === "apex" && submission.status === "Pending Review") ||
    (userRole === "apex" && submission.status === "Changes Requested") ||
    (userRole === "federation" && submission.status === "Forwarded to Federation") ||
    (userRole === "federation" && submission.status === "Pending Review") ||
    userRole === "ministry";

  const canForward =
    (userRole === "apex" && submission.status === "Pending Review") ||
    (userRole === "apex" && submission.status === "Changes Requested");

  const isCooperative = userRole === "cooperative";

  const getStatusLabel = (status: SubmissionStatus) => {
    switch (status) {
      case "Pending Review":
        return t("submissions.reviewPanel.statuses.pending");
      case "Under Review":
        return t("submissions.reviewPanel.statuses.reviewing");
      case "Approved":
        return t("submissions.reviewPanel.statuses.approved");
      case "Rejected":
        return t("submissions.reviewPanel.statuses.rejected");
      case "Changes Requested":
        return t("submissions.reviewPanel.statuses.changes");
      case "Forwarded to Federation":
        return t("submissions.reviewPanel.statuses.fed");
      case "Forwarded to Ministry":
        return t("submissions.reviewPanel.statuses.min");
      default:
        return status;
    }
  };

  const getActionLabel = (action: ReviewEntry["action"]) => {
    switch (action) {
      case "approved":
        return t("submissions.reviewPanel.actions.approved");
      case "rejected":
        return t("submissions.reviewPanel.actions.rejected");
      case "changes_requested":
        return t("submissions.reviewPanel.actions.changes_requested");
      case "forwarded":
        return t("submissions.reviewPanel.actions.forwarded");
      case "commented":
        return t("submissions.reviewPanel.actions.commented");
      default:
        return action;
    }
  };

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 shadow-[var(--shadow-elev-2)] font-sans">
      {/* Header */}
      <div className="flex items-start justify-between p-5 border-b border-border">
        <div>
          <p className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase mb-1">
            {submission.reference}
          </p>
          <h3 className="text-lg font-bold text-foreground">{submission.coopName}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">
            {submission.type} ·{" "}
            {t("submissions.reviewPanel.filedOn", { date: submission.submittedOn })}
          </p>
        </div>
        <button
          onClick={onClose}
          className="size-8 rounded-lg grid place-items-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Status Badge */}
      <div className="px-5 py-3 border-b border-border bg-surface/50">
        <div className="flex items-center gap-3">
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full ${
              statusTone(submission.status) === "success"
                ? "bg-success/10 text-success"
                : statusTone(submission.status) === "warning"
                  ? "bg-warning/10 text-warning-foreground"
                  : statusTone(submission.status) === "danger"
                    ? "bg-destructive/10 text-destructive"
                    : statusTone(submission.status) === "info"
                      ? "bg-info/10 text-info"
                      : "bg-muted text-muted-foreground"
            }`}
          >
            {submission.status === "Pending Review" && <Clock className="size-3" />}
            {submission.status === "Approved" && <CheckCircle2 className="size-3" />}
            {submission.status === "Rejected" && <XCircle className="size-3" />}
            {submission.status === "Changes Requested" && <RefreshCw className="size-3" />}
            {submission.status === "Forwarded to Federation" && <ArrowUpRight className="size-3" />}
            {getStatusLabel(submission.status)}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("submissions.reviewPanel.priority", {
              priority: t(`submissions.detail.timelineTier`, {
                tier: submission.priority,
              }).toLowerCase(),
            })}
          </span>
        </div>
      </div>

      {/* Submission Details */}
      <div className="px-5 py-4 border-b border-border">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                {t("submissions.reviewPanel.cooperative")}
              </p>
              <p className="text-sm font-semibold text-foreground">{submission.coopName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <User className="size-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                {t("submissions.reviewPanel.filedBy")}
              </p>
              <p className="text-sm font-semibold text-foreground">{submission.submittedBy}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                {t("submissions.reviewPanel.date")}
              </p>
              <p className="text-sm font-semibold text-foreground">{submission.submittedOn}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Hash className="size-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                {t("submissions.reviewPanel.reference")}
              </p>
              <p className="text-sm font-mono font-semibold text-foreground">
                {submission.reference}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Databases Included */}
      {submission.databasesIncluded.length > 0 && (
        <div className="px-5 py-3 border-b border-border">
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2">
            {t("submissions.reviewPanel.databasesIncluded")}
          </p>
          <div className="flex flex-wrap gap-2">
            {submission.databasesIncluded.map((db) => (
              <span
                key={db}
                className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-muted text-foreground"
              >
                <FileText className="size-3" />
                {t(`submissions.detail.sections.${db.toLowerCase().replace(/ /g, "_")}.label`, db)}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Financial Summary */}
      {submission.totalAssets !== undefined && (
        <div className="px-5 py-3 border-b border-border">
          <button
            onClick={() => setShowFinancials(!showFinancials)}
            className="w-full flex items-center justify-between text-left cursor-pointer"
          >
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              {t("submissions.reviewPanel.financialSummary")}
            </p>
            {showFinancials ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>
          {showFinancials && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-3">
              <div className="p-3 rounded-lg bg-surface border border-border">
                <p className="text-[10px] text-muted-foreground">
                  {t("submissions.reviewPanel.totalAssets")}
                </p>
                <p className="text-sm font-bold text-foreground">
                  {formatCurrency(submission.totalAssets!)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-surface border border-border">
                <p className="text-[10px] text-muted-foreground">
                  {t("submissions.reviewPanel.liabilities")}
                </p>
                <p className="text-sm font-bold text-foreground">
                  {formatCurrency(submission.totalLiabilities!)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-surface border border-border">
                <p className="text-[10px] text-muted-foreground">
                  {t("submissions.reviewPanel.equity")}
                </p>
                <p className="text-sm font-bold text-foreground">
                  {formatCurrency(submission.totalEquity!)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-surface border border-border">
                <p className="text-[10px] text-muted-foreground">
                  {t("submissions.reviewPanel.netSurplus")}
                </p>
                <p
                  className={`text-sm font-bold ${(submission.netSurplus ?? 0) >= 0 ? "text-success" : "text-destructive"}`}
                >
                  {(submission.netSurplus ?? 0) >= 0 ? "+" : ""}
                  {formatCurrency(submission.netSurplus!)}
                </p>
              </div>
              <div className="p-3 rounded-lg bg-surface border border-border">
                <p className="text-[10px] text-muted-foreground">
                  {t("submissions.reviewPanel.balanceCheck")}
                </p>
                <p
                  className={`text-sm font-bold ${submission.balanceCheck ? "text-success" : "text-destructive"}`}
                >
                  {submission.balanceCheck
                    ? t("submissions.reviewPanel.balanced")
                    : t("submissions.reviewPanel.notBalanced")}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Review Trail */}
      {submission.reviewTrail.length > 0 && (
        <div className="px-5 py-3 border-b border-border">
          <button
            onClick={() => setShowTrail(!showTrail)}
            className="w-full flex items-center justify-between text-left cursor-pointer"
          >
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              {t("submissions.reviewPanel.reviewTrailTitle", {
                count: submission.reviewTrail.length,
              })}
            </p>
            {showTrail ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )}
          </button>
          {showTrail && (
            <div className="space-y-3 mt-3">
              {submission.reviewTrail.map((entry) => (
                <div key={entry.id} className="flex items-start gap-3">
                  <div className="mt-0.5">{actionIcon(entry.action)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">{entry.reviewerName}</p>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {t(`common.roles.${entry.reviewerRole.toLowerCase()}`, entry.reviewerRole)}
                      </span>
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {getActionLabel(entry.action)}
                      </span>
                    </div>
                    {entry.comment && (
                      <p className="text-xs text-muted-foreground mt-0.5">{entry.comment}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-0.5">{entry.timestamp}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Review Actions */}
      {canReview && !isCooperative && (
        <div className="p-5 space-y-4">
          {/* Comment Input */}
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              {t("submissions.reviewPanel.reviewComment")}
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                userRole === "apex"
                  ? t("submissions.reviewPanel.placeholderApex")
                  : userRole === "federation"
                    ? t("submissions.reviewPanel.placeholderFederation")
                    : t("submissions.reviewPanel.placeholderDefault")
              }
              rows={3}
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 resize-none transition-shadow"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {canForward && (
              <button
                onClick={() => {
                  onForward(
                    submission.id,
                    comment || "Approved by apex reviewer. Forwarded to federation for review.",
                  );
                  setComment("");
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition-colors cursor-pointer"
              >
                <ArrowUpRight className="size-4" />
                {t("submissions.reviewPanel.btnApproveForward")}
              </button>
            )}
            {(userRole === "federation" || userRole === "ministry") && (
              <button
                onClick={() => {
                  onApprove(submission.id, comment || "Submission approved.");
                  setComment("");
                }}
                className="inline-flex items-center gap-2 rounded-lg bg-success px-4 py-2.5 text-sm font-semibold text-white hover:bg-success/90 transition-colors cursor-pointer"
              >
                <CheckCircle2 className="size-4" />
                {t("submissions.reviewPanel.btnApprove")}
              </button>
            )}
            <button
              onClick={() => {
                if (!comment.trim()) {
                  toast.error(t("submissions.reviewPanel.toastRequestReason"));
                  return;
                }
                onRequestChanges(submission.id, comment);
                setComment("");
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-info bg-info/10 px-4 py-2.5 text-sm font-semibold text-info hover:bg-info/20 transition-colors cursor-pointer"
            >
              <RefreshCw className="size-4" />
              {t("submissions.reviewPanel.btnRequestChanges")}
            </button>
            <button
              onClick={() => {
                if (!comment.trim()) {
                  toast.error(t("submissions.reviewPanel.toastRejectReason"));
                  return;
                }
                onReject(submission.id, comment);
                setComment("");
              }}
              className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2.5 text-sm font-semibold text-white hover:bg-destructive/90 transition-colors cursor-pointer"
            >
              <XCircle className="size-4" />
              {t("submissions.reviewPanel.btnReject")}
            </button>
          </div>

          {/* Role-specific guidance */}
          <div className="p-3 rounded-lg bg-muted/30 border border-border">
            <p className="text-xs text-muted-foreground">
              {userRole === "apex" && <>{t("submissions.reviewPanel.guidanceApex")}</>}
              {userRole === "federation" && <>{t("submissions.reviewPanel.guidanceFederation")}</>}
              {userRole === "ministry" && <>{t("submissions.reviewPanel.guidanceMinistry")}</>}
            </p>
          </div>
        </div>
      )}

      {/* Cooperative View - Read Only */}
      {isCooperative && (
        <div className="p-5">
          <div className="p-3 rounded-lg bg-info/5 border border-info/20 flex items-start gap-3">
            <AlertTriangle className="size-4 text-info shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {t("submissions.reviewPanel.coopViewTitle")}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("submissions.reviewPanel.coopViewDesc", {
                  status: getStatusLabel(submission.status),
                })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default SubmissionReviewPanel;
