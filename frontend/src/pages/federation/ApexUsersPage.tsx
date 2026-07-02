import {
  ArrowLeft,
  Mail,
  Loader2,
  Network,
  Plus,
  UserMinus,
  Users,
  X,
  Pencil,
  RotateCcw,
  Shield,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  useAddApexMember,
  useApex,
  useApexMembers,
  useRemoveApexMember,
  useResendVerification,
  useUpdateApexMember,
} from "@/hooks/apexes/useApexes";
import type { components } from "@/openapi-client/api";
import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

type MemberResponse = components["schemas"]["MemberResponse"];

const APEX_ROLE = "apex";

const Avatar = ({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) => {
  const initials =
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "??";
  const colors = [
    "from-sky-500 to-blue-600",
    "from-violet-500 to-purple-600",
    "from-emerald-500 to-teal-600",
    "from-amber-500 to-orange-600",
    "from-rose-500 to-pink-600",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  const sz =
    size === "sm" ? "size-7 text-[10px]" : size === "lg" ? "size-12 text-base" : "size-9 text-xs";
  return (
    <div
      className={`${sz} rounded-full bg-gradient-to-br ${color} grid place-items-center font-bold text-white shrink-0 ring-2 ring-white`}
    >
      {initials}
    </div>
  );
};

export const ApexUsersPage: React.FC = () => {
  const { apexId } = useParams({ from: "/app/users/$apexId" });

  const { data: apex, isLoading: apexLoading } = useApex(apexId);
  const { data: membersData, isLoading: membersLoading } = useApexMembers(apexId);
  const addMember = useAddApexMember();
  const removeMember = useRemoveApexMember();
  const resendVerification = useResendVerification();
  const updateMember = useUpdateApexMember();

  const members: MemberResponse[] = (membersData as MemberResponse[]) ?? [];

  const [showInvite, setShowInvite] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const [editingMember, setEditingMember] = useState<MemberResponse | null>(null);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");

  const [confirmRemove, setConfirmRemove] = useState<MemberResponse | null>(null);

  if (apexLoading) {
    return (
      <AppShell title="Apex Members" subtitle="Loading…">
        <div className="flex min-h-[50dvh] items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  const displayName = (m: MemberResponse) => {
    const full = [m.first_name, m.last_name].filter(Boolean).join(" ");
    return full || m.username || m.email || m.id;
  };

  const handleInvite = () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    addMember.mutate(
      {
        apexId,
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role: APEX_ROLE,
      },
      {
        onSuccess: () => {
          toast.success(`Invitation sent to ${firstName.trim()} ${lastName.trim()}`);
          setShowInvite(false);
          setFirstName("");
          setLastName("");
          setEmail("");
        },
        onError: (err) => {
          const e = err as { message?: string; error?: string };
          toast.error(e.message ?? e.error ?? "Failed to invite member.");
        },
      },
    );
  };

  const handleEdit = (m: MemberResponse) => {
    setEditingMember(m);
    setEditFirst(m.first_name ?? "");
    setEditLast(m.last_name ?? "");
  };

  const handleSaveEdit = () => {
    if (!editingMember) return;
    updateMember.mutate(
      {
        apexId,
        userId: editingMember.id,
        first_name: editFirst.trim(),
        last_name: editLast.trim(),
      },
      {
        onSuccess: () => {
          toast.success("Member updated.");
          setEditingMember(null);
        },
        onError: (err) => {
          const e = err as { message?: string };
          toast.error(e.message ?? "Failed to update member.");
        },
      },
    );
  };

  const handleRemove = (m: MemberResponse) => {
    const name = displayName(m);
    removeMember.mutate(
      { apexId, userId: m.id },
      {
        onSuccess: () => {
          toast.success(`Removed ${name}.`);
          setConfirmRemove(null);
        },
        onError: (err) => {
          const e = err as { message?: string; error?: string };
          toast.error(e.message ?? e.error ?? "Failed to remove member.");
          setConfirmRemove(null);
        },
      },
    );
  };

  const handleResend = (m: MemberResponse) => {
    resendVerification.mutate(
      { apexId, userId: m.id },
      {
        onSuccess: () => toast.success(`Verification email resent to ${displayName(m)}.`),
        onError: (err) => {
          const e = err as { message?: string; error?: string };
          toast.error(e.message ?? e.error ?? "Failed to resend email.");
        },
      },
    );
  };

  return (
    <AppShell
      title={apex?.name ?? "Apex Members"}
      subtitle="Invite, view and manage members of this apex"
      actions={
        <button
          onClick={() => setShowInvite(true)}
          className="press-feedback inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-[var(--shadow-elev-2)]"
        >
          <Plus className="size-4" /> Invite member
        </button>
      }
    >
      {/* Back link */}
      <Link
        to="/app/users"
        className="mb-5 inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="size-3.5" /> Back to apex selection
      </Link>

      {/* Apex header card */}
      <div className="mb-5 rounded-2xl border border-border bg-gradient-to-br from-surface to-muted/20 p-5 shadow-[var(--shadow-elev-1)]">
        <div className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500/15 to-blue-600/10 border border-sky-200/60 text-sky-600">
            <Network className="size-7" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-lg font-bold text-foreground truncate">
              {apex?.name ?? "Apex"}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {apex?.description ?? "No description"}
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-accent/10 border border-accent/20 px-2.5 py-1 text-xs font-semibold text-accent">
              <Shield className="size-3.5" />
              Apex Officer role
            </span>
            <span className="text-[11px] text-muted-foreground">
              {members.length} member{members.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className="mb-5 rounded-2xl border border-accent/20 bg-accent/5 p-5 shadow-[var(--shadow-elev-1)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <Plus className="size-4" />
              </div>
              <h3 className="font-heading text-sm font-bold text-foreground">Invite new member</h3>
            </div>
            <button
              onClick={() => setShowInvite(false)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                First name *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="e.g. Jean"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Last name *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="e.g. Dupont"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                Role
              </label>
              <div className="flex h-[38px] items-center rounded-xl border border-input bg-muted/40 px-3 text-sm font-semibold text-foreground">
                <Shield className="size-3.5 mr-2 text-accent" />
                Apex Officer
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/60">
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleInvite}
              disabled={addMember.isPending}
              className="press-feedback inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-xs font-semibold text-white hover:bg-accent/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addMember.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Mail className="size-3.5" />
              )}
              Send invitation
            </button>
          </div>
        </div>
      )}

      {/* Members table */}
      <div className="rounded-2xl border border-border bg-surface shadow-[var(--shadow-elev-1)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-accent" />
            <span className="text-sm font-semibold text-foreground">Members</span>
            {members.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
                {members.length}
              </span>
            )}
          </div>
        </div>

        {membersLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mb-4">
              <Users className="size-7 text-muted-foreground/50" />
            </div>
            <p className="font-semibold text-sm text-foreground">No members yet</p>
            <p className="text-xs mt-1">Invite a member to get started.</p>
            <button
              onClick={() => setShowInvite(true)}
              className="mt-4 press-feedback inline-flex items-center gap-1.5 rounded-xl bg-accent/10 border border-accent/20 px-4 py-2 text-xs font-semibold text-accent hover:bg-accent/15 transition-colors"
            >
              <Plus className="size-3.5" /> Invite first member
            </button>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {members.map((m) => {
              const name = displayName(m);
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors group"
                >
                  <Avatar name={name} />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-foreground truncate">{name}</p>
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                      {m.email ?? "—"}
                    </p>
                  </div>
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-sky-50 border border-sky-200 px-2 py-0.5 text-[10px] font-bold text-sky-700">
                    <Shield className="size-3" />
                    Apex Officer
                  </span>
                  {/* Actions */}
                  <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    {/* Edit */}
                    <button
                      onClick={() => handleEdit(m)}
                      title="Edit member"
                      className="press-feedback flex size-8 items-center justify-center rounded-lg border border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 hover:border-amber-300 transition-colors"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    {/* Resend */}
                    <button
                      onClick={() => handleResend(m)}
                      disabled={resendVerification.isPending}
                      title="Resend verification email"
                      className="press-feedback flex size-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-600 hover:bg-sky-100 hover:border-sky-300 transition-colors disabled:opacity-40"
                    >
                      {resendVerification.isPending ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RotateCcw className="size-3.5" />
                      )}
                    </button>
                    {/* Remove */}
                    <button
                      onClick={() => setConfirmRemove(m)}
                      title="Remove member"
                      className="press-feedback flex size-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 transition-colors"
                    >
                      <UserMinus className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Edit modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setEditingMember(null)}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-elev-3)] z-10 animate-panel">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
                <Pencil className="size-4" />
              </div>
              <div>
                <h3 className="font-heading text-base font-bold text-foreground">Edit member</h3>
                <p className="text-xs text-muted-foreground">
                  {editingMember.email ?? editingMember.id}
                </p>
              </div>
              <button
                onClick={() => setEditingMember(null)}
                className="ml-auto rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  First name
                </label>
                <input
                  type="text"
                  value={editFirst}
                  onChange={(e) => setEditFirst(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/15 transition-all"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                  Last name
                </label>
                <input
                  type="text"
                  value={editLast}
                  onChange={(e) => setEditLast(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/15 transition-all"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5 pt-4 border-t border-border">
              <button
                onClick={() => setEditingMember(null)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={updateMember.isPending}
                className="press-feedback inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateMember.isPending && <Loader2 className="size-3.5 animate-spin" />}
                <CheckCircle2 className="size-3.5" />
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm remove modal */}
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setConfirmRemove(null)}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-elev-3)] z-10 animate-panel">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex size-9 items-center justify-center rounded-xl bg-red-100 text-red-600">
                <AlertCircle className="size-4" />
              </div>
              <h3 className="font-heading text-base font-bold text-foreground">Remove member</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Remove{" "}
              <span className="font-semibold text-foreground">{displayName(confirmRemove)}</span>{" "}
              from this apex? They will lose access immediately.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmRemove(null)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleRemove(confirmRemove)}
                disabled={removeMember.isPending}
                className="press-feedback inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {removeMember.isPending && <Loader2 className="size-3.5 animate-spin" />}
                <UserMinus className="size-3.5" />
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};
