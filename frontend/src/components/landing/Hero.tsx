import { ArrowRight } from "lucide-react";
import { useTranslation } from "react-i18next";

import { HeroBackdropChart } from "@/components/landing/HeroBackdropChart";
import { HeroPanel } from "@/components/landing/HeroPanel";
import { useLoginRedirect } from "@/hooks/landing/useLoginRedirect";

export const Hero = () => {
  const { t } = useTranslation();
  const handleLogin = useLoginRedirect();

  return (
    <section className="relative isolate overflow-hidden border-b border-border bg-surface/40">
      <div
        className="absolute inset-0 -z-10 opacity-[0.04] [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]"
        style={{
          backgroundImage:
            "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "44px 44px",
        }}
      />
      <div className="animate-drift absolute -right-40 top-0 -z-10 size-[500px] rounded-full bg-accent/10 blur-[100px]" />
      <div className="animate-drift-reverse absolute -left-20 bottom-0 -z-10 size-[400px] rounded-full bg-success/5 blur-[90px]" />

      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-24 pt-16 sm:px-6 md:pt-20 lg:grid-cols-12 lg:gap-10 lg:px-8">
        <div className="space-y-6 lg:col-span-7">
          <div className="animate-hero animate-hero-delay-1 flex items-center gap-3.5">
            <img
              src="/eswatini-crest.png"
              alt=""
              aria-hidden="true"
              className="h-11 w-auto shrink-0"
            />
            <span aria-hidden="true" className="h-9 w-px shrink-0 bg-border" />
            <p className="text-sm font-semibold leading-snug text-foreground">
              {t("landing.hero.badge")}
            </p>
          </div>
          <h1 className="animate-hero animate-hero-delay-2 font-heading text-4xl font-bold tracking-tight text-balance text-foreground md:text-5xl lg:text-[3.25rem] lg:leading-[1.1]">
            {t("landing.hero.title1")}
            <span className="mt-1 block text-accent">{t("landing.hero.title2")}</span>
          </h1>
          <p className="animate-hero animate-hero-delay-3 max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
            {t("landing.hero.subtitle")}
          </p>
          <div className="animate-hero animate-hero-delay-4 pt-2">
            <button
              onClick={handleLogin}
              className="press-feedback group inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-elev-2)] transition-[background-color,box-shadow] hover:bg-primary/95 hover:shadow-[var(--shadow-elev-3)]"
            >
              {t("landing.hero.openPlatform")}
              <ArrowRight className="size-4 transition-transform duration-300 group-hover:translate-x-1" />
            </button>
          </div>
        </div>

        <div className="animate-panel relative isolate lg:col-span-5">
          <HeroBackdropChart />
          <HeroPanel />
        </div>
      </div>
    </section>
  );
};
