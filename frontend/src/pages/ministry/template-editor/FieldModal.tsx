import React from "react";
import { X, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

interface FieldModalProps {
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  modalFieldIndex: number | null;
  modalLabel: string;
  setModalLabel: (val: string) => void;
  modalDescription: string;
  setModalDescription: (val: string) => void;
  modalType: string;
  setModalType: (val: string) => void;
  modalRequired: boolean;
  setModalRequired: (val: boolean) => void;
  modalOptions: string[];
  newOptionText: string;
  setNewOptionText: (val: string) => void;
  addOption: () => void;
  deleteOption: (idx: number) => void;
  handleSaveModalField: () => void;
}

export const FieldModal: React.FC<FieldModalProps> = ({
  isModalOpen,
  setIsModalOpen,
  modalFieldIndex,
  modalLabel,
  setModalLabel,
  modalDescription,
  setModalDescription,
  modalType,
  setModalType,
  modalRequired,
  setModalRequired,
  modalOptions,
  newOptionText,
  setNewOptionText,
  addOption,
  deleteOption,
  handleSaveModalField,
}) => {
  const { t } = useTranslation();

  if (!isModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150 font-sans">
      <div className="bg-card border border-border w-full max-w-lg rounded-2xl shadow-xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-border/80 px-6 py-4">
          <h3 className="text-base font-bold text-foreground">
            {modalFieldIndex === null
              ? t("templateEditor.fieldModal.addTitle")
              : t("templateEditor.fieldModal.editTitle")}
          </h3>
          <button
            onClick={() => setIsModalOpen(false)}
            className="p-1.5 rounded-lg border hover:bg-muted/50 transition-colors text-muted-foreground cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase">
              {t("templateEditor.fieldModal.labelPrompt")}
            </label>
            <input
              type="text"
              value={modalLabel}
              onChange={(e) => setModalLabel(e.target.value)}
              placeholder={t("templateEditor.fieldModal.placeholderLabel")}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/45"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase">
              {t("templateEditor.fieldModal.descHelp")}
            </label>
            <input
              type="text"
              value={modalDescription}
              onChange={(e) => setModalDescription(e.target.value)}
              placeholder={t("templateEditor.fieldModal.placeholderDesc")}
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/45"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                {t("templateEditor.fieldModal.inputType")}
              </label>
              <select
                value={modalType}
                onChange={(e) => setModalType(e.target.value)}
                className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/45 select-custom"
              >
                <option value="text">{t("templateEditor.fieldModal.typeShortText")}</option>
                <option value="number">{t("templateEditor.fieldModal.typeNumber")}</option>
                <option value="select">{t("templateEditor.fieldModal.typeDropdown")}</option>
                <option value="textarea">{t("templateEditor.fieldModal.typeParagraph")}</option>
                <option value="date">{t("templateEditor.fieldModal.typeDatePicker")}</option>
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
                <span className="text-xs text-foreground font-semibold">
                  {t("templateEditor.fieldModal.requiredQuestion")}
                </span>
              </label>
            </div>
          </div>

          {/* Dynamic Dropdown Options Builder */}
          {modalType === "select" && (
            <div className="border-t border-border/60 pt-4 flex flex-col gap-3">
              <label className="text-xs font-bold text-muted-foreground uppercase">
                {t("templateEditor.fieldModal.dropdownChoices")}
              </label>

              {modalOptions.length === 0 ? (
                <p className="text-xs text-muted-foreground italic bg-muted/40 border rounded-xl p-3 text-center">
                  {t("templateEditor.fieldModal.noChoices")}
                </p>
              ) : (
                <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                  {modalOptions.map((opt, oIdx) => (
                    <div
                      key={oIdx}
                      className="flex items-center justify-between gap-3 bg-surface border p-2 rounded-xl"
                    >
                      <span className="text-xs font-medium text-foreground">{opt}</span>
                      <button
                        type="button"
                        onClick={() => deleteOption(oIdx)}
                        className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded transition-colors cursor-pointer"
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
                  placeholder={t("templateEditor.fieldModal.placeholderChoice")}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addOption();
                    }
                  }}
                  className="flex-1 rounded-xl border border-border bg-surface px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/45"
                />
                <button
                  type="button"
                  onClick={addOption}
                  className="px-3 py-1.5 bg-primary text-primary-foreground font-semibold text-xs rounded-xl hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
                >
                  {t("templateEditor.fieldModal.addOptionBtn")}
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
            className="rounded-xl border border-border px-4 py-2 text-xs font-semibold hover:bg-muted/50 transition-colors text-foreground bg-card cursor-pointer"
          >
            {t("templateEditor.fieldModal.cancel")}
          </button>
          <button
            type="button"
            onClick={handleSaveModalField}
            className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-colors shadow-sm cursor-pointer"
          >
            {t("templateEditor.fieldModal.applyField")}
          </button>
        </div>
      </div>
    </div>
  );
};
export default FieldModal;
