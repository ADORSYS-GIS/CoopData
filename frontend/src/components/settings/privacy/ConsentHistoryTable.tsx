import { useTranslation } from "react-i18next";

import { Card } from "@/components/app-shell";
import { Spinner } from "@/components/ui/spinner";
import { legalDocumentTitleKey } from "@/constants/legalDocuments";
import { useMyConsents } from "@/hooks/auth/useConsent";

/** Every acceptance recorded for the user, newest first, as kept by the server. */
export function ConsentHistoryTable() {
  const { t, i18n } = useTranslation();
  const { data: history, isLoading } = useMyConsents();

  return (
    <Card
      title={t("privacy.auditHistoryTitle", "Consent history")}
      subtitle={t("privacy.auditHistorySub", "Every acceptance recorded for your account")}
      edge="none"
    >
      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-6 text-xs text-muted-foreground">
          <Spinner size="sm" />
          <span>{t("common.loading", "Loading…")}</span>
        </div>
      ) : !history || history.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          {t("privacy.noHistory", "No acceptances recorded yet.")}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-y border-border bg-muted/60 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-2.5">{t("legal.document", "Document")}</th>
                <th className="px-4 py-2.5">{t("legal.version", "Version")}</th>
                <th className="px-4 py-2.5">{t("legal.acceptedAt", "Accepted on")}</th>
                <th className="px-4 py-2.5">{t("legal.ipAddress", "IP address")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((record) => (
                <tr key={record.id} className="transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5 font-bold text-foreground">
                    {t(legalDocumentTitleKey(record.document_type))}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">v{record.document_version}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {new Date(record.accepted_at).toLocaleString(i18n.language)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
                    {record.ip_address || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
