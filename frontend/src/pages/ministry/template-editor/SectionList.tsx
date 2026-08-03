import React from "react";
import { Plus, ChevronUp, ChevronDown, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TemplateSection } from "@/pages/cooperative/QuestionnaireWizard";

interface SectionListProps {
  sections: TemplateSection[];
  selectedSectionIndex: number | null;
  setSelectedSectionIndex: (idx: number) => void;
  addSection: () => void;
  moveSection: (idx: number, direction: "up" | "down") => void;
  deleteSection: (idx: number) => void;
  getEmoji: (icon: string) => string;
}

export const SectionList: React.FC<SectionListProps> = ({
  sections,
  selectedSectionIndex,
  setSelectedSectionIndex,
  addSection,
  moveSection,
  deleteSection,
  getEmoji,
}) => {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col gap-3 font-sans">
      <div className="flex items-center justify-between border-b border-border pb-2">
        <h3 className="text-sm font-bold text-foreground">{t("templateEditor.sectionList.title")}</h3>
        <button
          onClick={addSection}
          className="flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15 transition-colors cursor-pointer"
        >
          <Plus className="size-3.5" /> {t("templateEditor.sectionList.addSection")}
        </button>
      </div>

      {sections.length === 0 ? (
        <div className="py-6 text-center text-xs text-muted-foreground">
          {t("templateEditor.sectionList.noSections")}
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 max-h-[400px] overflow-y-auto">
          {sections.map((sec, idx) => {
            const isSelected = selectedSectionIndex === idx;
            return (
              <div
                key={sec.id}
                onClick={() => setSelectedSectionIndex(idx)}
                className={`group flex items-center justify-between gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? "bg-primary/5 border-primary/30 text-primary font-medium"
                    : "border-border/60 hover:bg-muted/40 text-foreground"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`p-1.5 rounded-lg bg-muted text-base leading-none`}>
                    {getEmoji(sec.icon)}
                  </div>
                  <span className="text-xs truncate">{sec.title || t("templateEditor.sectionList.untitledSection")}</span>
                </div>

                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveSection(idx, "up");
                    }}
                    disabled={idx === 0}
                    className="p-1 hover:bg-muted rounded text-muted-foreground disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronUp className="size-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      moveSection(idx, "down");
                    }}
                    disabled={idx === sections.length - 1}
                    className="p-1 hover:bg-muted rounded text-muted-foreground disabled:opacity-30 cursor-pointer"
                  >
                    <ChevronDown className="size-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSection(idx);
                    }}
                    className="p-1 hover:bg-destructive/10 hover:text-destructive rounded text-muted-foreground cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
