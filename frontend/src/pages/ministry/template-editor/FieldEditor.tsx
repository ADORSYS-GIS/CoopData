import React from "react";
import { Plus, ChevronUp, ChevronDown, Edit, Trash2 } from "lucide-react";

interface FieldEditorProps {
  activeSection: any;
  openAddFieldModal: () => void;
  openEditFieldModal: (idx: number, field: any) => void;
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
  return (
    <div className="flex flex-col gap-4 font-sans">
      <div className="flex items-center justify-between border-b border-border/80 pb-2">
        <h4 className="text-sm font-bold text-foreground">Questions / Form Fields</h4>
        <button
          onClick={openAddFieldModal}
          className="flex items-center gap-1 rounded-lg bg-accent/15 border border-accent/25 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors cursor-pointer"
        >
          <Plus className="size-3.5" /> Add Question
        </button>
      </div>

      {!activeSection.fields || activeSection.fields.length === 0 ? (
        <div className="py-10 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
          No questions in this section yet. Click "Add Question" to start building your form.
        </div>
      ) : (
        <div className="flex flex-col gap-4 max-h-[500px] overflow-y-auto pr-1">
          {activeSection.fields.map((field: any, fIdx: number) => (
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
                      Required
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
                    Type:{" "}
                    {field.type === "select"
                      ? "Dropdown Choice"
                      : field.type === "textarea"
                        ? "Paragraph Text"
                        : field.type}
                  </span>

                  {field.type === "select" && field.options && (
                    <div className="flex items-center gap-1 flex-wrap">
                      <span className="font-semibold">Options:</span>
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
                  title="Move up"
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  onClick={() => moveField(fIdx, "down")}
                  disabled={fIdx === activeSection.fields.length - 1}
                  className="p-1 hover:bg-muted rounded text-muted-foreground disabled:opacity-30 cursor-pointer"
                  title="Move down"
                >
                  <ChevronDown className="size-4" />
                </button>
                <button
                  onClick={() => openEditFieldModal(fIdx, field)}
                  className="p-1 hover:bg-primary/10 hover:text-primary rounded text-muted-foreground cursor-pointer"
                  title="Edit question"
                >
                  <Edit className="size-4" />
                </button>
                <button
                  onClick={() => deleteField(fIdx)}
                  className="p-1 hover:bg-destructive/10 hover:text-destructive rounded text-muted-foreground cursor-pointer"
                  title="Delete question"
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
