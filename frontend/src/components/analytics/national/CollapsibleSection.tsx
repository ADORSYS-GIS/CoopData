import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

interface CollapsibleSectionProps {
  id: string;
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  /** Number of items inside, shown next to the title. */
  count?: number;
}

/**
 * A titled section that can be folded. The whole header is a button with a
 * visible Hide / Show label and chevron, so it is clear the section can fold.
 */
export function CollapsibleSection({
  id,
  title,
  children,
  defaultOpen = true,
  count,
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
        className="group mb-3 flex w-full items-center justify-between gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2 text-left transition-colors hover:bg-muted/60"
      >
        <span className="flex min-w-0 items-center gap-2">
          <h2
            id={`${id}-title`}
            className="truncate font-heading text-sm font-bold uppercase tracking-wider text-foreground"
          >
            {title}
          </h2>
          {count !== undefined && (
            <span className="rounded-full bg-background px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              {count}
            </span>
          )}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-muted-foreground group-hover:text-foreground">
          {t(open ? "analytics.section.hide" : "analytics.section.show")}
          <ChevronDown
            className={`size-4 transition-transform ${open ? "" : "-rotate-90"}`}
            aria-hidden="true"
          />
        </span>
      </button>
      {open && <div id={`${id}-content`}>{children}</div>}
    </section>
  );
}
