import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useLoginRedirect } from "@/hooks/landing/useLoginRedirect";

export const LandingCta = () => {
  const { t } = useTranslation();
  const handleLogin = useLoginRedirect();

  return (
    <section className="py-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        <div
          data-animate
          className="card-edge-primary relative overflow-hidden rounded-2xl bg-primary p-10 text-primary-foreground shadow-xl lg:p-14"
        >
          <div className="animate-drift absolute -right-20 -top-20 size-72 rounded-full bg-accent/20 blur-[100px]" />
          <div className="relative">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/75">
              {t("landing.cta.badge")}
            </p>
            <h2 className="font-heading mt-3 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
              {t("landing.cta.title")}
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-primary-foreground/75">
              {t("landing.cta.desc")}
            </p>
            <button
              onClick={handleLogin}
              className="press-feedback group mt-8 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-accent/90"
            >
              {t("landing.header.signIn")}
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
