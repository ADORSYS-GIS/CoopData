import React from "react";
import { useParams, useSearch, useNavigate } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { QuestionnaireWizard } from "@/pages/cooperative/QuestionnaireWizard";
import { ClipboardList, FileSpreadsheet, ChevronLeft, BarChart3 } from "lucide-react";

const qSearchSchema = z.object({
  type: z.enum(["financial", "non_financial"]).optional(),
});

// ─── Type Selector (shown when no ?type= search param) ────────────────────────
function QuestionnaireSelectorPage({ submissionId }: { submissionId: string }) {
  const navigate = useNavigate();

  const options = [
    {
      type: "financial" as const,
      title: "Financial Questionnaire",
      description:
        "For Financial Primary Cooperatives (SACCOs). Covers membership, savings, loans, and financial performance.",
      icon: BarChart3,
      borderColor: "border-blue-500/20",
      bgColor: "from-blue-500/10 to-indigo-500/10",
      iconColor: "text-blue-600 dark:text-blue-400",
      btnClass: "bg-blue-600 hover:bg-blue-700",
    },
    {
      type: "non_financial" as const,
      title: "Non-Financial Questionnaire",
      description:
        "For Non-Financial Primary Cooperatives (Agriculture, Handicraft, Livestock etc.). Covers operations, membership, and key activities.",
      icon: ClipboardList,
      borderColor: "border-emerald-500/20",
      bgColor: "from-emerald-500/10 to-teal-500/10",
      iconColor: "text-emerald-600 dark:text-emerald-400",
      btnClass: "bg-emerald-600 hover:bg-emerald-700",
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <button
          onClick={() =>
            navigate({
              to: "/app/submissions/$id",
              params: { id: submissionId },
            })
          }
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronLeft className="size-4" />
          Back to Submission
        </button>

        <div className="mt-8 mb-8 text-center">
          <div className="size-16 rounded-3xl bg-primary/10 grid place-items-center mx-auto mb-4">
            <FileSpreadsheet className="size-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Select Questionnaire Type</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Choose the questionnaire that matches your cooperative's primary focus. Your answers are
            saved automatically as a draft.
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.type}
                onClick={() =>
                  navigate({
                    to: "/app/submissions/$id/questionnaire",
                    params: { id: submissionId },
                    search: { type: opt.type },
                  })
                }
                className={`group relative w-full rounded-2xl border bg-gradient-to-br p-6 text-left transition-all hover:shadow-lg hover:-translate-y-0.5 ${opt.borderColor} ${opt.bgColor}`}
              >
                <div className="flex items-start gap-4">
                  <div
                    className={`size-12 rounded-xl bg-background/60 grid place-items-center shrink-0 ${opt.iconColor}`}
                  >
                    <Icon className="size-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-foreground text-base">{opt.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{opt.description}</p>
                  </div>
                  <ChevronLeft className="size-5 text-muted-foreground rotate-180 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Route Component ───────────────────────────────────────────────────────────
function QuestionnaireRoute() {
  const { id: submissionId } = useParams({
    from: "/app/submissions_/$id/questionnaire",
  });
  const search = useSearch({ from: "/app/submissions_/$id/questionnaire" });
  const type = (search as { type?: "financial" | "non_financial" }).type;

  return (
    <ProtectedRoute>
      {!type ? (
        <QuestionnaireSelectorPage submissionId={submissionId} />
      ) : (
        <QuestionnaireWizard submissionId={submissionId} questionnaireType={type} />
      )}
    </ProtectedRoute>
  );
}

export const Route = createFileRoute("/app/submissions_/$id/questionnaire")({
  validateSearch: (search) => qSearchSchema.parse(search),
  component: QuestionnaireRoute,
});
