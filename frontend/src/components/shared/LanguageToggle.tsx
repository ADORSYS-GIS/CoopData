// frontend/src/components/shared/LanguageToggle.tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";
import type { LegalLang } from "@/types/legalPolicy";

interface LanguageToggleProps {
  currentLang?: LegalLang;
  onLanguageChange?: (lang: LegalLang) => void;
  className?: string;
}

const LANGS: { code: LegalLang; label: string }[] = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "pt", label: "PT" },
  { code: "ss", label: "SS" },
];

export const LanguageToggle: React.FC<LanguageToggleProps> = ({
  currentLang,
  onLanguageChange,
  className = "",
}) => {
  const { i18n } = useTranslation();
  const activeLang: LegalLang =
    currentLang ||
    (i18n.language?.startsWith("fr")
      ? "fr"
      : i18n.language?.startsWith("pt")
        ? "pt"
        : i18n.language?.startsWith("ss")
          ? "ss"
          : "en");

  const setLang = (lang: LegalLang) => {
    i18n.changeLanguage(lang);
    if (onLanguageChange) {
      onLanguageChange(lang);
    }
  };

  return (
    <div
      className={`inline-flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60 shadow-sm ${className}`}
    >
      <Globe className="w-4 h-4 text-slate-400 ml-1.5 mr-0.5" />
      {LANGS.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
            activeLang === l.code
              ? "bg-emerald-600 text-white shadow-sm"
              : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
          }`}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
};
