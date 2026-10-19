import { Cookie } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Card, StatusPill } from "@/components/app-shell";
import { Spinner } from "@/components/ui/spinner";
import { LEGAL_DOCUMENTS, type LegalDocument } from "@/constants/legalDocuments";
import { useConsentStatus, useRecordConsent } from "@/hooks/auth/useConsent";
import { useCookieConsentChoice } from "@/hooks/shared/useCookieConsentChoice";
import { useLegalDocuments } from "@/hooks/shared/useLegalDocuments";
import { openCookieSettings } from "@/lib/cookieConsent";

/** Labels per kind: the status when given, when not given, and the action. */
const KIND_TEXT = {
  required: ["legal.accepted", "legal.actionNeeded", "legal.accept"],
  consent: ["legal.consentGiven", "legal.consentNotGiven", "legal.giveConsent"],
  acknowledge: ["legal.acknowledged", "legal.notAcknowledged", "legal.acknowledge"],
} as const;

/**
 * The user's standing with each published legal document: the two required
 * agreements, the optional consent and acknowledgements, and the cookie choice.
 * A document counts as accepted only for its current published version.
 */
export function ConsentStatusCard() {
  const { t } = useTranslation();
  const { data: status, isLoading } = useConsentStatus();
  const { policies } = useLegalDocuments();
  const recordConsent = useRecordConsent();
  const cookieChoice = useCookieConsentChoice();

  const versionOf = (doc: LegalDocument) => {
    if (doc.type === "TERMS_OF_SERVICE" && status) return status.terms_version;
    if (doc.type === "PRIVACY_POLICY" && status) return status.privacy_version;
    return `${policies.find((p) => p.slug === doc.slug)?.version ?? 1}.0`;
  };
  const isAccepted = (doc: LegalDocument, version: string) => {
    if (doc.type === "TERMS_OF_SERVICE") return status?.terms_accepted ?? false;
    if (doc.type === "PRIVACY_POLICY") return status?.privacy_accepted ?? false;
    return (
      status?.accepted_consents.some(
        (c) => c.document_type === doc.type && c.document_version === version,
      ) ?? false
    );
  };

  const accept = async (doc: LegalDocument) => {
    try {
      await recordConsent.mutateAsync({ document_type: doc.type });
      toast.success(t("legal.consentRecorded", "Your choice has been recorded."));
    } catch {
      toast.error(t("legal.consentFailed", "Your choice could not be recorded. Please try again."));
    }
  };

  const tile = (doc: LegalDocument) => {
    const version = versionOf(doc);
    const accepted = isAccepted(doc, version);
    const [given, notGiven, action] = KIND_TEXT[doc.kind];
    return (
      <div
        key={doc.type}
        className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-foreground">{t(doc.titleKey)}</p>
            <p className="text-[11px] text-muted-foreground">
              {t("legal.versionLabel", "Version {{version}}", { version })}
            </p>
          </div>
          <StatusPill tone={accepted ? "success" : doc.kind === "required" ? "warning" : "neutral"}>
            {t(accepted ? given : notGiven)}
          </StatusPill>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2 text-xs">
          <Link
            to="/legal"
            search={{ doc: doc.slug }}
            className="text-[11px] font-medium text-accent hover:underline"
          >
            {t("legal.viewDoc", "View document")}
          </Link>
          {!accepted && (
            <button
              type="button"
              onClick={() => accept(doc)}
              disabled={recordConsent.isPending}
              className="rounded bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
            >
              {t(action)}
            </button>
          )}
        </div>
      </div>
    );
  };

  const cookieText =
    cookieChoice === "accepted"
      ? t("legal.cookieChoiceAll", "All technologies allowed")
      : cookieChoice === "rejected"
        ? t("legal.cookieChoiceEssential", "Essential only")
        : t("legal.cookieChoiceNone", "No choice made yet");

  return (
    <Card
      title={t("privacy.consentStatusTitle", "Your legal agreements")}
      subtitle={t(
        "privacy.consentStatusSub",
        "Each acceptance is recorded with its version and time",
      )}
      edge="accent"
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
          <Spinner size="sm" />
          <span>{t("common.loading", "Loading…")}</span>
        </div>
      ) : (
        <div className="space-y-5">
          <section className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("legal.requiredSection", "Required to use CoopData")}
            </h4>
            <div className="grid gap-4 sm:grid-cols-2">
              {LEGAL_DOCUMENTS.filter((d) => d.kind === "required").map(tile)}
            </div>
          </section>
          <section className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("legal.optionalSection", "Optional")}
            </h4>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {LEGAL_DOCUMENTS.filter((d) => d.kind !== "required").map(tile)}
              <div className="flex flex-col justify-between gap-3 rounded-xl border border-border bg-muted/30 p-4">
                <div className="flex items-start gap-2">
                  <Cookie className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      {t("legal.cookiePreferences", "Cookie preferences")}
                    </p>
                    <p className="text-[11px] text-muted-foreground">{cookieText}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2 text-xs">
                  <Link
                    to="/legal"
                    search={{ doc: "cookies" }}
                    className="text-[11px] font-medium text-accent hover:underline"
                  >
                    {t("legal.viewDoc", "View document")}
                  </Link>
                  <button
                    type="button"
                    onClick={openCookieSettings}
                    className="rounded border border-border px-2.5 py-1 text-[11px] font-semibold text-foreground transition-colors hover:bg-muted"
                  >
                    {t("legal.changeCookies", "Change")}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}
    </Card>
  );
}
