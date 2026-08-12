import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  useFederations,
  useFederationInvitations,
  useInviteUserToFederation,
  useResendInvitation,
  useDeleteInvitation,
} from "@/hooks/federations/useFederations";
import { AppShell, Card, StatCard } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Mail, Plus, RefreshCw, Trash2, AlertCircle, Search, UserCog } from "lucide-react";
import type { components } from "@/openapi-client/api";

type Invitation = components["schemas"]["InvitationResponse"];
type Federation = components["schemas"]["FederationResponse"];

// ─── Zod Schema ───────────────────────────────────────────────────────────
// Role is intentionally NOT part of the form — it is always "federation".
// The Ministry's purpose here is to register federation officers only.

type InvitationFormValues = {
  email: string;
  first_name: string;
  last_name: string;
};

// ─── Columns ──────────────────────────────────────────────────────────────

function extractErrorMessage(err: unknown): string {
  const e = err as { body?: { message?: string }; response?: { data?: { message?: string } } };
  return (
    e?.body?.message ??
    e?.response?.data?.message ??
    (err instanceof Error ? err.message : String(err))
  );
}

function createColumns(
  t: (key: string) => string,
  onResend: (invitationId: string, email: string) => void,
  onCancel: (invitationId: string, email: string) => void,
): ColumnDef<Invitation>[] {
  return [
    {
      accessorKey: "email",
      header: t("invitationList.tableHeaders.email"),
      cell: ({ row }) => (
        <div>
          <span className="font-medium">{row.getValue<string>("email") || "N/A"}</span>
          {(row.original.first_name || row.original.last_name) && (
            <p className="text-xs text-muted-foreground">
              {[row.original.first_name, row.original.last_name].filter(Boolean).join(" ")}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "email_sent",
      header: t("invitationList.tableHeaders.status"),
      cell: ({ row }) => {
        const status = row.original.status ?? "PENDING";
        const variant =
          status === "ACCEPTED" ? "default" : status === "EXPIRED" ? "destructive" : "secondary";
        const label =
          status === "EMAIL_VERIFIED"
            ? t("invitationList.statusEmailVerified")
            : status === "PENDING"
              ? t("invitationList.statusAwaitingVerification")
              : status;
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
    {
      accessorKey: "created_at",
      header: t("invitationList.tableHeaders.dateSent"),
      cell: ({ row }) => {
        const timestamp = row.getValue<number | null | undefined>("created_at");
        const formatted = timestamp
          ? new Date(timestamp * 1000).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          : "N/A";
        return <span className="text-muted-foreground">{formatted}</span>;
      },
    },
    {
      id: "actions",
      header: t("invitationList.tableHeaders.actions"),
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onResend(row.original.id, row.original.email || "")}
            title={t("invitationList.tooltipResend")}
          >
            <RefreshCw className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCancel(row.original.id, row.original.email || "")}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title={t("invitationList.tooltipCancel")}
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      ),
    },
  ];
}

// ─── Invitation Form Component ────────────────────────────────────────────

function InvitationForm({
  federationName,
  onSubmit,
  isPending,
}: {
  federationName: string;
  onSubmit: (values: InvitationFormValues) => void;
  isPending: boolean;
}) {
  const { t } = useTranslation();

  const invitationFormSchema = useMemo(() => {
    return z.object({
      email: z.string().email(t("invitationList.zod.emailInvalid")),
      first_name: z.string().min(1, t("invitationList.zod.firstNameRequired")),
      last_name: z.string().min(1, t("invitationList.zod.lastNameRequired")),
    });
  }, [t]);

  const form = useForm<InvitationFormValues>({
    resolver: zodResolver(invitationFormSchema),
    defaultValues: {
      email: "",
      first_name: "",
      last_name: "",
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t("invitationList.formLabelEmail")}</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder={t("invitationList.formPlaceholderEmail")}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-3">
          <FormField
            control={form.control}
            name="first_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("invitationList.formLabelFirstName")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("invitationList.formPlaceholderFirstName")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="last_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("invitationList.formLabelLastName")}</FormLabel>
                <FormControl>
                  <Input placeholder={t("invitationList.formPlaceholderLastName")} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Role is fixed — not a user choice */}
        <div className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 bg-muted/40">
          <UserCog className="size-4 text-muted-foreground shrink-0" />
          <div>
            <p className="text-xs font-medium text-foreground">
              {t("invitationList.roleFedOfficer")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("invitationList.roleDesc", { federationName })}
            </p>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              {t("invitationList.cancel")}
            </Button>
          </DialogClose>
          <Button type="submit" disabled={isPending}>
            {isPending ? t("invitationList.sending") : t("invitationList.sendInvitation")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────

export const InvitationList: React.FC = () => {
  const { t } = useTranslation();
  const [selectedFederationId, setSelectedFederationId] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: "resend" | "cancel";
    invitationId: string;
    email: string;
  } | null>(null);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  // Load real federations from API
  const { data: federations = [], isLoading: federationsLoading } = useFederations();

  // Auto-select the first federation once the list is loaded
  useEffect(() => {
    if (!federationsLoading && federations.length > 0 && !selectedFederationId) {
      setSelectedFederationId((federations as Federation[])[0].id);
    }
  }, [federationsLoading, federations, selectedFederationId]);

  const {
    data: invitations = [],
    isLoading,
    error,
  } = useFederationInvitations(selectedFederationId);

  const inviteMutation = useInviteUserToFederation();
  const resendMutation = useResendInvitation();
  const deleteMutation = useDeleteInvitation();

  const selectedFederation = (federations as Federation[]).find(
    (f) => f.id === selectedFederationId,
  );

  const columns = useMemo(() => {
    return createColumns(
      t,
      (invitationId, email) => setConfirmAction({ type: "resend", invitationId, email }),
      (invitationId, email) => setConfirmAction({ type: "cancel", invitationId, email }),
    );
  }, [t]);

  const table = useReactTable({
    data: (invitations as Invitation[]) ?? [],
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

  const handleInviteSubmit = (values: InvitationFormValues) => {
    if (!selectedFederationId) return;

    inviteMutation.mutate(
      {
        federationId: selectedFederationId,
        email: values.email,
        first_name: values.first_name,
        last_name: values.last_name,
        role: "federation", // always federation — Ministry invites federation officers only
      },
      {
        onSuccess: () => {
          toast.success(t("invitationList.toastSent"), {
            description: t("invitationList.toastSentDesc", { email: values.email }),
          });
          setShowCreateModal(false);
        },
        onError: (err) => {
          const errMsg = extractErrorMessage(err);
          toast.error(t("invitationList.toastSendFailed"), {
            description: errMsg,
          });
        },
      },
    );
  };

  const handleResendConfirm = () => {
    if (!confirmAction || !selectedFederationId) return;
    resendMutation.mutate(
      { federationId: selectedFederationId, invitationId: confirmAction.invitationId },
      {
        onSuccess: () => {
          toast.success(t("invitationList.toastResent"));
          setConfirmAction(null);
        },
        onError: (err) => {
          const errMsg = extractErrorMessage(err);
          toast.error(t("invitationList.toastResendFailed"), {
            description: errMsg,
          });
        },
      },
    );
  };

  const handleCancelConfirm = () => {
    if (!confirmAction || !selectedFederationId) return;
    deleteMutation.mutate(
      { federationId: selectedFederationId, invitationId: confirmAction.invitationId },
      {
        onSuccess: () => {
          toast.success(t("invitationList.toastCancelled"));
          setConfirmAction(null);
        },
        onError: (err) => {
          const errMsg = extractErrorMessage(err);
          toast.error(t("invitationList.toastCancelFailed"), {
            description: errMsg,
          });
        },
      },
    );
  };

  return (
    <AppShell title={t("invitationList.title")} subtitle={t("invitationList.subtitle")}>
      <div className="space-y-6">
        {/* Federation Selector */}
        <Card
          title={t("invitationList.selectFederationTitle")}
          subtitle={t("invitationList.selectFederationSubtitle")}
        >
          <div className="flex items-center gap-4">
            {federationsLoading ? (
              <Skeleton className="h-10 w-full max-w-md" />
            ) : (
              <Select value={selectedFederationId} onValueChange={setSelectedFederationId}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder={t("invitationList.selectFederationPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {(federations as Federation[]).length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">
                      {t("invitationList.noFederationsFound")}
                    </div>
                  ) : (
                    (federations as Federation[]).map((f) => (
                      <SelectItem key={f.id} value={f.id}>
                        {f.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}
            <Button
              onClick={() => setShowCreateModal(true)}
              disabled={!selectedFederationId}
              className="flex items-center gap-2 shrink-0"
            >
              <Plus className="size-4" />
              {t("invitationList.newInvitationBtn")}
            </Button>
          </div>
        </Card>

        {/* Stats — only show when a federation is selected */}
        {selectedFederationId && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label={t("invitationList.totalInvitations")}
              value={isLoading ? "..." : invitations.length.toString()}
              icon={Mail}
            />
            <StatCard
              label={t("invitationList.pending")}
              value={
                isLoading
                  ? "..."
                  : invitations
                      .filter(
                        (i: Invitation) => i.status === "PENDING" || i.status === "EMAIL_VERIFIED",
                      )
                      .length.toString()
              }
              icon={AlertCircle}
              tone="warning"
            />
            <StatCard
              label={t("invitationList.sent")}
              value={
                isLoading
                  ? "..."
                  : invitations.filter((i: Invitation) => i.email_sent).length.toString()
              }
              icon={RefreshCw}
              tone="success"
            />
            <StatCard
              label={t("invitationList.last30Days")}
              value={isLoading ? "..." : invitations.length.toString()}
              icon={Mail}
              tone="info"
            />
          </div>
        )}

        {/* Invitations Table */}
        <Card
          title={
            selectedFederation
              ? t("invitationList.invitationsFederationTitle", { name: selectedFederation.name })
              : t("invitationList.pendingInvitationsTitle")
          }
          subtitle={
            selectedFederationId
              ? t("invitationList.invitationsCount", { count: invitations.length })
              : t("invitationList.selectFederationPrompt")
          }
        >
          {!selectedFederationId ? (
            <div className="py-12 text-center text-muted-foreground">
              <Mail className="mx-auto mb-3 size-12 opacity-30" />
              <p className="font-medium">{t("invitationList.noFedSelected")}</p>
              <p className="text-sm">{t("invitationList.chooseFedHint")}</p>
            </div>
          ) : isLoading ? (
            <div className="space-y-3 py-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">
              <AlertCircle className="mx-auto mb-2 h-8 w-8" />
              <p className="font-medium">{t("invitationList.failedLoad")}</p>
              <p className="text-sm text-muted-foreground mt-1">{String(error)}</p>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="flex items-center py-2">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t("invitationList.searchPlaceholder")}
                    value={globalFilter ?? ""}
                    onChange={(e) => setGlobalFilter(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {/* Table */}
              {table.getFilteredRowModel().rows.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Mail className="mx-auto mb-3 h-12 w-12 opacity-30" />
                  <p className="font-medium">{t("invitationList.noInvitationsYet")}</p>
                  <p className="text-sm">{t("invitationList.inviteInstruction")}</p>
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
              {table.getFilteredRowModel().rows.length > 0 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-4">
                  <div className="text-sm text-muted-foreground text-center sm:text-left">
                    {t("invitationList.showingCount", {
                      filtered: table.getFilteredRowModel().rows.length,
                      total: invitations.length,
                    })}
                  </div>
                  <div className="flex items-center gap-1 flex-wrap justify-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.setPageIndex(0)}
                      disabled={!table.getCanPreviousPage()}
                      className="hidden sm:inline-flex"
                    >
                      {t("invitationList.first")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.previousPage()}
                      disabled={!table.getCanPreviousPage()}
                    >
                      {t("invitationList.prev")}
                    </Button>
                    <span className="text-sm px-1 whitespace-nowrap font-medium">
                      {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.nextPage()}
                      disabled={!table.getCanNextPage()}
                    >
                      {t("invitationList.next")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                      disabled={!table.getCanNextPage()}
                      className="hidden sm:inline-flex"
                    >
                      {t("invitationList.last")}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </Card>
      </div>

      {/* Create Invitation Dialog */}
      <Dialog open={showCreateModal} onOpenChange={setShowCreateModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="size-5 text-accent" />
              {t("invitationList.dialogInviteTitle", { name: selectedFederation?.name })}
            </DialogTitle>
            <DialogDescription>{t("invitationList.dialogInviteDesc")}</DialogDescription>
          </DialogHeader>
          <InvitationForm
            federationName={selectedFederation?.name ?? ""}
            onSubmit={handleInviteSubmit}
            isPending={inviteMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Confirm resend / cancel dialog */}
      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.type === "resend"
                ? t("invitationList.confirmResendTitle")
                : t("invitationList.confirmCancelTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "resend"
                ? t("invitationList.confirmResendDesc", { email: confirmAction?.email })
                : t("invitationList.confirmCancelDesc", { email: confirmAction?.email })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("invitationList.dismiss")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmAction?.type === "resend") {
                  handleResendConfirm();
                } else {
                  handleCancelConfirm();
                }
              }}
              className={
                confirmAction?.type === "cancel"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {confirmAction?.type === "resend"
                ? t("invitationList.resend")
                : t("invitationList.cancelInvitation")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};
export default InvitationList;
