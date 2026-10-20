import { useTranslation } from "react-i18next";

export const CapabilityHub = () => {
  const { t } = useTranslation();

  return (
    <div className="hidden lg:col-start-2 lg:row-span-3 lg:row-start-1 lg:flex lg:items-center lg:justify-center lg:px-6">
      <div className="relative flex size-36 items-center justify-center">
        <span aria-hidden="true" className="absolute inset-0 rounded-full bg-accent/10 blur-2xl" />
        <span
          aria-hidden="true"
          className="absolute inset-0 animate-ping rounded-full bg-accent/5 [animation-duration:3.5s]"
        />
        <span
          aria-hidden="true"
          className="absolute inset-2 rounded-full border border-dashed border-accent/25"
        />
        <div className="relative flex size-28 items-center justify-center rounded-full border border-border bg-surface shadow-[var(--shadow-elev-2)]">
          <img
            src="/coopdatalogo.png"
            alt={t("common.logoAlt")}
            className="size-20 object-contain"
          />
        </div>
      </div>
    </div>
  );
};
