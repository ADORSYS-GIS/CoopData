import { useState } from "react";
import { toast } from "sonner";
import {
  useFederationInvitations,
  useInviteUserToFederation,
  useResendInvitation,
  useDeleteInvitation,
} from "@/hooks/federations/useFederations";
import { AppShell, Card, StatCard } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Mail, Plus, RefreshCw, Trash2, AlertCircle } from "lucide-react";
import type { components } from "@/openapi-client/api";

type Invitation = components["schemas"]["InvitationResponse"];

export const InvitationList: React.FC = () => {
  const [selectedFederationId, setSelectedFederationId] = useState<string>("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    email: "",
    first_name: "",
    last_name: "",
    role: "federation",
  });
  const [confirmAction, setConfirmAction] = useState<{
    type: "resend" | "cancel";
    invitationId: string;
    email: string;
  } | null>(null);

  const {
    data: invitations = [],
    isLoading,
    error,
  } = useFederationInvitations(selectedFederationId);

  const inviteMutation = useInviteUserToFederation();
  const resendMutation = useResendInvitation();
  const deleteMutation = useDeleteInvitation();

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFederationId) return;

    inviteMutation.mutate(
      {
        federationId: selectedFederationId,
        email: inviteForm.email,
        first_name: inviteForm.first_name,
        last_name: inviteForm.last_name,
        role: inviteForm.role,
      },
      {
        onSuccess: () => {
          toast.success("Invitation sent", {
            description: `An invitation has been sent to ${inviteForm.email}.`,
          });
          setInviteForm({ email: "", first_name: "", last_name: "", role: "federation" });
          setShowCreateModal(false);
        },
        onError: (error) => {
          toast.error("Failed to send invitation", {
            description: String(error),
          });
        },
      },
    );
  };

  const handleResendInvitation = async (invitationId: string) => {
    if (!selectedFederationId) return;
    resendMutation.mutate(
      {
        federationId: selectedFederationId,
        invitationId,
      },
      {
        onSuccess: () => {
          toast.success("Invitation resent", {
            description: `The invitation has been resent successfully.`,
          });
          setConfirmAction(null);
        },
        onError: (error) => {
          toast.error("Failed to resend invitation", {
            description: String(error),
          });
        },
      },
    );
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!selectedFederationId) return;
    deleteMutation.mutate(
      {
        federationId: selectedFederationId,
        invitationId,
      },
      {
        onSuccess: () => {
          toast.success("Invitation cancelled", {
            description: `The invitation has been cancelled successfully.`,
          });
          setConfirmAction(null);
        },
        onError: (error) => {
          toast.error("Failed to cancel invitation", {
            description: String(error),
          });
        },
      },
    );
  };

  const formatDate = (timestamp: number | null | undefined): string => {
    if (!timestamp) return "N/A";
    return new Date(timestamp * 1000).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <AppShell title="Invitation Management">
      <div className="space-y-6">
        {/* Federation Selector */}
        <Card title="Select Federation" subtitle="Choose a federation to manage invitations">
          <div className="flex items-center gap-4">
            <Select value={selectedFederationId} onValueChange={setSelectedFederationId}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder="Select a federation..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="federation-1">Federation One</SelectItem>
                <SelectItem value="federation-2">Federation Two</SelectItem>
                <SelectItem value="federation-3">Federation Three</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={() => setShowCreateModal(true)}
              disabled={!selectedFederationId}
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              New Invitation
            </Button>
          </div>
        </Card>

        {/* Stats */}
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
                : invitations.filter((i: Invitation) => !i.email_sent).length.toString()
            }
            icon={AlertCircle}
          />
          <StatCard
            label="Sent"
            value={
              isLoading
                ? "..."
                : invitations.filter((i: Invitation) => i.email_sent).length.toString()
            }
            icon={RefreshCw}
          />
          <StatCard
            label="Last 30 Days"
            value={isLoading ? "..." : invitations.length.toString()}
            icon={Mail}
          />
        </div>

        {/* Create Invitation Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
              <h3 className="text-lg font-semibold mb-4">Send New Invitation</h3>
              <form onSubmit={handleInvite} className="space-y-4">
                <div>
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    required
                    placeholder="user@example.com"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="first_name">First Name</Label>
                    <Input
                      id="first_name"
                      type="text"
                      value={inviteForm.first_name}
                      onChange={(e) => setInviteForm({ ...inviteForm, first_name: e.target.value })}
                      required
                      placeholder="John"
                    />
                  </div>
                  <div>
                    <Label htmlFor="last_name">Last Name</Label>
                    <Input
                      id="last_name"
                      type="text"
                      value={inviteForm.last_name}
                      onChange={(e) => setInviteForm({ ...inviteForm, last_name: e.target.value })}
                      required
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={inviteForm.role}
                    onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="federation">Federation Admin</SelectItem>
                      <SelectItem value="apex">Apex Admin</SelectItem>
                      <SelectItem value="cooperative">Cooperative Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex justify-end gap-3">
                  <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={inviteMutation.isPending}>
                    {inviteMutation.isPending ? "Sending..." : "Send Invitation"}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Invitations Table */}
        <Card title="Pending Invitations" subtitle={`${invitations.length} invitations found`}>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="py-8 text-center text-destructive">
              <AlertCircle className="mx-auto mb-2 h-8 w-8" />
              <p>Failed to load invitations</p>
              <p className="text-sm text-muted-foreground">{String(error)}</p>
            </div>
          ) : invitations.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <Mail className="mx-auto mb-3 h-12 w-12 opacity-50" />
              <p className="text-lg font-medium">No invitations found</p>
              <p className="text-sm">Select a federation and send your first invitation</p>
            </div>
          ) : (
            <div className="-mx-5 -mb-5 overflow-x-auto border-t border-border">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <th className="px-5 py-3">Email</th>
                    <th className="px-5 py-3">Name</th>
                    <th className="px-5 py-3">Role</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Sent Date</th>
                    <th className="px-5 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {invitations.map((inv: Invitation) => (
                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors duration-150">
                      <td className="px-5 py-3.5 font-medium">{inv.email || "N/A"}</td>
                      <td className="px-5 py-3.5 text-muted-foreground">—</td>
                      <td className="px-5 py-3.5">
                        <Badge variant={inv.email_sent ? "default" : "secondary"}>
                          {inv.email_sent ? "Sent" : "Pending"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5">{formatDate(inv.created_at)}</td>
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex justify-end gap-2">
                          {!inv.email_sent && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                setConfirmAction({
                                  type: "resend",
                                  invitationId: inv.id,
                                  email: inv.email || "",
                                })
                              }
                              className="h-8 w-8 p-0"
                            >
                              <RefreshCw className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setConfirmAction({
                                type: "cancel",
                                invitationId: inv.id,
                                email: inv.email || "",
                              })
                            }
                            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* Confirmation Dialog */}
        <AlertDialog
          open={!!confirmAction}
          onOpenChange={(open) => !open && setConfirmAction(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>
                {confirmAction?.type === "resend" ? "Resend Invitation?" : "Cancel Invitation?"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {confirmAction?.type === "resend"
                  ? `This will resend the invitation email to ${confirmAction.email}. The previous invitation will remain valid.`
                  : `This will cancel the invitation to ${confirmAction?.email}. This action cannot be undone.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (confirmAction?.type === "resend") {
                    handleResendInvitation(confirmAction.invitationId);
                  } else if (confirmAction?.type === "cancel") {
                    handleCancelInvitation(confirmAction.invitationId);
                  }
                }}
                className={
                  confirmAction?.type === "cancel" ? "bg-destructive hover:bg-destructive/90" : ""
                }
              >
                {confirmAction?.type === "resend" ? "Resend" : "Cancel Invitation"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppShell>
  );
};
