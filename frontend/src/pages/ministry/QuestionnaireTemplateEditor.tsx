/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect, useMemo, useRef } from "react";
import { ArrowLeft, Save, AlertCircle, FolderPlus, CheckCircle2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useQuestionnaireTemplate,
  useUpdateQuestionnaireTemplate,
} from "@/hooks/admin/useQuestionnaireTemplates";
import { toast } from "sonner";
import { SectionList } from "./template-editor/SectionList";
import { SectionMetadataForm } from "./template-editor/SectionMetadataForm";
import { FieldEditor } from "./template-editor/FieldEditor";
import { FieldModal } from "./template-editor/FieldModal";
import { LocalizedField, type FieldTranslations } from "@/components/shared/LocalizedField";
import {
  CANONICAL_LANG,
  NON_EN_LANGS,
  type ContentLanguage,
  type QuestionnaireTranslations,
  fieldTranslation,
  setFieldTranslation,
  setLabelTranslation,
  setSectionTranslation,
} from "@/lib/contentLocalization";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";

interface QuestionnaireTemplateEditorProps {
  templateId: string;
  initialTemplate?: import("@/hooks/admin/useQuestionnaireTemplates").QuestionnaireTemplate;
  onBack: () => void;
}

interface FieldConfig {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  description?: string;
}

const AVAILABLE_EMOJIS = ["🏢", "👥", "📖", "💵", "📈", "📊", "📋", "❓"];

const getEmoji = (iconName: string): string => {
  const map: Record<string, string> = {
    Building2: "🏢",
    Users: "👥",
    BookOpen: "📖",
    DollarSign: "💵",
    TrendingUp: "📈",
    BarChart3: "📊",
    ClipboardList: "📋",
    FileText: "📋",
    HelpCircle: "❓",
  };
  return map[iconName] || iconName || "📋";
};

/**
 * Automatically deduplicates any duplicate field keys across all sections.
 */
const sanitizeSectionKeys = (rawSections: any[]): any[] => {
  const seenKeys = new Set<string>();
  return rawSections.map((sec) => ({
    ...sec,
    fields: (sec.fields || []).map((field: any) => {
      let key = field.key?.trim() || `field_${Date.now()}`;
      if (seenKeys.has(key)) {
        const baseKey = key;
        let counter = 1;
        while (seenKeys.has(`${baseKey}_${counter}`)) {
          counter++;
        }
        key = `${baseKey}_${counter}`;
      }
      seenKeys.add(key);
      return { ...field, key };
    }),
  }));
};

// Merge canonical sections with translations for a given language (read-only display).
function mergeSectionsForLang(
  canonical: any[],
  translations: QuestionnaireTranslations,
  lang: string,
): any[] {
  if (!lang || lang === CANONICAL_LANG) return canonical;
  return canonical.map((sec: any) => {
    const secTr = translations[lang]?.sections?.[sec.id];
    const fields = (sec.fields || []).map((f: any) => {
      const fTr = translations[lang]?.sections?.[sec.id]?.fields?.[f.key];
      return {
        ...f,
        label: fTr?.label ? fTr.label : f.label,
        description: fTr?.description ? fTr.description : f.description,
        options: fTr?.options ? fTr.options : f.options,
      };
    });
    return {
      ...sec,
      title: secTr?.title ? secTr.title : sec.title,
      description: secTr?.description ? secTr.description : sec.description,
      fields,
    };
  });
}

