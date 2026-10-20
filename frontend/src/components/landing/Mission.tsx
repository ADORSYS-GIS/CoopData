import { BarChart3, Globe2, Lock, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";

const PILLARS = [
  { icon: ShieldCheck, key: "trust" },
  { icon: BarChart3, key: "evidence" },
  { icon: Globe2, key: "inclusive" },
  { icon: Lock, key: "govt" },
] as const;

export const Mission = () => {
  const { t } = useTranslation();

  return (
    <section id="mission" className="scroll-mt-20 border-b border-border bg-surface/30 py-24">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:px-8">
        <div data-animate className="space-y-3 lg:col-span-4">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
            {t("landing.mission.badge")}
          </p>
          <h2 className="font-heading text-3xl font-bold leading-tight tracking-tight text-balance text-foreground md:text-4xl lg:sticky lg:top-28">
            {t("landing.mission.title")}
          </h2>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:col-span-8">
          {PILLARS.map((p, i) => (
            <div
              key={p.key}
              data-animate
              data-animate-delay={i + 1}
              className="hover-lift group relative overflow-hidden rounded-2xl border border-border/50 bg-surface/40 p-8 hover:bg-surface"
            >
              <div className="absolute -right-6 -top-6 text-accent/5 transition-[transform,color] duration-700 ease-[var(--ease-out-expo)] group-hover:rotate-6 group-hover:scale-110 group-hover:text-accent/10">
                <p.icon className="size-32" />
              </div>
              <div className="relative">
                <div className="flex size-12 items-center justify-center rounded-xl bg-accent/10 text-accent shadow-sm ring-1 ring-accent/10 transition-[background-color,box-shadow] duration-300 group-hover:bg-accent/20 group-hover:ring-accent/25">
                  <p.icon className="size-6" />
                </div>
                <h3 className="font-heading mt-6 text-lg font-bold text-foreground">
                  {t(`landing.mission.${p.key}Title`)}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {t(`landing.mission.${p.key}Body`)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
