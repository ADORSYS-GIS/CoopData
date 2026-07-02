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
} from "lucide-react";
import { AppShell, Card, StatCard } from "@/components/app-shell";
import {
  useCooperatives,
  useCreateCooperative,
  useUpdateCooperative,
  useDeleteCooperative,
} from "@/hooks/cooperatives/useCooperatives";
import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";

type CoopItem = { id: string; name: string; description?: string | null; path?: string | null };

export const CooperativesPage: React.FC = () => {
  const { data: rawData, isLoading, error } = useCooperatives();
  const createCoop = useCreateCooperative();
  const updateCoop = useUpdateCooperative();
  const deleteCoop = useDeleteCooperative();

  const cooperatives: CoopItem[] = (rawData as CoopItem[]) ?? [];

  const [search, setSearch] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCoop, setEditingCoop] = useState<CoopItem | null>(null);
  const [deletingCoop, setDeletingCoop] = useState<CoopItem | null>(null);

  const [createName, setCreateName] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const name = createName.trim();
    if (!name) {
      toast.error("Cooperative name is required.");
      return;
    }
    createCoop.mutate(
      { name, description: createDescription.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(`Cooperative "${name}" created.`);
          setIsCreateOpen(false);
          setCreateName("");
          setCreateDescription("");
        },
        onError: (err) => toast.error("Failed to create cooperative", { description: String(err) }),
      },
    );
  };

  const handleEdit = (coop: CoopItem) => {
    setEditingCoop(coop);
    setEditName(coop.name);
    setEditDescription(coop.description ?? "");
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCoop) return;
    const name = editName.trim();
    if (!name) {
      toast.error("Cooperative name is required.");
      return;
    }
    updateCoop.mutate(
      { id: editingCoop.id, name, description: editDescription.trim() || undefined },
      {
        onSuccess: () => {
          toast.success(`Updated "${name}"`);
          setEditingCoop(null);
        },
        onError: (err) => toast.error("Failed to update", { description: String(err) }),
      },
    );
  };

  const handleDelete = () => {
    if (!deletingCoop) return;
    deleteCoop.mutate(deletingCoop.id, {
      onSuccess: () => {
        toast.success(`Deleted "${deletingCoop.name}"`);
        setDeletingCoop(null);
      },
      onError: (err) => toast.error("Failed to delete", { description: String(err) }),
    });
  };

  const filtered = cooperatives.filter((c) => {
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || (c.description ?? "").toLowerCase().includes(q);
  });

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
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <StatCard
            icon={Building2}
            label="Total Cooperatives"
            value={String(cooperatives.length)}
            subtitle="Under your apex"
            tone="primary"
          />
          <StatCard
            icon={Building2}
            label="Shown"
            value={String(filtered.length)}
            subtitle="Matching filter"
            tone="accent"
          />
          <StatCard
            icon={Users}
            label="With Description"
            value={String(cooperatives.filter((c) => c.description).length)}
            subtitle="Having a description"
            tone="info"
          />
        </div>

        <Card title="Cooperative Directory" subtitle="Search, edit and manage cooperatives">
          <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/70 px-4 py-3">
            <div className="relative min-w-[280px] max-w-md w-full">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or description..."
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm font-medium text-slate-900 placeholder:text-slate-500 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/10"
              />
            </div>
          </div>

          <div className="-mx-5 -mb-5 overflow-x-auto border-t border-slate-200 bg-white">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-100/90 text-[10px] uppercase tracking-wider text-slate-700 font-bold">
                  <th className="px-5 py-3.5">Cooperative</th>
                  <th className="px-5 py-3.5 hidden md:table-cell">Description</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-slate-600">
                      <div className="flex flex-col items-center justify-center">
                        <Building2 className="size-8 text-slate-400 mb-2" />
                        <p className="font-bold text-sm text-slate-900">
                          {cooperatives.length === 0
                            ? "No cooperatives registered yet"
                            : "No cooperatives match your search"}
                        </p>
                        <p className="text-xs mt-1">
                          {cooperatives.length === 0
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
                      className="group hover:bg-sky-50/60 transition-colors duration-150"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700">
                            <Building2 className="size-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-950 leading-tight">{c.name}</p>
                            <p className="mt-1 max-w-[240px] truncate font-mono text-[10px] text-slate-500">
                              {c.id}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-700 text-xs hidden md:table-cell max-w-[260px] truncate">
                        {c.description ?? "—"}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to="/app/cooperative-members/$cooperativeId"
                            params={{ cooperativeId: c.id }}
                            title="Manage members"
                            className="press-feedback inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700 shadow-sm transition-colors hover:border-sky-300 hover:bg-sky-100"
                          >
                            <Users className="size-3.5" />
                            Members
                            <ChevronRight className="size-3" />
                          </Link>
                          <button
                            onClick={() => handleEdit(c)}
                            className="press-feedback inline-flex items-center justify-center size-8 rounded-lg border border-amber-200 bg-amber-50 text-amber-700 shadow-sm transition-colors hover:border-amber-300 hover:bg-amber-100"
                            title="Edit"
                          >
                            <Pencil className="size-3.5" />
                          </button>
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
              Showing {filtered.length} of {cooperatives.length} cooperatives
            </p>
          </div>
        </Card>
      </div>

      {/* Create Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setIsCreateOpen(false)}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-elev-3)] animate-panel z-10">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Building2 className="size-5 text-accent" />
                <h3 className="font-heading text-lg font-bold text-foreground">
                  Register Cooperative
                </h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="press-feedback rounded-lg p-1 hover:bg-muted text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Cooperative Name *
                </label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="e.g. Manzini Dairy Cooperative"
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Description
                </label>
                <textarea
                  value={createDescription}
                  onChange={(e) => setCreateDescription(e.target.value)}
                  placeholder="Optional description"
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="press-feedback px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createCoop.isPending}
                  className="press-feedback px-4 py-2 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {createCoop.isPending && <Loader2 className="size-3.5 animate-spin" />}
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingCoop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            onClick={() => setEditingCoop(null)}
            className="absolute inset-0 bg-background/60 backdrop-blur-sm"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-[var(--shadow-elev-3)] animate-panel z-10">
            <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Pencil className="size-5 text-accent" />
                <h3 className="font-heading text-lg font-bold text-foreground">Edit Cooperative</h3>
              </div>
              <button
                onClick={() => setEditingCoop(null)}
                className="press-feedback rounded-lg p-1 hover:bg-muted text-muted-foreground"
              >
                <X className="size-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/10 transition-all resize-none"
                />
              </div>
              <div className="flex justify-end gap-2 border-t border-border pt-3">
                <button
                  type="button"
                  onClick={() => setEditingCoop(null)}
                  className="press-feedback px-4 py-2 rounded-lg border border-border text-xs font-semibold text-foreground hover:bg-muted/40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={updateCoop.isPending}
                  className="press-feedback px-4 py-2 rounded-lg bg-primary text-xs font-semibold text-primary-foreground hover:bg-primary/95 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {updateCoop.isPending && <Loader2 className="size-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
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
