import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { useMemberColumns } from "./MemberColumns";
import type { NfMemberResponse } from "@/types/non-financial";
import { useTranslation } from "react-i18next";

interface MemberGridProps {
  members: NfMemberResponse[];
  isLoading?: boolean;
  isReadOnly?: boolean;
  errorRowIds?: string[];
  onEdit?: (member: NfMemberResponse) => void;
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
  const { t } = useTranslation();
  const columns = useMemberColumns(
    isReadOnly ? undefined : { onEdit: onEdit ?? (() => {}), onDelete: onDelete ?? (() => {}) },
  );

  const errorSet = new Set(errorRowIds ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          {t("nf.members")}
          <Badge variant="secondary">{members.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={members}
          isLoading={isLoading}
          emptyMessage={t("nf.emptyMembers")}
          pageSize={10}
          getRowClassName={(row) =>
            errorSet.has((row as NfMemberResponse).id) ? "bg-destructive/5" : undefined
          }
        />
      </CardContent>
    </Card>
  );
}
