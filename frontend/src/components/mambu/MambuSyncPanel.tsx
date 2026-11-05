import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Card } from "@/components/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useMambuCooperatives,
  useMambuStatus,
  useMambuSyncs,
  useSetMambuAutoSync,
  type MambuApexCooperative,
} from "@/hooks/mambu/useMambu";
import { MambuCooperativeTable } from "./MambuCooperativeTable";
import { MambuLinkDialog } from "./MambuLinkDialog";
import { MambuRunHistory } from "./MambuRunHistory";
import { MambuSummary } from "./MambuSummary";
import { MambuSyncControls } from "./MambuSyncControls";

export const MambuSyncPanel: React.FC = () => {
  const { t } = useTranslation();
  const status = useMambuStatus();
  const cooperatives = useMambuCooperatives();
  const syncs = useMambuSyncs();
  const autoSync = useSetMambuAutoSync();
  // null means "every linked cooperative": the default until the apex chooses.
  const [chosen, setChosen] = useState<Set<string> | null>(null);
  const [linking, setLinking] = useState<MambuApexCooperative | null>(null);
  const [focusRun, setFocusRun] = useState<string | null>(null);

  const list = useMemo(() => cooperatives.data ?? [], [cooperatives.data]);
  const linkedIds = useMemo(() => list.filter((c) => c.mambu_branch_id).map((c) => c.id), [list]);
  const selected = useMemo(
    () => new Set((chosen ? [...chosen] : linkedIds).filter((id) => linkedIds.includes(id))),
    [chosen, linkedIds],
  );
  const configured = status.data?.configured ?? false;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setChosen(next);
  };

  const setAuto = (id: string, value: boolean) =>
    autoSync.mutate(
      { cooperativeId: id, autoSync: value },
      { onError: (e) => toast.error(e.message) },
    );

  return (
    <div className="space-y-6">
      {!configured && !status.isLoading && (
        <p className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {t("mambu.notConfigured", {
            defaultValue: "The Mambu integration is not configured on this server.",
          })}
        </p>
      )}
      <MambuSummary cooperatives={list} />
      <Card
        title={t("mambu.runTitle", { defaultValue: "Sync your cooperatives" })}
        subtitle={t("mambu.runSubtitle", {
          defaultValue:
            "Choose the cooperatives to read from Mambu. Each gets a draft return for the whole year. You check the drafts and submit them. Cooperatives with Automatic switched on are also synced by itself every month.",
        })}
        action={
          <MambuSyncControls
            selectedIds={[...selected]}
            linkedCount={linkedIds.length}
            configured={configured}
            onStarted={setFocusRun}
          />
        }
      >
        {cooperatives.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : list.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("mambu.noCooperatives", {
              defaultValue: "You have no cooperatives yet. Create one, then link it to Mambu.",
            })}
          </p>
        ) : (
          <MambuCooperativeTable
            cooperatives={list}
            selected={selected}
            onToggle={toggle}
            onToggleAll={(checked) => setChosen(checked ? new Set(linkedIds) : new Set())}
            onAutoSync={setAuto}
            onLink={setLinking}
          />
        )}
      </Card>
      <MambuRunHistory runs={syncs.data ?? []} focusRunId={focusRun} />
      <MambuLinkDialog cooperative={linking} onClose={() => setLinking(null)} />
    </div>
  );
};
