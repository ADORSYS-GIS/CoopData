import { Loader2, RefreshCcw, Eye, EyeOff, Smartphone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useResetMfa } from "@/hooks/auth/useSecuritySettings";
import { keycloak } from "@/services/shared/authService";

interface ResetMfaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Resets MFA for a device change. The user proves they still hold the CURRENT
 * authenticator entry (password + current OTP), then the old secret is revoked
 * permanently and a fresh CONFIGURE_TOTP setup is armed — a new QR code is
 * shown at next sign-in. The old authenticator entry can never be used again.
 */
export const ResetMfaDialog: React.FC<ResetMfaDialogProps> = ({ open, onOpenChange }) => {
  const { t } = useTranslation();
  const resetMfa = useResetMfa();
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleReset = async () => {
    if (!password) {
      toast.error(t("profile.passwordRequired", "Please enter your password to confirm."));
      return;
    }
    if (!otp || otp.length !== 6) {
      toast.error(t("profile.otpRequired", "Please enter the 6-digit authenticator code."));
      return;
    }

    try {
      await resetMfa.mutateAsync({ password, otp });
      toast.success(
        t(
          "profile.mfaResetToast",
          "Authenticator reset. A new QR code will be shown on the next screen — scan it with your new device.",
        ),
      );
      onOpenChange(false);
      setPassword("");
      setOtp("");
      // Arm the CONFIGURE_TOTP required action and redirect through Keycloak so
      // the user scans the new QR right away.
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

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPassword("");
      setOtp("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCcw className="size-5 text-warning" />
            {t("profile.mfaResetTitle", "Change Authenticator Device")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "profile.mfaResetDesc",
              "Your current authenticator entry will be permanently revoked and a new one created. Enter your password and the current code from your existing authenticator app to continue.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 text-xs leading-relaxed text-muted-foreground">
            <Smartphone className="mt-0.5 size-3.5 shrink-0 text-warning" />
            <span>
              {t(
                "profile.mfaResetHint",
                "After resetting, codes from your old authenticator entry will no longer be accepted.",
              )}
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-foreground">
              {t("profile.currentPassword")}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-border bg-background px-3 py-2.5 pr-9 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-shadow"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold mb-1.5 text-foreground">
              {t("profile.authenticatorCode", "Authenticator Code")}
            </label>
            <input
              type="text"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, "").slice(0, 6))}
              placeholder="123456"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/20 transition-shadow"
            />
          </div>

          {resetMfa.isError && (
            <div className="w-full rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
              {resetMfa.error instanceof Error
                ? resetMfa.error.message
                : t("profile.unexpectedError")}
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            disabled={resetMfa.isPending}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {t("profile.mfaCancel")}
          </button>
          <button
            type="button"
            onClick={handleReset}
            disabled={resetMfa.isPending || !password || otp.length !== 6}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-warning px-4 py-2 text-sm font-semibold text-warning-foreground transition-colors hover:bg-warning/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {resetMfa.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCcw className="size-4" />
            )}
            {t("profile.mfaConfirmReset", "Reset & Get New Code")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
