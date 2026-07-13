import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { createSavingsColumns } from "./SavingsColumns";
import type { SavingsAccountResponse } from "@/types/non-financial";

interface SavingsGridProps {
  savings: SavingsAccountResponse[];
  isLoading?: boolean;
  isReadOnly?: boolean;
  errorRowIds?: string[];
  onEdit?: (savings: SavingsAccountResponse) => void;
  onDelete?: (id: string) => void;
}

export function SavingsGrid({
  savings,
  isLoading,
  isReadOnly,
  errorRowIds,
  onEdit,
  onDelete,
}: SavingsGridProps) {
  const columns = createSavingsColumns(
    isReadOnly ? undefined : { onEdit: onEdit ?? (() => {}), onDelete: onDelete ?? (() => {}) },
  );

  const errorSet = new Set(errorRowIds ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          Savings Accounts
          <Badge variant="secondary">{savings.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={savings}
          isLoading={isLoading}
          emptyMessage="No savings accounts found. Upload an Excel file or add one manually."
          pageSize={10}
          getRowClassName={(row) =>
            errorSet.has((row as SavingsAccountResponse).id) ? "bg-destructive/5" : undefined
          }
        />
      </CardContent>
    </Card>
  );
}
