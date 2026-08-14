import { Loader2, ShieldCheck, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useMfaSetup } from "@/hooks/auth/useSecuritySettings";
import { keycloak } from "@/services/shared/authService";

interface MfaSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const MfaSetupDialog: React.FC<MfaSetupDialogProps> = ({ open, onOpenChange }) => {
  const { t } = useTranslation();
  const mfaSetup = useMfaSetup();

  const handleStartSetup = async () => {
    try {
      // Arm the CONFIGURE_TOTP required action on the Keycloak account, then
      // redirect through Keycloak's login with kc_action=CONFIGURE_TOTP so the
      // user completes setup right away (re-auth → scan QR → enter code). After
      // completing, Keycloak sends them back to the profile page.
      await mfaSetup.mutateAsync();
      await keycloak.login({
        redirectUri: `${window.location.origin}/app/profile`,
        scope: "openid profile email",
        action: "CONFIGURE_TOTP",
        locale: localStorage.getItem("i18nextLng") || "en",
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("profile.unexpectedError"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-accent" />
            {t("profile.mfaSetupTitle")}
          </DialogTitle>
          <DialogDescription>{t("profile.mfaSetupDesc")}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <div className="flex w-full flex-col items-center gap-4 rounded-2xl border border-border bg-surface p-5 shadow-sm">
            <img
              src="/coopdatalogo.png"
              alt={t("common.logoAlt")}
              className="h-8 w-auto object-contain"
            />
            <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
              <Smartphone className="mt-0.5 size-3.5 shrink-0 text-accent" />
              <span>{t("profile.mfaRedirectHint")}</span>
            </div>
          </div>

          {mfaSetup.isError && (
            <div className="w-full rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
              {mfaSetup.error instanceof Error
                ? mfaSetup.error.message
                : t("profile.unexpectedError")}
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={mfaSetup.isPending}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {t("profile.mfaCancel")}
          </button>
          <button
            type="button"
            onClick={handleStartSetup}
            disabled={mfaSetup.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mfaSetup.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            {t("profile.mfaStartSetup")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
