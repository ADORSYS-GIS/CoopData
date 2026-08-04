import React, { useState } from "react";
import {
  ClipboardList,
  Edit,
  Loader2,
  AlertCircle,
  Building2,
  FileSpreadsheet,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuestionnaireTemplates } from "@/hooks/admin/useQuestionnaireTemplates";
import { QuestionnaireTemplateEditor } from "./QuestionnaireTemplateEditor";

export const QuestionnaireTemplatesPage: React.FC = () => {
  const { t } = useTranslation();
  const { data: templates, isLoading, error } = useQuestionnaireTemplates();
  const [editorTemplateId, setEditorTemplateId] = useState<string | null>(null);

  if (editorTemplateId) {
    return (
      <QuestionnaireTemplateEditor
        templateId={editorTemplateId}
        onBack={() => setEditorTemplateId(null)}
      />
    );
  }

  // Filter so we only show the active template for each type
  const activeTemplates = (templates || []).filter((t) => t.is_active);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-heading font-bold text-foreground">
            {t("questionnaireTemplates.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t("questionnaireTemplates.desc")}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="size-6 animate-spin mr-2" /> {t("questionnaireTemplates.loading")}
        </div>
      ) : error ? (
        <div className="p-6 rounded-2xl border border-destructive/20 bg-destructive/5 text-destructive text-sm flex items-center gap-2.5">
          <AlertCircle className="size-5" />
          {t("questionnaireTemplates.failedLoad", { error: String(error) })}
        </div>
      ) : activeTemplates.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card py-16 text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
          <ClipboardList className="size-10 opacity-30" />
          <h4 className="font-bold text-foreground">{t("questionnaireTemplates.noActiveFound")}</h4>
          <p className="max-w-xs text-xs mt-1">{t("questionnaireTemplates.seedDbMsg")}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-muted/40 border-b border-border/80 text-muted-foreground uppercase font-bold tracking-wider">
                <th className="px-6 py-4">{t("questionnaireTemplates.tableHeaders.nameLabel")}</th>
                <th className="px-6 py-4">{t("questionnaireTemplates.tableHeaders.type")}</th>
                <th className="px-6 py-4">{t("questionnaireTemplates.tableHeaders.version")}</th>
                <th className="px-6 py-4">
                  {t("questionnaireTemplates.tableHeaders.lastUpdated")}
                </th>
                <th className="px-6 py-4 text-right">
                  {t("questionnaireTemplates.tableHeaders.actions")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {activeTemplates.map((tItem) => (
                <tr key={tItem.id} className="hover:bg-muted/10 transition-colors">
                  <td className="px-6 py-4 font-semibold text-foreground">{tItem.label}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full font-semibold border ${
                        tItem.questionnaire_type === "financial"
                          ? "bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400"
                          : "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      {tItem.questionnaire_type === "financial"
                        ? t("questionnaireTemplates.typeFinancial")
                        : t("questionnaireTemplates.typeNonFinancial")}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-mono font-bold text-muted-foreground">
                    v{tItem.version}
                  </td>
                  <td className="px-6 py-4 text-muted-foreground">
                    {new Date(tItem.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setEditorTemplateId(tItem.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card hover:bg-muted/40 text-foreground transition-colors font-semibold"
                        title={t("questionnaireTemplates.editFieldsTooltip")}
                      >
                        <Edit className="size-3.5" />
                        {t("questionnaireTemplates.editFieldsBtn")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
export default QuestionnaireTemplatesPage;
