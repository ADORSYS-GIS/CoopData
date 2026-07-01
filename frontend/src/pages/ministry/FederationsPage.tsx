import {
  Plus,
  Search,
  Download,
  MapPin,
  Landmark,
  ShieldAlert,
  Users,
  Wallet,
  Activity,
  Pencil,
  Trash2,
} from "lucide-react";
import {
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { AppShell, Card, StatusPill, StatCard } from "@/components/app-shell";
import { formatCurrency, formatNumber } from "@/lib/mock-data";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useFederations,
  useCreateFederation,
  useUpdateFederation,
  useDeleteFederation,
} from "@/hooks/federations/useFederations";
import type { components } from "@/openapi-client/api";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

type Federation = components["schemas"]["FederationResponse"];

// ─── Zod Schemas ───────────────────────────────────────────────────────────

const federationFormSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  contact_email: z.string().optional(),
});

type FederationFormValues = z.infer<typeof federationFormSchema>;

// ─── Columns ───────────────────────────────────────────────────────────────

function createColumns(
  onEdit: (fed: Federation) => void,
  onDelete: (id: string, name: string) => void,
): ColumnDef<Federation>[] {
  return [
    {
      accessorKey: "id",
      header: "ID",
      cell: ({ row }) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.getValue<string>("id").slice(0, 8)}
        </span>
      ),
    },
    {
      accessorKey: "name",
      header: "Federation",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-foreground leading-tight">
            {row.getValue<string>("name")}
          </p>
          {row.original.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{row.original.description}</p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "domains",
      header: "Domains",
      cell: ({ row }) => {
        const domains = row.getValue<Federation["domains"]>("domains");
        if (!domains || domains.length === 0) {
          return <span className="text-xs text-muted-foreground">No domains</span>;
        }
        return (
          <div className="flex flex-wrap gap-1">
            {domains.map((d) => (
              <Badge key={d.name} variant="secondary" className="gap-1">
                <MapPin className="-size-3" />
                {d.name}
              </Badge>
            ))}
          </div>
        );
      },
    },
    {
      accessorKey: "enabled",
      header: "Status",
      cell: ({ row }) => (
        <StatusPill tone={row.getValue<boolean>("enabled") ? "success" : "danger"}>
          {row.getValue<boolean>("enabled") ? "Enabled" : "Disabled"}
        </StatusPill>
      ),
    },
    {
      id: "actions",
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button variant="ghost" size="icon" onClick={() => onEdit(row.original)} title="Edit">
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(row.original.id, row.original.name)}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Delete"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];
}

// ─── Federation Form Component ─────────────────────────────────────────────

