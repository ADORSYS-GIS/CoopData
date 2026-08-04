import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SortableHeader } from "@/components/ui/data-table";
import { Pencil, Trash2 } from "lucide-react";
import type { NfMemberResponse } from "@/types/non-financial";
import { useTranslation } from "react-i18next";

interface MemberActions {
  onEdit?: (member: NfMemberResponse) => void;
  onDelete?: (id: string) => void;
}

export function useMemberColumns(actions?: MemberActions): ColumnDef<NfMemberResponse>[] {
  const { t } = useTranslation();
  return [
    {
      accessorKey: "member_id",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.memberId")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs font-mono">{row.getValue("member_id")}</span>,
    },
    {
      accessorKey: "join_date",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.joinDate")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("join_date")}</span>,
    },
    {
      accessorKey: "status",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.status")}</SortableHeader>
      ),
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge
            variant={
              status === "Active" ? "default" : status === "Exited" ? "destructive" : "secondary"
            }
          >
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "gender",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.gender")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("gender")}</span>,
    },
    {
      accessorKey: "age_group",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.ageGroup")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("age_group")}</span>,
    },
    {
      accessorKey: "region",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.region")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("region")}</span>,
    },
    {
      accessorKey: "urban_rural",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.urbanRural")}</SortableHeader>
      ),
      cell: ({ row }) => <span className="text-xs">{row.getValue("urban_rural")}</span>,
    },
    {
      accessorKey: "agm_attendance",
      header: ({ column }) => <SortableHeader column={column}>{t("columns.agm")}</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-xs">
          {row.getValue("agm_attendance") ? t("common.yes") : t("common.no")}
        </span>
      ),
    },
    {
      accessorKey: "voting_exercised",
      header: ({ column }) => (
        <SortableHeader column={column}>{t("columns.voting")}</SortableHeader>
      ),
      cell: ({ row }) => (
        <span className="text-xs">
          {row.getValue("voting_exercised") ? t("common.yes") : t("common.no")}
        </span>
      ),
    },
    ...(actions
      ? [
          {
            id: "actions",
            header: t("columns.actions"),
            cell: ({ row }: { row: { original: NfMemberResponse } }) => (
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
  ] as ColumnDef<NfMemberResponse>[];
}
