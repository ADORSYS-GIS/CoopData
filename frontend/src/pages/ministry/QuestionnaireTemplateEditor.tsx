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
import { useQuestionnaireTemplate, useUpdateQuestionnaireTemplate } from "@/hooks/admin/useQuestionnaireTemplates";
import { toast } from "sonner";

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
  required: boolean;
  options: string[];
  description?: string;
}

export const QuestionnaireTemplateEditor: React.FC<QuestionnaireTemplateEditorProps> = ({
  templateId,
  onBack,
}) => {
  const { data: template, isLoading, error } = useQuestionnaireTemplate(templateId);
  const updateMutation = useUpdateQuestionnaireTemplate(templateId);

  const [label, setLabel] = useState("");
  const [sections, setSections] = useState<any[]>([]);
  const [selectedSectionIndex, setSelectedSectionIndex] = useState<number | null>(null);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

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

  const handleSave = async () => {
    try {
      setSaveMessage(null);
      // Validate unique keys
      const keys = new Set<string>();
      for (const section of sections) {
        for (const field of section.fields || []) {
          if (!field.key || field.key.trim() === "") {
            throw new Error(`Field key cannot be blank in section "${section.title}"`);
          }
          if (keys.has(field.key)) {
            throw new Error(`Duplicate field key "${field.key}" found. All keys must be unique.`);
          }
          keys.add(field.key);
        }
      }

      await updateMutation.mutateAsync({
        label,
        sections,
      });

      toast.success("Questionnaire template changes saved successfully to backend!");
    } catch (err: any) {
      toast.error(err.message || "Failed to save changes");
    }
  };

  // Section Management
  const addSection = () => {
    const newSection = {
      id: `section_${Date.now()}`,
      title: "New Section",
      icon: "ClipboardList",
      description: "Enter section description",
      fields: [],
    };
    const updated = [...sections, newSection];
    setSections(updated);
    setSelectedSectionIndex(updated.length - 1);
  };

  const deleteSection = (index: number) => {
    if (!window.confirm("Are you sure you want to delete this section and all of its fields?")) return;
    const updated = sections.filter((_, i) => i !== index);
    setSections(updated);
    if (selectedSectionIndex === index) {
      setSelectedSectionIndex(updated.length > 0 ? 0 : null);
    } else if (selectedSectionIndex !== null && selectedSectionIndex > index) {
      setSelectedSectionIndex(selectedSectionIndex - 1);
    }
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
    setModalRequired(field.required);
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
      alert("Please enter a question label.");
      return;
    }
    if (selectedSectionIndex === null) return;

    const updated = [...sections];
    const section = updated[selectedSectionIndex];

    if (modalFieldIndex === null) {
      // Create new field
      // Generate key internally from label slug
      const generatedKey = modalLabel
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
    toast.success(modalFieldIndex === null ? "Question added to section! Remember to click Save Changes to persist." : "Question configuration updated locally!");
  };

  const deleteField = (fieldIndex: number) => {
    if (selectedSectionIndex === null) return;
    if (!window.confirm("Are you sure you want to delete this question?")) return;
    const updated = [...sections];
    const section = updated[selectedSectionIndex];
    section.fields = section.fields.filter((_: any, i: number) => i !== fieldIndex);
    setSections(updated);
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
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <AlertCircle className="size-5 animate-spin mr-2" /> Loading template details...
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="p-6 rounded-2xl border border-destructive/20 bg-destructive/5 text-destructive">
        <AlertCircle className="size-6 mb-2" />
        <h4 className="font-bold">Failed to load template</h4>
        <p className="text-sm mt-1">{String(error || "Template not found")}</p>
        <button onClick={onBack} className="mt-4 px-4 py-2 bg-background border rounded-lg text-foreground hover:bg-muted text-xs">
          Back
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
            title="Back to list"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="text-xl font-heading font-bold text-foreground">
              Form Builder
            </h1>
            <p className="text-xs text-muted-foreground">
              Configure dynamic questionnaire forms for {template.questionnaire_type === "financial" ? "Financial SACCOs" : "Non-Financial Cooperatives"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/95 transition-all shadow-sm"
          >
            <Save className="size-4" />
            Save Changes
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
          {saveMessage.type === "success" ? <CheckCircle2 className="size-4" /> : <AlertCircle className="size-4" />}
          {saveMessage.text}
        </div>
      )}

      {/* Template Metadata */}
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <label className="block text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
          Template Title / Label
        </label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Financial Primary Cooperatives Questionnaire v1"
          className="w-full max-w-lg rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/45"
        />
      </div>

      {/* Builder Layout */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
        {/* Left column: Sections list */}
        <div className="md:col-span-4 flex flex-col gap-4">
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-border pb-2">
              <h3 className="text-sm font-bold text-foreground">Form Sections</h3>
              <button
                onClick={addSection}
                className="flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15 transition-colors"
              >
                <Plus className="size-3.5" /> Add Section
              </button>
            </div>

            {sections.length === 0 ? (
              <div className="py-6 text-center text-xs text-muted-foreground">
                No sections defined. Click "Add Section" to begin.
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
                        <span className="text-xs truncate">{sec.title || "(Untitled Section)"}</span>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => { e.stopPropagation(); moveSection(idx, "up"); }}
                          disabled={idx === 0}
                          className="p-1 hover:bg-muted rounded text-muted-foreground disabled:opacity-30"
                        >
                          <ChevronUp className="size-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveSection(idx, "down"); }}
                          disabled={idx === sections.length - 1}
                          className="p-1 hover:bg-muted rounded text-muted-foreground disabled:opacity-30"
                        >
                          <ChevronDown className="size-3.5" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteSection(idx); }}
                          className="p-1 hover:bg-destructive/10 hover:text-destructive rounded text-muted-foreground"
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
        </div>

        {/* Right column: Fields configuration in the selected section */}
        <div className="md:col-span-8">
          {activeSection ? (
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm flex flex-col gap-6">
              {/* Section Header Editor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-b border-border pb-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Section Title</label>
                  <input
                    type="text"
                    value={activeSection.title}
                    onChange={(e) => updateSectionMeta(selectedSectionIndex!, "title", e.target.value)}
                    className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Icon</label>
                    <select
                      value={activeSection.icon}
                      onChange={(e) => updateSectionMeta(selectedSectionIndex!, "icon", e.target.value)}
                      className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      {AVAILABLE_EMOJIS.map((emoji) => (
                        <option key={emoji} value={emoji}>
                          {emoji}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold text-muted-foreground uppercase">Section ID</label>
                    <span className="rounded-xl border border-border bg-muted/40 px-3 py-2 text-xs font-mono text-muted-foreground flex items-center min-h-[38px]">
                      {activeSection.id}
                    </span>
                  </div>
                </div>

                <div className="sm:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Description / Instruction</label>
                  <input
                    type="text"
                    value={activeSection.description || ""}
                    onChange={(e) => updateSectionMeta(selectedSectionIndex!, "description", e.target.value)}
                    placeholder="Brief guide for the cooperative filling this section..."
                    className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Fields List */}
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between border-b border-border/80 pb-2">
                  <h4 className="text-sm font-bold text-foreground">Questions / Form Fields</h4>
                  <button
                    onClick={openAddFieldModal}
                    className="flex items-center gap-1 rounded-lg bg-accent/15 border border-accent/25 px-2.5 py-1 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors"
                  >
                    <Plus className="size-3.5" /> Add Question
                  </button>
                </div>

                {(!activeSection.fields || activeSection.fields.length === 0) ? (
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
                              Type: {field.type === "select" ? "Dropdown Choice" : field.type === "textarea" ? "Paragraph Text" : field.type}
                            </span>
                            
                            {field.type === "select" && field.options && (
                              <div className="flex items-center gap-1 flex-wrap">
                                <span className="font-semibold">Options:</span>
                                {field.options.map((opt: string) => (
                                  <span key={opt} className="bg-primary/10 border border-primary/20 text-primary font-medium px-1.5 py-0.5 rounded-md text-[10px]">
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
                            className="p-1 hover:bg-muted rounded text-muted-foreground disabled:opacity-30"
                            title="Move up"
                          >
                            <ChevronUp className="size-4" />
                          </button>
                          <button
                            onClick={() => moveField(fIdx, "down")}
                            disabled={fIdx === activeSection.fields.length - 1}
                            className="p-1 hover:bg-muted rounded text-muted-foreground disabled:opacity-30"
                            title="Move down"
                          >
                            <ChevronDown className="size-4" />
                          </button>
                          <button
                            onClick={() => openEditFieldModal(fIdx, field)}
                            className="p-1 hover:bg-primary/10 hover:text-primary rounded text-muted-foreground"
                            title="Edit question"
                          >
                            <Edit className="size-4" />
                          </button>
                          <button
                            onClick={() => deleteField(fIdx)}
                            className="p-1 hover:bg-destructive/10 hover:text-destructive rounded text-muted-foreground"
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
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-12 shadow-sm text-center text-muted-foreground text-sm flex flex-col items-center justify-center gap-2">
              <FolderPlus className="size-8 opacity-45" />
              <span>Select a section on the left to start configuring its fields.</span>
            </div>
          )}
        </div>
      </div>

      {/* Field Configuration Popup / Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-border/80 px-6 py-4">
              <h3 className="text-base font-bold text-foreground">
                {modalFieldIndex === null ? "Add Question" : "Edit Question"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg border hover:bg-muted/50 transition-colors text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Question Label / Prompt</label>
                <input
                  type="text"
                  value={modalLabel}
                  onChange={(e) => setModalLabel(e.target.value)}
                  placeholder="e.g. Total Registered Members"
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/45"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-muted-foreground uppercase">Description / Help Text</label>
                <input
                  type="text"
                  value={modalDescription}
                  onChange={(e) => setModalDescription(e.target.value)}
                  placeholder="Optional guidance text for cooperatives..."
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/45"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Input Type</label>
                  <select
                    value={modalType}
                    onChange={(e) => setModalType(e.target.value)}
                    className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/45"
                  >
                    <option value="text">Short Text</option>
                    <option value="number">Number</option>
                    <option value="select">Dropdown Choice</option>
                    <option value="textarea">Paragraph Text</option>
                    <option value="date">Date picker</option>
                  </select>
                </div>

                <div className="flex items-end pb-1.5">
                  <label className="flex items-center gap-2.5 cursor-pointer py-2">
                    <input
                      type="checkbox"
                      checked={modalRequired}
                      onChange={(e) => setModalRequired(e.target.checked)}
                      className="size-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <span className="text-xs text-foreground font-semibold">Required question</span>
                  </label>
                </div>
              </div>

              {/* Dynamic Dropdown Options Builder */}
              {modalType === "select" && (
                <div className="border-t border-border/60 pt-4 flex flex-col gap-3">
                  <label className="text-xs font-bold text-muted-foreground uppercase">Dropdown Choices</label>
                  
                  {modalOptions.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic bg-muted/40 border rounded-xl p-3 text-center">
                      No choices added yet. Add choices below.
                    </p>
                  ) : (
                    <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                      {modalOptions.map((opt, oIdx) => (
                        <div key={oIdx} className="flex items-center justify-between gap-3 bg-surface border p-2 rounded-xl">
                          <span className="text-xs font-medium text-foreground">{opt}</span>
                          <button
                            type="button"
                            onClick={() => deleteOption(oIdx)}
                            className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded transition-colors"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add option control */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={newOptionText}
                      onChange={(e) => setNewOptionText(e.target.value)}
                      placeholder="Add a choice (e.g. Yes)"
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addOption(); } }}
                      className="flex-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/45"
                    />
                    <button
                      type="button"
                      onClick={addOption}
                      className="px-3 py-1.5 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:bg-primary/90 transition-colors shadow-sm"
                    >
                      Add Option
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-border/80 px-6 py-4 bg-muted/30">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted/50 transition-colors text-foreground bg-card"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveModalField}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-colors shadow-sm"
              >
                Apply Field
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default QuestionnaireTemplateEditor;
