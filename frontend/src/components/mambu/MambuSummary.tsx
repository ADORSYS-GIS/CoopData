import { AlertTriangle, CalendarClock, Link2, RefreshCw } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { MambuApexCooperative } from "@/hooks/mambu/useMambu";
import { cooperativeState, timeAgo } from "./mambuFormat";

interface TileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "warning";
}

const Tile: React.FC<TileProps> = ({ icon: Icon, label, value, hint, tone = "default" }) => (
  <div className="flex items-start gap-3 rounded-xl border bg-card p-4 shadow-[var(--shadow-elev-1)]">
    <span
      className={`grid size-10 shrink-0 place-content-center rounded-lg ${
        tone === "warning" ? "bg-warning/15 text-warning-foreground" : "bg-primary/10 text-primary"
      }`}
    >
      <Icon className="size-5" aria-hidden />
    </span>
    <div className="min-w-0">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold leading-tight">{value}</p>
      <p className="truncate text-xs text-muted-foreground">{hint}</p>
    </div>
  </div>
);

export const MambuSummary: React.FC<{ cooperatives: MambuApexCooperative[] }> = ({
  cooperatives,
}) => {
  const { t } = useTranslation();
  const linked = cooperatives.filter((c) => c.mambu_branch_id);
  const auto = linked.filter((c) => c.auto_sync).length;
  const attention = cooperatives.filter((c) => {
    const state = cooperativeState(c);
    return state === "attention" || state === "failed";
  }).length;
  const last = linked
    .map((c) => c.last_synced_at)
    .filter((d): d is string => !!d)
    .sort()
    .pop();

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Tile
        icon={Link2}
        label={t("mambu.tileLinked", { defaultValue: "Linked to Mambu" })}
        value={`${linked.length} / ${cooperatives.length}`}
        hint={t("mambu.tileLinkedHint", {
          defaultValue: "{{count}} cooperative(s) not linked yet",
          count: cooperatives.length - linked.length,
        })}
      />
      <Tile
        icon={CalendarClock}
        label={t("mambu.tileAuto", { defaultValue: "Automatic sync" })}
        value={String(auto)}
        hint={t("mambu.tileAutoHint", {
          defaultValue: "Runs on the 2nd of each month, at night",
        })}
      />
      <Tile
        icon={AlertTriangle}
        tone={attention > 0 ? "warning" : "default"}
        label={t("mambu.tileAttention", { defaultValue: "To check" })}
        value={String(attention)}
        hint={t("mambu.tileAttentionHint", { defaultValue: "Warnings or failed syncs" })}
      />
      <Tile
        icon={RefreshCw}
        label={t("mambu.tileLast", { defaultValue: "Last sync" })}
        value={timeAgo(last)}
        hint={t("mambu.tileLastHint", { defaultValue: "Most recent of your cooperatives" })}
      />
    </div>
  );
};
