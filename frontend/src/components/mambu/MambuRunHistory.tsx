import { useEffect, useState } from "react";
import { History } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, StatusPill } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import type { MambuSyncRun } from "@/hooks/mambu/useMambu";
import { MambuRunResults } from "./MambuRunResults";
import { periodLabel, runTone, timeAgo } from "./mambuFormat";

interface Props {
  runs: MambuSyncRun[];
  /** A run to open, for example the one that was just started. */
  focusRunId: string | null;
}

export const MambuRunHistory: React.FC<Props> = ({ runs, focusRunId }) => {
  const { t } = useTranslation();
  const [chosen, setChosen] = useState<string | null>(null);
  const selected = chosen ?? focusRunId ?? runs[0]?.id ?? null;

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
          <div className="flex flex-wrap gap-2">
            {runs.slice(0, 8).map((r) => (
              <Button
                key={r.id}
                size="sm"
                variant={selected === r.id ? "default" : "outline"}
                onClick={() => setChosen(r.id)}
              >
                {periodLabel(r.reporting_year, r.month)}
                <span className="ml-2 text-xs opacity-80">
                  {r.started_by === "automatic" ? "auto · " : ""}
                  {timeAgo(r.started_at)}
                </span>
                <span className="ml-2">
                  <StatusPill tone={runTone(r.status)}>{r.status}</StatusPill>
                </span>
              </Button>
            ))}
          </div>
          {selected && <MambuRunResults runId={selected} />}
        </div>
      )}
    </Card>
  );
};
