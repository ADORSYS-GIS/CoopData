import { useState } from "react";
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

const invitationFormSchema = z.object({
  email: z.string().email("Invalid email address"),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
});

type InvitationFormValues = z.infer<typeof invitationFormSchema>;

// ─── Columns ──────────────────────────────────────────────────────────────

function createColumns(
  onResend: (invitationId: string, email: string) => void,
  onCancel: (invitationId: string, email: string) => void,
): ColumnDef<Invitation>[] {
  return [
    {
      accessorKey: "email",
      header: "Email",
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
      header: "Status",
      cell: ({ row }) => {
        const status = row.original.status ?? "PENDING";
        const variant =
          status === "ACCEPTED" ? "default" : status === "EXPIRED" ? "destructive" : "secondary";
        const label =
          status === "EMAIL_VERIFIED"
            ? "Email Verified"
            : status === "PENDING"
              ? "Awaiting Verification"
              : status;
        return <Badge variant={variant}>{label}</Badge>;
      },
    },
    {
      accessorKey: "created_at",
      header: "Date Sent",
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
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onResend(row.original.id, row.original.email || "")}
            title="Resend"
          >
            <RefreshCw className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onCancel(row.original.id, row.original.email || "")}
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            title="Cancel"
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
              <FormLabel>Email Address *</FormLabel>
              <FormControl>
                <Input type="email" placeholder="user@example.com" {...field} />
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
                <FormLabel>First Name *</FormLabel>
                <FormControl>
                  <Input placeholder="John" {...field} />
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
                <FormLabel>Last Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Dlamini" {...field} />
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
            <p className="text-xs font-medium text-foreground">Role: Federation Officer</p>
            <p className="text-xs text-muted-foreground">
              This person will manage <span className="font-medium">{federationName}</span> on
              behalf of the Ministry.
            </p>
          </div>
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </DialogClose>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Sending..." : "Send Invitation"}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

// ─── Page Component ───────────────────────────────────────────────────────

export const InvitationList: React.FC = () => {
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

  const columns = createColumns(
    (invitationId, email) => setConfirmAction({ type: "resend", invitationId, email }),
    (invitationId, email) => setConfirmAction({ type: "cancel", invitationId, email }),
  );

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
          toast.success("Invitation sent", {
            description: `An invitation has been sent to ${values.email}.`,
          });
          setShowCreateModal(false);
        },
        onError: (err) => {
          toast.error("Failed to send invitation", { description: String(err) });
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
          toast.success("Invitation resent successfully.");
          setConfirmAction(null);
        },
        onError: (err) => {
          toast.error("Failed to resend invitation", { description: String(err) });
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
          toast.success("Invitation cancelled.");
          setConfirmAction(null);
        },
        onError: (err) => {
          toast.error("Failed to cancel invitation", { description: String(err) });
        },
      },
    );
  };

  return (
    <AppShell title="Invitation Management" subtitle="Invite users to federations">
      <div className="space-y-6">
        {/* Federation Selector */}
        <Card title="Select Federation" subtitle="Choose a federation to manage its invitations">
          <div className="flex items-center gap-4">
            {federationsLoading ? (
              <Skeleton className="h-10 w-full max-w-md" />
            ) : (
              <Select value={selectedFederationId} onValueChange={setSelectedFederationId}>
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder="Select a federation..." />
                </SelectTrigger>
                <SelectContent>
                  {(federations as Federation[]).length === 0 ? (
                    <div className="px-4 py-3 text-sm text-muted-foreground">
                      No federations found. Create one first.
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
              New Invitation
            </Button>
          </div>
        </Card>

        {/* Stats — only show when a federation is selected */}
        {selectedFederationId && (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Total Invitations"
              value={isLoading ? "..." : invitations.length.toString()}
              icon={Mail}
            />
            <StatCard
              label="Pending"
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
              label="Sent"
              value={
                isLoading
                  ? "..."
                  : invitations.filter((i: Invitation) => i.email_sent).length.toString()
              }
              icon={RefreshCw}
              tone="success"
            />
            <StatCard
              label="Last 30 Days"
              value={isLoading ? "..." : invitations.length.toString()}
              icon={Mail}
              tone="info"
            />
          </div>
        )}

        {/* Invitations Table */}
        <Card
          title={
            selectedFederation ? `Invitations — ${selectedFederation.name}` : "Pending Invitations"
          }
          subtitle={
            selectedFederationId
              ? `${invitations.length} invitation${invitations.length !== 1 ? "s" : ""} found`
              : "Select a federation above to view invitations"
          }
        >
          {!selectedFederationId ? (
            <div className="py-12 text-center text-muted-foreground">
              <Mail className="mx-auto mb-3 size-12 opacity-30" />
              <p className="font-medium">No federation selected</p>
              <p className="text-sm">Choose a federation from the dropdown above</p>
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
              <p className="font-medium">Failed to load invitations</p>
              <p className="text-sm text-muted-foreground mt-1">{String(error)}</p>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="flex items-center py-2">
                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search by email..."
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
                  <p className="font-medium">No invitations yet</p>
                  <p className="text-sm">
                    Click "New Invitation" to invite someone to this federation
                  </p>
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
                <div className="flex items-center justify-between space-x-2 py-4">
                  <div className="text-sm text-muted-foreground">
                    Showing {table.getFilteredRowModel().rows.length} of {invitations.length}{" "}
                    invitations
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
              Invite to {selectedFederation?.name}
            </DialogTitle>
            <DialogDescription>
              Send an invitation to join the selected federation.
            </DialogDescription>
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
              {confirmAction?.type === "resend" ? "Resend Invitation?" : "Cancel Invitation?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.type === "resend"
                ? `This will resend the invitation email to ${confirmAction?.email}.`
                : `This will permanently cancel the invitation to ${confirmAction?.email}. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Dismiss</AlertDialogCancel>
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
              {confirmAction?.type === "resend" ? "Resend" : "Cancel Invitation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
};
