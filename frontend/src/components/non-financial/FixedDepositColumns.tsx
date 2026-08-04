import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SortableHeader } from "@/components/ui/data-table";
import { Pencil, Trash2 } from "lucide-react";
import type { FixedDepositResponse } from "@/types/non-financial";
import { useTranslation } from "react-i18next";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "SZL" }).format(value);
}

interface FixedDepositActions {
  onEdit?: (fd: FixedDepositResponse) => void;
  onDelete?: (id: string) => void;
}

export function useFixedDepositColumns(
  actions?: FixedDepositActions,
): ColumnDef<FixedDepositResponse>[] {
  const { t } = useTranslation();
  return [
    {
      accessorKey: "fixed_deposit_id",
      header: ({ column }) => <SortableHeader column={column}>{t("columns.fdId")}</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-xs font-mono">{row.getValue("fixed_deposit_id")}</span>
      ),
    },
    {
      accessorKey: "member_id",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.memberId")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs font-mono">{row.getValue("member_id")}</span>,
    },
    {
      accessorKey: "deposit_type",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.depositType")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("deposit_type")}</span>,
    },
    {
      accessorKey: "start_date",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.startDate")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("start_date")}</span>,
    },
    {
      accessorKey: "maturity_date",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.maturityDate")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("maturity_date")}</span>,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.status")}</SortableHeader>
      ),
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return <Badge variant={status === "Active" ? "default" : "secondary"}>{status}</Badge>;
      },
    },
    {
      accessorKey: "tenure_category",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.tenure")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("tenure_category")}</span>,
    },
    {
      accessorKey: "number_of_renewals",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.renewals")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("number_of_renewals")}</span>,
    },
    {
      accessorKey: "interest_rate",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.interest")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{Number(row.getValue("interest_rate"))}%</span>,
    },
    {
      accessorKey: "balance",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.balance")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-xs font-mono">{formatCurrency(Number(row.getValue("balance")))}</span>
      ),
    },
    ...(actions
      ? [
          {
            id: "actions",
            header: t("columns.actions"),
            cell: ({ row }: { row: { original: FixedDepositResponse } }) => (
              <div className="flex items-center gap-1">
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => actions.onEdit?.(row.original)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="size-7 hover:text-destructive"
                  onClick={() => actions.onDelete?.(row.original.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            ),
          },
        ]
      : []),
  ] as ColumnDef<FixedDepositResponse>[];
}
