// frontend/src/pages/shared/DataPrivacyPage.tsx
import React from "react";
import { AppShell, Card } from "@/components/app-shell";
import { PrivacySecuritySettings } from "@/components/settings/PrivacySecuritySettings";
import { ShieldCheck, ExternalLink, Scale, FileText } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";

export const DataPrivacyPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <AppShell
      title={t("nav.dataPrivacy", "Data Privacy & Legal Consents")}
      subtitle={t(
        "privacy.pageSubtitle",
        "Manage active legal agreements, GDPR / NDPR data subject rights, and consent audit trails",
      )}
    >
      <div className="space-y-6 max-w-5xl mx-auto">
        {/* Banner Card */}
        <Card edge="accent">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="grid size-12 place-items-center rounded-2xl bg-accent/10 text-accent shrink-0">
                <ShieldCheck className="size-6" />
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold text-foreground">
                  {t("privacy.bannerTitle", "Privacy & Data Subject Rights")}
                </h2>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed max-w-2xl">
                  {t(
                    "privacy.bannerDesc",
                    "CoopData enforces strict data protection standards under the Eswatini Data Protection Act, GDPR, and NDPR. Review your recorded consents or exercise data subject rights below.",
                  )}
                </p>
              </div>
            </div>

            <Link
              to="/legal"
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs font-semibold text-accent shadow-sm hover:bg-muted hover:text-accent/80 transition-all shrink-0"
            >
              <Scale className="size-4" />
              <span>{t("privacy.openLegalCenter", "Open Legal Center")}</span>
              <ExternalLink className="size-3.5 opacity-70" />
            </Link>
          </div>
        </Card>

        {/* Privacy & Legal Consent Management Components */}
        <PrivacySecuritySettings />
      </div>
    </AppShell>
  );
};
