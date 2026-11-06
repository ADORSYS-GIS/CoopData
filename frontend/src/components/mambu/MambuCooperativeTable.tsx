import { Link } from "@tanstack/react-router";
import { Link2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { StatusPill } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { MambuApexCooperative } from "@/hooks/mambu/useMambu";
import { STATE_LABEL, STATE_TONE, cooperativeState, timeAgo } from "./mambuFormat";

interface Props {
  cooperatives: MambuApexCooperative[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: (checked: boolean) => void;
  onAutoSync: (id: string, value: boolean) => void;
  onLink: (cooperative: MambuApexCooperative) => void;
}

export const MambuCooperativeTable: React.FC<Props> = ({
  cooperatives,
  selected,
  onToggle,
  onToggleAll,
  onAutoSync,
  onLink,
}) => {
  const { t } = useTranslation();
  const linked = cooperatives.filter((c) => c.mambu_branch_id);
  const allSelected = linked.length > 0 && linked.every((c) => selected.has(c.id));

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-10">
            <Checkbox
              aria-label={t("mambu.selectAll", { defaultValue: "Select all linked cooperatives" })}
              checked={allSelected}
              disabled={linked.length === 0}
              onCheckedChange={(v) => onToggleAll(v === true)}
            />
          </TableHead>
          <TableHead>{t("mambu.cooperative", { defaultValue: "Cooperative" })}</TableHead>
          <TableHead>{t("mambu.branch", { defaultValue: "Mambu branch" })}</TableHead>
          <TableHead>{t("mambu.status", { defaultValue: "Status" })}</TableHead>
          <TableHead>{t("mambu.lastSync", { defaultValue: "Last sync" })}</TableHead>
          <TableHead>{t("mambu.autoSync", { defaultValue: "Automatic" })}</TableHead>
          <TableHead className="text-right">
            {t("mambu.actions", { defaultValue: "Actions" })}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {cooperatives.map((c) => {
          const state = cooperativeState(c);
          const isLinked = !!c.mambu_branch_id;
          return (
            <TableRow key={c.id} data-state={selected.has(c.id) ? "selected" : undefined}>
              <TableCell>
                <Checkbox
                  aria-label={`Select ${c.name}`}
                  checked={selected.has(c.id)}
                  disabled={!isLinked || c.running}
                  onCheckedChange={() => onToggle(c.id)}
                />
              </TableCell>
              <TableCell className="font-medium">
                {c.name}
                {c.institution_type && (
                  <div className="text-xs capitalize text-muted-foreground">
                    {c.institution_type}
                  </div>
                )}
              </TableCell>
              <TableCell className="font-mono text-xs">{c.mambu_branch_id ?? "—"}</TableCell>
              <TableCell>
                <StatusPill tone={STATE_TONE[state]}>
                  {state === "running" && <Loader2 className="mr-1 size-3 animate-spin" />}
                  {t(`mambu.state.${state}`, { defaultValue: STATE_LABEL[state] })}
                </StatusPill>
                {(state === "attention" || state === "failed") && (
                  <div className="mt-1 max-w-xs truncate text-xs text-muted-foreground">
                    {c.last_error ??
                      t("mambu.warningCount", {
                        defaultValue: "{{count}} warning(s)",
                        count: c.last_warning_count,
                      })}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {isLinked ? timeAgo(c.last_synced_at) : "—"}
              </TableCell>
              <TableCell>
                <Switch
                  aria-label={`Automatic sync of ${c.name}`}
                  checked={c.auto_sync}
                  disabled={!isLinked}
                  onCheckedChange={(v) => onAutoSync(c.id, v)}
                />
              </TableCell>
              <TableCell className="space-x-2 text-right">
                {c.last_submission_id && (
                  <Button asChild size="sm" variant="ghost">
                    <Link to="/app/submissions/$id" params={{ id: c.last_submission_id }}>
                      {t("mambu.openReturn", { defaultValue: "Open return" })}
                    </Link>
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => onLink(c)}>
                  <Link2 className="mr-1 size-3.5" aria-hidden />
                  {isLinked
                    ? t("mambu.changeLink", { defaultValue: "Change link" })
                    : t("mambu.link", { defaultValue: "Link" })}
                </Button>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
