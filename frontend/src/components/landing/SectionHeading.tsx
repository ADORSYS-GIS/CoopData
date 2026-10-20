import type { ReactNode } from "react";

interface Props {
  badge: string;
  title: string;
  aside?: ReactNode;
  align?: "start" | "center";
}

export const SectionHeading = ({ badge, title, aside, align = "start" }: Props) => {
  const centered = align === "center";
  return (
    <div
      data-animate
      className={
        aside
          ? "flex flex-wrap items-end justify-between gap-6 border-b border-border/80 pb-8"
          : centered
            ? "text-center"
            : undefined
      }
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">{badge}</p>
        <h2
          className={`font-heading mt-3 text-3xl font-bold tracking-tight text-balance text-foreground md:text-4xl ${centered ? "" : "max-w-2xl"}`}
        >
          {title}
        </h2>
      </div>
      {aside}
    </div>
  );
};
