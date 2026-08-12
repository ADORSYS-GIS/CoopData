import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
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
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useMfaSetup, useMfaVerify } from "@/hooks/auth/useSecuritySettings";

interface MfaSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after MFA is successfully enabled so the page can react. */
  onEnabled?: () => void;
}

export const MfaSetupDialog: React.FC<MfaSetupDialogProps> = ({
  open,
  onOpenChange,
  onEnabled,
}) => {
  const { t } = useTranslation();
  const mfaSetup = useMfaSetup();
  const mfaVerify = useMfaVerify();
  const [code, setCode] = useState("");
  const [attempted, setAttempted] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Generate a fresh secret when the dialog opens — but only if we don't
  // already have one from this session. Reusing it means a user who scanned
  // the QR and closed the dialog by accident can reopen without the old scan
  // becoming invalid.
  useEffect(() => {
    if (open) {
      setCode("");
      setAttempted(false);
      if (!mfaSetup.data) {
        mfaSetup.mutate();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Focus the OTP input once the QR is ready.
  useEffect(() => {
    if (open && mfaSetup.isSuccess && !mfaSetup.isPending) {
      // Small delay so the input is mounted and interactive.
      const id = window.setTimeout(() => inputRef.current?.focus(), 150);
      return () => window.clearTimeout(id);
    }
  }, [open, mfaSetup.isSuccess, mfaSetup.isPending]);

  const codeIncomplete = code.length < 6;
  const canVerify = !codeIncomplete && !mfaVerify.isPending;

  const handleVerify = async () => {
    if (codeIncomplete || !mfaSetup.data) {
      setAttempted(true);
      return;
    }
    try {
      await mfaVerify.mutateAsync({ secret: mfaSetup.data.secret, code });
      toast.success(t("profile.mfaEnabledToast"));
      onEnabled?.();
      onOpenChange(false);
      // Drop the cached setup so a future enable (after a disable) generates a
      // fresh secret instead of reusing this one.
      mfaSetup.reset();
    } catch (e) {
      setAttempted(true);
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
          {mfaSetup.isPending && (
            <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
              <Loader2 className="size-8 animate-spin" />
              <p className="text-xs">{t("profile.mfaGenerating")}</p>
            </div>
          )}

          {mfaSetup.isError && (
            <div className="w-full rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
              {mfaSetup.error instanceof Error
                ? mfaSetup.error.message
                : t("profile.unexpectedError")}
            </div>
          )}

          {mfaSetup.isSuccess && mfaSetup.data && (
            <>
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-sm">
                <img
                  src="/coopdatalogo.png"
                  alt={t("common.logoAlt")}
                  className="h-8 w-auto object-contain"
                />
                <QRCodeSVG
                  value={mfaSetup.data.otpauth_uri}
                  size={196}
                  level="M"
                  marginSize={1}
                  className="rounded-lg"
                />
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Smartphone className="size-3.5 text-accent" />
                <span>{t("profile.mfaScanHint")}</span>
              </div>

              <div className="w-full space-y-1.5">
                <p className="text-center text-xs font-semibold text-foreground">
                  {t("profile.mfaEnterCode")}
                </p>
                <div className="flex justify-center">
                  <InputOTP
                    ref={inputRef}
                    maxLength={6}
                    value={code}
                    onChange={(value) => {
                      setCode(value);
                      setAttempted(false);
                    }}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    aria-label={t("profile.mfaEnterCode")}
                  >
                    <InputOTPGroup>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <InputOTPSlot key={i} index={i} />
                      ))}
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                {attempted && codeIncomplete && (
                  <p className="text-center text-xs text-destructive">
                    {t("profile.mfaCodeRequired")}
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={mfaVerify.isPending}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {t("profile.mfaCancel")}
          </button>
          <button
            type="button"
            onClick={handleVerify}
            disabled={!canVerify}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {mfaVerify.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldCheck className="size-4" />
            )}
            {t("profile.mfaVerifyEnable")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
