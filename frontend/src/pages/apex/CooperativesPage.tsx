import {
  Plus,
  Search,
  Building2,
  Users,
  Pencil,
  Trash2,
  X,
  Loader2,
  AlertCircle,
  ChevronRight,
  Eye,
  MapPin,
  Phone,
  Hash,
  Calendar,
  CheckCircle2,
  XCircle,
  PauseCircle,
} from "lucide-react";
import { AppShell, Card, StatCard } from "@/components/app-shell";
import { Badge } from "@/components/ui/badge";
import { useDeleteCooperative } from "@/hooks/cooperatives/useCooperatives";
import {
  useCooperativeProfiles,
  type CooperativeProfile,
} from "@/hooks/cooperatives/useCooperativeProfile";
import { CooperativeProfileForm } from "@/pages/apex/CooperativeProfile";
import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

const STATUS_TONE: Record<
  string,
  { variant: "default" | "secondary" | "destructive"; icon: typeof CheckCircle2 }
> = {
  Active: { variant: "default", icon: CheckCircle2 },
  Inactive: { variant: "secondary", icon: PauseCircle },
  Suspended: { variant: "destructive", icon: XCircle },
};

function StatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status] ?? STATUS_TONE["Active"];
  const Icon = tone.icon;
  return (
    <Badge variant={tone.variant} className="gap-1">
      <Icon className="size-3" />
      {status}
    </Badge>
  );
}

