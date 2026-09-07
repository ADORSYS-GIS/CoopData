import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Languages, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CONTENT_LANGUAGES,
  CANONICAL_LANG,
  type ContentLanguage,
  normalizeAppLang,
  resolvePrimaryLang,
} from "@/lib/contentLocalization";

export interface FieldTranslations {
  pt?: string;
  ss?: string;
  fr?: string;
}

interface LocalizedFieldProps {
  id?: string;
  label: string;
  /** Canonical (English) value — always the source of truth for this field. */
  value: string;
  /** Updates the canonical (English) value. */
  onChange: (value: string) => void;
  /** Non-English translations for this field, keyed by language. */
  translations?: FieldTranslations;
  /** Updates the non-English translations map. */
  onTranslationsChange?: (next: FieldTranslations) => void;
  placeholder?: string;
  multiline?: boolean;
  required?: boolean;
  className?: string;
}

const LANG_LABELS: Record<ContentLanguage, string> = {
  en: "English",
  pt: "Português",
  ss: "siSwati",
  fr: "Français",
};

/**
 * A translatable text field whose *primary* input follows the app's current
 * UI language: if a translation already exists for that language, it is
 * shown and edited directly. Otherwise the canonical English text is shown
 * (including for brand-new fields, since there is nothing else to show yet).
 *
 * A collapsible panel below still exposes every other language (including
 * English, once it is no longer primary) so nothing is ever hidden.
 */
export const LocalizedField: React.FC<LocalizedFieldProps> = ({
  id,
  label,
  value,
  onChange,
  translations,
  onTranslationsChange,
  placeholder,
  multiline,
  required,
  className,
}) => {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);

  const displayLang = normalizeAppLang(i18n.language);
  const primaryLang = resolvePrimaryLang(translations, displayLang);

  const getValue = (lang: ContentLanguage): string =>
    lang === CANONICAL_LANG ? value : (translations?.[lang as keyof FieldTranslations] ?? "");

  const setValue = (lang: ContentLanguage, val: string) => {
    if (lang === CANONICAL_LANG) {
      onChange(val);
      return;
    }
    if (!onTranslationsChange) return;
    onTranslationsChange({ ...(translations ?? {}), [lang]: val });
  };

  const otherLangs = CONTENT_LANGUAGES.filter((l) => l !== primaryLang);
  const primaryValue = getValue(primaryLang);

  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="text-xs font-bold text-muted-foreground uppercase">
          {label}
          {required && <span className="text-destructive ml-0.5">*</span>}
          {primaryLang !== CANONICAL_LANG && (
            <span className="ml-1.5 normal-case font-semibold text-primary/80">
              ({LANG_LABELS[primaryLang]})
            </span>
          )}
        </label>
        {onTranslationsChange && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
          >
            <Languages className="size-3.5" />
            {t("localizedField.toggle", { defaultValue: "Translate" })}
            {open ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </button>
        )}
      </div>

      {multiline ? (
        <Textarea
          id={id}
          value={primaryValue}
          onChange={(e) => setValue(primaryLang, e.target.value)}
          placeholder={placeholder}
          className="w-full"
        />
      ) : (
        <Input
          id={id}
          value={primaryValue}
          onChange={(e) => setValue(primaryLang, e.target.value)}
          placeholder={placeholder}
          className="w-full"
        />
      )}

      {open && onTranslationsChange && (
        <div className="flex flex-col gap-2 mt-1 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3">
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider">
            {t("localizedField.otherLanguages", { defaultValue: "Translations" })}
          </span>
          {otherLangs.map((lang) => (
            <div key={lang} className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase w-7 text-muted-foreground shrink-0">
                {lang}
              </span>
              {multiline ? (
                <Textarea
                  value={getValue(lang)}
                  onChange={(e) => setValue(lang, e.target.value)}
                  placeholder={LANG_LABELS[lang]}
                  className="w-full"
                />
              ) : (
                <Input
                  value={getValue(lang)}
                  onChange={(e) => setValue(lang, e.target.value)}
                  placeholder={LANG_LABELS[lang]}
                  className="w-full"
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
