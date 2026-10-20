import { useTranslation } from "react-i18next";

import { SectionHeading } from "@/components/landing/SectionHeading";

const NEWS = [
  { tag: "Policy", date: "Oct 22, 2025", key: "news1", edge: "card-edge-warning" },
  { tag: "Release", date: "Oct 18, 2025", key: "news2", edge: "card-edge-success" },
  { tag: "Notice", date: "Oct 10, 2025", key: "news3", edge: "card-edge-danger" },
] as const;

export const Announcements = () => {
  const { t } = useTranslation();

  return (
    <section id="announcements" className="scroll-mt-20 border-b border-border bg-surface/30 py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge={t("landing.announcements.badge")}
          title={t("landing.announcements.title")}
        />
        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {NEWS.map((n, i) => (
            <li
              key={n.key}
              data-animate
              data-animate-delay={i + 1}
              className={`hover-lift flex flex-col rounded-xl bg-surface/40 p-6 hover:bg-surface ${n.edge}`}
            >
              <div className="mb-4 flex items-center gap-3 text-xs">
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 font-medium text-foreground">
                  {n.tag}
                </span>
                <span className="text-muted-foreground">{n.date}</span>
              </div>
              <h3 className="font-heading text-lg font-bold leading-tight text-foreground">
                {t(`landing.announcements.${n.key}Title`)}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t(`landing.announcements.${n.key}Body`)}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
};
