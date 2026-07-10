import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { createMemberColumns } from "./MemberColumns";
import type { MemberResponse } from "@/types/non-financial";

interface MemberGridProps {
  members: MemberResponse[];
  isLoading?: boolean;
  isReadOnly?: boolean;
  errorRowIds?: string[];
  onEdit?: (member: MemberResponse) => void;
  onDelete?: (id: string) => void;
}

export function MemberGrid({
  members,
  isLoading,
  isReadOnly,
  errorRowIds,
  onEdit,
  onDelete,
}: MemberGridProps) {
  const columns = createMemberColumns(
    isReadOnly
      ? undefined
      : { onEdit: onEdit ?? (() => {}), onDelete: onDelete ?? (() => {}) },
  );

  const errorSet = new Set(errorRowIds ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          Members
          <Badge variant="secondary">{members.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={members}
          isLoading={isLoading}
          emptyMessage="No members found. Upload an Excel file or add members manually."
          pageSize={10}
          getRowClassName={(row) =>
            errorSet.has((row as MemberResponse).id)
              ? "bg-destructive/5"
              : undefined
          }
        />
      </CardContent>
    </Card>
  );
}
