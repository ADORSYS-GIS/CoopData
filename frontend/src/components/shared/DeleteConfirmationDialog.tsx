import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Shield, Fingerprint, Eye, EyeOff } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";

export interface DeletePreviewData {
  apexes: number;
  cooperatives: number;
  members: number;
}

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName: string;
  entityType: "federation" | "apex" | "cooperative" | "submission";
  entityId: string;
  previewData?: DeletePreviewData;
  previewLoading?: boolean;
  onVerifyIdentity: (
    password: string,
    otp?: string,
  ) => Promise<{
    ok: boolean;
    verification_token?: string;
    requires_otp?: boolean;
    message?: string;
  }>;
  onConfirmDelete: (verificationToken: string) => Promise<void>;
  requiresOtp?: boolean;
}

type Step = "confirm" | "verify" | "deleting";

export const DeleteConfirmationDialog: React.FC<DeleteConfirmationDialogProps> = ({
  open,
  onOpenChange,
  entityName,
  entityType,
  previewData,
  previewLoading,
  onVerifyIdentity,
  onConfirmDelete,
}) => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("confirm");
  const [typedName, setTypedName] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [verificationToken, setVerificationToken] = useState<string | null>(null);
  const [requiresOtp, setRequiresOtp] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (open) {
      setStep("confirm");
      setTypedName("");
      setPassword("");
      setOtp("");
      setVerificationToken(null);
      setRequiresOtp(false);
      setVerifyError(null);
      setDeleteError(null);
      setShowPassword(false);
    }
  }, [open]);

  const nameMatches = typedName.trim() === entityName.trim();

  const handleProceedToVerify = useCallback(() => {
    setStep("verify");
  }, []);

  const handleVerify = useCallback(async () => {
    setVerifying(true);
    setVerifyError(null);
    try {
      const result = await onVerifyIdentity(password, otp || undefined);
      if (result.ok && result.verification_token) {
        setVerificationToken(result.verification_token);
        setRequiresOtp(result.requires_otp ?? false);
        setStep("deleting");
        setDeleting(true);
        try {
          await onConfirmDelete(result.verification_token);
          onOpenChange(false);
        } catch (e) {
          setDeleteError(e instanceof Error ? e.message : String(e));
          setStep("verify");
        } finally {
          setDeleting(false);
        }
      } else {
        if (result.requires_otp) {
          setRequiresOtp(true);
          setVerifyError(null);
        } else {
          setVerifyError(result.message ?? t("deleteDialog.verificationFailed"));
        }
      }
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : String(e));
    } finally {
      setVerifying(false);
    }
  }, [password, otp, onVerifyIdentity, onConfirmDelete, onOpenChange, t]);

  const entityLabel = entityType.charAt(0).toUpperCase() + entityType.slice(1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 p-0">
        <DialogHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-destructive/10 border border-destructive/20">
              <AlertTriangle className="size-5 text-destructive" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                {t("deleteDialog.deleteTitle", { entity: entityLabel })}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {t("deleteDialog.permanentWarning")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === "confirm" && (
          <div className="px-6 pb-6 pt-4 space-y-4">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">
                {t("deleteDialog.aboutToDelete")}{" "}
                <span className="font-bold text-destructive">{entityName}</span>
              </p>

              {previewLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Spinner size="sm" />
                  {t("deleteDialog.calculatingImpact")}
                </div>
              ) : previewData ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {t("deleteDialog.permanentlyDelete")}
                  </p>
                  <div className="grid grid-cols-1 gap-1 text-sm">
                    {previewData.apexes > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">{t("deleteDialog.apexes")}</span>
                        <span className="font-bold text-foreground">{previewData.apexes}</span>
                      </div>
                    )}
                    {previewData.cooperatives > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">
                          {t("deleteDialog.cooperatives")}
                        </span>
                        <span className="font-bold text-foreground">
                          {previewData.cooperatives}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">
                        {t("deleteDialog.memberAccounts")}
                      </span>
                      <span className="font-bold text-foreground">{previewData.members}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-muted-foreground">
                {t("deleteDialog.typeToConfirm")}{" "}
                <span className="font-bold text-foreground">{entityName}</span>
              </label>
              <Input
                value={typedName}
                onChange={(e) => setTypedName(e.target.value)}
                placeholder={entityName}
                autoFocus
                className="border-input"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">
                {t("common.cancel")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!nameMatches}
                onClick={handleProceedToVerify}
              >
                <Shield className="size-3.5 mr-1.5" />
                {t("deleteDialog.continue")}
              </Button>
            </div>
          </div>
        )}

        {step === "verify" && (
          <div className="px-6 pb-6 pt-4 space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Fingerprint className="size-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">
                  {t("deleteDialog.verifyIdentity")}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">{t("deleteDialog.enterPassword")}</p>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-muted-foreground">
                    {t("deleteDialog.password")}
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoFocus
                      placeholder={t("deleteDialog.accountPassword")}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((s) => !s)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {requiresOtp && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-muted-foreground">
                      {t("deleteDialog.authenticatorCode")}
                    </label>
                    <Input
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      placeholder="000000"
                      maxLength={6}
                      inputMode="numeric"
                      pattern="[0-9]*"
                    />
                  </div>
                )}
              </div>

              {verifyError && <p className="text-xs text-destructive font-medium">{verifyError}</p>}
              {deleteError && <p className="text-xs text-destructive font-medium">{deleteError}</p>}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setStep("confirm")}
                disabled={verifying}
              >
                {t("common.back")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleVerify}
                disabled={!password.trim() || verifying}
              >
                {verifying ? (
                  <Spinner size="sm" className="mr-1.5" />
                ) : (
                  <Shield className="size-3.5 mr-1.5" />
                )}
                {verifying ? t("deleteDialog.verifying") : t("deleteDialog.verifyAndDelete")}
              </Button>
            </div>
          </div>
        )}

        {step === "deleting" && (
          <div className="px-6 pb-6 pt-4 flex flex-col items-center justify-center py-8 space-y-3">
            <Spinner size="lg" className="text-destructive" />
            <p className="text-sm font-medium text-foreground">
              {t("deleteDialog.deleting", { entity: entityName })}
            </p>
            <p className="text-xs text-muted-foreground">{t("deleteDialog.cascadeDeleting")}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
