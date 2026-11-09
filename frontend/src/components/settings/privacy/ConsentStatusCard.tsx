import { ArrowUpRight, Cookie } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

import { Card } from "@/components/app-shell";
import { Spinner } from "@/components/ui/spinner";
import { LEGAL_DOCUMENTS, type LegalDocument } from "@/constants/legalDocuments";
import { useConsentStatus } from "@/hooks/auth/useConsent";
import { useLegalDocuments } from "@/hooks/shared/useLegalDocuments";

const TILE_CLASS =
  "group flex items-start justify-between gap-2 rounded-xl border border-border bg-muted/30 p-4 transition-colors hover:border-accent/50 hover:bg-muted/60";

/**
 * The published legal documents the user is bound by or may consent to.
 * Each tile is a single link to the document in the legal centre.
 */
export function ConsentStatusCard() {
  const { t } = useTranslation();
  const { data: status, isLoading } = useConsentStatus();
  const { policies } = useLegalDocuments();

  const versionOf = (doc: LegalDocument) => {
    if (doc.type === "TERMS_OF_SERVICE" && status) return status.terms_version;
    if (doc.type === "PRIVACY_POLICY" && status) return status.privacy_version;
    return `${policies.find((p) => p.slug === doc.slug)?.version ?? 1}.0`;
  };

  const tile = (doc: LegalDocument) => (
    <Link key={doc.type} to="/legal" search={{ doc: doc.slug }} className={TILE_CLASS}>
      <div>
        <p className="text-xs font-bold text-foreground">{t(doc.titleKey)}</p>
        <p className="text-[11px] text-muted-foreground">
          {t("legal.versionLabel", "Version {{version}}", { version: versionOf(doc) })}
        </p>
      </div>
      <ArrowUpRight
        className="size-4 shrink-0 text-accent transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
        aria-hidden
      />
    </Link>
  );

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
              <Link to="/legal" search={{ doc: "cookies" }} className={TILE_CLASS}>
                <div className="flex items-start gap-2">
                  <Cookie className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                  <p className="text-xs font-bold text-foreground">
                    {t("legal.cookiePreferences", "Cookie preferences")}
                  </p>
                </div>
                <ArrowUpRight
                  className="size-4 shrink-0 text-accent transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden
                />
              </Link>
            </div>
          </section>
        </div>
      )}
    </Card>
  );
}
