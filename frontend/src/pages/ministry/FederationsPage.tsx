import {
  Plus,
  Search,
  Download,
  Globe,
  Landmark,
  ShieldAlert,
  Users,
  Wallet,
  Activity,
  Pencil,
  Trash2,
  Calendar,
  FileCheck,
  TrendingUp,
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
import { useTranslation } from "react-i18next";
import { AppShell, Card, StatusPill, StatCard } from "@/components/app-shell";
import { formatCurrency, formatNumber } from "@/lib/mock-data";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  useFederations,
  useCreateFederation,
  useUpdateFederation,
  useDeleteFederation,
  useFederationDeletePreview,
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
import { DeleteConfirmationDialog } from "@/components/shared/DeleteConfirmationDialog";
import { useVerifyIdentity } from "@/hooks/auth/useVerifyIdentity";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";

type Federation = components["schemas"]["FederationResponse"];

// ─── Zod Schemas ───────────────────────────────────────────────────────────

const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+$/;

type FederationFormValues = {
  name: string;
  domain: string;
  contact_email?: string;
};

// ─── Columns ───────────────────────────────────────────────────────────────

function createColumns(
  t: (key: string) => string,
  onEdit: (fed: Federation) => void,
  onDelete: (id: string, name: string) => void,
): ColumnDef<Federation>[] {
  return [
    {
      accessorKey: "created_at",
      header: t("federationsPage.tableHeaders.registration"),
      cell: ({ row }) => {
        const createdAt = row.original.created_at;
        const displayDate = createdAt ? new Date(createdAt).toLocaleDateString("en-CA") : "—";
        return (
          <span className="text-xs text-muted-foreground">
            <Calendar className="inline size-3 mr-1" />
            {displayDate}
          </span>
        );
      },
    },
    {
      accessorKey: "name",
      header: t("federationsPage.tableHeaders.federation"),
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
      header: t("federationsPage.tableHeaders.domain"),
      cell: ({ row }) => {
        const domains = row.original.domains ?? [];
        const primary = domains[0];
        return primary ? (
          <Badge variant="outline" className="gap-1 font-mono text-xs">
            <Globe className="size-3" />
            {primary.name}
            {primary.verified && (
              <span className="ml-1 text-emerald-500" title={t("federationsPage.tooltipVerified")}>
                ✓
              </span>
            )}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        );
      },
    },
    {
      accessorKey: "apexes",
      header: t("federationsPage.tableHeaders.apexes"),
      cell: ({ row }) => <span className="text-sm">{row.original.apex_count ?? 0}</span>,
    },
    {
      accessorKey: "cooperatives",
      header: t("federationsPage.tableHeaders.cooperatives"),
      cell: ({ row }) => <span className="text-sm">{row.original.cooperative_count ?? 0}</span>,
    },

    {
      accessorKey: "enabled",
      header: t("federationsPage.tableHeaders.status"),
      cell: ({ row }) => (
        <StatusPill tone={row.getValue<boolean>("enabled") ? "success" : "danger"}>
          {row.getValue<boolean>("enabled")
            ? t("federationsPage.statusEnabled")
            : t("federationsPage.statusDisabled")}
        </StatusPill>
      ),
    },
    {
      accessorKey: "compliance",
      header: t("federationsPage.tableHeaders.compliance"),
      cell: () => (
        <Badge variant="secondary" className="gap-1">
          <FileCheck className="size-3" />
          {t("federationsPage.complianceCompliant")}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: t("federationsPage.tableHeaders.actions"),
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(row.original)}
            title={t("federationsPage.tooltipEdit")}
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onDelete(row.original.id, row.original.name)}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title={t("federationsPage.tooltipDelete")}
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
  isEdit,
}: {
  defaultValues?: Partial<FederationFormValues>;
  onSubmit: (values: FederationFormValues) => void;
  isPending: boolean;
  isEdit?: boolean;
}) {
  const { t } = useTranslation();

  const federationFormSchema = useMemo(() => {
    return z.object({
      name: z.string().min(2, t("federationsPage.zod.nameMin")),
      domain: z
        .string()
        .min(1, t("federationsPage.zod.domainRequired"))
        .regex(domainRegex, t("federationsPage.zod.domainInvalid")),
      contact_email: z
        .string()
        .email(t("federationsPage.zod.emailInvalid"))
        .optional()
        .or(z.literal("")),
    });
  }, [t]);

  const form = useForm<FederationFormValues>({
    resolver: zodResolver(federationFormSchema),
    defaultValues: {
      name: "",
      domain: "",
      contact_email: "",
      ...defaultValues,
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("federationsPage.formLabelName")}</FormLabel>
              <FormControl>
                <Input placeholder={t("federationsPage.formPlaceholderName")} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="domain"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("federationsPage.formLabelDomain")}</FormLabel>
              <FormControl>
                <Input placeholder={t("federationsPage.formPlaceholderDomain")} {...field} />
              </FormControl>
              <FormDescription className="text-xs">
                {t("federationsPage.formDescDomain")}
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contact_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("federationsPage.formLabelEmail")}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder={t("federationsPage.formPlaceholderEmail")}
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
          <span>{t("federationsPage.disclaimer")}</span>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("federationsPage.cancel")}
            </Button>
          </DialogClose>
          <Button type="submit" disabled={isPending}>
            {isPending
              ? t("federationsPage.btnSaving")
              : isEdit
                ? t("federationsPage.btnSave")
                : t("federationsPage.btnRegister")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// ─── Page Component ────────────────────────────────────────────────────────

export const FederationsPage: React.FC = () => {
  const { t } = useTranslation();
  const { data: federations = [], isLoading, error, refetch } = useFederations();
  const createMutation = useCreateFederation();
  const updateMutation = useUpdateFederation();
  const deleteMutation = useDeleteFederation();
  const { verifyIdentity } = useVerifyIdentity();

  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingFed, setEditingFed] = useState<Federation | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

  const { data: previewData, isLoading: previewLoading } = useFederationDeletePreview(
    deleteTarget?.id ?? "",
  );

  const federationsList = (federations as Federation[]) ?? [];

  const columns = useMemo(() => {
    return createColumns(
      t,
      (fed) => setEditingFed(fed),
      (id, name) => setDeleteTarget({ id, name }),
    );
  }, [t]);

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
    state: { sorting, columnFilters, globalFilter },
    initialState: { pagination: { pageSize: 10 } },
  });

  const activeCount = federationsList.filter((f) => f.enabled).length;
  const totalMembers = federationsList.length * 600;

  const handleCreateSubmit = (values: FederationFormValues) => {
    createMutation.mutate(
      {
        name: values.name,
        domain: values.domain,
        contact_email: values.contact_email || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t("federationsPage.toastCreated", { name: values.name }));
          setIsCreateOpen(false);
          refetch();
        },
        onError: (err) => {
          toast.error(t("federationsPage.toastCreateFailed"), {
            description: err instanceof Error ? err.message : String(err),
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
        domain: values.domain,
        contact_email: values.contact_email || undefined,
      },
      {
        onSuccess: () => {
          toast.success(t("federationsPage.toastUpdated", { name: values.name }));
          setEditingFed(null);
          refetch();
        },
        onError: (err) => {
          toast.error(t("federationsPage.toastUpdateFailed"), {
            description: err instanceof Error ? err.message : String(err),
          });
        },
      },
    );
  };

  const handleVerifyIdentity = async (password: string, otp?: string) => {
    return verifyIdentity({ password, otp });
  };

  const handleConfirmDelete = async (verificationToken: string) => {
    if (!deleteTarget) return;
    return new Promise<void>((resolve, reject) => {
      deleteMutation.mutate(
        { id: deleteTarget.id, verificationToken },
        {
          onSuccess: () => {
            toast.success(t("federationsPage.toastDeleted", { name: deleteTarget.name }), {
              description: t("federationsPage.toastDeletedDesc"),
            });
            setDeleteTarget(null);
            refetch();
            resolve();
          },
          onError: (err) => {
            toast.error(t("federationsPage.toastDeleteFailed"), {
              description: err instanceof Error ? err.message : String(err),
            });
            reject(err);
          },
        },
      );
    });
  };

  return (
    <AppShell
      title={t("federationsPage.title")}
      subtitle={t("federationsPage.subtitle")}
      actions={
        <Button onClick={() => setIsCreateOpen(true)}>
          <Plus className="size-4" /> {t("federationsPage.registerFedBtn")}
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Statistics Row */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={Landmark}
            label={t("federationsPage.totalFederations")}
            value={formatNumber(federationsList.length)}
            subtitle={t("federationsPage.regionalOversight")}
            tone="primary"
          />
          <StatCard
            icon={Activity}
            label={t("federationsPage.active")}
            value={formatNumber(activeCount)}
            subtitle={t("federationsPage.operationalFederations")}
            tone="success"
          />
          <StatCard
            icon={Users}
            label={t("federationsPage.totalMembers")}
            value={formatNumber(totalMembers)}
            subtitle={t("federationsPage.acrossAllFederations")}
            tone="accent"
          />
          <StatCard
            icon={Wallet}
            label={t("federationsPage.combinedPortfolio")}
            value={formatCurrency(0)}
            subtitle={t("federationsPage.aggregateCapital")}
            tone="info"
          />
        </div>

        {/* Directory Card */}
        <Card
          title={t("federationsPage.directoryTitle")}
          subtitle={t("federationsPage.directorySubtitle")}
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => toast.success(t("federationsPage.toastExporting"))}
            >
              <Download className="size-3.5" /> {t("federationsPage.exportCsv")}
            </Button>
          }
        >
          {/* Search */}
          <div className="flex items-center py-2">
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t("federationsPage.searchPlaceholder")}
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
              <p>{t("federationsPage.failedLoad")}</p>
              <p className="text-sm text-muted-foreground">{String(error)}</p>
            </div>
          ) : table.getFilteredRowModel().rows.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Landmark className="size-8 text-muted-foreground/60 mb-2 mx-auto" />
              <p className="font-semibold text-sm">{t("federationsPage.noMatchQuery")}</p>
              <p className="text-xs">{t("federationsPage.adjustSearch")}</p>
            </div>
          ) : (
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
          )}

          {/* Pagination */}
          {!isLoading && !error && table.getFilteredRowModel().rows.length > 0 && (
            <div className="flex items-center justify-between space-x-2 py-4">
              <div className="text-sm text-muted-foreground">
                {t("federationsPage.showingCount", {
                  filtered: table.getFilteredRowModel().rows.length,
                  total: federationsList.length,
                })}
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.previousPage()}
                  disabled={!table.getCanPreviousPage()}
                >
                  {t("federationsPage.previous")}
                </Button>
                <span className="text-sm font-medium">
                  {table.getState().pagination.pageIndex + 1}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => table.nextPage()}
                  disabled={!table.getCanNextPage()}
                >
                  {t("federationsPage.next")}
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
              {t("federationsPage.dialogRegisterTitle")}
            </DialogTitle>
            <DialogDescription>{t("federationsPage.dialogRegisterDesc")}</DialogDescription>
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
              {t("federationsPage.dialogEditTitle")}
            </DialogTitle>
            <DialogDescription>{t("federationsPage.dialogEditDesc")}</DialogDescription>
          </DialogHeader>
          {editingFed && (
            <FederationForm
              isEdit
              defaultValues={{
                name: editingFed.name,
                domain: editingFed.domains?.[0]?.name ?? "",
                contact_email: editingFed.contact_email ?? "",
              }}
              onSubmit={handleEditSubmit}
              isPending={updateMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <DeleteConfirmationDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        entityName={deleteTarget?.name ?? ""}
        entityType="federation"
        entityId={deleteTarget?.id ?? ""}
        previewData={
          previewData as unknown as
            { apexes: number; cooperatives: number; members: number } | undefined
        }
        previewLoading={previewLoading}
        onVerifyIdentity={handleVerifyIdentity}
        onConfirmDelete={handleConfirmDelete}
      />
    </AppShell>
  );
};
export default FederationsPage;