export const QuestionnaireTemplateEditor: React.FC<QuestionnaireTemplateEditorProps> = ({
  templateId,
  initialTemplate,
  onBack,
}) => {
  const { t, i18n } = useTranslation();
  const { data: template, isLoading, error } = useQuestionnaireTemplate(templateId);
  const updateMutation = useUpdateQuestionnaireTemplate(templateId);

  // Pre-populate from initialTemplate immediately (avoids blank editor on first render)
  const [label, setLabel] = useState(initialTemplate?.label ?? "");
  const [labelTr, setLabelTr] = useState<FieldTranslations>({});
  const [sections, setSections] = useState<any[]>(() => {
    const raw = initialTemplate?.sections;
    return Array.isArray(raw) ? raw : [];
  });
  const [translations, setTranslations] = useState<QuestionnaireTranslations>(
    (initialTemplate?.translations as QuestionnaireTranslations) ?? {},
  );
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(
    Array.isArray(initialTemplate?.sections) && (initialTemplate?.sections as unknown[]).length > 0
      ? 0
      : null,
  );
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Ref to preserve selectedSectionIndex across save operations
  const preservedSectionIndex = useRef<number | null>(null);

  // Delete confirmation dialog state
  const [deleteFieldDialogOpen, setDeleteFieldDialogOpen] = useState(false);
  const [fieldToDeleteIndex, setFieldToDeleteIndex] = useState<number | null>(null);

  // Field Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFieldIndex, setModalFieldIndex] = useState<number | null>(null);
  const [modalLabel, setModalLabel] = useState("");
  const [modalLabelTr, setModalLabelTr] = useState<FieldTranslations>({});
  const [modalType, setModalType] = useState("text");
  const [modalDescription, setModalDescription] = useState("");
  const [modalDescTr, setModalDescTr] = useState<FieldTranslations>({});
  const [modalRequired, setModalRequired] = useState(true);
  const [modalOptions, setModalOptions] = useState<string[]>([]);
  const [modalOptionsTr, setModalOptionsTr] = useState<FieldTranslations[]>([]);
  const [newOptionText, setNewOptionText] = useState("");

  // Display language: the editor renders read-only surfaces (section list titles,
  // field labels/options) in the app's current language when a translation exists,
  // while the editable inputs (metadata + per-field Translate toggles) stay canonical.
  const displayLang = i18n.language?.split("-")[0] || "en";
  const displaySections = useMemo(
    () => mergeSectionsForLang(sections, translations, displayLang),
    [sections, translations, displayLang],
  );

  // Load template details when query succeeds
  useEffect(() => {
    if (template) {
      setLabel(template.label);
      const tr = (template.translations as QuestionnaireTranslations) ?? {};
      setTranslations(tr);
      if (tr.en) {
        // label is canonical; labelTr only holds non-en
        const acc: FieldTranslations = {};
        for (const lang of NON_EN_LANGS) {
          acc[lang] = tr[lang]?.label;
        }
        setLabelTr(acc);
      } else {
        setLabelTr({});
      }
      const cleanSections = sanitizeSectionKeys(template.sections || []);
      setSections(cleanSections);
      // Restore preserved section index if valid, otherwise default to first section
      if ((template.sections || []).length > 0) {
        const preservedIdx = preservedSectionIndex.current;
        if (
          preservedIdx !== null &&
          preservedIdx !== undefined &&
          preservedIdx >= 0 &&
          preservedIdx < template.sections.length
        ) {
          setSelectedSectionIndex(preservedIdx);
        } else {
          setSelectedSectionIndex(0);
        }
        // Clear the preserved index after use
        preservedSectionIndex.current = null;
      }
    }
  }, [template]);

  // Aggregate a field's per-language label translations for the modal.
  const readFieldTr = (
    sectionId: string,
    fieldKey: string,
    field: "label" | "description",
  ): FieldTranslations => {
    const acc: FieldTranslations = {};
    for (const lang of NON_EN_LANGS) {
      if (lang === CANONICAL_LANG) continue;
      const f = fieldTranslation(translations, lang, sectionId, fieldKey);
      acc[lang] = f?.[field];
    }
    return acc;
  };

  const readFieldOptionsTr = (
    sectionId: string,
    fieldKey: string,
    count: number,
  ): FieldTranslations[] => {
    const arr: FieldTranslations[] = [];
    for (let i = 0; i < count; i++) {
      const acc: FieldTranslations = {};
      for (const lang of NON_EN_LANGS) {
        if (lang === CANONICAL_LANG) continue;
        acc[lang] = fieldTranslation(translations, lang, sectionId, fieldKey)?.options?.[i];
      }
      arr.push(acc);
    }
    return arr;
  };

  // Persist a field's modal translations (all languages at once) under its key.
  const persistFieldTranslations = (
    nextTranslations: QuestionnaireTranslations,
    sectionId: string,
    fieldKey: string,
    labelTr: FieldTranslations,
    descTr: FieldTranslations,
    optionsTr: FieldTranslations[],
  ) => {
    let next = nextTranslations;
    for (const lang of NON_EN_LANGS) {
      if (lang === CANONICAL_LANG) continue;
      const patch: { label?: string; description?: string; options?: (string | undefined)[] } = {};
      if (labelTr[lang] !== undefined) patch.label = labelTr[lang];
      if (descTr[lang] !== undefined) patch.description = descTr[lang];
      if (modalType === "select" && optionsTr.length) {
        const hasAnyTranslation = optionsTr.some(
          (o) => o[lang] !== undefined && o[lang] !== null && o[lang].trim() !== "",
        );
        if (hasAnyTranslation) {
          patch.options = optionsTr.map((o) => o[lang]);
        } else {
          patch.options = undefined;
        }
      } else {
        patch.options = undefined;
      }
      next = setFieldTranslation(next, lang, sectionId, fieldKey, patch as any);
    }
    return next;
  };

  const handleSave = async (sectionsToSave?: any[]) => {
    const rawList = sectionsToSave ?? sections;
    const listToSave = sanitizeSectionKeys(rawList);
    setSections(listToSave);
    // Preserve current section index before save
    preservedSectionIndex.current = selectedSectionIndex;
    try {
      setSaveMessage(null);
      // Validate unique keys
      const keys = new Set<string>();
      for (const section of listToSave) {
        for (const field of section.fields || []) {
          if (!field.key || field.key.trim() === "") {
            throw new Error(t("templateEditor.toastBlankKey", { title: section.title }));
          }
          if (keys.has(field.key)) {
            throw new Error(t("templateEditor.toastDuplicateKey", { key: field.key }));
          }
          keys.add(field.key);
        }
      }

      // Persist label translation
      let nextTr = translations;
      for (const lang of NON_EN_LANGS) {
        if (lang === CANONICAL_LANG) continue;
        if (labelTr[lang]) nextTr = setLabelTranslation(nextTr, lang, labelTr[lang]!);
      }

      await updateMutation.mutateAsync({
        label,
        sections: listToSave,
        translations: nextTr,
      });
      setTranslations(nextTr);

      toast.success(t("templateEditor.toastSaved"));
    } catch (err: any) {
      // Clear preserved index on error
      preservedSectionIndex.current = null;
      toast.error(err.message || t("templateEditor.toastSaveFailed"));
    }
  };

  // Section Management
  const addSection = () => {
    const newSection = {
      id: `section_${Date.now()}`,
      title: t("templateEditor.newSectionDefaultTitle"),
      icon: "📋",
      description: t("templateEditor.newSectionDefaultDesc"),
      fields: [],
    };
    const updated = [...sections, newSection];
    setSections(updated);
    setSelectedSectionIndex(updated.length - 1);
    handleSave(updated);
  };

  const deleteSection = (index: number) => {
    if (!window.confirm(t("templateEditor.confirmDeleteSection"))) return;
    const updated = sections.filter((_, i) => i !== index);
    setSections(updated);
    if (selectedSectionIndex === index) {
      setSelectedSectionIndex(updated.length > 0 ? 0 : null);
    } else if (selectedSectionIndex !== null && selectedSectionIndex > index) {
      setSelectedSectionIndex(selectedSectionIndex - 1);
    }
    handleSave(updated);
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index === 0) return;
    if (direction === "down" && index === sections.length - 1) return;

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    const updated = [...sections];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;

    setSections(updated);
    if (selectedSectionIndex === index) {
      setSelectedSectionIndex(targetIndex);
    } else if (selectedSectionIndex === targetIndex) {
      setSelectedSectionIndex(index);
    }
    handleSave(updated);
  };

  const updateSectionMeta = (index: number, key: string, value: any) => {
    const updated = [...sections];
    updated[index] = { ...updated[index], [key]: value };
    setSections(updated);
  };

  // ---- section-level translation helpers ----
  const secTrTitle = (index: number): FieldTranslations => {
    const sec = sections[index];
    const acc: FieldTranslations = {};
    if (!sec) return acc;
    for (const lang of NON_EN_LANGS) {
      if (lang === CANONICAL_LANG) continue;
      acc[lang] = translations[lang]?.sections?.[sec.id]?.title;
    }
    return acc;
  };
  const secTrDesc = (index: number): FieldTranslations => {
    const sec = sections[index];
    const acc: FieldTranslations = {};
    if (!sec) return acc;
    for (const lang of NON_EN_LANGS) {
      if (lang === CANONICAL_LANG) continue;
      acc[lang] = translations[lang]?.sections?.[sec.id]?.description;
    }
    return acc;
  };
  const setSecTr = (
    index: number,
    patch: { title?: FieldTranslations; description?: FieldTranslations },
  ) => {
    const sec = sections[index];
    if (!sec) return;
    let next = translations;
    for (const lang of NON_EN_LANGS) {
      if (lang === CANONICAL_LANG) continue;
      if (patch.title?.[lang])
        next = setSectionTranslation(next, lang, sec.id, { title: patch.title![lang]! });
      if (patch.description?.[lang])
        next = setSectionTranslation(next, lang, sec.id, {
          description: patch.description![lang]!,
        });
    }
    setTranslations(next);
  };

  // Field Modal handlers
  const openAddFieldModal = () => {
    setModalFieldIndex(null);
    setModalLabel("");
    setModalLabelTr({});
    setModalDescription("");
    setModalDescTr({});
    setModalType("text");
    setModalRequired(true);
    setModalOptions([]);
    setModalOptionsTr([]);
    setNewOptionText("");
    setIsModalOpen(true);
  };

  const openEditFieldModal = (index: number, field: FieldConfig) => {
    setModalFieldIndex(index);
    const sec = sections[selectedSectionIndex!];
    setModalLabel(field.label);
    setModalLabelTr(readFieldTr(sec.id, field.key, "label"));
    setModalDescription(field.description || "");
    setModalDescTr(readFieldTr(sec.id, field.key, "description"));
    setModalType(field.type);
    setModalRequired(field.required ?? true);
    const options = field.options || [];
    setModalOptions(options);
    setModalOptionsTr(readFieldOptionsTr(sec.id, field.key, options.length));
    setNewOptionText("");
    setIsModalOpen(true);
  };

  const addOption = () => {
    if (!newOptionText.trim()) return;
    if (modalOptions.includes(newOptionText.trim())) return;
    setModalOptions([...modalOptions, newOptionText.trim()]);
    setModalOptionsTr([...modalOptionsTr, {}]);
    setNewOptionText("");
  };

  const deleteOption = (optIndex: number) => {
    setModalOptions(modalOptions.filter((_, i) => i !== optIndex));
    setModalOptionsTr(modalOptionsTr.filter((_, i) => i !== optIndex));
  };

  const setOptionTranslation = (optIndex: number, lang: ContentLanguage, val: string) => {
    setModalOptionsTr((prev) => {
      const next = [...prev];
      next[optIndex] = { ...(next[optIndex] ?? {}), [lang]: val };
      return next;
    });
  };

  const handleSaveModalField = () => {
    if (!modalLabel.trim()) {
      alert(t("templateEditor.alertLabelRequired"));
      return;
    }
    if (selectedSectionIndex === null) return;

    const section = sections[selectedSectionIndex];
    const updated = [...sections];
    const sec = updated[selectedSectionIndex];

    let fieldKey: string;
    if (modalFieldIndex === null) {
      const baseKey =
        modalLabel
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "") || `field_${Date.now()}`;

      // Check all existing field keys across all sections to prevent collisions
      const existingKeys = new Set<string>();
      for (const s of sections) {
        for (const f of s.fields || []) {
          existingKeys.add(f.key);
        }
      }

      let generatedKey = baseKey;
      let counter = 1;
      while (existingKeys.has(generatedKey)) {
        generatedKey = `${baseKey}_${counter}`;
        counter++;
      }
      fieldKey = generatedKey;
      const newField: FieldConfig = {
        key: generatedKey,
        label: modalLabel.trim(),
        description: modalDescription.trim() || undefined,
        type: modalType,
        required: modalRequired,
        options: modalType === "select" ? modalOptions : [],
      };
      sec.fields = [...(sec.fields || []), newField];
    } else {
      const existingField = sec.fields[modalFieldIndex];
      fieldKey = existingField.key;
      sec.fields[modalFieldIndex] = {
        key: existingField.key,
        label: modalLabel.trim(),
        description: modalDescription.trim() || undefined,
        type: modalType,
        required: modalRequired,
        options: modalType === "select" ? modalOptions : [],
      };
    }

    const sanitizedUpdated = sanitizeSectionKeys(updated);
    setSections(sanitizedUpdated);
    setIsModalOpen(false);

    const nextTr = persistFieldTranslations(
      translations,
      section.id,
      fieldKey,
      modalLabelTr,
      modalDescTr,
      modalOptionsTr,
    );
    setTranslations(nextTr);

    // Persist both canonical sections and translations together.
    void (async () => {
      // Preserve current section index before save
      preservedSectionIndex.current = selectedSectionIndex;
      try {
        await updateMutation.mutateAsync({ label, sections: sanitizedUpdated, translations: nextTr });
        toast.success(t("templateEditor.toastSaved"));
      } catch (err: any) {
        // Clear preserved index on error
        preservedSectionIndex.current = null;
        toast.error(err.message || t("templateEditor.toastSaveFailed"));
      }
    })();
  };

  const deleteField = (fieldIndex: number) => {
    if (selectedSectionIndex === null) return;
    setFieldToDeleteIndex(fieldIndex);
    setDeleteFieldDialogOpen(true);
  };

  const confirmDeleteField = () => {
    if (fieldToDeleteIndex === null || selectedSectionIndex === null) return;
    // Preserve current section index before save
    preservedSectionIndex.current = selectedSectionIndex;
    const updated = [...sections];
    const section = updated[selectedSectionIndex];
    section.fields = section.fields.filter((_: any, i: number) => i !== fieldToDeleteIndex);
    setSections(updated);
    setDeleteFieldDialogOpen(false);
    setFieldToDeleteIndex(null);
    handleSave(updated);
  };

  const moveField = (fieldIndex: number, direction: "up" | "down") => {
    if (selectedSectionIndex === null) return;
    // Preserve current section index before save
    preservedSectionIndex.current = selectedSectionIndex;
    const updated = [...sections];
    const section = updated[selectedSectionIndex];
    if (direction === "up" && fieldIndex === 0) return;
    if (direction === "down" && fieldIndex === section.fields.length - 1) return;

    const targetIndex = direction === "up" ? fieldIndex - 1 : fieldIndex + 1;
    const temp = section.fields[fieldIndex];
    section.fields[fieldIndex] = section.fields[targetIndex];
    section.fields[targetIndex] = temp;

    setSections(updated);
    handleSave(updated);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <AlertCircle className="size-5 animate-spin mr-2" /> {t("templateEditor.loading")}
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="p-6 rounded-2xl border border-destructive/20 bg-destructive/5 text-destructive">
        <AlertCircle className="size-6 mb-2" />
        <h4 className="font-bold">{t("templateEditor.failedLoad")}</h4>
        <p className="text-sm mt-1">{String(error || "Template not found")}</p>
        <button
          onClick={onBack}
          className="mt-4 px-4 py-2 bg-background border rounded-lg text-foreground hover:bg-muted text-xs"
        >
          {t("templateEditor.backBtn")}
        </button>
      </div>
    );
  }

  const activeSection = selectedSectionIndex !== null ? sections[selectedSectionIndex] : null;

  // Display language: the editor renders read-only surfaces (section titles, field
  // labels/options) in the app's current language when a translation exists, while
  // the editable inputs (metadata + per-field Translate toggles) stay canonical.
  const displayActiveSection =
    selectedSectionIndex !== null ? displaySections[selectedSectionIndex] : null;

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto py-4 relative">
      {/* Top action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="rounded-xl border border-border p-2 hover:bg-muted/50 transition-colors"
            title={t("templateEditor.backTooltip")}
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">
              {t("templateEditor.titleFormBuilder")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t("templateEditor.subtitleFormBuilder", {
                type:
                  template.questionnaire_type === "financial"
                    ? t("templateEditor.typeFinancial")
                    : t("templateEditor.typeNonFinancial"),
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave()}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/95 transition-all shadow-sm"
          >
            <Save className="size-4" />
            {t("templateEditor.saveChanges")}
          </button>
        </div>
      </div>

      {saveMessage && (
        <div
          className={`flex items-center gap-2.5 p-4 rounded-xl border text-sm font-medium ${
            saveMessage.type === "success"
              ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"
              : "border-destructive/20 bg-destructive/5 text-destructive"
          }`}
        >
          {saveMessage.type === "success" ? (
            <CheckCircle2 className="size-4" />
          ) : (
            <AlertCircle className="size-4" />
          )}
          {saveMessage.text}
        </div>
      )}

      {/* Template Metadata */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <LocalizedField
          id="template-label"
          label={t("templateEditor.metaLabel")}
          value={label}
          onChange={setLabel}
          translations={labelTr}
          onTranslationsChange={setLabelTr}
          placeholder={t("templateEditor.metaPlaceholder")}
        />
      </div>

      {/* Builder Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left column: Sections list */}
        <div className="md:col-span-4 flex flex-col gap-4">
          <SectionList
            sections={displaySections}
            selectedSectionIndex={selectedSectionIndex}
            setSelectedSectionIndex={setSelectedSectionIndex}
            addSection={addSection}
            moveSection={moveSection}
            deleteSection={deleteSection}
            getEmoji={getEmoji}
          />
        </div>

        {/* Right column: Fields configuration in the selected section */}
        <div className="md:col-span-8">
          {activeSection && selectedSectionIndex !== null ? (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col gap-6">
              <SectionMetadataForm
                activeSection={activeSection}
                selectedSectionIndex={selectedSectionIndex}
                updateSectionMeta={updateSectionMeta}
                availableEmojis={AVAILABLE_EMOJIS}
                titleTr={secTrTitle(selectedSectionIndex)}
                onTitleTrChange={(v) => setSecTr(selectedSectionIndex, { title: v })}
                descTr={secTrDesc(selectedSectionIndex)}
                onDescTrChange={(v) => setSecTr(selectedSectionIndex, { description: v })}
              />
              <FieldEditor
                activeSection={displayActiveSection}
                openAddFieldModal={openAddFieldModal}
                openEditFieldModal={openEditFieldModal}
                deleteField={deleteField}
                moveField={moveField}
              />
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-12 shadow-sm text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
              <FolderPlus className="size-8 opacity-45" />
              <span>{t("templateEditor.selectSectionPrompt")}</span>
            </div>
          )}
        </div>
      </div>

      {/* Field Configuration Popup / Modal */}
      <FieldModal
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        modalFieldIndex={modalFieldIndex}
        modalLabel={modalLabel}
        setModalLabel={setModalLabel}
        modalLabelTr={modalLabelTr}
        setModalLabelTr={setModalLabelTr}
        modalDescription={modalDescription}
        setModalDescription={setModalDescription}
        modalDescTr={modalDescTr}
        setModalDescTr={setModalDescTr}
        modalType={modalType}
        setModalType={setModalType}
        modalRequired={modalRequired}
        setModalRequired={setModalRequired}
        modalOptions={modalOptions}
        setModalOptions={setModalOptions}
        modalOptionsTr={modalOptionsTr}
        setModalOptionsTr={setModalOptionsTr}
        newOptionText={newOptionText}
        setNewOptionText={setNewOptionText}
        addOption={addOption}
        deleteOption={deleteOption}
        setOptionTranslation={setOptionTranslation}
        handleSaveModalField={handleSaveModalField}
      />

      {/* Delete Field Confirmation Dialog */}
      <AlertDialog open={deleteFieldDialogOpen} onOpenChange={setDeleteFieldDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("templateEditor.deleteFieldTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("templateEditor.deleteFieldDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteField}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
export default QuestionnaireTemplateEditor;
