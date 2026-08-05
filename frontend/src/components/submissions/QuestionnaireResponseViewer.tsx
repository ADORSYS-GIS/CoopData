/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import {
  ClipboardList,
  AlertCircle,
  Loader2,
  CheckCircle2,
  Building2,
  Users,
  BookOpen,
  DollarSign,
  TrendingUp,
  BarChart3,
  HelpCircle,
} from "lucide-react";
import { useQuestionnaire, useActiveTemplate } from "@/hooks/submissions/useQuestionnaire";
import { useTranslation } from "react-i18next";

interface QuestionnaireResponseViewerProps {
  submissionId: string;
  questionnaireType?: "financial" | "non_financial";
}

const getEmoji = (iconName: string): string => {
  const map: Record<string, string> = {
    Building2: "🏢",
    Users: "👥",
    BookOpen: "📖",
    DollarSign: "💵",
    TrendingUp: "📈",
    BarChart3: "📊",
    ClipboardList: "📋",
  };
  return map[iconName] || iconName || "📋";
};

export const QuestionnaireResponseViewer: React.FC<QuestionnaireResponseViewerProps> = ({
  submissionId,
  questionnaireType,
}) => {
  const { t } = useTranslation();
  const {
    data: response,
    isLoading: isResponseLoading,
    error: responseError,
  } = useQuestionnaire(submissionId, questionnaireType);
  const qType = response?.questionnaire_type || questionnaireType;

  const { data: template, isLoading: isTemplateLoading } = useActiveTemplate(qType ?? "");
  const [selectedSectionIndex, setSelectedSectionIndex] = useState(0);

  if (isResponseLoading || isTemplateLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2.5">
        <Loader2 className="size-6 animate-spin text-primary opacity-60" />
        <span className="text-xs text-muted-foreground font-medium">
          {t("questionnaireViewer.loading")}
        </span>
      </div>
    );
  }

  if (responseError || !response) {
    return (
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-5 text-destructive text-sm flex items-center gap-2">
        <AlertCircle className="size-5" />
        <span>{t("questionnaireViewer.noData")}</span>
      </div>
    );
  }

  const sections = template?.sections || [];
  if (sections.length === 0) {
    // No response saved yet (fresh submission) — the type isn't known, so we
    // can't resolve a template. Guide the user to start the questionnaire
    // instead of showing a confusing "no template for type «»" error.
    if (!qType) {
      return (
        <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-6 text-center">
          <ClipboardList className="size-6 text-primary opacity-70 mx-auto mb-2" />
          <p className="text-xs font-semibold text-foreground">
            {t("questionnaireViewer.notStartedTitle", {
              defaultValue: "Questionnaire not started yet",
            })}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {t("questionnaireViewer.notStartedHint", {
              defaultValue: "Click the button above to begin and choose a questionnaire type.",
            })}
          </p>
        </div>
      );
    }
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-center text-xs text-muted-foreground">
        {t("questionnaireViewer.noTemplate", { type: response.questionnaire_type })}
      </div>
    );
  }

  const currentSection = sections[selectedSectionIndex] || sections[0];
  const answers = response.answers || {};

  const renderValue = (field: any, val: any) => {
    if (val === undefined || val === null || val === "") {
      return (
        <span className="text-muted-foreground italic font-normal">
          {t("questionnaireViewer.notProvided")}
        </span>
      );
    }
    if (typeof val === "boolean") {
      return val ? t("questionnaireViewer.yes") : t("questionnaireViewer.no");
    }
    if (field.type === "number") {
      return <span className="font-mono font-semibold">{Number(val).toLocaleString()}</span>;
    }
    return <span className="font-medium text-foreground">{String(val)}</span>;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
      {/* Sidebar: Sections list */}
      <div className="md:col-span-4 flex flex-col gap-1.5 bg-card/40 border border-border/80 rounded-2xl p-3">
        <div className="border-b border-border/60 pb-2 px-2">
          <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
            {t("questionnaireViewer.sections", {
              type:
                response.questionnaire_type === "financial"
                  ? t("questionnaireViewer.financial")
                  : t("questionnaireViewer.nonFinancial"),
            })}
          </h4>
        </div>
        <div className="flex flex-col gap-1 max-h-[400px] overflow-y-auto pr-1">
          {sections.map((sec: any, idx: number) => {
            const isSelected = selectedSectionIndex === idx;
            return (
              <button
                key={sec.id}
                onClick={() => setSelectedSectionIndex(idx)}
                className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                  isSelected
                    ? "bg-primary/5 border-primary/30 text-primary font-medium shadow-sm"
                    : "border-transparent hover:bg-muted/40 text-foreground"
                }`}
              >
                <div className={`p-1 text-base leading-none`}>{getEmoji(sec.icon)}</div>
                <span className="text-xs truncate">{sec.title}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content: Answers list */}
      <div className="md:col-span-8 rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col gap-5">
        <div className="flex items-start gap-3 border-b border-border/80 pb-3">
          <div className="size-10 rounded-xl bg-primary/5 flex items-center justify-center text-lg">
            {getEmoji(currentSection.icon || "")}
          </div>
          <div>
            <h3 className="text-base font-bold text-foreground">{currentSection.title}</h3>
            {currentSection.description && (
              <p className="text-xs text-muted-foreground mt-0.5">{currentSection.description}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(currentSection.fields || []).map((field: any) => {
            const val = answers[field.key];
            const isTextarea = field.type === "textarea";
            return (
              <div
                key={field.key}
                className={`flex flex-col gap-1 bg-surface/30 border border-border/40 p-3.5 rounded-xl ${
                  isTextarea ? "sm:col-span-2" : ""
                }`}
              >
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  {field.label}
                </span>
                <div className="text-sm mt-0.5 break-words">{renderValue(field, val)}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
export default QuestionnaireResponseViewer;
