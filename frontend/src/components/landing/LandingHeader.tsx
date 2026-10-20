import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LanguageSwitcher } from "@/components/shared/LanguageSwitcher";
import { LANDING_SECTIONS } from "@/constants/landing";
import { useLoginRedirect } from "@/hooks/landing/useLoginRedirect";
import { useScrolled } from "@/hooks/landing/useScrolled";

export const LandingHeader = () => {
  const { t } = useTranslation();
  const handleLogin = useLoginRedirect();
  const scrolled = useScrolled();

  return (
    <header
      className={`sticky top-0 z-30 border-b backdrop-blur-lg transition-[background-color,border-color,box-shadow] duration-300 ${
        scrolled
          ? "border-border bg-surface/90 shadow-[var(--shadow-elev-1)]"
          : "border-transparent bg-surface/60"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/coopdatalogo.png"
            alt={t("common.logoAlt")}
            className="size-12 shrink-0 rounded-lg object-contain sm:size-16"
          />
        </Link>
        <nav className="hidden items-center gap-6 whitespace-nowrap text-xs font-semibold uppercase tracking-wider text-muted-foreground lg:flex">
          {LANDING_SECTIONS.map((s) => (
            <a key={s.id} href={`#${s.id}`} className="link-underline hover:text-primary">
              {t(s.labelKey)}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2.5">
          <LanguageSwitcher />
          <button
            onClick={handleLogin}
            className="press-feedback group inline-flex items-center gap-2 whitespace-nowrap rounded-xl bg-primary px-3.5 py-2.5 sm:px-4.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elev-2)] transition-colors hover:bg-primary/95"
          >
            {t("landing.header.enterPlatform")}
            <ArrowRight className="hidden size-4 transition-transform sm:block duration-300 group-hover:translate-x-0.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
