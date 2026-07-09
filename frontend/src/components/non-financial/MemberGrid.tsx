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
import type { MemberResponse } from "@/types/non-financial";

interface MemberGridProps {
  members: MemberResponse[];
  isLoading?: boolean;
  isReadOnly?: boolean;
  onAdd?: () => void;
  onEdit?: (member: MemberResponse) => void;
  onDelete?: (id: string) => void;
}

export function MemberGrid({
  members,
  isLoading,
  isReadOnly,
  onAdd,
  onEdit,
  onDelete,
}: MemberGridProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-sm">
            Members
            <Badge variant="secondary">{members.length}</Badge>
          </CardTitle>
          {!isReadOnly && (
            <Button size="sm" onClick={onAdd}>
              <Plus className="size-4" />
              Add Member
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No members found. Upload an Excel file or add members manually.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Member ID</TableHead>
                  <TableHead className="text-xs">Join Date</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Gender</TableHead>
                  <TableHead className="text-xs">Age Group</TableHead>
                  <TableHead className="text-xs">Region</TableHead>
                  <TableHead className="text-xs">Urban/Rural</TableHead>
                  <TableHead className="text-xs">AGM</TableHead>
                  <TableHead className="text-xs">Voting</TableHead>
                  {!isReadOnly && <TableHead className="text-xs">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell className="text-xs font-mono">{m.member_id}</TableCell>
                    <TableCell className="text-xs">{m.join_date}</TableCell>
                    <TableCell className="text-xs">
                      <Badge
                        variant={
                          m.status === "Active"
                            ? "default"
                            : m.status === "Exited"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {m.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{m.gender}</TableCell>
                    <TableCell className="text-xs">{m.age_group}</TableCell>
                    <TableCell className="text-xs">{m.region}</TableCell>
                    <TableCell className="text-xs">{m.urban_rural}</TableCell>
                    <TableCell className="text-xs">{m.agm_attendance ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-xs">{m.voting_exercised ? "Yes" : "No"}</TableCell>
                    {!isReadOnly && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7"
                            onClick={() => onEdit?.(m)}
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 hover:text-destructive"
                            onClick={() => onDelete?.(m.id)}
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
