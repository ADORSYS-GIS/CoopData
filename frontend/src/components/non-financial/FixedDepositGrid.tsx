import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { createFixedDepositColumns } from "./FixedDepositColumns";
import type { FixedDepositResponse } from "@/types/non-financial";

interface FixedDepositGridProps {
  fixedDeposits: FixedDepositResponse[];
  isLoading?: boolean;
  isReadOnly?: boolean;
  errorRowIds?: string[];
  onEdit?: (fd: FixedDepositResponse) => void;
  onDelete?: (id: string) => void;
}

export function FixedDepositGrid({
  fixedDeposits,
  isLoading,
  isReadOnly,
  errorRowIds,
  onEdit,
  onDelete,
}: FixedDepositGridProps) {
  const columns = createFixedDepositColumns(
    isReadOnly ? undefined : { onEdit: onEdit ?? (() => {}), onDelete: onDelete ?? (() => {}) },
  );

  const errorSet = new Set(errorRowIds ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          Fixed Deposits
          <Badge variant="secondary">{fixedDeposits.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={fixedDeposits}
          isLoading={isLoading}
          emptyMessage="No fixed deposits found. Upload an Excel file or add one manually."
          pageSize={10}
          getRowClassName={(row) =>
            errorSet.has((row as FixedDepositResponse).id) ? "bg-destructive/5" : undefined
          }
        />
      </CardContent>
    </Card>
  );
}
