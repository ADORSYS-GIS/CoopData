import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface CollapsibleSectionProps {
  id: string;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

/** A titled section whose content can be folded away. */
export function CollapsibleSection({
  id,
  title,
  children,
  defaultOpen = true,
}: CollapsibleSectionProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section aria-labelledby={`${id}-title`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={`${id}-content`}
        aria-label={t(open ? "analytics.section.collapse" : "analytics.section.expand", { title })}
        className="mb-3 flex w-full items-center justify-between gap-2 text-left"
      >
        <h2
          id={`${id}-title`}
          className="font-heading text-sm font-bold uppercase tracking-wider text-foreground"
        >
          {title}
        </h2>
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform ${
            open ? "" : "-rotate-90"
          }`}
        />
      </button>
      {open && <div id={`${id}-content`}>{children}</div>}
    </section>
  );
}
