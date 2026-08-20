import { Loader2, ShieldCheck, Eye, EyeOff, Smartphone } from "lucide-react";
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
import { useEnableMfa } from "@/hooks/auth/useSecuritySettings";

interface ReEnableMfaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Re-enables MFA after a soft-disable. Because the OTP credential was preserved
 * when the user disabled MFA, re-enabling does NOT generate a new QR code —
 * the existing authenticator entry starts working again. The user still proves
 * they hold the entry by entering their password + current 6-digit code.
 */
export const ReEnableMfaDialog: React.FC<ReEnableMfaDialogProps> = ({ open, onOpenChange }) => {
  const { t } = useTranslation();
  const enableMfa = useEnableMfa();
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleEnable = async () => {
    if (!password) {
      toast.error(t("profile.passwordRequired", "Please enter your password to confirm."));
      return;
    }
    if (!otp || otp.length !== 6) {
      toast.error(t("profile.otpRequired", "Please enter the 6-digit authenticator code."));
      return;
    }

    try {
      await enableMfa.mutateAsync({ password, otp });
      toast.success(
        t(
          "profile.mfaReenabledToast",
          "Two-Factor Authentication re-enabled. Your existing authenticator entry works again.",
        ),
      );
      onOpenChange(false);
      setPassword("");
      setOtp("");
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
            <ShieldCheck className="size-5 text-accent" />
            {t("profile.mfaReenableTitle", "Re-enable Two-Factor Authentication")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "profile.mfaReenableDesc",
              "Your authenticator entry is still valid — no new QR code needed. Enter your password and the current code from your authenticator app to turn MFA back on.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            <Smartphone className="mt-0.5 size-3.5 shrink-0 text-accent" />
            <span>
              {t(
                "profile.mfaReenableHint",
                "Use the code from the authenticator entry you set up before disabling MFA.",
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

          {enableMfa.isError && (
            <div className="w-full rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
              {enableMfa.error instanceof Error
                ? enableMfa.error.message
                : t("profile.unexpectedError")}
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            disabled={enableMfa.isPending}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {t("profile.mfaCancel")}
          </button>
          <button
            type="button"
            onClick={handleEnable}
            disabled={enableMfa.isPending || !password || otp.length !== 6}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {enableMfa.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            {t("profile.mfaConfirmReenable", "Re-enable MFA")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
