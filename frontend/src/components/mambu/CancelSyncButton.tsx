import { Loader2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useCancelMambuSync } from "@/hooks/mambu/useMambu";

/** Stops a running sync, after a confirmation. Nothing is imported from a stopped SACCO. */
export const CancelSyncButton: React.FC<{ runId: string }> = ({ runId }) => {
  const { t } = useTranslation();
  const cancel = useCancelMambuSync();

  const confirm = () =>
    cancel.mutate(runId, {
      onSuccess: ({ cancelled }) =>
        toast.success(
          t("mambu.cancelled", {
            defaultValue: "Sync cancelled for {{count}} SACCO(s). You can start it again.",
            count: cancelled,
          }),
        ),
      onError: (e) => toast.error(e.message),
    });

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="outline" size="sm" disabled={cancel.isPending}>
          {cancel.isPending ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <XCircle className="mr-1 size-3.5" />
          )}
          {t("mambu.cancelSync", { defaultValue: "Cancel sync" })}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("mambu.cancelTitle", { defaultValue: "Cancel this sync?" })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("mambu.cancelBody", {
              defaultValue:
                "SACCOs that are still being read are stopped and nothing is imported from them. A SACCO that is already saving its return finishes. You can start the sync again afterwards.",
            })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            {t("mambu.keepRunning", { defaultValue: "Keep running" })}
          </AlertDialogCancel>
          <AlertDialogAction onClick={confirm}>
            {t("mambu.confirmCancel", { defaultValue: "Cancel the sync" })}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
