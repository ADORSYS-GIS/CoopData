// frontend/src/components/shared/LanguageToggle.tsx
import React from "react";
import { useTranslation } from "react-i18next";
import { Globe } from "lucide-react";

interface LanguageToggleProps {
  currentLang?: "en" | "fr";
  onLanguageChange?: (lang: "en" | "fr") => void;
  className?: string;
}

export const LanguageToggle: React.FC<LanguageToggleProps> = ({
  currentLang,
  onLanguageChange,
  className = "",
}) => {
  const { i18n } = useTranslation();
  const activeLang = currentLang || (i18n.language?.startsWith("fr") ? "fr" : "en");

  const setLang = (lang: "en" | "fr") => {
    i18n.changeLanguage(lang);
    if (onLanguageChange) {
      onLanguageChange(lang);
    }
  };

  return (
    <div className={`inline-flex items-center gap-1 bg-slate-800/80 p-1 rounded-lg border border-slate-700/60 shadow-sm ${className}`}>
      <Globe className="w-4 h-4 text-slate-400 ml-1.5 mr-0.5" />
      <button
        type="button"
        onClick={() => setLang("en")}
        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
          activeLang === "en"
            ? "bg-emerald-600 text-white shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
        }`}
      >
        EN
      </button>
      <button
        type="button"
        onClick={() => setLang("fr")}
        className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
          activeLang === "fr"
            ? "bg-emerald-600 text-white shadow-sm"
            : "text-slate-400 hover:text-slate-200 hover:bg-slate-700/50"
        }`}
      >
        FR
      </button>
    </div>
  );
};
