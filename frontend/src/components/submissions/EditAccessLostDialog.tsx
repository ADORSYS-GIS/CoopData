import { Eye, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";

import { useOrganizationLabelsContext } from "@/context/OrganizationLabelsContext";
import { handoverTime, type SubmissionAccess } from "@/lib/submissionAccess";

interface Props {
  access: SubmissionAccess;
  /** The backend's explanation when a refused save revealed the change. */
  serverMessage: string | null;
  onClose: () => void;
}

/**
 * Tells the user, at the moment it happens, that they can no longer edit the
 * submission — typically because the Apex reclaimed it — and that the page is now
 * read-only. Shown once per loss; the banner keeps explaining afterwards.
 */
export function EditAccessLostDialog({ access, serverMessage, onClose }: Props) {
  const { t, apexShort, coopShort } = useOrganizationLabelsContext();
  const { i18n } = useTranslation();
  const name = "name" in access ? access.name : null;
  const vars = { name, apex: apexShort, coop: coopShort };
  const named = name ? "Named" : "";

  const reason =
    access.kind === "reclaimed" || access.kind === "withApex"
      ? t(`submissions.access.lost.reclaimed${named}`, vars)
      : access.kind === "colleague"
        ? t(`submissions.access.lost.colleague${named}`, vars)
        : serverMessage || t("submissions.access.lost.generic", vars);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-[2px] sm:items-center"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="edit-access-lost-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-200">
        <div className="flex items-start gap-3 px-6 pb-4 pt-6">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-warning/15 text-warning ring-1 ring-warning/25">
            <ShieldAlert className="size-5" aria-hidden />
          </div>
          <div className="min-w-0">
            <h2 id="edit-access-lost-title" className="text-base font-bold text-foreground">
              {t("submissions.access.lost.title")}
            </h2>
            <p className="mt-1 text-sm leading-relaxed text-foreground/90">{reason}</p>
          </div>
        </div>

        {access.kind === "reclaimed" && access.comment && (
          <div className="mx-6 mb-4 rounded-lg border border-warning/20 bg-warning/5 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("submissions.access.noteFrom", vars)}
            </p>
            <p className="text-xs text-foreground">{access.comment}</p>
            {access.at && (
              <p className="mt-1 text-[10px] text-muted-foreground">
                {handoverTime(access.at, i18n.language)}
              </p>
            )}
          </div>
        )}

        <div className="mx-6 flex items-start gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          <Eye className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>{t("submissions.access.lost.readOnlyNow")}</span>
        </div>

        <div className="px-6 py-5">
          <button
            type="button"
            autoFocus
            onClick={onClose}
            className="w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("submissions.access.lost.ok")}
          </button>
        </div>
      </div>
    </div>
  );
}
