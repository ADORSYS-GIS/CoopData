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
} from "@/components/ui/alert-dialog";

export interface LogoutPrompt {
  /** Logging out offline means no sign-in again until the connection returns. */
  offline: boolean;
  /** Changes still waiting in the outbox (kept on the device for this user). */
  unsentCount: number;
}

interface Props {
  prompt: LogoutPrompt | null;
  onStay: () => void;
  onLogout: () => void;
}

/** Asks before a manual logout that would lock the user out offline or leave changes unsent. */
export function LogoutConfirmDialog({ prompt, onStay, onLogout }: Props) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={prompt !== null} onOpenChange={(open) => !open && onStay()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("logoutPrompt.title")}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              {prompt?.offline && <p>{t("logoutPrompt.offline")}</p>}
              {prompt && prompt.unsentCount > 0 && (
                <p>{t("logoutPrompt.unsent", { count: prompt.unsentCount })}</p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onStay}>{t("logoutPrompt.stay")}</AlertDialogCancel>
          <AlertDialogAction onClick={onLogout}>{t("logoutPrompt.confirm")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
