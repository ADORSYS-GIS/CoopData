import React from "react";
import { AlertCircle, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";

export interface DeleteSubmissionModalProps {
  submission: { id: string; reference?: string | null };
  onClose: () => void;
  onConfirm: () => void;
  isPending: boolean;
}

export const DeleteSubmissionModal: React.FC<DeleteSubmissionModalProps> = ({
  submission,
  onClose,
  onConfirm,
  isPending,
}) => {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-surface rounded-2xl border border-border shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-destructive/10 grid place-items-center shrink-0">
              <AlertCircle className="size-5 text-destructive" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                {t("submissions.deleteConfirmationTitle", "Delete Submission")}
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t("submissions.deleteConfirmationWarning", "This action cannot be undone.")}
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
        <div className="px-6 pb-4">
          <p className="text-sm text-foreground">
            {t("submissions.deleteConfirmation", {
              ref: submission.reference ?? submission.id.slice(0, 8),
            })}
          </p>
        </div>
        <div className="flex gap-3 px-6 py-5">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 rounded-xl border border-border bg-transparent px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
          >
            {t("submissions.cancel", "Cancel")}
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-destructive px-4 py-2.5 text-sm font-semibold text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {isPending ? <Spinner size="sm" /> : t("submissions.delete", "Delete")}
          </button>
        </div>
      </div>
    </div>
  );
};
