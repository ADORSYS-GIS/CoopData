import { ClipboardCheck, LineChart, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";

const STEPS = [
  { icon: UserPlus, key: "register" },
  { icon: ClipboardCheck, key: "report" },
  { icon: LineChart, key: "oversee" },
] as const;

export const HowItWorks = () => {
  const { t } = useTranslation();

  return (
    <section
      id="how-it-works"
      className="relative scroll-mt-20 overflow-hidden bg-primary py-20 text-primary-foreground"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "radial-gradient(var(--primary-foreground) 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />
      <div className="animate-drift absolute -right-24 -top-24 -z-0 size-80 rounded-full bg-accent/20 blur-[110px]" />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div data-animate className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground/60">
            {t("landing.howItWorks.badge")}
          </p>
          <h2 className="font-heading mt-3 text-3xl font-bold leading-tight tracking-tight text-balance text-white md:text-4xl">
            {t("landing.howItWorks.title")}
          </h2>
        </div>

        <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
          <div
            aria-hidden="true"
            className="absolute left-0 right-0 top-6 hidden h-px bg-gradient-to-r from-primary-foreground/5 via-primary-foreground/20 to-primary-foreground/5 md:block"
          />
          {STEPS.map((step, i) => (
            <li
              key={step.key}
              data-animate
              data-animate-delay={i + 1}
              className="group relative md:pr-6"
            >
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary-foreground/10 text-white ring-1 ring-primary-foreground/15 backdrop-blur-sm transition-[background-color,box-shadow,transform] duration-300 group-hover:-translate-y-0.5 group-hover:bg-primary-foreground/20 group-hover:ring-primary-foreground/30">
                <step.icon className="size-5.5" />
              </div>
              <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
                {t("landing.howItWorks.stepLabel", { number: i + 1 })}
              </p>
              <h3 className="font-heading mt-2 text-lg font-bold text-white">
                {t(`landing.howItWorks.${step.key}Title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-primary-foreground/70">
                {t(`landing.howItWorks.${step.key}Body`)}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
};
