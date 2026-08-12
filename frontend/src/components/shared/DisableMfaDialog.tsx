import { Loader2, ShieldOff, Eye, EyeOff } from "lucide-react";
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
import { useDisableMfa } from "@/hooks/auth/useSecuritySettings";

interface DisableMfaDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DisableMfaDialog: React.FC<DisableMfaDialogProps> = ({ open, onOpenChange }) => {
  const { t } = useTranslation();
  const disableMfa = useDisableMfa();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleDisable = async () => {
    if (!password) {
      toast.error(t("profile.passwordRequired", "Please enter your password to confirm."));
      return;
    }

    try {
      await disableMfa.mutateAsync({ password });
      toast.success(t("profile.mfaDisabledToast", "Two-Factor Authentication has been disabled."));
      onOpenChange(false);
      setPassword("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("profile.unexpectedError"));
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPassword("");
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldOff className="size-5 text-destructive" />
            {t("profile.mfaDisableTitle", "Disable Two-Factor Authentication")}
          </DialogTitle>
          <DialogDescription>
            {t(
              "profile.mfaDisableDesc",
              "Are you sure you want to disable MFA? This will make your account less secure. Please enter your password to confirm.",
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
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

          {disableMfa.isError && (
            <div className="w-full rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-center text-sm text-destructive">
              {disableMfa.error instanceof Error
                ? disableMfa.error.message
                : t("profile.unexpectedError")}
            </div>
          )}
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            disabled={disableMfa.isPending}
            className="inline-flex items-center justify-center rounded-lg border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            {t("profile.mfaCancel")}
          </button>
          <button
            type="button"
            onClick={handleDisable}
            disabled={disableMfa.isPending || !password}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {disableMfa.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldOff className="size-4" />
            )}
            {t("profile.mfaConfirmDisable", "Disable MFA")}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
