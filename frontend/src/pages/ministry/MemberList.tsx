import { useState } from "react";
import {
  type ColumnDef,
  type SortingState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { toast } from "sonner";
import {
  useFederations,
  useFederationMembers,
  useRemoveFederationMember,
} from "@/hooks/federations/useFederations";
import { AppShell, Card, StatCard } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Users, UserCheck, Search, Trash2 } from "lucide-react";
import type { components } from "@/openapi-client/api";

type Member = components["schemas"]["MemberResponse"];

// ─── Columns ──────────────────────────────────────────────────────────────

function createColumns(
  onRemove: (member: Member) => void,
): ColumnDef<Member>[] {
  return [
    {
      accessorKey: "first_name",
      header: "Name",
      cell: ({ row }) => (
        <div className="font-medium text-foreground">
          {row.original.first_name} {row.original.last_name}
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.getValue<string>("email") ?? "—"}</span>
      ),
    },
    {
      accessorKey: "username",
      header: "Username",
      cell: ({ row }) => (
        <span className="text-foreground">{row.getValue<string>("username") ?? "—"}</span>
      ),
    },
    {
      accessorKey: "email",
      header: "Status",
      cell: () => <Badge variant="default">Active</Badge>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onRemove(row.original)}
          >
            <Trash2 className="size-4" />
            <span className="sr-only">Remove member</span>
          </Button>
        </div>
      ),
    },
  ];
}

// ─── Page Component ───────────────────────────────────────────────────────

export const MemberList: React.FC = () => {
  const { data: federations = [], isLoading: federationsLoading } = useFederations();
  const [selectedFederationId, setSelectedFederationId] = useState<string>("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [deleteTarget, setDeleteTarget] = useState<Member | null>(null);

  const {
    data: members = [],
    isLoading: membersLoading,
    error: membersError,
    refetch: refetchMembers,
  } = useFederationMembers(selectedFederationId);

  const removeMemberMutation = useRemoveFederationMember();

  const handleRemoveConfirm = () => {
    if (!deleteTarget || !selectedFederationId) return;
    removeMemberMutation.mutate(
      { federationId: selectedFederationId, userId: deleteTarget.id },
      {
        onSuccess: () => {
          toast.success(
            `Removed "${deleteTarget.first_name ?? deleteTarget.email ?? deleteTarget.id}" from federation`,
          );
          setDeleteTarget(null);
          refetchMembers();
        },
        onError: (err) => {
          toast.error("Failed to remove member", { description: String(err) });
        },
      },
    );
  };

  const columns = createColumns((member) => setDeleteTarget(member));

  const table = useReactTable({
    data: (members as Member[]) ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const activeMembers = (members as Member[]).length;

  return (
    <AppShell title="Member Management" subtitle="View and manage federation members">
      <div className="space-y-6">
        {/* Federation Selector */}
        <Card title="Select Federation" subtitle="Choose a federation to view its members">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              {federationsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedFederationId} onValueChange={setSelectedFederationId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a federation..." />
                  </SelectTrigger>
                  <SelectContent>
                    {federations.map((f: components["schemas"]["FederationResponse"]) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </Card>

        {/* Stats Cards */}
        {selectedFederationId && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              icon={Users}
              label="Total Members"
              value={String((members as Member[]).length)}
              subtitle="All registered members"
              tone="primary"
            />
            <StatCard
              icon={UserCheck}
              label="Active Members"
              value={String((members as Member[]).length)}
              subtitle="Accepted invitation"
              tone="success"
            />
            <StatCard
              icon={Users}
              label="Federations"
              value={String(federations.length)}
              subtitle="Total federations"
              tone="info"
            />
          </div>
        )}

        {/* Members Table */}
        {selectedFederationId && (
          <Card
            title="Federation Members"
            subtitle={`${table.getFilteredRowModel().rows.length} members found`}
            action={
              <div className="relative w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search members..."
                  value={globalFilter ?? ""}
                  onChange={(e) => setGlobalFilter(e.target.value)}
                  className="pl-9"
                />
              </div>
            }
          >
            {membersLoading ? (
              <div className="space-y-3 py-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : membersError ? (
              <div className="py-8 text-center text-destructive">
                <p>Failed to load members: {String(membersError)}</p>
                <Button variant="outline" className="mt-3" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </div>
            ) : table.getFilteredRowModel().rows.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Users className="mx-auto mb-3 size-12 opacity-30" />
                <p className="text-lg font-medium">No members found</p>
                <p className="text-sm">
                  {globalFilter
                    ? "Try adjusting your search query"
                    : "This federation has no members yet"}
                </p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <table className="w-full">
                    <thead>
                      {table.getHeaderGroups().map((headerGroup) => (
                        <tr key={headerGroup.id} className="border-b bg-muted/50">
                          {headerGroup.headers.map((header) => (
                            <th
                              key={header.id}
                              className="h-10 px-4 text-left align-middle text-xs font-medium text-muted-foreground uppercase tracking-wider"
                            >
                              {header.isPlaceholder
                                ? null
                                : flexRender(header.column.columnDef.header, header.getContext())}
                            </th>
                          ))}
                        </tr>
                      ))}
                    </thead>
                    <tbody>
                      {table.getRowModel().rows.map((row) => (
                        <tr key={row.id} className="border-b transition-colors hover:bg-muted/50">
                          {row.getVisibleCells().map((cell) => (
                            <td key={cell.id} className="px-4 py-3 align-middle">
                              {flexRender(cell.column.columnDef.cell, cell.getContext())}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between space-x-2 py-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {table.getFilteredRowModel().rows.length} of{" "}
                    {(members as Member[]).length} members
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.setPageIndex(0)}
                      disabled={!table.getCanPreviousPage()}
                    >
                      First
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                    >
                      Previous
                    </Button>
                    <span className="text-sm">
                      Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                    >
                      Next
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                      disabled={!table.getCanNextPage()}
                    >
                      Last
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        )}

        {/* Empty state when no federation selected */}
        {!selectedFederationId && !federationsLoading && (
          <Card title="No Federation Selected">
            <div className="py-12 text-center text-muted-foreground">
              <Users className="mx-auto mb-3 size-12 opacity-30" />
              <p className="text-lg font-medium">Select a federation</p>
              <p className="text-sm">
                Choose a federation from the dropdown above to view its members
              </p>
            </div>
          </Card>
        )}
      </div>

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove member?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove{" "}
              <span className="font-medium text-foreground">
                {deleteTarget?.first_name ?? deleteTarget?.email ?? "this member"}
              </span>{" "}
              from the federation. They will lose access to all federation resources. This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMemberMutation.isPending ? "Removing..." : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};
