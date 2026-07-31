/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  BookOpen,
  BarChart3,
  Save,
  AlertCircle,
  Loader2,
  ClipboardList,
  Users,
  Building2,
  DollarSign,
  TrendingUp,
} from "lucide-react";
import {
  useQuestionnaire,
  useSaveQuestionnaire,
  useActiveTemplate,
} from "@/hooks/submissions/useQuestionnaire";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface QuestionnaireWizardProps {
  submissionId: string;
  questionnaireType: "financial" | "non_financial";
  onComplete?: () => void;
  onBack?: () => void;
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

// ─── Field Input Renderer ──────────────────────────────────────────────────────
const FieldInput: React.FC<{
  field: { key: string; label: string; type: string; options?: string[]; required?: boolean };
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}> = ({ field, value, onChange }) => {
  const { t } = useTranslation();
  const baseClass =
    "w-full rounded-xl border border-border bg-card/50 px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/45 focus:border-primary transition-all";

  if (field.type === "select" && field.options) {
    return (
      <select
        className={baseClass}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(field.key, e.target.value)}
        required={field.required}
      >
        <option value="">{t("questionnaire.select")}</option>
        {field.options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === "textarea") {
    return (
      <textarea
        rows={3}
        className={`${baseClass} resize-none`}
        value={(value as string) ?? ""}
        onChange={(e) => onChange(field.key, e.target.value)}
        placeholder={t("questionnaire.enterField", { field: field.label.toLowerCase() })}
        required={field.required}
      />
    );
  }

  return (
    <input
      type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
      className={baseClass}
      value={(value as string | number) ?? ""}
      onChange={(e) =>
        onChange(
          field.key,
          field.type === "number"
            ? e.target.value === ""
              ? ""
              : Number(e.target.value)
            : e.target.value,
        )
      }
      placeholder={
        field.type === "number"
          ? "0"
          : t("questionnaire.enterField", { field: field.label.toLowerCase() })
      }
      required={field.required}
    />
  );
};

// ─── Main Questionnaire Wizard ─────────────────────────────────────────────────
export const QuestionnaireWizard: React.FC<QuestionnaireWizardProps> = ({
  submissionId,
  questionnaireType,
  onComplete,
  onBack,
}) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentSection, setCurrentSection] = React.useState(0);
  const [answers, setAnswers] = React.useState<Record<string, unknown>>({});
  const [saveSuccess, setSaveSuccess] = React.useState(false);

  // Load the active questionnaire template dynamically
  const {
    data: template,
    isLoading: isTemplateLoading,
    error: templateError,
  } = useActiveTemplate(questionnaireType);
  const { data: existing, isLoading: isResponseLoading } = useQuestionnaire(
    submissionId,
    questionnaireType,
  );
  const saveMutation = useSaveQuestionnaire(submissionId);

  // Load existing answers when fetched
  React.useEffect(() => {
    if (existing?.answers && Object.keys(existing.answers).length > 0) {
      setAnswers(existing.answers as Record<string, unknown>);
    }
  }, [existing]);

  const sections = template?.sections || [];
  const section = sections[currentSection];

  const handleFieldChange = (key: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  };

  const handlePopulateTestData = () => {
    const mockAnswers: Record<string, unknown> = { ...answers };
    sections.forEach((sec: any) => {
      (sec.fields || []).forEach((field: any) => {
        if (field.type === "number") {
          if (field.key.includes("rate") || field.key.includes("percent")) {
            mockAnswers[field.key] = Math.floor(Math.random() * 15) + 5;
          } else if (field.key.includes("year") || field.key.includes("age")) {
            mockAnswers[field.key] = Math.floor(Math.random() * 40) + 20;
          } else {
            mockAnswers[field.key] = (Math.floor(Math.random() * 90) + 10) * 100;
          }
        } else if (field.type === "select" && field.options && field.options.length > 0) {
          const randOpt = field.options[Math.floor(Math.random() * field.options.length)];
          mockAnswers[field.key] = randOpt;
        } else if (field.type === "date") {
          mockAnswers[field.key] = new Date().toISOString().split("T")[0];
        } else if (field.type === "textarea") {
          mockAnswers[field.key] =
            `This is a sample test answer for "${field.label}" in the ${sec.title} section.`;
        } else {
          if (field.key.includes("name")) {
            mockAnswers[field.key] = "Unity Cooperative Society Ltd";
          } else if (field.key.includes("no") || field.key.includes("code")) {
            mockAnswers[field.key] = "COOP-" + Math.floor(Math.random() * 9000 + 1000);
          } else if (field.key.includes("email")) {
            mockAnswers[field.key] = "info@unitycoop.coop";
          } else {
            mockAnswers[field.key] = `Test ${field.label}`;
          }
        }
      });
    });
    setAnswers(mockAnswers);
    toast.success(t("questionnaire.testDataPopulated"));
  };

  const handleSave = async () => {
    await saveMutation.mutateAsync({
      questionnaire_type: questionnaireType,
      answers,
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  const handleSaveAndNext = async () => {
    // Validate current section's required fields
    const missing: string[] = [];
    (section.fields || []).forEach((field: any) => {
      if (field.required) {
        const val = answers[field.key];
        if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) {
          missing.push(field.label);
        }
      }
    });

    if (missing.length > 0) {
      toast.error(t("questionnaire.requiredFieldsSection", { fields: missing.join(", ") }));
      return;
    }

    await handleSave();
    if (currentSection < sections.length - 1) {
      setCurrentSection((s) => s + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmitAll = async () => {
    // Validate all sections
    const missing: Array<{ sectionTitle: string; fieldLabel: string; sectionIndex: number }> = [];
    sections.forEach((sec: any, secIdx: number) => {
      (sec.fields || []).forEach((field: any) => {
        if (field.required) {
          const val = answers[field.key];
          if (val === undefined || val === null || (typeof val === "string" && val.trim() === "")) {
            missing.push({
              sectionTitle: sec.title,
              fieldLabel: field.label,
              sectionIndex: secIdx,
            });
          }
        }
      });
    });

    if (missing.length > 0) {
      toast.error(
        t("questionnaire.cannotCompleteFields", {
          fields: missing.map((m) => `"${m.fieldLabel}" (${m.sectionTitle})`).join(", "),
        }),
      );
      // Focus/go to the first section with missing fields
      setCurrentSection(missing[0].sectionIndex);
      return;
    }

    await saveMutation.mutateAsync({
      questionnaire_type: questionnaireType,
      answers,
    });
    onComplete?.();
    navigate({ to: "/app/submissions/$id", params: { id: submissionId } });
  };

  if (isTemplateLoading || isResponseLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 gap-3">
        <Loader2 className="size-8 animate-spin text-primary opacity-60" />
        <span className="text-xs text-muted-foreground font-medium">
          {t("questionnaire.loadingConfig")}
        </span>
      </div>
    );
  }

  if (templateError || sections.length === 0) {
    return (
      <div className="max-w-md mx-auto py-20 px-4 text-center">
        <div className="size-12 rounded-full bg-destructive/10 grid place-items-center mx-auto mb-4 text-destructive">
          <AlertCircle className="size-6" />
        </div>
        <h2 className="text-lg font-bold text-foreground">
          {t("questionnaire.noQuestionnaireFound")}
        </h2>
        <p className="text-sm text-muted-foreground mt-2">
          {t("questionnaire.adminNotActivated", {
            type:
              questionnaireType === "financial"
                ? t("questionnaire.financial")
                : t("questionnaire.nonFinancial"),
          })}
        </p>
        <button
          onClick={
            onBack ?? (() => navigate({ to: "/app/submissions/$id", params: { id: submissionId } }))
          }
          className="mt-6 inline-flex items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold hover:bg-muted/50"
        >
          <ChevronLeft className="size-4" /> {t("questionnaire.goBack")}
        </button>
      </div>
    );
  }

  const progress = Math.round(((currentSection + 1) / sections.length) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      {/* Header */}
      <div className="border-b border-border/50 bg-card/85 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={
                  onBack ??
                  (() => navigate({ to: "/app/submissions/$id", params: { id: submissionId } }))
                }
                className="rounded-xl border border-border p-2 hover:bg-muted/50 transition-colors"
              >
                <ChevronLeft className="size-4" />
              </button>
              <div>
                <h1 className="text-base font-bold text-foreground">
                  {template?.label ||
                    (questionnaireType === "financial"
                      ? t("questionnaire.financial")
                      : t("questionnaire.nonFinancial"))}
                </h1>
                <p className="text-xs text-muted-foreground">
                  {t("questionnaire.sectionIndicator", {
                    section: currentSection + 1,
                    total: sections.length,
                    title: section.title,
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {saveSuccess && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-500 font-medium animate-in fade-in duration-300">
                  <CheckCircle2 className="size-4" /> {t("questionnaire.saved")}
                </span>
              )}
              {saveMutation.isPending && (
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" /> {t("questionnaire.saving")}
                </span>
              )}
              {saveMutation.isError && (
                <span className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="size-4" /> {t("questionnaire.failedSave")}
                </span>
              )}
              <button
                onClick={handlePopulateTestData}
                className="inline-flex items-center gap-1.5 rounded-xl border border-dashed border-primary/45 bg-primary/5 hover:bg-primary/10 px-3 py-2 text-sm font-semibold text-primary transition-colors cursor-pointer focus:outline-none"
              >
                {t("questionnaire.populateTestData")}
              </button>
              <button
                onClick={handleSave}
                disabled={saveMutation.isPending}
                className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-50"
              >
                <Save className="size-4 text-muted-foreground" />
                {t("questionnaire.saveDraft")}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Section tabs (scrollable) */}
          <div className="flex gap-1.5 mt-3 overflow-x-auto pb-1 scrollbar-none">
            {sections.map((s: any, idx: number) => {
              const isComplete = idx < currentSection;
              const isCurrent = idx === currentSection;
              return (
                <button
                  key={s.id}
                  onClick={() => setCurrentSection(idx)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all ${
                    isCurrent
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : isComplete
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="size-3" />
                  ) : (
                    <span className="text-[13px] leading-none">{getEmoji(s.icon)}</span>
                  )}
                  <span className="hidden sm:inline">{s.title}</span>
                  <span className="sm:hidden">{idx + 1}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Section body */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6 flex items-start gap-4">
          <div className="size-12 rounded-2xl bg-primary/10 flex items-center justify-center text-xl shrink-0">
            {getEmoji(section.icon || "")}
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">{section.title}</h2>
            {section.description && (
              <p className="text-sm text-muted-foreground mt-0.5">{section.description}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {(section.fields || []).map((field: any) => (
            <div
              key={field.key}
              className={`flex flex-col gap-1.5 ${field.type === "textarea" ? "sm:col-span-2" : ""}`}
            >
              <label className="text-sm font-medium text-foreground/80 mb-0.5">
                {field.label}
                {field.required && <span className="text-destructive ml-0.5">*</span>}
              </label>
              {field.description && (
                <span className="text-xs text-muted-foreground -mt-1 mb-1 leading-relaxed">
                  {field.description}
                </span>
              )}
              <FieldInput field={field} value={answers[field.key]} onChange={handleFieldChange} />
            </div>
          ))}
        </div>

        {/* Navigation */}
        <div className="mt-8 flex items-center justify-between border-t border-border/50 pt-6">
          <button
            onClick={() => {
              setCurrentSection((s) => Math.max(0, s - 1));
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            disabled={currentSection === 0}
            className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium hover:bg-muted/50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="size-4" />
            {t("questionnaire.previous")}
          </button>

          {currentSection < sections.length - 1 ? (
            <button
              onClick={handleSaveAndNext}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/95 transition-colors disabled:opacity-50 shadow-sm"
            >
              {t("questionnaire.saveNext")}
              <ChevronRight className="size-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmitAll}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm"
            >
              <CheckCircle2 className="size-4" />
              {t("questionnaire.complete")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
export default QuestionnaireWizard;
