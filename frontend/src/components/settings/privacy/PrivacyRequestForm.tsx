import React, { useState } from "react";
import { AlertTriangle, Download, FileCheck, Send, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { Card } from "@/components/app-shell";
import { Spinner } from "@/components/ui/spinner";
import { useSubmitPrivacyRequest } from "@/hooks/auth/useConsent";

type RequestType = "EXPORT_DATA" | "CORRECT_DATA" | "DELETE_ACCOUNT";

const REQUEST_TYPES = [
  {
    id: "EXPORT_DATA",
    icon: Download,
    label: "privacy.typeExport",
    desc: "privacy.typeExportDesc",
  },
  {
    id: "CORRECT_DATA",
    icon: FileCheck,
    label: "privacy.typeCorrect",
    desc: "privacy.typeCorrectDesc",
  },
  {
    id: "DELETE_ACCOUNT",
    icon: Trash2,
    label: "privacy.typeDelete",
    desc: "privacy.typeDeleteDesc",
  },
] as const;

/** Lets a user ask for a copy, a correction or the deletion of their data. */
export function PrivacyRequestForm() {
  const { t } = useTranslation();
  const submitRequest = useSubmitPrivacyRequest();
  const [requestType, setRequestType] = useState<RequestType>("EXPORT_DATA");
  const [details, setDetails] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await submitRequest.mutateAsync({
        request_type: requestType,
        details: details.trim() || undefined,
      });
      toast.success(
        t("privacy.requestSubmitted", "Your request has been submitted and will be reviewed."),
      );
      setDetails("");
    } catch {
      toast.error(
        t("privacy.requestFailed", "Your request could not be submitted. Please try again."),
      );
    }
  };

  return (
    <Card
      title={t("privacy.requestsTitle", "Request about your data")}
      subtitle={t(
        "privacy.requestsSub",
        "Ask for a copy of your data, a correction, or the deletion of your account",
      )}
      edge="info"
    >
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
        <fieldset>
          <legend className="mb-1.5 block text-xs font-semibold text-foreground">
            {t("privacy.requestTypeLabel", "Request type")}
          </legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {REQUEST_TYPES.map((opt) => {
              const Icon = opt.icon;
              const selected = requestType === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setRequestType(opt.id)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    selected
                      ? "border-accent bg-accent/15 text-foreground shadow-sm"
                      : "border-border bg-surface text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon
                    className={`mb-1.5 size-4 ${selected ? "text-accent" : "text-muted-foreground"}`}
                    aria-hidden
                  />
                  <p className="text-xs font-bold">{t(opt.label)}</p>
                  <p className="mt-0.5 text-[10px] leading-tight text-muted-foreground/80">
                    {t(opt.desc)}
                  </p>
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold text-foreground">
            {t("privacy.detailsLabel", "Details (optional)")}
          </span>
          <textarea
            rows={3}
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            placeholder={t("privacy.detailsPlaceholder", "Describe what you need…")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
          />
        </label>

        {requestType === "DELETE_ACCOUNT" && (
          <div className="flex items-start gap-2.5 rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning-foreground">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <span>
              {t(
                "privacy.deleteWarning",
                "Some records must be kept for legal, audit or security reasons, as set out in the Data Retention & Erasure Schedule (for example financial and audit records for up to 7 years). Where deletion is limited, we will explain why.",
              )}
            </span>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitRequest.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-xs font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:opacity-50"
          >
            {submitRequest.isPending ? <Spinner size="sm" /> : <Send className="size-3.5" />}
            {t("privacy.submitButton", "Submit request")}
          </button>
        </div>
      </form>
    </Card>
  );
}
