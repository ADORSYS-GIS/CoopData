import {
  ArrowLeft,
  AlertCircle,
  Building2,
  CheckCircle2,
  Clock,
  Mail,
  Pencil,
  Plus,
  RotateCcw,
  UserMinus,
  Users,
  X,
  Shield,
} from "lucide-react";
import { AppShell } from "@/components/app-shell";
import {
  useCooperative,
  useCooperativeMembers,
  useAddCooperativeMember,
  useUpdateCooperativeMember,
  useRemoveCooperativeMember,
  useResendCooperativeMemberVerification,
} from "@/hooks/cooperatives/useCooperatives";
import { Link, useParams } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Spinner } from "@/components/ui/spinner";

type MemberItem = {
  id: string;
  username?: string | null;
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  status: string;
};

const Avatar = ({ name }: { name: string }) => {
  const initials =
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "??";
  const colors = [
    "from-(--chart-1) to-(--chart-1)",
    "from-(--chart-4) to-(--chart-4)",
    "from-(--chart-2) to-(--chart-2)",
    "from-(--chart-3) to-(--chart-3)",
    "from-(--chart-4) to-(--chart-4)",
  ];
  const color = colors[name.charCodeAt(0) % colors.length];
  return (
    <div
      className={`size-9 rounded-full bg-gradient-to-br ${color} grid place-items-center font-bold text-xs text-white shrink-0 ring-2 ring-white`}
    >
      {initials}
    </div>
  );
};

