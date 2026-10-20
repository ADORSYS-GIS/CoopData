import { Link } from "@tanstack/react-router";
import { ArrowUp } from "lucide-react";
import { useTranslation } from "react-i18next";

import { LANDING_FOOTER_SECTIONS } from "@/constants/landing";
import { prefersReducedMotion } from "@/lib/motion";

const LEGAL_LINKS = [
  { labelKey: "landing.footer.legal.privacyPolicy", doc: "privacy" },
  { labelKey: "landing.footer.legal.termsOfUse", doc: "terms" },
  { labelKey: "landing.footer.legal.cookiePolicy", doc: "cookies" },
  { labelKey: "landing.footer.legal.acceptableUse", doc: "acceptable-use" },
] as const;

const linkClass =
  "link-underline text-sm text-muted-foreground transition-colors hover:text-foreground";

const ColumnTitle = ({ children }: { children: string }) => (
  <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/70">
    {children}
  </p>
);

export const LandingFooter = () => {
  const { t } = useTranslation();
  const scrollToTop = () =>
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });

  return (
    <footer className="relative border-t border-border bg-surface">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/40 to-transparent" />
      <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr] lg:px-8">
        <div data-animate className="space-y-5">
          <img
            src="/coopdatalogo.png"
            alt={t("common.logoAlt")}
            className="size-14 shrink-0 rounded-lg object-contain"
          />
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {t("landing.footer.badge")}
          </p>
          <span className="inline-flex items-center gap-2 rounded-full border border-success/20 bg-success/5 px-3 py-1.5 text-xs font-medium text-success">
            <span className="relative flex size-1.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
              <span className="relative inline-flex size-1.5 rounded-full bg-success" />
            </span>
            {t("landing.footer.allOperational")}
          </span>
        </div>

        <nav data-animate data-animate-delay="1" aria-label={t("landing.footer.exploreCol")}>
          <ColumnTitle>{t("landing.footer.exploreCol")}</ColumnTitle>
          <ul className="space-y-3">
            {LANDING_FOOTER_SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className={linkClass}>
                  {t(s.labelKey)}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <nav data-animate data-animate-delay="2" aria-label={t("landing.footer.legalCol")}>
          <ColumnTitle>{t("landing.footer.legalCol")}</ColumnTitle>
          <ul className="space-y-3">
            {LEGAL_LINKS.map((l) => (
              <li key={l.doc}>
                <Link to="/legal" search={{ doc: l.doc }} className={linkClass}>
                  {t(l.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div className="border-t border-border/80 bg-muted/10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-5 text-xs text-muted-foreground sm:px-6 lg:px-8">
          <p>{t("landing.footer.copyright", { year: new Date().getFullYear() })}</p>
          <button
            type="button"
            onClick={scrollToTop}
            className="press-feedback group inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 font-semibold transition-colors hover:border-accent/40 hover:text-foreground"
          >
            {t("landing.footer.backToTop")}
            <ArrowUp className="size-3.5 transition-transform duration-300 group-hover:-translate-y-0.5" />
          </button>
        </div>
      </div>
    </footer>
  );
};
