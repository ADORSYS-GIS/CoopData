import React from "react";
import { Languages } from "lucide-react";
import { useTranslation } from "react-i18next";

import { normalizeAppLang } from "@/lib/contentLocalization";
import type { LegalLang } from "@/types/legalPolicy";

/** Each language is named in itself, so every reader can find theirs. */
const LANGS: { code: LegalLang; name: string }[] = [
  { code: "en", name: "English" },
  { code: "fr", name: "Français" },
  { code: "pt", name: "Português" },
  { code: "ss", name: "SiSwati" },
];

interface LanguageToggleProps {
  className?: string;
}

/**
 * Switches the language of the legal centre and of the app with it, so the
 * documents and the surrounding screens always read in the same language.
 * Shows native names on wide screens and language codes on small ones.
 */
export const LanguageToggle: React.FC<LanguageToggleProps> = ({ className = "" }) => {
  const { t, i18n } = useTranslation();
  const active = normalizeAppLang(i18n.resolvedLanguage ?? i18n.language);

  return (
    <div
      role="radiogroup"
      aria-label={t("legal.center.language", "Document language")}
      className={`inline-flex items-center gap-1 rounded-xl border border-border bg-surface p-1 shadow-[var(--shadow-elev-1)] ${className}`}
    >
      <Languages className="ml-1.5 mr-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
      {LANGS.map((l) => {
        const selected = active === l.code;
        return (
          <button
            key={l.code}
            type="button"
            role="radio"
            aria-checked={selected}
            lang={l.code}
            title={l.name}
            onClick={() => void i18n.changeLanguage(l.code)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40 ${
              selected
                ? "bg-accent text-accent-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span className="sm:hidden">{l.code.toUpperCase()}</span>
            <span className="hidden sm:inline">{l.name}</span>
          </button>
        );
      })}
    </div>
  );
};
