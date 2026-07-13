import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/ui/data-table";
import { createLoanColumns } from "./LoanColumns";
import type { LoanResponse } from "@/types/non-financial";

interface LoanGridProps {
  loans: LoanResponse[];
  isLoading?: boolean;
  isReadOnly?: boolean;
  errorRowIds?: string[];
  onEdit?: (loan: LoanResponse) => void;
  onDelete?: (id: string) => void;
}

export function LoanGrid({
  loans,
  isLoading,
  isReadOnly,
  errorRowIds,
  onEdit,
  onDelete,
}: LoanGridProps) {
  const columns = createLoanColumns(
    isReadOnly ? undefined : { onEdit: onEdit ?? (() => {}), onDelete: onDelete ?? (() => {}) },
  );

  const errorSet = new Set(errorRowIds ?? []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          Loans
          <Badge variant="secondary">{loans.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <DataTable
          columns={columns}
          data={loans}
          isLoading={isLoading}
          emptyMessage="No loans found. Upload an Excel file or add one manually."
          pageSize={10}
          getRowClassName={(row) =>
            errorSet.has((row as LoanResponse).id) ? "bg-destructive/5" : undefined
          }
        />
      </CardContent>
    </Card>
  );
}
