import { useTranslation } from "react-i18next";

const PARTNERS = [
  { src: "/partner-1.png", alt: "Partner 1" },
  { src: "/partner-2.png", alt: "Partner 2" },
  { src: "/partner-11.png", alt: "Partner 5" },
] as const;

export const PartnerStrip = () => {
  const { t } = useTranslation();

  return (
    <section className="overflow-hidden border-y border-border bg-muted/30 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <p
          data-animate
          className="mb-10 text-center text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground"
        >
          {t("landing.partners.title")}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-12 lg:gap-16">
          {PARTNERS.map((partner, i) => (
            <img
              key={partner.src}
              data-animate
              data-animate-delay={i + 1}
              src={partner.src}
              alt={partner.alt}
              draggable={false}
              className="h-28 w-auto max-w-[280px] object-contain opacity-80 grayscale-[35%] transition-[opacity,filter,transform] duration-500 hover:scale-[1.03] hover:opacity-100 hover:grayscale-0"
            />
          ))}
        </div>
      </div>
    </section>
  );
};
