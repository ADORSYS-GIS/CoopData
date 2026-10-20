import { ChevronDown } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";

import { SectionHeading } from "@/components/landing/SectionHeading";

const FAQ_KEYS = ["1", "2", "3", "4"] as const;

interface ItemProps {
  question: string;
  answer: string;
  defaultOpen?: boolean;
}

const FaqItem = ({ question, answer, defaultOpen = false }: ItemProps) => {
  const [open, setOpen] = useState(defaultOpen);
  const panelId = useId();

  return (
    <li className="border-b border-border last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left text-sm font-semibold text-foreground transition-colors hover:bg-muted/30"
      >
        {question}
        <ChevronDown
          className={`size-4 shrink-0 text-muted-foreground transition-transform duration-300 ease-[var(--ease-out-expo)] ${open ? "rotate-180 text-accent" : ""}`}
        />
      </button>
      <div
        id={panelId}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-[var(--ease-out-expo)] ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
      >
        <p className="overflow-hidden px-6 text-sm leading-relaxed text-muted-foreground">
          <span className="block pb-5">{answer}</span>
        </p>
      </div>
    </li>
  );
};

export const Faq = () => {
  const { t } = useTranslation();

  return (
    <section id="faq" className="scroll-mt-20 border-b border-border bg-surface py-24">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          align="center"
          badge={t("landing.faq.badge")}
          title={t("landing.faq.title")}
        />
        <ul
          data-animate
          data-animate-delay="2"
          className="mt-12 overflow-hidden rounded-xl border border-border bg-background shadow-sm"
        >
          {FAQ_KEYS.map((k, i) => (
            <FaqItem
              key={k}
              question={t(`landing.faq.q${k}`)}
              answer={t(`landing.faq.a${k}`)}
              defaultOpen={i === 0}
            />
          ))}
        </ul>
      </div>
    </section>
  );
};
