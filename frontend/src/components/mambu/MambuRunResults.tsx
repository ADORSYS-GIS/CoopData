import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { StatusPill } from "@/components/app-shell";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useMambuSync, type MambuSyncItem } from "@/hooks/mambu/useMambu";
import { CancelSyncButton } from "./CancelSyncButton";
import { PHASE_LABELS, itemTone, periodLabel, progressCount, runTone } from "./mambuFormat";

const warningText = (item: MambuSyncItem): string =>
  item.warnings
    .filter((w) => w.severity === "warning")
    .map((w) => w.message)
    .join(" · ");

export const MambuRunResults: React.FC<{ runId: string }> = ({ runId }) => {
  const { t } = useTranslation();
  const { data, isLoading, error } = useMambuSync(runId);

  if (isLoading) return <Skeleton className="h-32 w-full" />;
  if (error || !data) {
    return <p className="text-sm text-destructive">{error?.message ?? "Could not load the run"}</p>;
  }
  const { run, items } = data;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <strong>{periodLabel(run.reporting_year, run.month)}</strong>
        <StatusPill tone={runTone(run.status)}>{run.status}</StatusPill>
        <span className="text-muted-foreground">
          {new Date(run.started_at).toLocaleString()} · {run.total_saccos}{" "}
          {t("mambu.saccos", { defaultValue: "SACCOs" })}
        </span>
        {run.error && <span className="text-destructive">{run.error}</span>}
        {run.status === "running" && (
          <span className="ml-auto">
            <CancelSyncButton runId={run.id} />
          </span>
        )}
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("mambu.sacco", { defaultValue: "SACCO" })}</TableHead>
            <TableHead>{t("mambu.status", { defaultValue: "Status" })}</TableHead>
            <TableHead className="text-right">Members</TableHead>
            <TableHead className="text-right">Savings</TableHead>
            <TableHead className="text-right">Loans</TableHead>
            <TableHead className="text-right">Deposits</TableHead>
            <TableHead className="text-right">Ledger</TableHead>
            <TableHead>{t("mambu.notes", { defaultValue: "Notes" })}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => (
            <TableRow key={item.id}>
              <TableCell className="font-medium">
                {item.cooperative_name ?? item.mambu_branch_id}
                <div className="text-xs text-muted-foreground">{item.mambu_branch_id}</div>
              </TableCell>
              <TableCell>
                <StatusPill tone={itemTone(item.status)}>{item.status}</StatusPill>
                {item.phase && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {t(`mambu.phase.${item.phase}`, {
                      defaultValue: PHASE_LABELS[item.phase] ?? item.phase,
                    })}
                    {progressCount(item.records_read, item.records_total)}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-right">{item.members}</TableCell>
              <TableCell className="text-right">{item.savings_accounts}</TableCell>
              <TableCell className="text-right">{item.loans}</TableCell>
              <TableCell className="text-right">{item.fixed_deposits}</TableCell>
              <TableCell className="text-right">{item.ledger_lines}</TableCell>
              <TableCell className="max-w-sm text-xs text-muted-foreground">
                {item.error ?? warningText(item)}
                {item.submission_id && (
                  <div>
                    <Link
                      to="/app/submissions/$id"
                      params={{ id: item.submission_id }}
                      className="text-primary underline"
                    >
                      {t("mambu.review", { defaultValue: "Review submission" })}
                    </Link>
                  </div>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
