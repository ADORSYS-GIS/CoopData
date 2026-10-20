import { useTranslation } from "react-i18next";

import { HeroTrendChart } from "@/components/landing/HeroTrendChart";
import { LANDING_STATS, type LandingStat } from "@/constants/landing";
import { useStatCounter } from "@/hooks/landing/useStatCounter";

const KpiCell = ({ stat, className }: { stat: LandingStat; className: string }) => {
  const { t } = useTranslation();
  const { ref, display, finalText } = useStatCounter<HTMLDivElement>(stat);

  return (
    <div ref={ref} className={`flex flex-col px-6 py-5 ${className}`}>
      <dt className="text-xs text-muted-foreground">{t(stat.labelKey)}</dt>
      <dd className="mt-auto pt-1 font-heading text-3xl font-semibold tracking-tight text-foreground num">
        <span className="sr-only">{finalText}</span>
        <span aria-hidden="true">{display}</span>
      </dd>
    </div>
  );
};

/** Cell borders draw the dividers: two figures side by side, the last one full width below. */
const CELL_CLASSES = [
  "border-r border-border",
  "",
  "col-span-2 border-t border-border text-center",
];

export const HeroPanel = () => {
  const { t } = useTranslation();

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-elev-2)]">
      <p className="border-b border-border px-6 py-4 font-heading text-base font-semibold text-foreground">
        {t("landing.heroPanel.title")}
      </p>
      <dl className="grid grid-cols-2 border-b border-border">
        {LANDING_STATS.map((stat, i) => (
          <KpiCell key={stat.labelKey} stat={stat} className={CELL_CLASSES[i] ?? ""} />
        ))}
      </dl>
      <div className="px-6 pb-5 pt-6">
        <HeroTrendChart />
      </div>
    </div>
  );
};