function FederationForm({
  defaultValues,
  onSubmit,
  isPending,
}: {
  defaultValues?: FederationFormValues;
  onSubmit: (values: FederationFormValues) => void;
  isPending: boolean;
}) {
  const form = useForm<FederationFormValues>({
    resolver: zodResolver(federationFormSchema),
    defaultValues: defaultValues ?? { name: "", contact_email: undefined },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Federation Name *</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Manzini Regional Federation" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contact_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contact Email</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="contact@federation.org"
                  {...field}
                  value={field.value ?? ""}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="bg-muted/50 rounded-xl p-3 text-xs text-muted-foreground leading-relaxed flex items-start gap-2">
          <ShieldAlert className="size-4 shrink-0 text-amber-600 mt-0.5" />
          <span>
            By registering, you certify this federation operates in accordance with national
            cooperative guidelines and has cleared the Ministry's registration process.
          </span>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// ─── Page Component ────────────────────────────────────────────────────────

export const FederationsPage: React.FC = () => {
  const { data: federations = [], isLoading, error, refetch } = useFederations();
  const createMutation = useCreateFederation();
  const updateMutation = useUpdateFederation();
  const deleteMutation = useDeleteFederation();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  // Dialog states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingFed, setEditingFed] = useState<Federation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const federationsList = (federations as Federation[]) ?? [];

  const columns = createColumns(
    (fed) => setEditingFed(fed),
    (id, name) => setDeleteTarget({ id, name }),
  );

  const table = useReactTable({
    data: federationsList,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: 10,
      },
    },
  });

  const activeCount = federationsList.filter((f) => f.enabled).length;
  const totalDomains = federationsList.reduce((sum, f) => sum + (f.domains?.length ?? 0), 0);

  const allDomains = Array.from(
    new Set(federationsList.flatMap((f) => f.domains?.map((d) => d.name) ?? [])),
  );

  const [activeDomain, setActiveDomain] = useState("All domains");

  const handleCreateSubmit = (values: FederationFormValues) => {
    createMutation.mutate(
      { name: values.name, contact_email: values.contact_email },
      {
        onSuccess: () => {
          toast.success(`Successfully registered "${values.name}"!`);
          setIsCreateOpen(false);
          refetch();
        },
        onError: (err) => {
          toast.error("Failed to register federation", {
            description: String(err),
          });
        },
      },
    );
  };

  const handleEditSubmit = (values: FederationFormValues) => {
    if (!editingFed) return;
    updateMutation.mutate(
      {
        id: editingFed.id,
        name: values.name,
        contact_email: values.contact_email,
      },
      {
        onSuccess: () => {
          toast.success(`Updated "${values.name}"`);
          setEditingFed(null);
          refetch();
        },
        onError: (err) => {
          toast.error("Failed to update federation", {
            description: String(err),
          });
        },
      },
    );
  };

  const handleDeleteConfirm = () => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        toast.success(`Deleted "${deleteTarget.name}"`, {
          description: "Federation removed from registry.",
        });
        setDeleteTarget(null);
        refetch();
      },
      onError: (err) => {
        toast.error("Failed to delete federation", {
          description: String(err),
        });
      },
    });
  };

  return (
    <AppShell
      title="Federation Registry"
      subtitle="Manage regional federations · create and oversee apex organizations under each federation"
      actions={
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="size-4" /> Register federation
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Statistics Row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={Landmark}
            label="Total Federations"
            value={formatNumber(federationsList.length)}
            subtitle="Regional oversight bodies"
            tone="primary"
          />
          <StatCard
            icon={Activity}
            label="Active"
            value={formatNumber(activeCount)}
            subtitle="Operational federations"
            tone="success"
          />
          <StatCard
            icon={Users}
            label="Total Domains"
            value={formatNumber(totalDomains)}
            subtitle="Across all federations"
            tone="accent"
          />
          <StatCard
            icon={Wallet}
            label="Combined Portfolio"
            value={formatCurrency(0)}
            subtitle="Aggregate capital base"
            tone="info"
          />
        </div>

        {/* Directory Card */}
        <Card
          title="National Federation Directory"
          subtitle="Search, filter, and manage regional federations"
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success("Exporting federation data as CSV...")}
            >
              <Download className="size-3.5" /> Export CSV
            </Button>
          }
        >
          {/* Domain Filter Pills */}
          <div className="flex flex-wrap gap-1.5 text-xs mb-4">
            {["All domains", ...allDomains].map((item) => {
              const isActive = activeDomain === item;
              return (
                <button
                  key={item}
                  onClick={() => setActiveDomain(item)}
                  className={`press-feedback rounded-lg border px-3 py-1.5 font-bold transition-all ${
                    isActive
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border text-muted-foreground hover:bg-muted/50 bg-surface"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>

          {/* Search */}
          <div className="flex items-center py-2">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, domain..."
                value={globalFilter ?? ""}
                onChange={(e) => setGlobalFilter(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="space-y-3 py-8">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">
              <ShieldAlert className="mx-auto mb-2 h-8 w-8" />
              <p>Failed to load federations</p>
              <p className="text-sm text-muted-foreground">{String(error)}</p>
            </div>
          ) : table.getFilteredRowModel().rows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <div className="flex flex-col items-center justify-center">
                <Landmark className="size-8 text-muted-foreground/60 mb-2" />
                <p className="font-semibold text-sm">No federations match query</p>
                <p className="text-xs">
                  Try adjusting search parameters or register a new federation.
                </p>
              </div>
            </div>
          ) : (
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
          )}

          {/* Pagination */}
          {!isLoading && !error && table.getFilteredRowModel().rows.length > 0 && (
            <div className="flex items-center justify-between space-x-2 py-4">
              <div className="text-sm text-muted-foreground">
                Showing {table.getFilteredRowModel().rows.length} of {federationsList.length}{" "}
                federations
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
          )}
        </Card>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Landmark className="size-5 text-accent" />
              Register Federation
            </DialogTitle>
            <DialogDescription>Add a new federation to the national registry.</DialogDescription>
          </DialogHeader>
          <FederationForm onSubmit={handleCreateSubmit} isPending={createMutation.isPending} />
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editingFed} onOpenChange={(open) => !open && setEditingFed(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-5 text-accent" />
              Edit Federation
            </DialogTitle>
            <DialogDescription>Update federation details in the registry.</DialogDescription>
          </DialogHeader>
          {editingFed && (
            <FederationForm
              defaultValues={{
                name: editingFed.name,
                contact_email: editingFed.description || undefined,
              }}
              onSubmit={handleEditSubmit}
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation AlertDialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the federation "{deleteTarget?.name}". This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};
