import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SortableHeader } from "@/components/ui/data-table";
import { Pencil, Trash2 } from "lucide-react";
import type { LoanResponse } from "@/types/non-financial";
import { useTranslation } from "react-i18next";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "SZL" }).format(value);
}

const loanStatusVariant = (status: string) => {
  if (status === "Performing") return "default" as const;
  if (status === "Arrears") return "destructive" as const;
  if (status === "Restructured") return "secondary" as const;
  return "outline" as const;
};

interface LoanActions {
  onEdit?: (loan: LoanResponse) => void;
  onDelete?: (id: string) => void;
}

export function useLoanColumns(actions?: LoanActions): ColumnDef<LoanResponse>[] {
  const { t } = useTranslation();
  return [
    {
      accessorKey: "loan_id",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.loanId")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs font-mono">{row.getValue("loan_id")}</span>,
    },
    {
      accessorKey: "member_id",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.memberId")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs font-mono">{row.getValue("member_id")}</span>,
    },
    {
      accessorKey: "loan_product_type",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.productType")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("loan_product_type")}</span>,
    },
    {
      accessorKey: "loan_start_date",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.startDate")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("loan_start_date")}</span>,
    },
    {
      accessorKey: "loan_maturity_date",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.maturityDate")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("loan_maturity_date")}</span>,
    },
    {
      accessorKey: "loan_status",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.status")}</SortableHeader>
      ),
      cell: ({ row }) => {
        const status = row.getValue("loan_status") as string;
        return <Badge variant={loanStatusVariant(status)}>{status}</Badge>;
      },
    },
    {
      accessorKey: "days_past_due_category",
      header: ({ column }) => <SortableHeader column={column}>{t("columns.dpd")}</SortableHeader>,
      cell: ({ row }) => <span className="text-xs">{row.getValue("days_past_due_category")}</span>,
    },
    {
      accessorKey: "repayment_regularity",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.regularity")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("repayment_regularity")}</span>,
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
    {
      accessorKey: "loan_amount",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.loanAmount")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-xs font-mono">
          {formatCurrency(Number(row.getValue("loan_amount")))}
        </span>
      ),
    },
    ...(actions
      ? [
          {
            id: "actions",
            header: t("columns.actions"),
            cell: ({ row }: { row: { original: LoanResponse } }) => (
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
  ] as ColumnDef<LoanResponse>[];
}