export const CooperativesPage: React.FC = () => {
  const navigate = useNavigate();
  const { data: cooperatives, isLoading, error } = useCooperativeProfiles();
  const deleteCoop = useDeleteCooperative();

  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [deletingCoop, setDeletingCoop] = useState<CooperativeProfile | null>(null);

  const handleDelete = () => {
    if (!deletingCoop) return;
    deleteCoop.mutate(deletingCoop.keycloak_id ?? deletingCoop.id, {
      onSuccess: () => {
        toast.success(`Deleted "${deletingCoop.name}"`);
        setDeletingCoop(null);
      },
      onError: (err) => toast.error("Failed to delete", { description: String(err) }),
    });
  };

  const allCoops = cooperatives ?? [];

  const filtered = allCoops.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.reg_no ?? "").toLowerCase().includes(q) ||
      (c.region ?? "").toLowerCase().includes(q) ||
      (c.sector ?? "").toLowerCase().includes(q) ||
      (c.institution_type ?? "").toLowerCase().includes(q)
    );
  });

  const activeCount = allCoops.filter((c) => c.status === "Active").length;
  const suspendedCount = allCoops.filter((c) => c.status === "Suspended").length;
  const inactiveCount = allCoops.filter((c) => c.status === "Inactive").length;
  const saccoCount = allCoops.filter((c) => c.institution_type === "sacco").length;

  if (isLoading) {
    return (
      <AppShell title="Cooperative Management" subtitle="Manage cooperatives under your apex">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (error) {
    return (
      <AppShell title="Cooperative Management" subtitle="Manage cooperatives under your apex">
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <AlertCircle className="size-8 mb-2 text-destructive" />
          <p className="font-semibold text-sm">Failed to load cooperatives</p>
          <p className="text-xs mt-1">{String(error)}</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Cooperative Management"
      subtitle="Create and manage cooperatives under your apex"
      actions={
        <button
          onClick={() => setIsCreateOpen(true)}
          className="press-feedback inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-[var(--shadow-elev-2)]"
        >
          <Plus className="size-4" /> Register cooperative
        </button>
      }
    >
      <div className="-m-2 space-y-6 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-3 shadow-inner">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={Building2}
            label="Total Cooperatives"
            value={String(allCoops.length)}
            subtitle="Under your apex"
            tone="primary"
          />
          <StatCard
            icon={CheckCircle2}
            label="Active"
            value={String(activeCount)}
            subtitle="Operational"
            tone="success"
          />
          <StatCard
            icon={PauseCircle}
            label="Inactive / Suspended"
            value={String(inactiveCount + suspendedCount)}
            subtitle={`${inactiveCount} inactive, ${suspendedCount} suspended`}
            tone="warning"
          />
          <StatCard
            icon={Building2}
            label="SACCOs"
            value={String(saccoCount)}
            subtitle="Savings & credit coops"
            tone="accent"
          />
        </div>

        <Card title="Cooperative Directory" subtitle="Search, view, edit and manage cooperatives">
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="relative min-w-[280px] max-w-md w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name, reg no, region, sector..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-900 placeholder:text-slate-500 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10"
              />
            </div>
          </div>

          <div className="-mx-5 -mb-5 overflow-x-auto border-t border-slate-200 bg-white">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/90 text-[10px] uppercase tracking-wider text-slate-700 font-bold">
                  <th className="px-5 py-3.5">Cooperative</th>
                  <th className="px-5 py-3.5 hidden lg:table-cell">Reg No</th>
                  <th className="px-5 py-3.5 hidden md:table-cell">Type</th>
                  <th className="px-5 py-3.5 hidden lg:table-cell">Region</th>
                  <th className="px-5 py-3.5 hidden xl:table-cell">Sector</th>
                  <th className="px-5 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-600">
                      <div className="flex flex-col items-center justify-center">
                        <Building2 className="size-8 text-slate-400 mb-2" />
                        <p className="font-bold text-sm text-slate-900">
                          {allCoops.length === 0
                            ? "No cooperatives registered yet"
                            : "No cooperatives match your search"}
                        </p>
                        <p className="text-xs mt-1">
                          {allCoops.length === 0
                            ? "Register your first cooperative to get started."
                            : "Try adjusting your search."}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() =>
                        navigate({
                          to: "/app/cooperative/$cooperativeId",
                          params: { cooperativeId: c.id },
                        })
                      }
                      className="group cursor-pointer hover:bg-sky-50/60 transition-colors duration-150"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
                            <Building2 className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-950 leading-tight">{c.name}</p>
                            <p className="mt-0.5 text-xs text-slate-500 truncate max-w-[200px]">
                              {c.phone ?? "—"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell">
                        <span className="font-mono text-xs text-slate-700">{c.reg_no ?? "—"}</span>
                      </td>
                      <td className="px-5 py-4 hidden md:table-cell">
                        <span className="text-xs font-medium text-slate-700 capitalize">
                          {c.institution_type ?? "—"}
                        </span>
                      </td>
                      <td className="px-5 py-4 hidden lg:table-cell text-xs text-slate-700">
                        {c.region ?? "—"}
                      </td>
                      <td className="px-5 py-4 hidden xl:table-cell text-xs text-slate-700">
                        {c.sector ?? "—"}
                      </td>
                      <td className="px-5 py-4">
                        <StatusBadge status={c.status} />
                      </td>
                      <td className="px-5 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() =>
                              navigate({
                                to: "/app/cooperative/$cooperativeId",
                                params: { cooperativeId: c.id },
                              })
                            }
                            title="View details"
                            className="press-feedback inline-flex items-center justify-center size-8 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-100"
                          >
                            <Eye className="size-3.5" />
                          </button>
                          {c.keycloak_id && (
                            <Link
                              to="/app/cooperative-members/$cooperativeId"
                              params={{ cooperativeId: c.keycloak_id }}
                              title="Manage members"
                              className="press-feedback inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-100"
                            >
                              <Users className="size-3.5" />
                              <ChevronRight className="size-3" />
                            </Link>
                          )}
                          <Link
                            to="/app/cooperative-profile/$cooperativeId"
                            params={{ cooperativeId: c.id }}
                            title="Edit profile"
                            className="press-feedback inline-flex items-center justify-center size-8 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-100"
                          >
                            <Pencil className="size-3.5" />
                          </Link>
                          <button
                            onClick={() => setDeletingCoop(c)}
                            className="press-feedback inline-flex items-center justify-center size-8 rounded-lg border border-red-200 bg-red-50 text-red-700 shadow-sm transition-colors hover:border-red-300 hover:bg-red-100"
                            title="Delete"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs font-semibold text-slate-600">
            <p>
              Showing {filtered.length} of {allCoops.length} cooperatives
            </p>
          </div>
        </Card>
      </div>

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div
            onClick={() => setIsCreateOpen(false)}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-2xl my-8 z-10">
            <div className="flex items-center justify-between mb-2 px-2">
              <div className="flex items-center gap-2">
                <Building2 className="size-5 text-accent" />
                <h3 className="font-heading text-lg font-bold text-foreground">
                  Register New Cooperative
                </h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="press-feedback rounded-lg p-1 hover:bg-muted text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <CooperativeProfileForm onSuccess={() => setIsCreateOpen(false)} />
          </div>
        </div>
      )}

      {deletingCoop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setDeletingCoop(null)}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-sm rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-elev-3)] animate-panel z-10">
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="size-5 text-destructive" />
              <h3 className="font-heading text-lg font-bold text-foreground">Delete Cooperative</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              Are you sure you want to delete{" "}
              <strong className="text-foreground">{deletingCoop.name}</strong>? This cannot be
              undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeletingCoop(null)}
                className="press-feedback px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteCoop.isPending}
                className="press-feedback px-4 py-2 rounded-lg bg-destructive text-xs font-semibold text-destructive-foreground hover:bg-destructive/95 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                {deleteCoop.isPending && <Loader2 className="size-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};
