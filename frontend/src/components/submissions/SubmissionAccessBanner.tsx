import { Eye, Lock, MessageSquareQuote, Undo2, UserRound } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import { handoverTime, type SubmissionAccess } from "@/lib/submissionAccess";

interface Props {
  access: SubmissionAccess;
}

/**
 * Explains why a draft is read-only for the current user: the Apex reclaimed it,
 * the Apex is still preparing it, or a colleague is editing it.
 */
export function SubmissionAccessBanner({ access }: Props) {
  const { t, apexShort, coopShort } = useOrganizationLabelsContext();
  const { i18n } = useTranslation();
  if (access.kind !== "reclaimed" && access.kind !== "withApex" && access.kind !== "colleague") {
    return null;
  }

  const vars = { name: access.name, apex: apexShort, coop: coopShort };
  const reclaimed = access.kind === "reclaimed";
  const Icon = reclaimed ? Undo2 : access.kind === "colleague" ? UserRound : Lock;
  const named = access.name ? "Named" : "";

  return (
    <div
      role="status"
      className={`relative overflow-hidden rounded-xl border ${
        reclaimed ? "border-warning/30 bg-warning/5" : "border-border bg-muted/30"
      }`}
    >
      <div
        className={`absolute inset-y-0 left-0 w-1 ${reclaimed ? "bg-warning" : "bg-muted-foreground/30"}`}
      />
      <div className="flex items-start gap-4 px-5 py-4 pl-6">
        <div
          className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl ring-1 ${
            reclaimed
              ? "bg-warning/15 text-warning ring-warning/25"
              : "bg-muted text-muted-foreground ring-border"
          }`}
        >
          <Icon className="size-5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-foreground">
              {t(`submissions.access.banner.${access.kind}.title${named}`, vars)}
            </p>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-surface px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Eye className="size-3" aria-hidden />
              {t("submissions.access.readOnly")}
            </span>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t(`submissions.access.banner.${access.kind}.body${named}`, vars)}
          </p>
          {reclaimed && access.at && (
            <p className="text-[11px] font-medium text-muted-foreground/80">
              {t("submissions.access.reclaimedAt", {
                time: handoverTime(access.at, i18n.language),
              })}
            </p>
          )}
          {reclaimed && access.comment && (
            <figure className="mt-2 flex gap-2 rounded-lg border border-warning/20 bg-surface px-3 py-2">
              <MessageSquareQuote className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden />
              <div className="min-w-0">
                <figcaption className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("submissions.access.noteFrom", vars)}
                </figcaption>
                <blockquote className="text-xs text-foreground">{access.comment}</blockquote>
              </div>
            </figure>
          )}
        </div>
      </div>
    </div>
  );
}
