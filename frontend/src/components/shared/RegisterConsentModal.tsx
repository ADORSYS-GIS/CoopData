import React, { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ShieldAlert, CheckCircle2, Lock, FileText, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useConsentStatus, useRecordConsent } from "@/hooks/auth/useConsent";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/context/AuthContext";

export const RegisterConsentModal: React.FC = () => {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { data: status, isLoading } = useConsentStatus();
  const recordConsent = useRecordConsent();

  const [open, setOpen] = useState(false);
  const [termsChecked, setTermsChecked] = useState(false);
  const [privacyChecked, setPrivacyChecked] = useState(false);
  const [marketingChecked, setMarketingChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthenticated && status && !status.has_accepted_all_required) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [isAuthenticated, status]);

  if (!isAuthenticated || isLoading || status?.has_accepted_all_required) {
    return null;
  }

  const handleAcceptAll = async () => {
    if (!termsChecked || !privacyChecked) {
      toast.error(
        t(
          "legal.acceptRequiredToast",
          "Please accept both the Terms of Service and Privacy Policy to proceed.",
        ),
      );
      return;
    }

    setSubmitting(true);
    try {
      if (!status?.terms_accepted) {
        await recordConsent.mutateAsync({
          document_type: "TERMS_OF_SERVICE",
          document_version: "1.0",
        });
      }
      if (!status?.privacy_accepted) {
        await recordConsent.mutateAsync({
          document_type: "PRIVACY_POLICY",
          document_version: "1.0",
        });
      }

      toast.success(t("legal.consentRecordedSuccess", "Legal policies accepted successfully!"));
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to record legal consent");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md p-6 bg-surface/95 backdrop-blur-xl border border-border/80 shadow-2xl rounded-2xl">
        <DialogHeader className="text-left space-y-2">
          <div className="size-10 rounded-xl bg-accent/10 border border-accent/20 text-accent grid place-items-center">
            <ShieldAlert className="size-5" />
          </div>
          <DialogTitle className="text-lg font-bold text-foreground">
            {t("legal.mandatoryConsentTitle", "Action Required: Accept Updated Legal Terms")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground leading-relaxed">
            {t(
              "legal.mandatoryConsentDesc",
              "To continue using CoopData, please review and accept our mandatory Terms of Service and Privacy Policy (v1.0).",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3.5 my-4">
          {/* Terms of Service Checkbox */}
          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={termsChecked}
              onChange={(e) => setTermsChecked(e.target.checked)}
              className="mt-0.5 size-4 rounded border-border text-accent focus:ring-accent"
            />
            <div className="text-xs flex-1">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <FileText className="size-3.5 text-accent" />
                {t("legal.termsOfService", "Terms of Service")} (v1.0) *
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t(
                  "legal.termsAcceptPrompt",
                  "I agree to the platform usage rules, responsibilities, and operational conditions.",
                )}
              </p>
              <Link
                to="/legal"
                target="_blank"
                className="text-[11px] text-accent font-medium hover:underline inline-flex items-center gap-1 mt-1"
              >
                {t("legal.readFullTerms", "Read Terms of Service")}{" "}
                <ExternalLink className="size-3" />
              </Link>
            </div>
          </label>

          {/* Privacy Policy Checkbox */}
          <label className="flex items-start gap-3 p-3.5 rounded-xl border border-border bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={privacyChecked}
              onChange={(e) => setPrivacyChecked(e.target.checked)}
              className="mt-0.5 size-4 rounded border-border text-accent focus:ring-accent"
            />
            <div className="text-xs flex-1">
              <span className="font-bold text-foreground flex items-center gap-1.5">
                <Lock className="size-3.5 text-accent" />
                {t("legal.privacyPolicy", "Privacy Policy")} (v1.0) *
              </span>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {t(
                  "legal.privacyAcceptPrompt",
                  "I consent to the collection, processing, and protection of personal & co-op data.",
                )}
              </p>
              <Link
                to="/legal"
                target="_blank"
                className="text-[11px] text-accent font-medium hover:underline inline-flex items-center gap-1 mt-1"
              >
                {t("legal.readFullPrivacy", "Read Privacy Policy")}{" "}
                <ExternalLink className="size-3" />
              </Link>
            </div>
          </label>

          {/* Optional Marketing Consent */}
          <label className="flex items-start gap-3 p-3 rounded-xl border border-border/50 bg-background/50 transition-colors cursor-pointer">
            <input
              type="checkbox"
              checked={marketingChecked}
              onChange={(e) => setMarketingChecked(e.target.checked)}
              className="mt-0.5 size-4 rounded border-border text-accent focus:ring-accent"
            />
            <div className="text-xs flex-1">
              <span className="font-medium text-foreground">
                {t(
                  "legal.marketingConsent",
                  "Optional: Receive platform product updates & sector newsletters",
                )}
              </span>
            </div>
          </label>
        </div>

        <DialogFooter>
          <button
            onClick={handleAcceptAll}
            disabled={!termsChecked || !privacyChecked || submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? <Spinner size="sm" /> : <CheckCircle2 className="size-4" />}
            {t("legal.acceptAndProceed", "Accept & Continue to CoopData")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
