import { Hammer, Home, PiggyBank, Sprout, Truck } from "lucide-react";
import { useTranslation } from "react-i18next";

import { SectionHeading } from "@/components/landing/SectionHeading";

const SECTORS = [
  { icon: Sprout, key: "agri" },
  { icon: PiggyBank, key: "sacco" },
  { icon: Home, key: "housing" },
  { icon: Truck, key: "transport" },
  { icon: Hammer, key: "artisan" },
] as const;

export const Sectors = () => {
  const { t } = useTranslation();

  return (
    <section id="sectors" className="scroll-mt-20 border-b border-border bg-surface/30 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge={t("landing.sectors.badge")}
          title={t("landing.sectors.title")}
          aside={
            <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
              {t("landing.sectors.subtitle")}
            </p>
          }
        />
        <ul className="mt-12 grid gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-5">
          {SECTORS.map((s, i) => (
            <li
              key={s.key}
              data-animate
              data-animate-delay={i + 1}
              className="group flex gap-4 bg-background p-6 transition-colors duration-300 hover:bg-muted/40 lg:flex-col lg:gap-0"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/5 text-primary transition-colors duration-300 group-hover:bg-primary/10">
                <s.icon className="size-5" />
              </div>
              <div className="lg:mt-5">
                <h3 className="font-heading text-base font-bold text-foreground">
                  {t(`landing.sectors.${s.key}Title`)}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  {t(`landing.sectors.${s.key}Desc`)}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
