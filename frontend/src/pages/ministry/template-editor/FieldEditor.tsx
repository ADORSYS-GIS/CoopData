import React from "react";
import { Plus, ChevronUp, ChevronDown, Edit, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TemplateSection, TemplateField } from "@/pages/cooperative/QuestionnaireWizard";

interface FieldEditorProps {
  activeSection: TemplateSection;
  openAddFieldModal: () => void;
  openEditFieldModal: (idx: number, field: TemplateField) => void;
  deleteField: (idx: number) => void;
  moveField: (idx: number, direction: "up" | "down") => void;
}

export const FieldEditor: React.FC<FieldEditorProps> = ({
  activeSection,
  openAddFieldModal,
  openEditFieldModal,
  deleteField,
  moveField,
}) => {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-4 font-sans">
      <div className="flex items-center justify-between border-b border-border/80 pb-2">
        <h4 className="text-sm font-bold text-foreground">
          {t("templateEditor.fieldEditor.title")}
        </h4>
        <button
          onClick={openAddFieldModal}
          className="flex items-center gap-1 rounded-lg bg-accent/15 border border-accent/25 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors cursor-pointer"
        >
          <Plus className="size-3.5" /> {t("templateEditor.fieldEditor.addQuestion")}
        </button>
      </div>

      {!activeSection.fields || activeSection.fields.length === 0 ? (
        <div className="py-10 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
          {t("templateEditor.fieldEditor.noQuestions")}
        </div>
      ) : (
        <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto pr-1">
          {activeSection.fields.map((field: TemplateField, fIdx: number) => (
            <div
              key={field.key || fIdx}
              className="rounded-xl border border-border bg-surface p-4 flex items-center justify-between gap-4 hover:shadow-md transition-all relative group"
            >
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm text-foreground break-words">
                    {field.label}
                  </span>
                  {field.required && (
                    <span className="text-[10px] font-semibold text-destructive bg-destructive/10 border border-destructive/25 rounded-md px-1.5 py-0.5">
                      {t("templateEditor.fieldEditor.required")}
                    </span>
                  )}
                </div>
                {field.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                    {field.description}
                  </p>
                )}

                <div className="flex items-center gap-3 mt-1.5 flex-wrap text-xs text-muted-foreground">
                  <span className="capitalize bg-muted border border-border px-2 py-0.5 rounded-md font-medium text-[11px]">
                    {t("templateEditor.fieldEditor.typeLabel")}
                    {field.type === "select"
                      ? t("templateEditor.fieldEditor.typeDropdown")
                      : field.type === "textarea"
                        ? t("templateEditor.fieldEditor.typeParagraph")
                        : field.type}
                  </span>

                  {field.type === "select" && field.options && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-semibold">
                        {t("templateEditor.fieldEditor.optionsLabel")}
                      </span>
                      {field.options.map((opt: string) => (
                        <span
                          key={opt}
                          className="bg-primary/10 border border-primary/20 text-primary font-medium px-1.5 py-0.5 rounded-md text-[10px]"
                        >
                          {opt}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions block */}
              <div className="flex items-center gap-1 shrink-0 bg-card border border-border p-1.5 rounded-xl shadow-sm opacity-90 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => moveField(fIdx, "up")}
                  disabled={fIdx === 0}
                  className="p-1 hover:bg-muted rounded text-muted-foreground disabled:opacity-30 cursor-pointer"
                  title={t("templateEditor.fieldEditor.tooltipMoveUp")}
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  onClick={() => moveField(fIdx, "down")}
                  disabled={fIdx === activeSection.fields.length - 1}
                  className="p-1 hover:bg-muted rounded text-muted-foreground disabled:opacity-30 cursor-pointer"
                  title={t("templateEditor.fieldEditor.tooltipMoveDown")}
                >
                  <ChevronDown className="size-4" />
                </button>
                <button
                  onClick={() => openEditFieldModal(fIdx, field)}
                  className="p-1 hover:bg-primary/10 hover:text-primary rounded text-muted-foreground cursor-pointer"
                  title={t("templateEditor.fieldEditor.tooltipEdit")}
                >
                  <Edit className="size-4" />
                </button>
                <button
                  onClick={() => deleteField(fIdx)}
                  className="p-1 hover:bg-destructive/10 hover:text-destructive rounded text-muted-foreground cursor-pointer"
                  title={t("templateEditor.fieldEditor.tooltipDelete")}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
