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
import { useStartMambuSync, type MambuScope } from "@/hooks/mambu/useMambu";
import { MONTH_NAMES, periodLabel, previousMonth } from "./mambuFormat";

interface Props {
  scope?: MambuScope;
  configured: boolean;
  running: boolean;
  /** Blocks the button, for example when the SACCO is not linked or in cooldown. */
  blocked?: boolean;
  onStarted: (runId: string) => void;
}

const confirmBody = (scope: MambuScope): string => {
  if (scope === "cooperative") {
    return "CoopData will read {{period}} from Mambu for your SACCO and create a draft for you to check and submit. A Mambu draft for that month is replaced. Submitted or approved data is never changed.";
  }
  if (scope === "apex") {
    return "CoopData will read {{period}} from Mambu for your linked cooperatives and create drafts at your level. Mambu drafts for that month are replaced. Submitted or approved data is never changed.";
  }
  return "CoopData will read {{period}} from Mambu for every linked SACCO and create submissions waiting for your review. Existing Mambu data for that month is replaced. Approved submissions are never changed.";
};

export const MambuRunForm: React.FC<Props> = ({
  scope = "ministry",
  configured,
  running,
  blocked = false,
  onStarted,
}) => {
  const { t } = useTranslation();
  const initial = previousMonth(new Date());
  const [year, setYear] = useState(String(initial.year));
  const [month, setMonth] = useState(String(initial.month));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const start = useStartMambuSync(scope);

  const thisYear = new Date().getFullYear();
  const years = [thisYear, thisYear - 1, thisYear - 2];

  const run = () => {
    start.mutate(
      { year: Number(year), month: Number(month) },
      {
        onSuccess: (r) => {
          toast.success(t("mambu.started", { defaultValue: "Mambu sync started" }));
          onStarted(r.id);
        },
        onError: (e) => toast.error(e.message),
      },
    );
  };

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">
          {t("mambu.month", { defaultValue: "Month" })}
        </span>
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger className="w-40" aria-label="Month">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {MONTH_NAMES.map((name, i) => (
              <SelectItem key={name} value={String(i + 1)}>
                {name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1">
        <span className="text-xs font-medium text-muted-foreground">
          {t("mambu.year", { defaultValue: "Year" })}
        </span>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-28" aria-label="Year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        disabled={!configured || running || blocked || start.isPending}
        onClick={() => setConfirmOpen(true)}
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${running ? "animate-spin" : ""}`} />
        {t("mambu.syncButton", { defaultValue: "Sync with Mambu" })}
      </Button>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("mambu.confirmTitle", { defaultValue: "Sync with Mambu?" })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(`mambu.confirmBody.${scope}`, {
                defaultValue: confirmBody(scope),
                period: periodLabel(Number(year), Number(month)),
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
