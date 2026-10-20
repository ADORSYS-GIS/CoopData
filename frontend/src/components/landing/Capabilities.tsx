import { BarChart3, ClipboardList, FileBarChart, Lock, Users, Wifi } from "lucide-react";
import { useTranslation } from "react-i18next";

import { CapabilityHub } from "@/components/landing/CapabilityHub";
import { CapabilityHubLinks } from "@/components/landing/CapabilityHubLinks";
import { SectionHeading } from "@/components/landing/SectionHeading";

const CAPABILITIES = [
  { icon: Users, key: "rbac" },
  { icon: ClipboardList, key: "data" },
  { icon: Wifi, key: "offline" },
  { icon: FileBarChart, key: "reporting" },
  { icon: BarChart3, key: "analytics" },
  { icon: Lock, key: "security" },
] as const;

/** Grid placement that turns the flat list into a hub-and-spoke diagram from `lg` up. */
const CELL_CLASSES = [
  "lg:col-start-1 lg:row-start-1 lg:flex-row-reverse lg:text-right",
  "lg:col-start-1 lg:row-start-2 lg:flex-row-reverse lg:text-right",
  "lg:col-start-1 lg:row-start-3 lg:flex-row-reverse lg:text-right",
  "lg:col-start-3 lg:row-start-1",
  "lg:col-start-3 lg:row-start-2",
  "lg:col-start-3 lg:row-start-3",
] as const;

export const Capabilities = () => {
  const { t } = useTranslation();

  return (
    <section id="capabilities" className="scroll-mt-20 border-b border-border bg-surface py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge={t("landing.capabilities.badge")}
          title={t("landing.capabilities.title")}
        />

        <div
          data-animate
          className="relative isolate mt-14 grid gap-6 md:grid-cols-2 lg:auto-rows-fr lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-x-10 lg:gap-y-4"
        >
          <CapabilityHubLinks />

          {CAPABILITIES.slice(0, 3).map((c, i) => (
            <CapabilityCard key={c.key} capability={c} className={CELL_CLASSES[i]} />
          ))}

          <CapabilityHub />

          {CAPABILITIES.slice(3).map((c, i) => (
            <CapabilityCard key={c.key} capability={c} className={CELL_CLASSES[i + 3]} />
          ))}
        </div>
      </div>
    </section>
  );
};

interface CardProps {
  capability: (typeof CAPABILITIES)[number];
  className: string;
}

const CapabilityCard = ({ capability, className }: CardProps) => {
  const { t } = useTranslation();

  return (
    <div
      className={`group flex items-start gap-4 rounded-xl bg-surface p-4 transition-colors duration-300 hover:bg-muted/40 lg:items-center lg:bg-transparent lg:hover:bg-muted/30 ${className}`}
    >
      <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent ring-4 ring-accent/5 transition-[box-shadow,transform] duration-300 group-hover:-translate-y-0.5 group-hover:ring-accent/15">
        <capability.icon className="size-5" />
      </div>
      <div>
        <h3 className="font-heading text-base font-bold text-foreground">
          {t(`landing.capabilities.${capability.key}Title`)}
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          {t(`landing.capabilities.${capability.key}Body`)}
        </p>
      </div>
    </div>
  );
};
