import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SortableHeader } from "@/components/ui/data-table";
import { Pencil, Trash2 } from "lucide-react";
import type { MemberResponse } from "@/types/non-financial";

interface MemberActions {
  onEdit?: (member: MemberResponse) => void;
  onDelete?: (id: string) => void;
}

export function createMemberColumns(actions?: MemberActions): ColumnDef<MemberResponse>[] {
  return [
    {
      accessorKey: "member_id",
      header: ({ column }) => <SortableHeader column={column}>Member ID</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-xs font-mono">{row.getValue("member_id")}</span>
      ),
    },
    {
      accessorKey: "join_date",
      header: ({ column }) => <SortableHeader column={column}>Join Date</SortableHeader>,
      cell: ({ row }) => <span className="text-xs">{row.getValue("join_date")}</span>,
    },
    {
      accessorKey: "status",
      header: ({ column }) => <SortableHeader column={column}>Status</SortableHeader>,
      cell: ({ row }) => {
        const status = row.getValue("status") as string;
        return (
          <Badge
            variant={status === "Active" ? "default" : status === "Exited" ? "destructive" : "secondary"}
          >
            {status}
          </Badge>
        );
      },
    },
    {
      accessorKey: "gender",
      header: ({ column }) => <SortableHeader column={column}>Gender</SortableHeader>,
      cell: ({ row }) => <span className="text-xs">{row.getValue("gender")}</span>,
    },
    {
      accessorKey: "age_group",
      header: ({ column }) => <SortableHeader column={column}>Age Group</SortableHeader>,
      cell: ({ row }) => <span className="text-xs">{row.getValue("age_group")}</span>,
    },
    {
      accessorKey: "region",
      header: ({ column }) => <SortableHeader column={column}>Region</SortableHeader>,
      cell: ({ row }) => <span className="text-xs">{row.getValue("region")}</span>,
    },
    {
      accessorKey: "urban_rural",
      header: ({ column }) => <SortableHeader column={column}>Urban/Rural</SortableHeader>,
      cell: ({ row }) => <span className="text-xs">{row.getValue("urban_rural")}</span>,
    },
    {
      accessorKey: "agm_attendance",
      header: ({ column }) => <SortableHeader column={column}>AGM</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-xs">{row.getValue("agm_attendance") ? "Yes" : "No"}</span>
      ),
    },
    {
      accessorKey: "voting_exercised",
      header: ({ column }) => <SortableHeader column={column}>Voting</SortableHeader>,
      cell: ({ row }) => (
        <span className="text-xs">{row.getValue("voting_exercised") ? "Yes" : "No"}</span>
      ),
    },
    ...(actions
      ? [
          {
            id: "actions",
            header: "Actions",
            cell: ({ row }: { row: { original: MemberResponse } }) => (
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
  ] as ColumnDef<MemberResponse>[];
}
