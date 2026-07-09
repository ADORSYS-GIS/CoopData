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
import type { SavingsAccountResponse } from "@/types/non-financial";

interface SavingsGridProps {
  savings: SavingsAccountResponse[];
  isLoading?: boolean;
  isReadOnly?: boolean;
  onAdd?: () => void;
  onEdit?: (savings: SavingsAccountResponse) => void;
  onDelete?: (id: string) => void;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "SZL" }).format(value);
}

export function SavingsGrid({
  savings,
  isLoading,
  isReadOnly,
  onAdd,
  onEdit,
  onDelete,
}: SavingsGridProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            Savings Accounts
            <Badge variant="secondary">{savings.length}</Badge>
          </CardTitle>
          {!isReadOnly && (
            <Button size="sm" onClick={onAdd}>
              <Plus className="size-4" />
              Add Savings Account
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : savings.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No savings accounts found. Upload an Excel file or add one manually.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Account ID</TableHead>
                  <TableHead className="text-xs">Member ID</TableHead>
                  <TableHead className="text-xs">Type</TableHead>
                  <TableHead className="text-xs">Opening Date</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Frequency</TableHead>
                  <TableHead className="text-xs">Contributions</TableHead>
                  <TableHead className="text-xs">Trend</TableHead>
                  <TableHead className="text-xs">Interest Rate</TableHead>
                  <TableHead className="text-xs">Balance</TableHead>
                  {!isReadOnly && <TableHead className="text-xs">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {savings.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-xs font-mono">{s.savings_account_id}</TableCell>
                    <TableCell className="text-xs font-mono">{s.member_id}</TableCell>
                    <TableCell className="text-xs">{s.account_type}</TableCell>
                    <TableCell className="text-xs">{s.account_opening_date}</TableCell>
                    <TableCell className="text-xs">
                      <Badge variant={s.account_status === "Active" ? "default" : "secondary"}>
                        {s.account_status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{s.contribution_frequency}</TableCell>
                    <TableCell className="text-xs">{s.number_of_contributions}</TableCell>
                    <TableCell className="text-xs">{s.balance_trend}</TableCell>
                    <TableCell className="text-xs">{s.interest_rate}%</TableCell>
                    <TableCell className="text-xs font-mono">{formatCurrency(s.balance)}</TableCell>
                    {!isReadOnly && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            onClick={() => onEdit?.(s)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 hover:text-destructive"
                            onClick={() => onDelete?.(s.id)}
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
