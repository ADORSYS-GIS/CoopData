import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SortableHeader } from "@/components/ui/data-table";
import { Pencil, Trash2 } from "lucide-react";
import type { SavingsAccountResponse } from "@/types/non-financial";
import { useTranslation } from "react-i18next";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "SZL" }).format(value);
}

interface SavingsActions {
  onEdit?: (savings: SavingsAccountResponse) => void;
  onDelete?: (id: string) => void;
}

export function useSavingsColumns(actions?: SavingsActions): ColumnDef<SavingsAccountResponse>[] {
  const { t } = useTranslation();
  return [
    {
      accessorKey: "savings_account_id",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.accountId")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-xs font-mono">{row.getValue("savings_account_id")}</span>
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
      accessorKey: "account_type",
      header: ({ column }) => <SortableHeader column={column}>{t("columns.type")}</SortableHeader>,
      cell: ({ row }) => <span className="text-xs">{row.getValue("account_type")}</span>,
    },
    {
      accessorKey: "account_opening_date",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.openingDate")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("account_opening_date")}</span>,
    },
    {
      accessorKey: "account_status",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.status")}</SortableHeader>
      ),
      cell: ({ row }) => {
        const status = row.getValue("account_status") as string;
        return <Badge variant={status === "Active" ? "default" : "secondary"}>{status}</Badge>;
      },
    },
    {
      accessorKey: "contribution_frequency",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.frequency")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("contribution_frequency")}</span>,
    },
    {
      accessorKey: "number_of_contributions",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.contributions")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("number_of_contributions")}</span>,
    },
    {
      accessorKey: "balance_trend",
      header: ({ column }) => <SortableHeader column={column}>{t("columns.trend")}</SortableHeader>,
      cell: ({ row }) => <span className="text-xs">{row.getValue("balance_trend")}</span>,
    },
    {
      accessorKey: "interest_rate",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.interestRate")}</SortableHeader>
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
            cell: ({ row }: { row: { original: SavingsAccountResponse } }) => (
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
  ] as ColumnDef<SavingsAccountResponse>[];
}
