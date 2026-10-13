import { useTranslation } from "react-i18next";
import { AlertTriangle, RotateCw, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { SyncQueueItem } from "@/services/shared/offlineDb";
import { describeSyncFailure, describeSyncItem } from "@/services/shared/describeSyncItem";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: SyncQueueItem[];
  onRetry: (id: number) => void;
  onDismiss: (id: number) => void;
  onRetryAll: () => void;
}

/** Lists offline changes the server didn't accept, so nothing is lost silently. */
export function SyncProblemsDialog({
  open,
  onOpenChange,
  items,
  onRetry,
  onDismiss,
  onRetryAll,
}: Props) {
  const { t, i18n } = useTranslation();
  const formatTime = (ms: number) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: "medium", timeStyle: "short" }).format(ms);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
            {t("sync.panelTitle")}
          </DialogTitle>
          <DialogDescription>{t("sync.panelDescription")}</DialogDescription>
        </DialogHeader>

        {items.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("sync.empty")}</p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto" aria-label={t("sync.panelTitle")}>
            {items.map((item) => (
              <li key={item.id} className="rounded-xl border border-border bg-surface p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {describeSyncItem(item, t)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("sync.madeAt", { time: formatTime(item.createdAt) })}
                    </p>
                    <p className="mt-1 text-xs text-destructive">{describeSyncFailure(item, t)}</p>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="outline" onClick={() => onRetry(item.id!)}>
                      <RotateCw className="size-3.5" aria-hidden="true" />
                      {t("sync.retry")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDismiss(item.id!)}
                      aria-label={`${t("sync.dismiss")}: ${describeSyncItem(item, t)}`}
                    >
                      <Trash2 className="size-3.5" aria-hidden="true" />
                      {t("sync.dismiss")}
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        {items.length > 1 && (
          <DialogFooter>
            <Button onClick={onRetryAll}>
              <RotateCw className="size-3.5" aria-hidden="true" />
              {t("sync.retryAll")}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
