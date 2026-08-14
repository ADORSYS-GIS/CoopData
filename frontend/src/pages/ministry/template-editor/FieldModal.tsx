import React, { useState } from "react";
import { X, Trash2, Languages } from "lucide-react";
import { useTranslation } from "react-i18next";
import { LocalizedField, type FieldTranslations } from "@/components/shared/LocalizedField";
import {
  CONTENT_LANGUAGES,
  CANONICAL_LANG,
  type ContentLanguage,
  normalizeAppLang,
  resolvePrimaryLang,
} from "@/lib/contentLocalization";

interface FieldModalProps {
  isModalOpen: boolean;
  setIsModalOpen: (open: boolean) => void;
  modalFieldIndex: number | null;
  modalLabel: string;
  setModalLabel: (val: string) => void;
  modalLabelTr: FieldTranslations;
  setModalLabelTr: (val: FieldTranslations) => void;
  modalDescription: string;
  setModalDescription: (val: string) => void;
  modalDescTr: FieldTranslations;
  setModalDescTr: (val: FieldTranslations) => void;
  modalType: string;
  setModalType: (val: string) => void;
  modalOptions: string[];
  setModalOptions: (val: string[]) => void;
  /** Per-option translations, aligned by index with `modalOptions`. */
  modalOptionsTr: FieldTranslations[];
  setModalOptionsTr: (val: FieldTranslations[]) => void;
  newOptionText: string;
  setNewOptionText: (val: string) => void;
  addOption: () => void;
  deleteOption: (idx: number) => void;
  setOptionTranslation: (idx: number, lang: ContentLanguage, val: string) => void;
  handleSaveModalField: () => void;
}

const LANG_LABELS: Record<ContentLanguage, string> = {
  en: "English",
  pt: "Português",
  ss: "siSwati",
  fr: "Français",
};

export const FieldModal: React.FC<FieldModalProps> = ({
  isModalOpen,
  setIsModalOpen,
  modalFieldIndex,
  modalLabel,
  setModalLabel,
  modalLabelTr,
  setModalLabelTr,
  modalDescription,
  setModalDescription,
  modalDescTr,
  setModalDescTr,
  modalType,
  setModalType,
  modalOptions,
  setModalOptions,
  modalOptionsTr,
  setModalOptionsTr,
  newOptionText,
  setNewOptionText,
  addOption,
  deleteOption,
  setOptionTranslation,
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
          <LocalizedField
            id="field-label"
            label={t("templateEditor.fieldModal.labelPrompt")}
            value={modalLabel}
            onChange={setModalLabel}
            translations={modalLabelTr}
            onTranslationsChange={setModalLabelTr}
            placeholder={t("templateEditor.fieldModal.placeholderLabel")}
            required
          />

          <LocalizedField
            id="field-desc"
            label={t("templateEditor.fieldModal.descHelp")}
            value={modalDescription}
            onChange={setModalDescription}
            translations={modalDescTr}
            onTranslationsChange={setModalDescTr}
            placeholder={t("templateEditor.fieldModal.placeholderDesc")}
            multiline
          />

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
              <span className="flex items-center gap-2 py-2 text-xs text-muted-foreground font-medium">
                <span className="text-destructive font-bold">*</span>
                {t("questionnaire.allFieldsRequired")}
              </span>
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
                <div className="flex flex-col gap-2 max-h-[260px] overflow-y-auto pr-1">
                  {modalOptions.map((opt, oIdx) => (
                    <OptionRow
                      key={oIdx}
                      opt={opt}
                      oIdx={oIdx}
                      translations={modalOptionsTr[oIdx] ?? {}}
                      onChangeCanonical={(val) => {
                        const next = [...modalOptions];
                        next[oIdx] = val;
                        setModalOptions(next);
                      }}
                      onSetOptionTranslation={(lang, val) => setOptionTranslation(oIdx, lang, val)}
                      deleteOption={deleteOption}
                    />
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

const OptionRow: React.FC<{
  opt: string;
  oIdx: number;
  translations: FieldTranslations;
  onChangeCanonical: (val: string) => void;
  onSetOptionTranslation: (lang: ContentLanguage, val: string) => void;
  deleteOption: (idx: number) => void;
}> = ({ opt, oIdx, translations, onChangeCanonical, onSetOptionTranslation, deleteOption }) => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const displayLang = normalizeAppLang(i18n.language);
  const primaryLang = resolvePrimaryLang(translations, displayLang);

  const getValue = (lang: ContentLanguage): string =>
    lang === CANONICAL_LANG ? opt : (translations[lang as keyof FieldTranslations] ?? "");

  const setValue = (lang: ContentLanguage, val: string) => {
    if (lang === CANONICAL_LANG) {
      onChangeCanonical(val);
      return;
    }
    onSetOptionTranslation(lang, val);
  };

  const otherLangs = CONTENT_LANGUAGES.filter((l) => l !== primaryLang);
  const primaryValue = getValue(primaryLang);

  return (
    <div className="flex flex-col gap-1 bg-surface border p-2 rounded-xl">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={primaryValue}
          onChange={(e) => setValue(primaryLang, e.target.value)}
          className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
        {primaryLang !== CANONICAL_LANG && (
          <span className="text-[9px] font-bold uppercase text-primary/80 shrink-0">
            {primaryLang}
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="p-1 hover:bg-primary/10 text-primary rounded transition-colors cursor-pointer"
            title="Translate"
          >
            <Languages className="size-3.5" />
          </button>
          <button
            type="button"
            onClick={() => deleteOption(oIdx)}
            className="p-1 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded transition-colors cursor-pointer"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
      {open && (
        <div className="flex flex-col gap-1.5 mt-1 pl-1">
          {otherLangs.map((lang) => (
            <div key={lang} className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase w-6 text-muted-foreground shrink-0">
                {lang}
              </span>
              <input
                type="text"
                value={getValue(lang)}
                onChange={(e) => setValue(lang, e.target.value)}
                placeholder={LANG_LABELS[lang]}
                className="flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FieldModal;
