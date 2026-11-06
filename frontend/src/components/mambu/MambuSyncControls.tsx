import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useStartMambuSync } from "@/hooks/mambu/useMambu";

interface Props {
  selectedIds: string[];
  linkedCount: number;
  configured: boolean;
  onStarted: (runId: string) => void;
}

/** Year and button of the sync. Only a whole year is synced: one return per cooperative. */
export const MambuSyncControls: React.FC<Props> = ({
  selectedIds,
  linkedCount,
  configured,
  onStarted,
}) => {
  const { t } = useTranslation();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(String(thisYear));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const start = useStartMambuSync();
  const count = selectedIds.length;

  const run = () =>
    start.mutate(
      { year: Number(year), cooperativeIds: selectedIds },
      {
        onSuccess: (r) => {
          toast.success(t("mambu.started", { defaultValue: "Mambu sync started" }));
          onStarted(r.id);
        },
        onError: (e) => toast.error(e.message),
      },
    );

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">
          {t("mambu.year", { defaultValue: "Year" })}
        </span>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28" aria-label="Year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[thisYear, thisYear - 1, thisYear - 2].map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        disabled={!configured || count === 0 || start.isPending}
        onClick={() => setConfirmOpen(true)}
      >
        <RefreshCw className={`mr-2 size-4 ${start.isPending ? "animate-spin" : ""}`} />
        {t("mambu.syncSelected", { defaultValue: "Sync {{count}} selected", count })}
      </Button>
      <span className="pb-2 text-xs text-muted-foreground">
        {t("mambu.ofLinked", { defaultValue: "of {{count}} linked", count: linkedCount })}
      </span>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("mambu.confirmTitle", { defaultValue: "Sync with Mambu?" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("mambu.confirmBody", {
                defaultValue:
                  "CoopData will read {{year}} from Mambu for {{count}} cooperative(s) and make one full-year draft for each, with a column for every month. Drafts from an earlier sync are replaced. Submitted or approved returns are never changed. You check the drafts and submit them.",
                year,
                count,
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel", { defaultValue: "Cancel" })}</AlertDialogCancel>
            <AlertDialogAction onClick={run}>
              {t("mambu.syncButton", { defaultValue: "Sync with Mambu" })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
