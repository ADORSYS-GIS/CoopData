import React from "react";
import { useTranslation } from "react-i18next";
import type { TemplateSection } from "@/pages/cooperative/QuestionnaireWizard";
import { LocalizedField, type FieldTranslations } from "@/components/shared/LocalizedField";

interface SectionMetadataFormProps {
  activeSection: TemplateSection;
  selectedSectionIndex: number;
  updateSectionMeta: (idx: number, key: keyof TemplateSection, value: string) => void;
  availableEmojis: string[];
  titleTr: FieldTranslations;
  onTitleTrChange: (val: FieldTranslations) => void;
  descTr: FieldTranslations;
  onDescTrChange: (val: FieldTranslations) => void;
}

export const SectionMetadataForm: React.FC<SectionMetadataFormProps> = ({
  activeSection,
  selectedSectionIndex,
  updateSectionMeta,
  availableEmojis,
  titleTr,
  onTitleTrChange,
  descTr,
  onDescTrChange,
}) => {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-border pb-4 font-sans">
      <div className="col-span-1 sm:col-span-2">
        <LocalizedField
          id={`section-title-${selectedSectionIndex}`}
          label={t("templateEditor.sectionMeta.title")}
          value={activeSection.title}
          onChange={(v) => updateSectionMeta(selectedSectionIndex, "title", v)}
          translations={titleTr}
          onTranslationsChange={onTitleTrChange}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-muted-foreground uppercase">
            {t("templateEditor.sectionMeta.icon")}
          </label>
          <select
            value={activeSection.icon}
            onChange={(e) => updateSectionMeta(selectedSectionIndex, "icon", e.target.value)}
            className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {availableEmojis.map((emoji) => (
              <option key={emoji} value={emoji}>
                {emoji}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-bold text-muted-foreground uppercase">
            {t("templateEditor.sectionMeta.sectionId")}
          </label>
          <span className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-mono text-muted-foreground flex items-center min-h-[38px]">
            {activeSection.id}
          </span>
        </div>
      </div>

      <div className="col-span-1 sm:col-span-2">
        <LocalizedField
          id={`section-desc-${selectedSectionIndex}`}
          label={t("templateEditor.sectionMeta.descInstruction")}
          value={activeSection.description || ""}
          onChange={(v) => updateSectionMeta(selectedSectionIndex, "description", v)}
          translations={descTr}
          onTranslationsChange={onDescTrChange}
          placeholder={t("templateEditor.sectionMeta.placeholderDesc")}
          multiline
        />
      </div>
    </div>
  );
};
