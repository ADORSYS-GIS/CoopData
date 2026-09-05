import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Upload, PenLine, ClipboardList, AlertTriangle, ArrowRight, RotateCcw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUpdateSubmissionMethod } from "@/hooks/submissions/useSubmissions";
import { apiClient } from "@/openapi-client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";

export type SubmissionMethod = "upload" | "manual" | "questionnaire";

interface SubmissionMethodModalProps {
  open: boolean;
  submissionId: string;
  currentMethod?: SubmissionMethod | null;
  hasExistingData?: boolean;
  onClose: () => void;
  onMethodSelected?: () => void;
}

interface MethodOption {
  value: SubmissionMethod;
  icon: React.ReactNode;
  title: string;
  desc: string;
  note: string;
  confirm: string;
  accent: string;
}

export const SubmissionMethodModal: React.FC<SubmissionMethodModalProps> = ({
  open,
  submissionId,
  currentMethod,
  hasExistingData = false,
  onClose,
  onMethodSelected,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const updateMethod = useUpdateSubmissionMethod();
  const [pendingTargetMethod, setPendingTargetMethod] = useState<SubmissionMethod | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  const options: MethodOption[] = [
    {
      value: "upload",
      icon: <Upload className="size-6 text-primary" />,
      title: t("submissions.methodModal.uploadTitle", "Excel / PDF Upload"),
      desc: t(
        "submissions.methodModal.uploadDesc",
        "Upload financial statements and non-financial Excel templates",
      ),
      note: t(
        "submissions.methodModal.uploadNote",
        "Automated AI line-item extraction and template parsing",
      ),
      confirm: t("submissions.methodModal.confirmUpload", "Select Upload"),
      accent: "border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/10",
    },
    {
      value: "manual",
      icon: <PenLine className="size-6 text-accent" />,
      title: t("submissions.methodModal.manualTitle", "Manual Form Entry"),
      desc: t(
        "submissions.methodModal.manualDesc",
        "Direct web form & grid entry for financial and sub-ledger data",
      ),
      note: t(
        "submissions.methodModal.manualNote",
        "Interactive step-by-step wizard with built-in validation",
      ),
      confirm: t("submissions.methodModal.confirmManual", "Select Manual Form"),
      accent: "border-accent/25 bg-accent/5 hover:border-accent/40 hover:bg-accent/10",
    },
    {
      value: "questionnaire",
      icon: <ClipboardList className="size-6 text-success dark:text-success" />,
      title: t("submissions.methodModal.questionnaireTitle", "Questionnaire"),
      desc: t("submissions.methodModal.questionnaireDesc", "Fill guided regulatory questionnaires"),
      note: t("submissions.methodModal.questionnaireNote", "Custom questionnaire field structure"),
      confirm: t("submissions.methodModal.confirmQuestionnaire", "Select Questionnaire"),
      accent:
        "border-success/30/20 bg-success/100/5 hover:border-success/30/40 hover:bg-success/100/10",
    },
  ];

  const handleClose = () => {
    setPendingTargetMethod(null);
    setIsResetting(false);
    onClose();
  };

  const executeMethodSwitch = async (targetMethod: SubmissionMethod, resetData: boolean) => {
    setIsResetting(true);
    try {
      if (resetData) {
        // Clear financial statement and line items
        await apiClient
          .DELETE("/api/v1/cooperative/submissions/{id}/financial-statement", {
            params: { path: { id: submissionId } },
          })
          .catch(() => null);

        // Clear non-financial sub-ledger records
        await apiClient
          .DELETE("/api/v1/cooperative/submissions/{id}/non-financial", {
            params: { path: { id: submissionId } },
          })
          .catch(() => null);
      }

      await updateMethod.mutateAsync({ id: submissionId, submissionMethod: targetMethod });

      toast.success(
        resetData
          ? t(
              "submissions.methodModal.resetSuccess",
              "Submission method updated and existing data reset.",
            )
          : t("submissions.methodModal.currentBadge", {
              method:
                targetMethod === "upload"
                  ? "Upload"
                  : targetMethod === "manual"
                    ? "Manual Entry"
                    : "Questionnaire",
            }),
      );

      // Invalidate queries to ensure a fresh state
      queryClient.invalidateQueries({ queryKey: ["submission", submissionId] });
      queryClient.invalidateQueries({ queryKey: ["cooperative-submissions"] });
      queryClient.invalidateQueries({ queryKey: ["line-items"] });
      queryClient.invalidateQueries({ queryKey: ["financial-statement"] });
      queryClient.invalidateQueries({ queryKey: ["members"] });
      queryClient.invalidateQueries({ queryKey: ["savings"] });
      queryClient.invalidateQueries({ queryKey: ["loans"] });
      queryClient.invalidateQueries({ queryKey: ["fixed-deposits"] });
      queryClient.invalidateQueries({ queryKey: ["non-financial-members"] });
      queryClient.invalidateQueries({ queryKey: ["non-financial-savings"] });
      queryClient.invalidateQueries({ queryKey: ["non-financial-loans"] });
      queryClient.invalidateQueries({ queryKey: ["non-financial-fixed-deposits"] });

      onMethodSelected?.();
      handleClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    } finally {
      setIsResetting(false);
    }
  };

  const handleSelect = (targetMethod: SubmissionMethod) => {
    if (currentMethod && targetMethod !== currentMethod && hasExistingData) {
      // Require confirmation to reset existing data when changing methods
      setPendingTargetMethod(targetMethod);
    } else {
      void executeMethodSwitch(targetMethod, false);
    }
  };

  const targetOption = options.find((o) => o.value === pendingTargetMethod);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        {pendingTargetMethod ? (
          /* Reset Confirmation View */
          <div className="p-6 space-y-6">
            <DialogHeader className="text-left">
              <div className="flex items-center gap-3 mb-1">
                <div className="size-10 rounded-xl bg-destructive/15 grid place-items-center shrink-0">
                  <AlertTriangle className="size-5 text-destructive" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-foreground">
                    {t(
                      "submissions.methodModal.confirmResetTitle",
                      "Reset Existing Data & Switch Method?",
                    )}
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    {t(
                      "submissions.methodModal.confirmResetSubtitle",
                      "To ensure a clean, consistent submission, changing submission methods will reset previous entries.",
                    )}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 space-y-3">
              <div className="flex items-start gap-2.5">
                <RotateCcw className="size-4 text-destructive shrink-0 mt-0.5" />
                <p className="text-xs text-foreground leading-relaxed">
                  {t(
                    "submissions.methodModal.resetWarningText",
                    "Switching from your current method to '{{targetMethod}}' will clear all existing financial statement line items and non-financial database entries attached to this submission.",
                    { targetMethod: targetOption?.title ?? pendingTargetMethod },
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setPendingTargetMethod(null)}
                disabled={isResetting}
                className="rounded-xl border border-border bg-surface px-4 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors cursor-pointer disabled:opacity-50"
              >
                {t("cancel", "Cancel")}
              </button>
              <button
                type="button"
                onClick={() => executeMethodSwitch(pendingTargetMethod, true)}
                disabled={isResetting}
                className="inline-flex items-center gap-2 rounded-xl bg-destructive px-5 py-2 text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isResetting ? <Spinner size="sm" /> : <RotateCcw className="size-3.5" />}
                {t(
                  "submissions.methodModal.btnResetAndSwitch",
                  "Clear Existing Data & Switch Method",
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Selection Options View */
          <>
            <div className="px-6 pt-6 pb-2">
              <DialogHeader className="text-left">
                <div className="flex items-center gap-2 mb-1">
                  <div className="size-9 rounded-xl bg-accent/15 grid place-items-center">
                    <ClipboardList className="size-5 text-accent" />
                  </div>
                  <DialogTitle className="text-lg font-bold text-foreground">
                    {t("submissions.methodModal.title", "Choose Submission Method")}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-sm text-muted-foreground">
                  {t(
                    "submissions.methodModal.subtitle",
                    "Select how your cooperative will complete both financial and non-financial information for this submission.",
                  )}
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="px-6 pb-6">
              {hasExistingData && (
                <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-2.5 mb-4">
                  <AlertTriangle className="size-4 text-warning shrink-0" />
                  <p className="text-xs font-semibold text-warning">
                    {t(
                      "submissions.methodModal.existingDataNotice",
                      "Notice: Data already exists for this submission. Changing methods will clear existing data to maintain uniform submission records.",
                    )}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {options.map((opt) => {
                  const IconWrap = opt.icon;
                  const isCurrent = currentMethod === opt.value;
                  return (
                    <button
                      key={opt.value}
                      onClick={() => handleSelect(opt.value)}
                      disabled={updateMethod.isPending || isResetting}
                      className={`rounded-2xl border text-left p-5 flex flex-col gap-3 transition-all group cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${
                        isCurrent ? "ring-2 ring-primary border-primary bg-primary/10" : opt.accent
                      }`}
                    >
                      <div className="size-12 rounded-xl bg-background/60 border border-border grid place-items-center">
                        {IconWrap}
                      </div>
                      <div>
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold text-foreground">{opt.title}</h4>
                          {isCurrent && (
                            <span className="text-[10px] font-bold text-primary bg-primary/15 px-2 py-0.5 rounded-full">
                              Active
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                          {opt.desc}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-2 leading-relaxed">
                          {opt.note}
                        </p>
                      </div>
                      <span className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary/90 text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-primary transition-colors shadow-sm">
                        {updateMethod.isPending || isResetting ? (
                          <Spinner size="sm" />
                        ) : (
                          <ArrowRight className="size-4" />
                        )}
                        {isCurrent
                          ? t("submissions.methodModal.activeMethod", "Currently Active")
                          : opt.confirm}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};
