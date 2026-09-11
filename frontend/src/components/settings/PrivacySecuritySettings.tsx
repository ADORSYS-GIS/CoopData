import React, { useState } from "react";
import {
  ShieldCheck,
  Download,
  Trash2,
  FileCheck,
  History,
  AlertTriangle,
  Send,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { Card, StatusPill } from "@/components/app-shell";
import {
  useConsentStatus,
  useMyConsents,
  useRecordConsent,
  useSubmitPrivacyRequest,
} from "@/hooks/auth/useConsent";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { Link } from "@tanstack/react-router";

export const PrivacySecuritySettings: React.FC = () => {
  const { t } = useTranslation();
  const { data: status, isLoading: statusLoading } = useConsentStatus();
  const { data: history, isLoading: historyLoading } = useMyConsents();
  const recordConsent = useRecordConsent();
  const submitRequest = useSubmitPrivacyRequest();

  const [requestType, setRequestType] = useState<"EXPORT_DATA" | "CORRECT_DATA" | "DELETE_ACCOUNT">(
    "EXPORT_DATA"
  );
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handlePrivacySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await submitRequest.mutateAsync({
        request_type: requestType,
        details: details.trim() || undefined,
      });
      toast.success(
        t("privacy.requestSubmitted", "Privacy request submitted successfully! Our compliance team will review it.")
      );
      setDetails("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit privacy request");
    } finally {
      setSubmitting(false);
    }
  };

  const requiredPolicies = [
    {
      type: "TERMS_OF_SERVICE",
      title: t("legal.termsOfService", "Terms of Service"),
      version: "1.0",
      accepted: status?.terms_accepted ?? false,
      link: "/legal/terms",
    },
    {
      type: "PRIVACY_POLICY",
      title: t("legal.privacyPolicy", "Privacy Policy"),
      version: "1.0",
      accepted: status?.privacy_accepted ?? false,
      link: "/legal/privacy",
    },
    {
      type: "COOKIE_POLICY",
      title: t("legal.cookiePolicy", "Cookie Policy"),
      version: "1.0",
      accepted: status?.accepted_consents.some((c) => c.document_type === "COOKIE_POLICY") ?? false,
      link: "/legal/cookies",
    },
    {
      type: "ACCEPTABLE_USE",
      title: t("legal.acceptableUse", "Acceptable Use Policy"),
      version: "1.0",
      accepted: status?.accepted_consents.some((c) => c.document_type === "ACCEPTABLE_USE") ?? false,
      link: "/legal/acceptable-use",
    },
    {
      type: "SECURITY_PROTECTION",
      title: t("legal.securityProtection", "Security & Protection Policy"),
      version: "1.0",
      accepted: status?.accepted_consents.some((c) => c.document_type === "SECURITY_PROTECTION") ?? false,
      link: "/legal/security",
    },
    {
      type: "DATA_RETENTION",
      title: t("legal.dataRetention", "Data Retention Policy"),
      version: "1.0",
      accepted: status?.accepted_consents.some((c) => c.document_type === "DATA_RETENTION") ?? false,
      link: "/legal/data-retention",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overview & Consent Status */}
      <Card
        title={t("privacy.consentStatusTitle", "Active Legal Consents")}
        subtitle={t("privacy.consentStatusSub", "Versioned agreement history on file with server timestamping")}
        edge="accent"
      >
        {statusLoading ? (
          <div className="py-6 flex items-center justify-center text-muted-foreground gap-2 text-xs">
            <Spinner size="sm" />
            <span>{t("common.loading", "Loading consent status...")}</span>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {requiredPolicies.map((pol) => (
                <div
                  key={pol.type}
                  className="p-4 rounded-xl border border-border bg-muted/30 flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold text-foreground">{pol.title}</p>
                      <p className="text-[11px] text-muted-foreground">Version {pol.version}</p>
                    </div>
                    <StatusPill tone={pol.accepted ? "success" : "warning"}>
                      {pol.accepted ? t("legal.accepted", "Accepted") : t("legal.pending", "Pending")}
                    </StatusPill>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50 text-xs">
                    <Link
                      to={pol.link as any}
                      className="text-accent hover:underline font-medium text-[11px] inline-flex items-center gap-1"
                    >
                      {t("legal.viewDoc", "View Document")}
                    </Link>
                    {!pol.accepted && (
                      <button
                        onClick={async () => {
                          try {
                            await recordConsent.mutateAsync({
                              document_type: pol.type,
                              document_version: pol.version,
                            });
                            toast.success(t("legal.consentRecorded", "Consent recorded!"));
                          } catch (err) {
                            toast.error(err instanceof Error ? err.message : "Failed to record consent");
                          }
                        }}
                        disabled={recordConsent.isPending}
                        className="bg-primary text-primary-foreground text-[11px] font-semibold px-2.5 py-1 rounded hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {t("legal.accept", "Accept")}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Privacy Requests Form (Export / Correct / Delete) */}
      <Card
        title={t("privacy.requestsTitle", "Submit Privacy & Data Request")}
        subtitle={t("privacy.requestsSub", "Exercise your GDPR / NDPR data subject rights (Export, Correction, Deletion)")}
        edge="info"
      >
        <form onSubmit={handlePrivacySubmit} className="space-y-4 max-w-2xl">
          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              {t("privacy.requestTypeLabel", "Request Type")}
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                {
                  id: "EXPORT_DATA",
                  label: t("privacy.typeExport", "Export My Data"),
                  icon: Download,
                  desc: "Receive structured JSON/CSV of your records",
                },
                {
                  id: "CORRECT_DATA",
                  label: t("privacy.typeCorrect", "Correct My Data"),
                  icon: FileCheck,
                  desc: "Request updates to inaccurate profile/records",
                },
                {
                  id: "DELETE_ACCOUNT",
                  label: t("privacy.typeDelete", "Account Erasure"),
                  icon: Trash2,
                  desc: "Request account anonymization or deletion",
                },
              ].map((opt) => {
                const Icon = opt.icon;
                const selected = requestType === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setRequestType(opt.id as any)}
                    className={`p-3 text-left rounded-xl border transition-all ${
                      selected
                        ? "bg-accent/15 border-accent text-foreground shadow-sm"
                        : "bg-surface border-border text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    <Icon className={`size-4 mb-1.5 ${selected ? "text-accent" : "text-muted-foreground"}`} />
                    <p className="text-xs font-bold">{opt.label}</p>
                    <p className="text-[10px] text-muted-foreground/80 leading-tight mt-0.5">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-foreground mb-1.5">
              {t("privacy.detailsLabel", "Additional Context or Instructions (Optional)")}
            </label>
            <textarea
              rows={3}
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Provide specific details regarding your request..."
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
            />
          </div>

          {requestType === "DELETE_ACCOUNT" && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-warning-foreground text-xs flex items-start gap-2.5">
              <AlertTriangle className="size-4 shrink-0 mt-0.5 text-warning" />
              <span>
                {t(
                  "privacy.deleteWarning",
                  "Note: Financial statement filings and regulatory audit trails must be retained for 10 years per statutory regulations. Account erasure will anonymize your personal credentials while retaining compliance records."
                )}
              </span>
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50"
            >
              {submitting ? <Spinner size="sm" /> : <Send className="size-3.5" />}
              {t("privacy.submitButton", "Submit Request")}
            </button>
          </div>
        </form>
      </Card>

      {/* Immutable Consent Audit Log History */}
      <Card
        title={t("privacy.auditHistoryTitle", "Consent Audit Trail")}
        subtitle={t("privacy.auditHistorySub", "Server-recorded history of all consent acceptances for your account")}
        edge="none"
      >
        {historyLoading ? (
          <div className="py-6 flex items-center justify-center text-muted-foreground gap-2 text-xs">
            <Spinner size="sm" />
            <span>{t("common.loading", "Loading audit records...")}</span>
          </div>
        ) : !history || history.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4 text-center">
            {t("privacy.noHistory", "No historical consent logs recorded yet.")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-y border-border bg-muted/60 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <th className="px-4 py-2.5">{t("legal.document", "Document")}</th>
                  <th className="px-4 py-2.5">{t("legal.version", "Version")}</th>
                  <th className="px-4 py-2.5">{t("legal.acceptedAt", "Accepted At (UTC)")}</th>
                  <th className="px-4 py-2.5">{t("legal.ipAddress", "IP Address")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((record) => (
                  <tr key={record.id} className="hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-2.5 font-bold text-foreground">{record.document_type}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">v{record.document_version}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {new Date(record.accepted_at).toLocaleString()}
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
    </div>
  );
};
