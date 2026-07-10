import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SortableHeader } from "@/components/ui/data-table";
import { Pencil, Trash2 } from "lucide-react";
import type { FixedDepositResponse } from "@/types/non-financial";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "SZL" }).format(value);
}

interface FixedDepositActions {
  onEdit?: (fd: FixedDepositResponse) => void;
  onDelete?: (id: string) => void;
}

export function createFixedDepositColumns(actions?: FixedDepositActions): ColumnDef<FixedDepositResponse>[] {
  return [
    {
      accessorKey: "fixed_deposit_id",
      header: ({ column }) => <SortableHeader column={column}>FD ID</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-xs font-mono">{row.getValue("fixed_deposit_id")}</span>
      ),
    },
    {
      accessorKey: "member_id",
      header: ({ column }) => <SortableHeader column={column}>Member ID</SortableHeader>,
      cell: ({ row }) => <span className="text-xs font-mono">{row.getValue("member_id")}</span>,
    },
    {
      accessorKey: "deposit_type",
      header: ({ column }) => <SortableHeader column={column}>Deposit Type</SortableHeader>,
      cell: ({ row }) => <span className="text-xs">{row.getValue("deposit_type")}</span>,
    },
    {
      accessorKey: "start_date",
      header: ({ column }) => <SortableHeader column={column}>Start Date</SortableHeader>,
      cell: ({ row }) => <span className="text-xs">{row.getValue("start_date")}</span>,
    },
    {
      accessorKey: "maturity_date",
      header: ({ column }) => <SortableHeader column={column}>Maturity Date</SortableHeader>,
      cell: ({ row }) => <span className="text-xs">{row.getValue("maturity_date")}</span>,
    },
    {
      accessorKey: "status",
      header: ({ column }) => <SortableHeader column={column}>Status</SortableHeader>,
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge variant={status === "Active" ? "default" : "secondary"}>{status}</Badge>
        );
      },
    },
    {
      accessorKey: "tenure_category",
      header: ({ column }) => <SortableHeader column={column}>Tenure</SortableHeader>,
      cell: ({ row }) => <span className="text-xs">{row.getValue("tenure_category")}</span>,
    },
    {
      accessorKey: "number_of_renewals",
      header: ({ column }) => <SortableHeader column={column}>Renewals</SortableHeader>,
      cell: ({ row }) => <span className="text-xs">{row.getValue("number_of_renewals")}</span>,
    },
    {
      accessorKey: "interest_rate",
      header: ({ column }) => <SortableHeader column={column}>Interest</SortableHeader>,
      cell: ({ row }) => <span className="text-xs">{Number(row.getValue("interest_rate"))}%</span>,
    },
    {
      accessorKey: "balance",
      header: ({ column }) => <SortableHeader column={column}>Balance</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-xs font-mono">{formatCurrency(Number(row.getValue("balance")))}</span>
      ),
    },
    ...(actions
      ? [
          {
            id: "actions",
            header: "Actions",
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
