/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import {
  ArrowLeft,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  CheckCircle2,
  AlertCircle,
  FolderPlus,
  Users,
  BookOpen,
  DollarSign,
  TrendingUp,
  BarChart3,
  ClipboardList,
  Building2,
  Edit,
  X,
} from "lucide-react";
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

interface QuestionnaireTemplateEditorProps {
  templateId: string;
  onBack: () => void;
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
  };
  return map[iconName] || iconName || "📋";
};

interface FieldConfig {
  key: string;
  label: string;
  type: string;
  required?: boolean;
  options?: string[];
  description?: string;
}

export const QuestionnaireTemplateEditor: React.FC<QuestionnaireTemplateEditorProps> = ({
  templateId,
  onBack,
}) => {
  const { t } = useTranslation();
  const { data: template, isLoading, error } = useQuestionnaireTemplate(templateId);
  const updateMutation = useUpdateQuestionnaireTemplate(templateId);

  const [label, setLabel] = useState("");
  const [sections, setSections] = useState<any[]>([]);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(null);
  const [saveMessage, setSaveMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // Field Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalFieldIndex, setModalFieldIndex] = useState<number | null>(null); // null means adding a new field
  const [modalLabel, setModalLabel] = useState("");
  const [modalType, setModalType] = useState("text");
  const [modalRequired, setModalRequired] = useState(false);
  const [modalDescription, setModalDescription] = useState("");
  const [modalOptions, setModalOptions] = useState<string[]>([]);
  const [newOptionText, setNewOptionText] = useState("");

  // Load template details when query succeeds
  useEffect(() => {
    if (template) {
      setLabel(template.label);
      setSections(template.sections || []);
      if ((template.sections || []).length > 0) {
        setSelectedSectionIndex(0);
      }
    }
  }, [template]);

  const handleSave = async (sectionsToSave?: any[]) => {
    const listToSave = sectionsToSave || sections;
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

      await updateMutation.mutateAsync({
        label,
        sections: listToSave,
      });

      toast.success(t("templateEditor.toastSaved"));
    } catch (err: any) {
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

  // Field Modal handlers
  const openAddFieldModal = () => {
    setModalFieldIndex(null);
    setModalLabel("");
    setModalDescription("");
    setModalType("text");
    setModalRequired(false);
    setModalOptions([]);
    setNewOptionText("");
    setIsModalOpen(true);
  };

  const openEditFieldModal = (index: number, field: FieldConfig) => {
    setModalFieldIndex(index);
    setModalLabel(field.label);
    setModalDescription(field.description || "");
    setModalType(field.type);
    setModalRequired(!!field.required);
    setModalOptions(field.options || []);
    setNewOptionText("");
    setIsModalOpen(true);
  };

  const addOption = () => {
    if (!newOptionText.trim()) return;
    if (modalOptions.includes(newOptionText.trim())) return;
    setModalOptions([...modalOptions, newOptionText.trim()]);
    setNewOptionText("");
  };

  const deleteOption = (optIndex: number) => {
    setModalOptions(modalOptions.filter((_, i) => i !== optIndex));
  };

  const handleSaveModalField = () => {
    if (!modalLabel.trim()) {
      alert(t("templateEditor.alertLabelRequired"));
      return;
    }
    if (selectedSectionIndex === null) return;

    const updated = [...sections];
    const section = updated[selectedSectionIndex];

    if (modalFieldIndex === null) {
      // Create new field
      // Generate key internally from label slug
      const generatedKey =
        modalLabel
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "") || `field_${Date.now()}`;

      const newField: FieldConfig = {
        key: generatedKey,
        label: modalLabel.trim(),
        description: modalDescription.trim() || undefined,
        type: modalType,
        required: modalRequired,
        options: modalType === "select" ? modalOptions : [],
      };
      section.fields = [...(section.fields || []), newField];
    } else {
      // Edit existing field
      const existingField = section.fields[modalFieldIndex];
      const updatedField: FieldConfig = {
        key: existingField.key, // keep the unique key unchanged
        label: modalLabel.trim(),
        description: modalDescription.trim() || undefined,
        type: modalType,
        required: modalRequired,
        options: modalType === "select" ? modalOptions : [],
      };
      section.fields[modalFieldIndex] = updatedField;
    }

    setSections(updated);
    setIsModalOpen(false);
    handleSave(updated);
  };

  const deleteField = (fieldIndex: number) => {
    if (selectedSectionIndex === null) return;
    if (!window.confirm(t("templateEditor.confirmDeleteField"))) return;
    const updated = [...sections];
    const section = updated[selectedSectionIndex];
    section.fields = section.fields.filter((_: any, i: number) => i !== fieldIndex);
    setSections(updated);
    handleSave(updated);
  };

  const moveField = (fieldIndex: number, direction: "up" | "down") => {
    if (selectedSectionIndex === null) return;
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
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
          {t("templateEditor.metaLabel")}
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder={t("templateEditor.metaPlaceholder")}
          className="w-full max-w-lg rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/45"
        />
      </div>

      {/* Builder Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left column: Sections list */}
        <div className="md:col-span-4 flex flex-col gap-4">
          <SectionList
            sections={sections}
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
          {activeSection ? (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col gap-6">
              <SectionMetadataForm
                activeSection={activeSection}
                selectedSectionIndex={selectedSectionIndex!}
                updateSectionMeta={updateSectionMeta}
                availableEmojis={AVAILABLE_EMOJIS}
              />
              <FieldEditor
                activeSection={activeSection}
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
        modalDescription={modalDescription}
        setModalDescription={setModalDescription}
        modalType={modalType}
        setModalType={setModalType}
        modalRequired={modalRequired}
        setModalRequired={setModalRequired}
        modalOptions={modalOptions}
        newOptionText={newOptionText}
        setNewOptionText={setNewOptionText}
        addOption={addOption}
        deleteOption={deleteOption}
        handleSaveModalField={handleSaveModalField}
      />
    </div>
  );
};
export default QuestionnaireTemplateEditor;
