import type { LucideIcon } from "lucide-react";
import { Inbox, Lock, PenLine, Send, Undo2, UserRound } from "lucide-react";

import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import type { SubmissionAccess } from "@/lib/submissionAccess";

interface Props {
  access: SubmissionAccess;
  /** Smaller variant for table rows. */
  compact?: boolean;
}

type Tone = "success" | "warning" | "primary" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  success: "text-success bg-success/10 border-success/25",
  warning: "text-warning bg-warning/10 border-warning/30",
  primary: "text-primary bg-primary/5 border-primary/20",
  muted: "text-muted-foreground bg-muted/50 border-border/60",
};

const STYLE: Record<
  Exclude<SubmissionAccess["kind"], "none">,
  { tone: Tone; icon: LucideIcon; live?: boolean }
> = {
  editing: { tone: "success", icon: PenLine, live: true },
  waiting: { tone: "primary", icon: Inbox },
  colleague: { tone: "warning", icon: UserRound },
  reclaimed: { tone: "warning", icon: Undo2 },
  withApex: { tone: "muted", icon: Lock },
  withCooperative: { tone: "primary", icon: Send },
};

/** Who holds a draft submission, as a small pill. Renders nothing for non-drafts. */
export function SubmissionAccessBadge({ access, compact = false }: Props) {
  const { t, apexShort, coopShort } = useOrganizationLabelsContext();
  if (access.kind === "none") return null;

  const { tone, icon: Icon, live } = STYLE[access.kind];
  const name = "name" in access ? access.name : null;
  const label = t(`submissions.access.badge.${access.kind}${name ? "Named" : ""}`, {
    name,
    apex: apexShort,
    coop: coopShort,
  });

  return (
    <span
      className={`inline-flex w-fit items-center gap-1.5 border font-semibold ${TONE_CLASS[tone]} ${
        compact ? "rounded-md px-1.5 py-0.5 text-[10px]" : "rounded-lg px-2 py-1 text-xs"
      }`}
      title={label}
    >
      {live ? (
        <span className="relative flex size-1.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-success opacity-60" />
          <span className="relative inline-flex size-1.5 rounded-full bg-success" />
        </span>
      ) : (
        <Icon className={compact ? "size-3" : "size-3.5"} aria-hidden />
      )}
      <span className="truncate">{label}</span>
    </span>
  );
}
