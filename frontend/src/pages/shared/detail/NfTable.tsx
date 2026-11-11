import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, PenLine } from "lucide-react";
import { Card, StatusPill } from "@/components/app-shell";
import { Spinner } from "@/components/ui/spinner";
import { useNfRecordsPage } from "@/hooks/non-financial/useNfRecordsPage";
import type { SubmissionSectionResponse } from "@/hooks/submissions/useSubmissionSections";
import type { NfListParams, PaginatedResponse } from "@/types/non-financial";

const ROWS_PER_PAGE = 50;

function sectionStatusTone(status: string): "neutral" | "warning" | "success" {
  return status === "ready" ? "success" : status === "in_progress" ? "warning" : "neutral";
}

export function NfTable({
  title,
  section,
  columns,
  queryKey,
  fetchPage,
  params,
  total,
  canMarkReady,
  onMarkReady,
  isUpdating,
  onEdit,
}: {
  title: string;
  section?: SubmissionSectionResponse;
  columns: string[];
  queryKey: string;
  fetchPage: (params: NfListParams) => Promise<PaginatedResponse<unknown>>;
  params: NfListParams;
  /** How many records the list has, known without loading them. */
  total: number;
  canMarkReady?: boolean;
  onMarkReady?: () => void;
  isUpdating?: boolean;
  onEdit?: () => void;
}) {
  const { t } = useTranslation();
  // A list can have tens of thousands of records, so it is folded until it is asked for and
  // then shown a page at a time.
  const [open, setOpen] = useState(false);
  const [page, setPage] = useState(1);
  const pageQuery = useNfRecordsPage(queryKey, fetchPage, params, page, ROWS_PER_PAGE, open);
  const rows = (pageQuery.data?.data ?? []) as Record<string, unknown>[];
  const pages = Math.max(1, Math.ceil(total / ROWS_PER_PAGE));
  const firstRow = total === 0 ? 0 : (page - 1) * ROWS_PER_PAGE + 1;
  const lastRow = Math.min(total, page * ROWS_PER_PAGE);
  const fmtCol = (col: string) => col.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const cell = (val: unknown) => {
    if (val === null || val === undefined || val === "")
      return <span className="text-muted-foreground/40">—</span>;
    if (typeof val === "boolean")
      return val ? t("submissions.detail.nfDatabases.yes") : t("submissions.detail.nfDatabases.no");
    return String(val);
  };
  const isReady = section?.status === "ready";
  const isInProgress = section?.status === "in_progress";

  const sectionStatusLabel = (status: string) => {
    const map: Record<string, string> = {
      pending: t("submissions.detail.pendingStatus"),
      in_progress: t("submissions.detail.inProgressStatus"),
      ready: t("submissions.detail.readyStatus"),
    };
    return map[status] ?? status;
  };

  return (
    <Card
      title={title}
      action={
        <div className="flex items-center gap-2">
          {section && (
            <StatusPill tone={sectionStatusTone(section.status)}>
              {sectionStatusLabel(section.status)}
            </StatusPill>
          )}
          {canMarkReady && !isReady && isInProgress && (
            <button
              onClick={onMarkReady}
              disabled={isUpdating}
              className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 border border-success/25 px-2.5 py-1 text-xs font-semibold text-success hover:bg-success/15 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {isUpdating ? <Spinner size="sm" /> : <CheckCircle2 className="size-3" />}
              {t("submissions.detail.nfDatabases.btnMarkReady")}
            </button>
          )}
          {canMarkReady && onEdit && (
            <button
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/25 px-2.5 py-1 text-xs font-semibold text-primary hover:bg-primary/15 transition-colors cursor-pointer"
            >
              <PenLine className="size-3" />
              {t("edit")}
            </button>
          )}
          <button
            onClick={() => setOpen((o) => !o)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-lg hover:bg-muted/50 cursor-pointer"
          >
            {open
              ? t("submissions.detail.nfDatabases.btnCollapse")
              : t("submissions.detail.nfDatabases.btnExpand")}
          </button>
        </div>
      }
    >
      {open && (
        <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border mt-2">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold text-left">
                {columns.map((col) => (
                  <th key={col} className="px-4 py-2.5 whitespace-nowrap">
                    {fmtCol(col)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row, i) => (
                <tr key={i} className="hover:bg-muted/20 transition-colors">
                  {columns.map((col) => (
                    <td key={col} className="px-4 py-2 whitespace-nowrap text-foreground">
                      {cell(row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {pageQuery.isLoading && (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
              <Spinner size="sm" className="mr-2" />
              {t("submissions.detail.nfDatabases.loadingRecords")}
            </div>
          )}
          {total > ROWS_PER_PAGE && (
            <div className="flex items-center justify-between border-t border-border px-4 py-2 text-xs text-muted-foreground">
              <span>
                {t("submissions.detail.nfDatabases.pageRange", {
                  defaultValue: "{{from}}–{{to}} of {{total}}",
                  from: firstRow.toLocaleString("en-US"),
                  to: lastRow.toLocaleString("en-US"),
                  total: total.toLocaleString("en-US"),
                })}
              </span>
              <span className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-border px-2.5 py-1 font-semibold hover:bg-muted/50 disabled:opacity-40 cursor-pointer"
                >
                  {t("submissions.detail.nfDatabases.previousPage", { defaultValue: "Previous" })}
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  disabled={page >= pages}
                  className="rounded-lg border border-border px-2.5 py-1 font-semibold hover:bg-muted/50 disabled:opacity-40 cursor-pointer"
                >
                  {t("submissions.detail.nfDatabases.nextPage", { defaultValue: "Next" })}
                </button>
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
