import React from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Upload, PenLine, ClipboardList, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUpdateSubmissionMethod } from "@/hooks/submissions/useSubmissions";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export type SubmissionMethod = "upload" | "manual" | "questionnaire";

interface SubmissionMethodModalProps {
  open: boolean;
  submissionId: string;
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
  onClose,
  onMethodSelected,
}) => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const updateMethod = useUpdateSubmissionMethod();

  const options: MethodOption[] = [
    {
      value: "upload",
      icon: <Upload className="size-6 text-primary" />,
      title: t("submissions.methodModal.uploadTitle"),
      desc: t("submissions.methodModal.uploadDesc"),
      note: t("submissions.methodModal.uploadNote"),
      confirm: t("submissions.methodModal.confirmUpload"),
      accent: "border-primary/20 bg-primary/5 hover:border-primary/40 hover:bg-primary/10",
    },
    {
      value: "manual",
      icon: <PenLine className="size-6 text-accent" />,
      title: t("submissions.methodModal.manualTitle"),
      desc: t("submissions.methodModal.manualDesc"),
      note: t("submissions.methodModal.manualNote"),
      confirm: t("submissions.methodModal.confirmManual"),
      accent: "border-accent/25 bg-accent/5 hover:border-accent/40 hover:bg-accent/10",
    },
    {
      value: "questionnaire",
      icon: <ClipboardList className="size-6 text-emerald-600 dark:text-emerald-400" />,
      title: t("submissions.methodModal.questionnaireTitle"),
      desc: t("submissions.methodModal.questionnaireDesc"),
      note: t("submissions.methodModal.questionnaireNote"),
      confirm: t("submissions.methodModal.confirmQuestionnaire"),
      accent:
        "border-emerald-500/20 bg-emerald-500/5 hover:border-emerald-500/40 hover:bg-emerald-500/10",
    },
  ];

  const handleSelect = async (method: SubmissionMethod) => {
    try {
      await updateMethod.mutateAsync({ id: submissionId, submissionMethod: method });
      toast.success(
        t("submissions.methodModal.currentBadge", {
          method: t(
            `submissions.methodModal.${method === "upload" ? "uploadTitle" : method === "manual" ? "manualTitle" : "questionnaireTitle"}`,
          ),
        }),
      );
      queryClient.invalidateQueries({ queryKey: ["submission", submissionId] });
      onMethodSelected?.();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <div className="px-6 pt-6 pb-2">
          <DialogHeader className="text-left">
            <div className="flex items-center gap-2 mb-1">
              <div className="size-9 rounded-xl bg-accent/15 grid place-items-center">
                <ClipboardList className="size-5 text-accent" />
              </div>
              <DialogTitle className="text-lg font-bold text-foreground">
                {t("submissions.methodModal.title")}
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm text-muted-foreground">
              {t("submissions.methodModal.subtitle")}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="px-6 pb-6">
          <div className="flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-2.5 mb-4">
            <AlertCircle className="size-4 text-warning-foreground shrink-0" />
            <p className="text-xs font-semibold text-warning-foreground">
              {t("submissions.methodModal.choosePrompt")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {options.map((opt) => {
              const IconWrap = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleSelect(opt.value)}
                  disabled={updateMethod.isPending}
                  className={`rounded-2xl border text-left p-5 flex flex-col gap-3 transition-all group cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${opt.accent}`}
                >
                  <div className="size-12 rounded-xl bg-background/60 border border-border grid place-items-center">
                    {IconWrap}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{opt.title}</h4>
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {opt.desc}
                    </p>
                    <p className="text-[11px] text-muted-foreground/70 mt-2 leading-relaxed">
                      {opt.note}
                    </p>
                  </div>
                  <span className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary/90 text-primary-foreground px-4 py-2.5 text-sm font-semibold hover:bg-primary transition-colors shadow-sm">
                    {updateMethod.isPending ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      opt.icon
                    )}
                    {opt.confirm}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