export const CooperativeMembersPage: React.FC = () => {
  const { t } = useTranslation();
  const { cooperativeId } = useParams({ from: "/app/cooperative-members/$cooperativeId" });

  const { data: coop, isLoading: coopLoading } = useCooperative(cooperativeId);
  const { data: membersRaw, isLoading: membersLoading } = useCooperativeMembers(cooperativeId);
  const addMember = useAddCooperativeMember();
  const updateMember = useUpdateCooperativeMember();
  const removeMember = useRemoveCooperativeMember();
  const resend = useResendCooperativeMemberVerification();

  const members: MemberItem[] = (membersRaw as MemberItem[]) ?? [];

  const [showInvite, setShowInvite] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");

  const [editingMember, setEditingMember] = useState<MemberItem | null>(null);
  const [editFirst, setEditFirst] = useState("");
  const [editLast, setEditLast] = useState("");

  const [confirmRemove, setConfirmRemove] = useState<MemberItem | null>(null);

  const displayName = (m: MemberItem) => {
    const full = [m.first_name, m.last_name].filter(Boolean).join(" ");
    return full || m.username || m.email || m.id;
  };

  const coopData = coop as { id: string; name: string; description?: string | null } | undefined;

  const handleInvite = () => {
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      toast.error(t("coopMembers.toast.fillRequired"));
      return;
    }
    addMember.mutate(
      {
        cooperativeId,
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        role: "cooperative",
      },
      {
        onSuccess: () => {
          toast.success(
            t("coopMembers.toast.invitationSent", {
              firstName: firstName.trim(),
              lastName: lastName.trim(),
            }),
          );
          setShowInvite(false);
          setFirstName("");
          setLastName("");
          setEmail("");
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(t("coopMembers.toast.inviteFailed"), { description: msg });
        },
      },
    );
  };

  const handleSaveEdit = () => {
    if (!editingMember) return;
    updateMember.mutate(
      {
        cooperativeId,
        userId: editingMember.id,
        first_name: editFirst.trim(),
        last_name: editLast.trim(),
      },
      {
        onSuccess: () => {
          toast.success(t("coopMembers.toast.memberUpdated"));
          setEditingMember(null);
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(t("coopMembers.toast.updateFailed"), { description: msg });
        },
      },
    );
  };

  const handleRemove = (m: MemberItem) => {
    removeMember.mutate(
      { cooperativeId, userId: m.id },
      {
        onSuccess: () => {
          toast.success(t("coopMembers.toast.memberRemoved", { name: displayName(m) }));
          setConfirmRemove(null);
        },
        onError: (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(t("coopMembers.toast.removeFailed"), { description: msg });
          setConfirmRemove(null);
        },
      },
    );
  };

  const handleResend = (m: MemberItem) => {
    resend.mutate(
      { cooperativeId, userId: m.id },
      {
        onSuccess: () =>
          toast.success(t("coopMembers.toast.emailResent", { name: displayName(m) })),
        onError: (err) => {
          const msg = err instanceof Error ? err.message : String(err);
          toast.error(t("coopMembers.toast.resendFailed"), { description: msg });
        },
      },
    );
  };

  if (coopLoading) {
    return (
      <AppShell title={t("coopMembers.title")} subtitle={t("coopMembers.loading")}>
        <div className="flex min-h-[50dvh] items-center justify-center">
          <Spinner size="lg" className="text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title={coopData?.name ?? cooperativeId}
      subtitle={t("coopMembers.subtitle", { name: coopData?.name ?? t("coopMembers.thisCoop") })}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <Link
          to="/app/cooperatives"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="size-3.5" /> {t("coopMembers.backToCoops")}
        </Link>
        <button
          onClick={() => setShowInvite(true)}
          className="press-feedback inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-[var(--shadow-elev-2)]"
        >
          <Plus className="size-4" /> {t("coopMembers.inviteMember")}
        </button>
      </div>

      <div className="mb-5 rounded-2xl border border-border bg-gradient-to-br from-surface to-muted/20 p-5 shadow-[var(--shadow-elev-1)]">
        <div className="flex items-center gap-4">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-success/15 to-success/10 border border-success/20/60 text-success">
            <Building2 className="size-7" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-heading text-lg font-bold text-foreground truncate">
              {coopData?.name ?? t("coopMembers.cooperative")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">
              {coopData?.description ?? t("coopMembers.noDescription")}
            </p>
          </div>
          <div className="hidden sm:flex flex-col items-end gap-1">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-success/10 border border-success/20 px-2.5 py-1 text-xs font-semibold text-success">
              <Shield className="size-3.5" />
              {t("coopMembers.cooperativeRole")}
            </span>
            <span className="text-xs text-muted-foreground">
              {members.length}{" "}
              {members.length !== 1
                ? t("coopMembers.membersCountPlural")
                : t("coopMembers.membersCountSingular")}
            </span>
          </div>
        </div>
      </div>

      {showInvite && (
        <div className="mb-5 rounded-2xl border border-accent/20 bg-accent/5 p-5 shadow-[var(--shadow-elev-1)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="flex size-7 items-center justify-center rounded-lg bg-accent/15 text-accent">
                <Plus className="size-4" />
              </div>
              <h3 className="font-heading text-sm font-bold text-foreground">
                {t("coopMembers.inviteNewMember")}
              </h3>
            </div>
            <button
              onClick={() => setShowInvite(false)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                {t("coopMembers.firstName")} *
              </label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder={t("coopMembers.placeholderFirstName")}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                {t("coopMembers.lastName")} *
              </label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={t("coopMembers.placeholderLastName")}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
                {t("coopMembers.email")} *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("coopMembers.placeholderEmail")}
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/15 transition-all"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border/60">
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted/50 transition-colors"
            >
              {t("coopMembers.cancel")}
            </button>
            <button
              type="button"
              onClick={handleInvite}
              disabled={addMember.isPending}
              className="press-feedback inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-accent text-xs font-semibold text-white hover:bg-accent/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {addMember.isPending ? <Spinner size="sm" /> : <Mail className="size-3.5" />}
              {t("coopMembers.sendInvitation")}
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-surface shadow-[var(--shadow-elev-1)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-accent" />
            <span className="text-sm font-semibold text-foreground">
              {t("coopMembers.members")}
            </span>
            {members.length > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">
                {members.length}
              </span>
            )}
          </div>
        </div>

        {membersLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="md" className="text-muted-foreground" />
          </div>
        ) : members.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="flex size-14 items-center justify-center rounded-2xl bg-muted mb-4">
              <Users className="size-7 text-muted-foreground/50" />
            </div>
            <p className="font-semibold text-sm text-foreground">{t("coopMembers.noMembersYet")}</p>
            <p className="text-xs mt-1">{t("coopMembers.noMembersDesc")}</p>
            <button
              onClick={() => setShowInvite(true)}
              className="mt-4 press-feedback inline-flex items-center gap-1.5 rounded-xl bg-accent/10 border border-accent/20 px-4 py-2 text-xs font-semibold text-accent hover:bg-accent/15 transition-colors"
            >
              <Plus className="size-3.5" /> {t("coopMembers.inviteFirstMember")}
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
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {m.email ?? "—"}
                    </p>
                  </div>
                  {m.status === "PENDING" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-warning/10 border border-warning/20 px-2 py-0.5 text-[10px] font-bold text-warning-foreground">
                      <Clock className="size-3" />
                      {t("coopMembers.status.pending")}
                    </span>
                  )}
                  {m.status === "ACTIVE" && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-success/10 border border-success/20 px-2 py-0.5 text-[10px] font-bold text-success">
                      <CheckCircle2 className="size-3" />
                      {t("coopMembers.status.active")}
                    </span>
                  )}
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-md bg-success/10 border border-success/20 px-2 py-0.5 text-[10px] font-bold text-success">
                    <Shield className="size-3" />
                    {t("coopMembers.roleLabel")}
                  </span>
                  <div className="flex items-center gap-1.5 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => {
                        setEditingMember(m);
                        setEditFirst(m.first_name ?? "");
                        setEditLast(m.last_name ?? "");
                      }}
                      title={t("coopMembers.editMember")}
                      className="press-feedback flex size-8 items-center justify-center rounded-lg border border-warning/20 bg-warning/10 text-warning hover:bg-warning/10 hover:border-warning/30 transition-colors"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      onClick={() => handleResend(m)}
                      disabled={resend.isPending}
                      title={t("coopMembers.resendVerificationEmail")}
                      className="press-feedback flex size-8 items-center justify-center rounded-lg border border-accent/20 bg-accent/10 text-accent hover:bg-accent/15 hover:border-accent/30 transition-colors disabled:opacity-40"
                    >
                      {resend.isPending ? (
                        <Spinner size="sm" />
                      ) : (
                        <RotateCcw className="size-3.5" />
                      )}
                    </button>
                    <button
                      onClick={() => setConfirmRemove(m)}
                      title={t("coopMembers.removeMemberTitle")}
                      className="press-feedback flex size-8 items-center justify-center rounded-lg border border-destructive/20 bg-destructive/10 text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-colors"
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

      {editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setEditingMember(null)}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-elev-3)] z-10 animate-panel">
            <div className="flex items-center gap-3 mb-5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-warning/10 text-warning">
                <Pencil className="size-4" />
              </div>
              <div>
                <h3 className="font-heading text-base font-bold text-foreground">
                  {t("coopMembers.editMember")}
                </h3>
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
                  {t("coopMembers.firstName")}
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
                  {t("coopMembers.lastName")}
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
                {t("coopMembers.cancel")}
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={updateMember.isPending}
                className="press-feedback inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {updateMember.isPending && <Spinner size="sm" />}
                <CheckCircle2 className="size-3.5" />
                {t("coopMembers.saveChanges")}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setConfirmRemove(null)}
            className="absolute inset-0 bg-background/70 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-elev-3)] z-10 animate-panel">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex size-9 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertCircle className="size-4" />
              </div>
              <h3 className="font-heading text-base font-bold text-foreground">
                {t("coopMembers.removeMemberTitle")}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              {t("coopMembers.removeMemberConfirm", { name: displayName(confirmRemove) })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setConfirmRemove(null)}
                className="px-4 py-2 rounded-xl border border-border text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
              >
                {t("coopMembers.cancel")}
              </button>
              <button
                onClick={() => handleRemove(confirmRemove)}
                disabled={removeMember.isPending}
                className="press-feedback inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-destructive text-xs font-semibold text-destructive-foreground hover:bg-destructive/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {removeMember.isPending && <Spinner size="sm" />}
                <UserMinus className="size-3.5" />
                {t("coopMembers.remove")}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};
