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
import type { FixedDepositResponse } from "@/types/non-financial";

interface FixedDepositGridProps {
  fixedDeposits: FixedDepositResponse[];
  isLoading?: boolean;
  isReadOnly?: boolean;
  onAdd?: () => void;
  onEdit?: (fd: FixedDepositResponse) => void;
  onDelete?: (id: string) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "SZL" }).format(value);
}

export function FixedDepositGrid({
  fixedDeposits,
  isLoading,
  isReadOnly,
  onAdd,
  onEdit,
  onDelete,
}: FixedDepositGridProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            Fixed Deposits
            <Badge variant="secondary">{fixedDeposits.length}</Badge>
          </CardTitle>
          {!isReadOnly && (
            <Button size="sm" onClick={onAdd}>
              <Plus className="size-4" />
              Add Fixed Deposit
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : fixedDeposits.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No fixed deposits found. Upload an Excel file or add one manually.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">FD ID</TableHead>
                  <TableHead className="text-xs">Member ID</TableHead>
                  <TableHead className="text-xs">Deposit Type</TableHead>
                  <TableHead className="text-xs">Start Date</TableHead>
                  <TableHead className="text-xs">Maturity Date</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Tenure</TableHead>
                  <TableHead className="text-xs">Renewals</TableHead>
                  <TableHead className="text-xs">Interest</TableHead>
                  <TableHead className="text-xs">Balance</TableHead>
                  {!isReadOnly && <TableHead className="text-xs">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {fixedDeposits.map((fd) => (
                  <TableRow key={fd.id}>
                    <TableCell className="text-xs font-mono">{fd.fixed_deposit_id}</TableCell>
                    <TableCell className="text-xs font-mono">{fd.member_id}</TableCell>
                    <TableCell className="text-xs">{fd.deposit_type}</TableCell>
                    <TableCell className="text-xs">{fd.start_date}</TableCell>
                    <TableCell className="text-xs">{fd.maturity_date}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant={fd.status === "Active" ? "default" : "secondary"}>
                        {fd.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{fd.tenure_category}</TableCell>
                    <TableCell className="text-xs">{fd.number_of_renewals}</TableCell>
                    <TableCell className="text-xs">{fd.interest_rate}%</TableCell>
                    <TableCell className="text-xs font-mono">
                      {formatCurrency(fd.balance)}
                    </TableCell>
                    {!isReadOnly && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            onClick={() => onEdit?.(fd)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 hover:text-destructive"
                            onClick={() => onDelete?.(fd.id)}
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
