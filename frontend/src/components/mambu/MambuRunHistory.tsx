import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, StatusPill } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MambuSyncRun } from "@/hooks/mambu/useMambu";
import { MambuRunResults } from "./MambuRunResults";
import { periodLabel, runDuration, runTone, startedLabel, timeAgo } from "./mambuFormat";

interface Props {
  runs: MambuSyncRun[];
  /** A run to open, for example the one that was just started. */
  focusRunId: string | null;
}

const FIRST_ROWS = 6;

export const MambuRunHistory: React.FC<Props> = ({ runs, focusRunId }) => {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const selected = chosen ?? focusRunId ?? runs[0]?.id ?? null;
  const shown = showAll ? runs : runs.slice(0, FIRST_ROWS);

  useEffect(() => {
    if (focusRunId) setChosen(focusRunId);
  }, [focusRunId]);

  return (
    <Card
      title={t("mambu.historyTitle", { defaultValue: "Sync history" })}
      subtitle={t("mambu.historySubtitle", {
        defaultValue: "What each sync read and the warnings that need your attention.",
      })}
    >
      {runs.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
          <History className="size-8" aria-hidden />
          <p className="text-sm">
            {t("mambu.noRuns", { defaultValue: "No sync has been run yet." })}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("mambu.started", { defaultValue: "Started" })}</TableHead>
                <TableHead>{t("mambu.period", { defaultValue: "Period" })}</TableHead>
                <TableHead className="text-right">
                  {t("mambu.saccos", { defaultValue: "SACCOs" })}
                </TableHead>
                <TableHead>{t("mambu.status", { defaultValue: "Status" })}</TableHead>
                <TableHead>{t("mambu.took", { defaultValue: "Took" })}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((r) => (
                <TableRow
                  key={r.id}
                  data-state={selected === r.id ? "selected" : undefined}
                  className="cursor-pointer"
                  onClick={() => setChosen(r.id)}
                >
                  <TableCell>
                    <div className="font-medium">{startedLabel(r.started_at)}</div>
                    <div className="text-xs text-muted-foreground">
                      {timeAgo(r.started_at)}
                      {r.started_by === "automatic" &&
                        ` · ${t("mambu.automatic", { defaultValue: "automatic" })}`}
                    </div>
                  </TableCell>
                  <TableCell>{periodLabel(r.reporting_year, r.month)}</TableCell>
                  <TableCell className="text-right">{r.total_saccos}</TableCell>
                  <TableCell>
                    <StatusPill tone={runTone(r.status)}>{r.status}</StatusPill>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {runDuration(r.started_at, r.finished_at)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {runs.length > FIRST_ROWS && (
            <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
              {showAll
                ? t("mambu.showFewer", { defaultValue: "Show fewer" })
                : t("mambu.showAll", {
                    defaultValue: "Show all {{count}} syncs",
                    count: runs.length,
                  })}
            </Button>
          )}
          {selected && (
            <div className="border-t pt-4">
              <MambuRunResults runId={selected} />
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
