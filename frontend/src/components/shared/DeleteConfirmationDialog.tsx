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
import { Loader2, AlertTriangle, Shield, Fingerprint } from "lucide-react";

export interface DeletePreviewData {
  apexes: number;
  cooperatives: number;
  members: number;
}

interface DeleteConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityName: string;
  entityType: "federation" | "apex" | "cooperative";
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
          setVerifyError(result.message ?? "Verification failed");
        }
      }
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : String(e));
    } finally {
      setVerifying(false);
    }
  }, [password, otp, onVerifyIdentity, onConfirmDelete, onOpenChange]);

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
              <DialogTitle className="text-base font-bold">Delete {entityLabel}</DialogTitle>
              <DialogDescription className="text-xs">
                This action is permanent and cannot be undone
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {step === "confirm" && (
          <div className="px-6 pb-6 pt-4 space-y-4">
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 space-y-3">
              <p className="text-sm font-medium text-foreground">
                You are about to delete{" "}
                <span className="font-bold text-destructive">{entityName}</span>
              </p>

              {previewLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Calculating cascade impact…
                </div>
              ) : previewData ? (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    This will permanently delete:
                  </p>
                  <div className="grid grid-cols-1 gap-1 text-sm">
                    {previewData.apexes > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Apexes</span>
                        <span className="font-bold text-foreground">{previewData.apexes}</span>
                      </div>
                    )}
                    {previewData.cooperatives > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Cooperatives</span>
                        <span className="font-bold text-foreground">
                          {previewData.cooperatives}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Member accounts</span>
                      <span className="font-bold text-foreground">{previewData.members}</span>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-muted-foreground">
                Type <span className="font-bold text-foreground">{entityName}</span> to confirm
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
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!nameMatches}
                onClick={handleProceedToVerify}
              >
                <Shield className="size-3.5 mr-1.5" />
                Continue
              </Button>
            </div>
          </div>
        )}

        {step === "verify" && (
          <div className="px-6 pb-6 pt-4 space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Fingerprint className="size-4 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">Verify your identity</p>
              </div>
              <p className="text-xs text-muted-foreground">
                Enter your password to confirm this destructive action.
              </p>

              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Password
                  </label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                    placeholder="Your account password"
                  />
                </div>

                {requiresOtp && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-muted-foreground">
                      Authenticator code (6 digits)
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
                Back
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleVerify}
                disabled={!password.trim() || verifying}
              >
                {verifying ? (
                  <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Shield className="size-3.5 mr-1.5" />
                )}
                {verifying ? "Verifying…" : "Verify & Delete"}
              </Button>
            </div>
          </div>
        )}

        {step === "deleting" && (
          <div className="px-6 pb-6 pt-4 flex flex-col items-center justify-center py-8 space-y-3">
            <Loader2 className="size-8 animate-spin text-destructive" />
            <p className="text-sm font-medium text-foreground">Deleting {entityName}…</p>
            <p className="text-xs text-muted-foreground">
              Cascade-deleting all associated entities
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
