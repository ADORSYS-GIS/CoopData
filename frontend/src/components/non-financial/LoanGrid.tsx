import { Trash2, Plus, Loader2, Pencil } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LoanResponse } from "@/types/non-financial";

interface LoanGridProps {
  loans: LoanResponse[];
  isLoading?: boolean;
  isReadOnly?: boolean;
  onAdd?: () => void;
  onEdit?: (loan: LoanResponse) => void;
  onDelete?: (id: string) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "SZL" }).format(value);
}

const loanStatusVariant = (status: string) => {
  if (status === "Performing") return "default" as const;
  if (status === "Arrears") return "destructive" as const;
  if (status === "Restructured") return "secondary" as const;
  return "outline" as const;
};

export function LoanGrid({ loans, isLoading, isReadOnly, onAdd, onEdit, onDelete }: LoanGridProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            Loans
            <Badge variant="secondary">{loans.length}</Badge>
          </CardTitle>
          {!isReadOnly && (
            <Button size="sm" onClick={onAdd}>
              <Plus className="size-4" />
              Add Loan
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : loans.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No loans found. Upload an Excel file or add one manually.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Loan ID</TableHead>
                  <TableHead className="text-xs">Member ID</TableHead>
                  <TableHead className="text-xs">Product Type</TableHead>
                  <TableHead className="text-xs">Start Date</TableHead>
                  <TableHead className="text-xs">Maturity Date</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">DPD</TableHead>
                  <TableHead className="text-xs">Regularity</TableHead>
                  <TableHead className="text-xs">Interest</TableHead>
                  <TableHead className="text-xs">Balance</TableHead>
                  <TableHead className="text-xs">Loan Amount</TableHead>
                  {!isReadOnly && <TableHead className="text-xs">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {loans.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs font-mono">{l.loan_id}</TableCell>
                    <TableCell className="text-xs font-mono">{l.member_id}</TableCell>
                    <TableCell className="text-xs">{l.loan_product_type}</TableCell>
                    <TableCell className="text-xs">{l.loan_start_date}</TableCell>
                    <TableCell className="text-xs">{l.loan_maturity_date}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant={loanStatusVariant(l.loan_status)}>{l.loan_status}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">{l.days_past_due_category}</TableCell>
                    <TableCell className="text-xs">{l.repayment_regularity}</TableCell>
                    <TableCell className="text-xs">{l.interest_rate}%</TableCell>
                    <TableCell className="text-xs font-mono">{formatCurrency(l.balance)}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {formatCurrency(l.loan_amount)}
                    </TableCell>
                    {!isReadOnly && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            onClick={() => onEdit?.(l)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 hover:text-destructive"
                            onClick={() => onDelete?.(l.id)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
