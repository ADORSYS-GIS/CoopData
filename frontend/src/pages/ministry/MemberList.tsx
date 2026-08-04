import { useState, useEffect, useMemo } from "react";
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
import { useTranslation } from "react-i18next";
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
import { Users, UserCheck, UserCog, Search, Trash2 } from "lucide-react";
import type { components } from "@/openapi-client/api";

type Member = components["schemas"]["MemberResponse"];

// ─── Columns ──────────────────────────────────────────────────────────────

function createColumns(
  t: (key: string) => string,
  onRemove: (member: Member) => void,
): ColumnDef<Member>[] {
  return [
    {
      accessorKey: "first_name",
      header: t("memberList.tableHeaders.name"),
      cell: ({ row }) => (
        <div className="font-medium text-foreground">
          {row.original.first_name} {row.original.last_name}
        </div>
      ),
    },
    {
      accessorKey: "email",
      header: t("memberList.tableHeaders.email"),
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.getValue<string>("email") ?? "—"}</span>
      ),
    },
    {
      accessorKey: "username",
      header: t("memberList.tableHeaders.username"),
      cell: ({ row }) => (
        <span className="text-foreground">{row.getValue<string>("username") ?? "—"}</span>
      ),
    },
    {
      accessorKey: "status",
      header: t("memberList.tableHeaders.status"),
      cell: ({ row }) => {
        const status = row.original.status;
        if (status === "ACTIVE") {
          return (
            <Badge variant="default" className="bg-emerald-100 text-emerald-700 border-emerald-200">
              {t("memberList.statusActive")}
            </Badge>
          );
        }
        return (
          <Badge variant="secondary" className="bg-amber-100 text-amber-700 border-amber-200">
            {t("memberList.statusPending")}
          </Badge>
        );
      },
    },
    {
      id: "actions",
      header: t("memberList.tableHeaders.actions"),
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={() => onRemove(row.original)}
          >
            <Trash2 className="size-4" />
            <span className="sr-only">{t("memberList.removeMemberSr")}</span>
          </Button>
        </div>
      ),
    },
  ];
}

// ─── Page Component ───────────────────────────────────────────────────────

export const MemberList: React.FC = () => {
  const { t } = useTranslation();
  const { data: federations = [], isLoading: federationsLoading } = useFederations();
  const [selectedFederationId, setSelectedFederationId] = useState<string>("");

  // Auto-select the first federation once the list is loaded
  useEffect(() => {
    if (!federationsLoading && federations.length > 0 && !selectedFederationId) {
      setSelectedFederationId(federations[0].id);
    }
  }, [federationsLoading, federations, selectedFederationId]);
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
            t("memberList.toastRemoved", {
              name: deleteTarget.first_name ?? deleteTarget.email ?? deleteTarget.id,
            }),
          );
          setDeleteTarget(null);
          refetchMembers();
        },
        onError: (err) => {
          toast.error(t("memberList.toastRemoveFailed"), { description: String(err) });
        },
      },
    );
  };

  const columns = useMemo(() => createColumns(t, (member) => setDeleteTarget(member)), [t]);

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

  const activeMembers = (members as Member[]).filter((m) => m.status === "ACTIVE").length;
  const pendingMembers = (members as Member[]).filter((m) => m.status === "PENDING").length;

  return (
    <AppShell title={t("memberList.title")} subtitle={t("memberList.subtitle")}>
      <div className="space-y-6">
        {/* Federation Selector */}
        <Card
          title={t("memberList.selectFederationTitle")}
          subtitle={t("memberList.selectFederationSubtitle")}
        >
          <div className="flex items-center gap-4">
            <div className="flex-1">
              {federationsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select value={selectedFederationId} onValueChange={setSelectedFederationId}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("memberList.selectFederationPlaceholder")} />
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
              label={t("memberList.totalMembers")}
              value={String((members as Member[]).length)}
              subtitle={t("memberList.allRegisteredMembers")}
              tone="primary"
            />
            <StatCard
              icon={UserCheck}
              label={t("memberList.activeMembers")}
              value={String(activeMembers)}
              subtitle={t("memberList.acceptedInvitation")}
              tone="success"
            />
            <StatCard
              icon={UserCog}
              label={t("memberList.pendingMembers")}
              value={String(pendingMembers)}
              subtitle={t("memberList.awaitingVerification")}
              tone="warning"
            />
            <StatCard
              icon={Users}
              label={t("memberList.federations")}
              value={String(federations.length)}
              subtitle={t("memberList.totalFederations")}
              tone="info"
            />
          </div>
        )}

        {/* Members Table */}
        {selectedFederationId && (
          <Card
            title={t("memberList.federationMembersTitle")}
            subtitle={t("memberList.membersFound", {
              count: table.getFilteredRowModel().rows.length,
            })}
            action={
              <div className="relative w-64">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("memberList.searchPlaceholder")}
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
                <p>{t("memberList.failedLoad", { error: String(membersError) })}</p>
                <Button variant="outline" className="mt-3" onClick={() => window.location.reload()}>
                  {t("memberList.retry")}
                </Button>
              </div>
            ) : table.getFilteredRowModel().rows.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Users className="mx-auto mb-3 size-12 opacity-30" />
                <p className="text-lg font-medium">{t("memberList.noMembersFound")}</p>
                <p className="text-sm">
                  {globalFilter ? t("memberList.adjustSearchQuery") : t("memberList.noMembersYet")}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
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
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between space-x-2 py-4">
                  <div className="text-sm text-muted-foreground">
                    {t("memberList.showingCount", {
                      filtered: table.getFilteredRowModel().rows.length,
                      total: (members as Member[]).length,
                    })}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.setPageIndex(0)}
                      disabled={!table.getCanPreviousPage()}
                    >
                      {t("memberList.first")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                    >
                      {t("memberList.previous")}
                    </Button>
                    <span className="text-sm font-medium">
                      {t("memberList.pageIndicator", {
                        current: table.getState().pagination.pageIndex + 1,
                        total: table.getPageCount(),
                      })}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                    >
                      {t("memberList.next")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                      disabled={!table.getCanNextPage()}
                    >
                      {t("memberList.last")}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </Card>
        )}

        {/* Empty state when no federation selected */}
        {!selectedFederationId && !federationsLoading && (
          <Card title={t("memberList.noFedSelectedTitle")}>
            <div className="py-12 text-center text-muted-foreground">
              <Users className="mx-auto mb-3 size-12 opacity-30" />
              <p className="text-lg font-medium">{t("memberList.noFedSelectedDesc")}</p>
              <p className="text-sm">{t("memberList.noFedSelectedHint")}</p>
            </div>
          </Card>
        )}
      </div>

      {/* Remove Member Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("memberList.removeMemberTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("memberList.removeMemberDesc", {
                name: deleteTarget?.first_name ?? deleteTarget?.email ?? "this member",
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("memberList.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {removeMemberMutation.isPending ? t("memberList.removing") : t("memberList.remove")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};
