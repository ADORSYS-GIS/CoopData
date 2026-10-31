import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, StatusPill } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useMambuStatus, useMambuSyncs, type MambuScope } from "@/hooks/mambu/useMambu";
import { useCooperativeMambuStatus } from "@/hooks/mambu/useMambuScoped";
import { MambuRunForm } from "./MambuRunForm";
import { MambuRunResults } from "./MambuRunResults";
import { periodLabel, runTone } from "./mambuFormat";

const SUBTITLE: Record<MambuScope, string> = {
  ministry:
    "Reads every linked SACCO and creates one submission per SACCO for the month. Submissions wait for Ministry review before they count in statistics.",
  apex: "Reads your linked cooperatives and creates one draft per cooperative for the month. Check the drafts, then submit them.",
  cooperative:
    "Reads your SACCO from Mambu and creates a draft for the month. Check the numbers, then submit the draft as usual.",
};

/** Notice shown to a cooperative that cannot sync right now, or null when it can. */
const useCooperativeBlock = (scope: MambuScope): { blocked: boolean; message: string | null } => {
  const { t } = useTranslation();
  const status = useCooperativeMambuStatus(scope === "cooperative");
  if (scope !== "cooperative" || !status.data) return { blocked: false, message: null };
  if (!status.data.linked) {
    return {
      blocked: true,
      message: t("mambu.notLinked", {
        defaultValue: "Your SACCO is not linked to a Mambu branch yet. Ask your apex to link it.",
      }),
    };
  }
  if (status.data.cooldown_seconds_left > 0) {
    return {
      blocked: true,
      message: t("mambu.cooldown", {
        defaultValue: "Synced a moment ago. You can sync again in {{minutes}} minute(s).",
        minutes: Math.ceil(status.data.cooldown_seconds_left / 60),
      }),
    };
  }
  return { blocked: false, message: null };
};

export const MambuSyncPanel: React.FC<{ scope?: MambuScope }> = ({ scope = "ministry" }) => {
  const { t } = useTranslation();
  const status = useMambuStatus(scope);
  const cooperativeStatus = useCooperativeMambuStatus(scope === "cooperative");
  const syncs = useMambuSyncs(scope);
  const block = useCooperativeBlock(scope);
  const [selected, setSelected] = useState<string | null>(null);

  const runs = useMemo(() => syncs.data ?? [], [syncs.data]);
  const running = runs.some((r) => r.status === "running");

  useEffect(() => {
    if (!selected && runs.length > 0) setSelected(runs[0].id);
  }, [runs, selected]);

  const configured =
    scope === "cooperative"
      ? (cooperativeStatus.data?.configured ?? false)
      : (status.data?.configured ?? false);
  const loading = scope === "cooperative" ? cooperativeStatus.isLoading : status.isLoading;

  return (
    <div className="space-y-6">
      <Card
        title={t("mambu.runTitle", { defaultValue: "Sync a month from Mambu" })}
        subtitle={t(`mambu.runSubtitle.${scope}`, { defaultValue: SUBTITLE[scope] })}
      >
        {!configured && !loading && (
          <p className="mb-3 text-sm text-destructive">
            {t("mambu.notConfigured", {
              defaultValue: "The Mambu integration is not configured on this server.",
            })}
          </p>
        )}
        {block.message && <p className="mb-3 text-sm text-muted-foreground">{block.message}</p>}
        <MambuRunForm
          scope={scope}
          configured={configured}
          running={running}
          blocked={block.blocked}
          onStarted={setSelected}
        />
      </Card>
      <Card title={t("mambu.historyTitle", { defaultValue: "Sync history" })}>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("mambu.noRuns", { defaultValue: "No sync has been run yet." })}
          </p>
        ) : (
          <div className="mb-4 flex flex-wrap gap-2">
            {runs.slice(0, 8).map((r) => (
              <Button
                key={r.id}
                size="sm"
                variant={selected === r.id ? "default" : "outline"}
                onClick={() => setSelected(r.id)}
              >
                {periodLabel(r.reporting_year, r.month)}
                <StatusPill tone={runTone(r.status)}>{r.status}</StatusPill>
              </Button>
            ))}
          </div>
        )}
        {selected && <MambuRunResults runId={selected} scope={scope} />}
      </Card>
    </div>
  );
};
